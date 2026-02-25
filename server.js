const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const multer = require("multer");
const { randomUUID, randomBytes, scryptSync, timingSafeEqual } = require("crypto");

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fsSync.existsSync(envPath)) return;
  const raw = fsSync.readFileSync(envPath, "utf-8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) return;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadLocalEnv();

const app = express();
const PORT = process.env.PORT || 5170;
app.disable("x-powered-by");

const DATA_PATH = path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const MODELS_DIR = path.join(UPLOADS_DIR, "models");
const SCANS_DIR = path.join(UPLOADS_DIR, "scans");
const JOB_IMAGES_DIR = path.join(UPLOADS_DIR, "job-images");
const MESHY_API_BASE = "https://api.meshy.ai/openapi/v1";
const MESHY_DEFAULT_MODEL = process.env.MESHY_AI_MODEL || "meshy-6";
const MESHY_MAX_REFERENCE_IMAGES = Number(process.env.MESHY_MAX_REFERENCE_IMAGES || 4);
const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS || 24 * 60 * 60 * 1000);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 6);
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MS || 15 * 60 * 1000);

const tokens = new Map();
const loginAttempts = new Map();
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MODEL_EXTENSIONS = new Set([".glb", ".usdz"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return (value || "").toString().trim().toLowerCase();
}

function hashPassword(plainPassword) {
  const password = (plainPassword || "").toString();
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPasswordHash(plainPassword, passwordHash) {
  const parts = (passwordHash || "").toString().split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, storedHashHex] = parts;
  if (!salt || !storedHashHex) return false;
  try {
    const computedHashHex = scryptSync((plainPassword || "").toString(), salt, 64).toString("hex");
    const storedHash = Buffer.from(storedHashHex, "hex");
    const computedHash = Buffer.from(computedHashHex, "hex");
    if (storedHash.length !== computedHash.length) {
      return false;
    }
    return timingSafeEqual(storedHash, computedHash);
  } catch (err) {
    return false;
  }
}

function verifyUserPassword(user, plainPassword) {
  if (user && user.passwordHash) {
    return verifyPasswordHash(plainPassword, user.passwordHash);
  }
  return user && user.password === plainPassword;
}

function isPasswordValid(password) {
  const value = (password || "").toString();
  return value.length >= 8 && value.length <= 128;
}

function getClientIp(req) {
  const forwarded = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
  if (forwarded) return forwarded;
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "unknown";
}

function getLoginAttempt(ip) {
  const key = ip || "unknown";
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current) return { key, state: null, now };

  if (current.lockedUntil && current.lockedUntil > now) {
    return { key, state: current, now };
  }
  if (now - current.firstFailedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { key, state: null, now };
  }
  if (current.lockedUntil && current.lockedUntil <= now) {
    loginAttempts.delete(key);
    return { key, state: null, now };
  }
  return { key, state: current, now };
}

function isLoginBlocked(ip) {
  const { state, now } = getLoginAttempt(ip);
  if (!state || !state.lockedUntil || state.lockedUntil <= now) {
    return { blocked: false, retryAfterSeconds: 0 };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
  return { blocked: true, retryAfterSeconds };
}

function registerLoginFailure(ip) {
  const { key, state, now } = getLoginAttempt(ip);
  if (!state) {
    loginAttempts.set(key, { count: 1, firstFailedAt: now, lockedUntil: 0 });
    return;
  }
  const nextCount = state.count + 1;
  const nextState = { ...state, count: nextCount };
  if (nextCount >= LOGIN_MAX_ATTEMPTS) {
    nextState.lockedUntil = now + LOGIN_LOCK_MS;
  }
  loginAttempts.set(key, nextState);
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip || "unknown");
}

function ensureDirSync(dir) {
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
}

function normalizeSlug(text) {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function readDb() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fs.writeFile(DATA_PATH, JSON.stringify(db, null, 2));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { id, email, role, restaurantId } = user;
  return { id, email, role, restaurantId };
}

function getToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function requireAuth(req, res, next) {
  const token = getToken(req);
  const session = tokens.get(token);
  if (!session || !session.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (session.expiresAt <= Date.now()) {
    tokens.delete(token);
    return res.status(401).json({ error: "unauthorized" });
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    tokens.delete(token);
    return res.status(401).json({ error: "unauthorized" });
  }
  session.expiresAt = Date.now() + TOKEN_TTL_MS;
  tokens.set(token, session);
  req.user = user;
  req.db = db;
  next();
}

function requireMaster(req, res, next) {
  if (req.user.role !== "master") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}

function canAccessRestaurant(user, restaurantId) {
  return user.role === "master" || user.restaurantId === restaurantId;
}

function findRestaurant(db, id) {
  return db.restaurants.find((r) => r.id === id);
}

function findItem(db, id) {
  return db.items.find((i) => i.id === id);
}

function authorizeRestaurant(req, res, next) {
  const restaurant = findRestaurant(req.db, req.params.id);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  if (!canAccessRestaurant(req.user, restaurant.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  req.restaurant = restaurant;
  next();
}

function authorizeItem(req, res, next) {
  const item = findItem(req.db, req.params.id);
  if (!item) {
    return res.status(404).json({ error: "item_not_found" });
  }
  if (!canAccessRestaurant(req.user, item.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  req.item = item;
  next();
}

function ensureUploads() {
  ensureDirSync(UPLOADS_DIR);
  ensureDirSync(IMAGES_DIR);
  ensureDirSync(MODELS_DIR);
  ensureDirSync(SCANS_DIR);
  ensureDirSync(JOB_IMAGES_DIR);
}

function ensureOrders(db) {
  if (!Array.isArray(db.orders)) {
    db.orders = [];
  }
}

function ensureModelJobs(db) {
  if (!Array.isArray(db.modelJobs)) {
    db.modelJobs = [];
  }
}

async function removeDirIfExists(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    // ignore cleanup errors
  }
}

function getAiProviders() {
  const hasMeshy = Boolean(process.env.MESHY_API_KEY);
  return [
    {
      id: "meshy",
      label: "Meshy",
      enabled: hasMeshy,
      supportsAuto: true,
      supportsMultiImage: true,
      notes: hasMeshy
        ? `Pronto para gerar 3D (ate ${MESHY_MAX_REFERENCE_IMAGES} fotos por job).`
        : "Defina MESHY_API_KEY para habilitar."
    },
    {
      id: "manual",
      label: "Manual",
      enabled: true,
      supportsAuto: false,
      notes: "Pipeline assistido por voce (scanner + blender)."
    }
  ];
}

function getAiProvider(providerId) {
  return getAiProviders().find((provider) => provider.id === providerId);
}

function urlToUploadFilePath(urlValue) {
  if (!urlValue || !urlValue.startsWith("/uploads/")) return "";
  const relativePath = decodeURIComponent(urlValue.replace(/^\/uploads\//, ""));
  const candidate = path.resolve(UPLOADS_DIR, relativePath);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!candidate.startsWith(`${uploadsRoot}${path.sep}`) && candidate !== uploadsRoot) {
    return "";
  }
  return candidate;
}

function extensionToMime(ext) {
  const value = ext.toLowerCase();
  if (value === ".jpg" || value === ".jpeg") return "image/jpeg";
  if (value === ".png") return "image/png";
  if (value === ".webp") return "image/webp";
  return "";
}

function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function fileExt(filename) {
  return (path.extname(filename || "") || "").toLowerCase();
}

function isImageFile(file) {
  return IMAGE_EXTENSIONS.has(fileExt(file && file.originalname));
}

function isModelFile(file, expectedExt) {
  const ext = fileExt(file && file.originalname);
  if (!MODEL_EXTENSIONS.has(ext)) return false;
  return ext === expectedExt;
}

async function localImageToDataUri(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return "";
  }
  const mime = extensionToMime(ext);
  if (!mime) return "";
  const buffer = await fs.readFile(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function resolveImageCandidate(candidate) {
  if (!candidate) return "";
  if (isRemoteHttpUrl(candidate)) {
    const ext = path.extname(new URL(candidate).pathname || "").toLowerCase();
    if (ext && !IMAGE_EXTENSIONS.has(ext)) {
      return "";
    }
    return candidate;
  }
  const localPath = urlToUploadFilePath(candidate);
  if (!localPath) return "";
  return localImageToDataUri(localPath);
}

async function buildJobImageInputs(item, job) {
  const referenceImages = Array.isArray(job && job.referenceImages)
    ? [...job.referenceImages].reverse()
    : [];
  const scans = Array.isArray(item.scans) ? [...item.scans].reverse() : [];
  const orderedCandidates = [
    ...referenceImages,
    ...scans,
    item.image || ""
  ].filter(Boolean);
  const unique = [];
  const seen = new Set();

  for (const candidate of orderedCandidates) {
    const imageInput = await resolveImageCandidate(candidate);
    if (!imageInput || seen.has(imageInput)) continue;
    seen.add(imageInput);
    unique.push(imageInput);
    if (unique.length >= MESHY_MAX_REFERENCE_IMAGES) break;
  }

  return unique;
}

function mapMeshyStatus(meshyStatus) {
  const status = (meshyStatus || "").toString().toUpperCase();
  if (status === "SUCCEEDED" || status === "COMPLETED") return "revisao";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "erro";
  return "processando";
}

function extractMeshyTaskId(payload) {
  if (!payload || typeof payload !== "object") return "";
  const candidates = [
    payload.result,
    payload.id,
    payload.task_id,
    payload.taskId,
    payload.task && payload.task.id,
    payload.data && payload.data.id,
    payload.result && payload.result.id
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function buildMeshyStartRequest(imageInputs, options = {}) {
  const aiModel = (options.aiModel || MESHY_DEFAULT_MODEL || "").toString().trim();
  const payload = {
    should_texture: true
  };
  if (aiModel) payload.ai_model = aiModel;
  if (options.targetPolycount) {
    payload.target_polycount = Number(options.targetPolycount);
  }

  if (imageInputs.length > 1) {
    payload.image_urls = imageInputs.slice(0, MESHY_MAX_REFERENCE_IMAGES);
    return { endpoint: "multi-image-to-3d", payload };
  }

  payload.image_url = imageInputs[0];
  return { endpoint: "image-to-3d", payload };
}

async function startMeshyImageTo3D(imageInputs, options = {}) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    throw new Error("meshy_key_missing");
  }
  const normalizedInputs = Array.isArray(imageInputs)
    ? imageInputs.filter(Boolean)
    : [imageInputs].filter(Boolean);
  if (!normalizedInputs.length) {
    throw new Error("meshy_image_input_missing");
  }
  const { endpoint, payload } = buildMeshyStartRequest(normalizedInputs, options);
  const res = await fetch(`${MESHY_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `meshy_start_failed:${endpoint}:${res.status}:${errorBody.slice(0, 300)}`
    );
  }
  const data = await res.json();
  const taskId = extractMeshyTaskId(data);
  if (!taskId) {
    throw new Error("meshy_task_id_missing");
  }
  return { taskId, endpoint };
}

function getMeshyTaskEndpoints(endpointHint) {
  const hint = (endpointHint || "").toString().toLowerCase().trim();
  const ordered = [];
  if (hint.includes("multi-image-to-3d")) {
    ordered.push("multi-image-to-3d", "image-to-3d");
  } else if (hint.includes("image-to-3d")) {
    ordered.push("image-to-3d", "multi-image-to-3d");
  } else {
    ordered.push("image-to-3d", "multi-image-to-3d");
  }
  return [...new Set(ordered)];
}

async function fetchMeshyTask(taskId, endpointHint = "") {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    throw new Error("meshy_key_missing");
  }
  const triedErrors = [];
  for (const endpoint of getMeshyTaskEndpoints(endpointHint)) {
    const res = await fetch(`${MESHY_API_BASE}/${endpoint}/${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (res.ok) {
      const task = await res.json();
      return { endpoint, task };
    }
    const errorBody = await res.text();
    triedErrors.push(`${endpoint}:${res.status}:${errorBody.slice(0, 200)}`);
    if (res.status !== 404) {
      break;
    }
  }
  throw new Error(`meshy_sync_failed:${triedErrors.join(" | ")}`);
}

function extractMeshyModelUrls(taskData) {
  const containers = [
    taskData && taskData.model_urls,
    taskData && taskData.result && taskData.result.model_urls,
    taskData && taskData.result && taskData.result.modelUrls,
    taskData && taskData.output && taskData.output.model_urls,
    taskData && taskData.data && taskData.data.model_urls
  ].filter(Boolean);

  const urls = {};
  containers.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (!urls.glb && isRemoteHttpUrl(entry.glb)) urls.glb = entry.glb;
    if (!urls.usdz && isRemoteHttpUrl(entry.usdz)) urls.usdz = entry.usdz;
  });

  if (!urls.glb) {
    const glbCandidates = [
      taskData && taskData.glb_url,
      taskData && taskData.result && taskData.result.glb_url
    ];
    const glb = glbCandidates.find((value) => isRemoteHttpUrl(value));
    if (glb) urls.glb = glb;
  }

  if (!urls.usdz) {
    const usdzCandidates = [
      taskData && taskData.usdz_url,
      taskData && taskData.result && taskData.result.usdz_url
    ];
    const usdz = usdzCandidates.find((value) => isRemoteHttpUrl(value));
    if (usdz) urls.usdz = usdz;
  }

  return urls;
}

async function downloadModelToUploads(urlValue, extension) {
  if (!isRemoteHttpUrl(urlValue)) return "";
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const filename = `${randomUUID()}${ext}`;
  const destPath = path.join(MODELS_DIR, filename);
  const res = await fetch(urlValue);
  if (!res.ok) {
    throw new Error(`model_download_failed:${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  return `/uploads/models/${filename}`;
}

ensureUploads();

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if ((req.headers["x-forwarded-proto"] || "").toString().toLowerCase() === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/r/:slug", async (req, res) => {
  const params = new URLSearchParams(req.query);
  params.set("r", req.params.slug);

  try {
    const db = await readDb();
    const restaurant = db.restaurants.find((r) => r.slug === req.params.slug);
    if (restaurant && restaurant.template === "topo-do-mundo") {
      return res.redirect(`/templates/topo-do-mundo.html?${params.toString()}`);
    }
  } catch (err) {
    // Fallback to default menu page if DB read fails.
  }

  res.redirect(`/?${params.toString()}`);
});

app.get("/i/:id", (req, res) => {
  res.redirect(`/item.html?id=${encodeURIComponent(req.params.id)}`);
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/api/public/restaurants", async (req, res) => {
  const db = await readDb();
  const itemCounts = new Map();
  (db.items || []).forEach((item) => {
    itemCounts.set(item.restaurantId, (itemCounts.get(item.restaurantId) || 0) + 1);
  });

  const restaurants = (db.restaurants || [])
    .map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description || "",
      logo: restaurant.logo || "",
      template: restaurant.template || "default",
      itemCount: itemCounts.get(restaurant.id) || 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  res.json({ restaurants });
});

app.get("/api/public/restaurant/:slug", async (req, res) => {
  const db = await readDb();
  const restaurant = db.restaurants.find((r) => r.slug === req.params.slug);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  const items = db.items.filter((i) => i.restaurantId === restaurant.id);
  res.json({ restaurant, items });
});

app.get("/api/public/item/:id", async (req, res) => {
  const db = await readDb();
  const item = findItem(db, req.params.id);
  if (!item) {
    return res.status(404).json({ error: "item_not_found" });
  }
  const restaurant = findRestaurant(db, item.restaurantId);
  res.json({ item, restaurant });
});

app.post("/api/login", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = (req.body && req.body.password ? req.body.password : "").toString();
  const ip = getClientIp(req);
  const lockState = isLoginBlocked(ip);
  if (lockState.blocked) {
    res.setHeader("Retry-After", String(lockState.retryAfterSeconds));
    return res.status(429).json({ error: "too_many_attempts" });
  }
  if (!email || !password) {
    registerLoginFailure(ip);
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const db = await readDb();
  const user = db.users.find((u) => normalizeEmail(u.email) === email);
  if (!user || !verifyUserPassword(user, password)) {
    registerLoginFailure(ip);
    return res.status(401).json({ error: "invalid_credentials" });
  }
  clearLoginFailures(ip);

  let changed = false;
  if (user.email !== email) {
    user.email = email;
    changed = true;
  }
  if (!user.passwordHash) {
    user.passwordHash = hashPassword(password);
    delete user.password;
    changed = true;
  }
  if (changed) {
    await writeDb(db);
  }

  const token = randomUUID();
  tokens.set(token, {
    userId: user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS
  });
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/me", requireAuth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get("/api/ai/providers", requireAuth, async (req, res) => {
  res.json({ providers: getAiProviders() });
});

app.get("/api/my-restaurant", requireAuth, async (req, res) => {
  if (req.user.role !== "client" || !req.user.restaurantId) {
    return res.status(403).json({ error: "forbidden" });
  }
  const restaurant = findRestaurant(req.db, req.user.restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  res.json({ restaurant });
});

app.post("/api/logout", requireAuth, async (req, res) => {
  const token = getToken(req);
  tokens.delete(token);
  res.json({ ok: true });
});

app.get("/api/restaurants", requireAuth, requireMaster, async (req, res) => {
  res.json({ restaurants: req.db.restaurants });
});

app.post("/api/restaurants", requireAuth, requireMaster, async (req, res) => {
  const db = req.db;
  const { name, description } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: "name_required" });
  }
  const slug = normalizeSlug(req.body.slug || name);
  if (!slug) {
    return res.status(400).json({ error: "slug_invalid" });
  }
  if (db.restaurants.some((r) => r.slug === slug)) {
    return res.status(400).json({ error: "slug_in_use" });
  }
  const restaurant = {
    id: `r-${randomUUID()}`,
    name,
    slug,
    description: description || "",
    logo: req.body.logo || "",
    theme: { accent: req.body.accent || "#D95F2B" },
    template: req.body.template || "default"
  };
  db.restaurants.push(restaurant);
  await writeDb(db);
  res.json({ restaurant });
});

app.put("/api/restaurants/:id", requireAuth, authorizeRestaurant, async (req, res) => {
  const db = req.db;
  const restaurant = req.restaurant;
  restaurant.name = req.body.name || restaurant.name;
  restaurant.description = req.body.description || restaurant.description;
  if (req.body.slug) {
    const slug = normalizeSlug(req.body.slug);
    if (slug && slug !== restaurant.slug) {
      if (db.restaurants.some((r) => r.slug === slug)) {
        return res.status(400).json({ error: "slug_in_use" });
      }
      restaurant.slug = slug;
    }
  }
  if (req.body.logo !== undefined) restaurant.logo = req.body.logo;
  if (req.body.accent) restaurant.theme.accent = req.body.accent;
  if (req.body.template !== undefined) {
    restaurant.template = req.body.template || "default";
  }
  await writeDb(db);
  res.json({ restaurant });
});

app.post(
  "/api/restaurants/:id/users",
  requireAuth,
  requireMaster,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    const email = normalizeEmail(req.body && req.body.email);
    const password = (req.body && req.body.password ? req.body.password : "").toString();
    if (!email || !password) {
      return res.status(400).json({ error: "email_password_required" });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "email_invalid" });
    }
    if (!isPasswordValid(password)) {
      return res.status(400).json({ error: "password_too_weak" });
    }
    if (db.users.some((u) => normalizeEmail(u.email) === email)) {
      return res.status(400).json({ error: "email_in_use" });
    }
    const user = {
      id: `u-${randomUUID()}`,
      email,
      passwordHash: hashPassword(password),
      role: "client",
      restaurantId: req.restaurant.id
    };
    db.users.push(user);
    await writeDb(db);
    res.json({ user: sanitizeUser(user) });
  }
);

app.get(
  "/api/restaurants/:id/items",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    const items = db.items.filter((i) => i.restaurantId === req.restaurant.id);
    res.json({ items });
  }
);

app.post(
  "/api/restaurants/:id/items",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    const { name, description, price } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: "name_required" });
    }
    const item = {
      id: `i-${randomUUID()}`,
      restaurantId: req.restaurant.id,
      name,
      description: description || "",
      price: Number(price) || 0,
      image: req.body.image || "",
      modelGlb: req.body.modelGlb || "",
      modelUsdz: req.body.modelUsdz || "",
      scans: []
    };
    db.items.push(item);
    await writeDb(db);
    res.json({ item });
  }
);

app.put("/api/items/:id", requireAuth, authorizeItem, async (req, res) => {
  const db = req.db;
  const item = req.item;
  if (req.body.name) item.name = req.body.name;
  if (req.body.description !== undefined) item.description = req.body.description;
  if (req.body.price !== undefined) item.price = Number(req.body.price) || 0;
  if (req.body.image !== undefined) item.image = req.body.image;
  if (req.body.modelGlb !== undefined) item.modelGlb = req.body.modelGlb;
  if (req.body.modelUsdz !== undefined) item.modelUsdz = req.body.modelUsdz;
  await writeDb(db);
  res.json({ item });
});

app.delete("/api/items/:id", requireAuth, authorizeItem, async (req, res) => {
  const db = req.db;
  const item = req.item;
  ensureModelJobs(db);
  const removedJobs = db.modelJobs.filter((job) => job.itemId === item.id);

  db.items = db.items.filter((entry) => entry.id !== item.id);
  db.modelJobs = db.modelJobs.filter((job) => job.itemId !== item.id);

  await writeDb(db);

  await removeDirIfExists(path.join(SCANS_DIR, item.id));
  for (const job of removedJobs) {
    await removeDirIfExists(path.join(JOB_IMAGES_DIR, job.id));
  }

  res.json({
    ok: true,
    removedItemId: item.id,
    removedModelJobs: removedJobs.map((job) => job.id)
  });
});

app.post("/api/public/orders", async (req, res) => {
  const db = await readDb();
  ensureOrders(db);
  const { restaurantSlug, table, items } = req.body || {};
  if (!restaurantSlug) {
    return res.status(400).json({ error: "restaurant_required" });
  }
  const restaurant = db.restaurants.find((r) => r.slug === restaurantSlug);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  const tableValue = (table || "").toString().trim();
  if (!tableValue) {
    return res.status(400).json({ error: "table_required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items_required" });
  }
  const menuItems = db.items.filter((i) => i.restaurantId === restaurant.id);
  const menuMap = new Map(menuItems.map((i) => [i.id, i]));
  const orderItems = [];
  let total = 0;

  items.forEach((entry) => {
    const menuItem = menuMap.get(entry.id);
    if (!menuItem) return;
    const qty = Math.max(1, Math.min(50, Number(entry.qty) || 1));
    const price = Number(menuItem.price) || 0;
    orderItems.push({
      id: menuItem.id,
      name: menuItem.name,
      price,
      qty
    });
    total += price * qty;
  });

  if (orderItems.length === 0) {
    return res.status(400).json({ error: "invalid_items" });
  }

  const order = {
    id: `o-${randomUUID()}`,
    restaurantId: restaurant.id,
    table: tableValue,
    items: orderItems,
    total: Math.round(total * 100) / 100,
    status: "novo",
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  await writeDb(db);
  res.json({ order });
});

app.get(
  "/api/restaurants/:id/orders",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    ensureOrders(db);
    const orders = db.orders
      .filter((order) => order.restaurantId === req.restaurant.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ orders });
  }
);

app.get(
  "/api/restaurants/:id/model-jobs",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    ensureModelJobs(db);
    const jobs = db.modelJobs
      .filter((job) => job.restaurantId === req.restaurant.id)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    res.json({ jobs });
  }
);

const modelJobImageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dir = path.join(JOB_IMAGES_DIR, req.params.id);
      ensureDirSync(dir);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  }
});

const uploadModelJobImages = multer({
  storage: modelJobImageStorage,
  limits: { files: 20, fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isImageFile(file)) {
      return cb(new Error("photos_invalid_type"));
    }
    cb(null, true);
  }
});

app.post(
  "/api/model-jobs/:id/images",
  requireAuth,
  uploadModelJobImages.array("photos", 20),
  async (req, res) => {
    const db = req.db;
    ensureModelJobs(db);
    const job = db.modelJobs.find((entry) => entry.id === req.params.id);
    if (!job) {
      return res.status(404).json({ error: "job_not_found" });
    }
    if (!canAccessRestaurant(req.user, job.restaurantId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: "photos_required" });
    }

    const urls = files.map(
      (file) => `/uploads/job-images/${req.params.id}/${file.filename}`
    );
    if (!Array.isArray(job.referenceImages)) {
      job.referenceImages = [];
    }
    job.referenceImages.push(...urls);
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.json({ urls, count: job.referenceImages.length, job });
  }
);

app.post(
  "/api/restaurants/:id/model-jobs",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    ensureModelJobs(db);
    const { itemId, sourceType, notes, autoMode, provider, aiModel } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ error: "item_required" });
    }
    const item = findItem(db, itemId);
    if (!item || item.restaurantId !== req.restaurant.id) {
      return res.status(400).json({ error: "item_invalid" });
    }
    const source = (sourceType || "").toString().trim();
    const allowedSources = new Set(["scanner", "upload", "api"]);
    if (!allowedSources.has(source)) {
      return res.status(400).json({ error: "source_invalid" });
    }
    const providerId = (provider || "manual").toString().trim().toLowerCase();
    const providerConfig = getAiProvider(providerId);
    if (!providerConfig) {
      return res.status(400).json({ error: "provider_invalid" });
    }

    const now = new Date().toISOString();
    const job = {
      id: `mj-${randomUUID()}`,
      restaurantId: req.restaurant.id,
      itemId: item.id,
      sourceType: source,
      provider: providerId,
      aiModel: (aiModel || "").toString().trim(),
      autoMode: Boolean(autoMode),
      status: "enviado",
      notes: (notes || "").toString().slice(0, 500),
      modelGlb: "",
      modelUsdz: "",
      referenceImages: [],
      providerTaskId: "",
      providerTaskEndpoint: "",
      providerStatus: "",
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.id
    };
    db.modelJobs.push(job);
    await writeDb(db);
    res.json({ job });
  }
);

app.put("/api/model-jobs/:id", requireAuth, async (req, res) => {
  const db = req.db;
  ensureModelJobs(db);
  const job = db.modelJobs.find((entry) => entry.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  if (!canAccessRestaurant(req.user, job.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const allowedStatus = new Set([
    "enviado",
    "triagem",
    "processando",
    "revisao",
    "publicado",
    "erro"
  ]);
  if (req.body.status !== undefined) {
    const status = (req.body.status || "").toString().toLowerCase();
    if (!allowedStatus.has(status)) {
      return res.status(400).json({ error: "status_invalid" });
    }
    job.status = status;
  }
  if (req.body.notes !== undefined) {
    job.notes = (req.body.notes || "").toString().slice(0, 500);
  }
  if (req.body.modelGlb !== undefined) {
    job.modelGlb = (req.body.modelGlb || "").toString().trim();
  }
  if (req.body.modelUsdz !== undefined) {
    job.modelUsdz = (req.body.modelUsdz || "").toString().trim();
  }
  if (req.body.provider !== undefined) {
    const providerId = (req.body.provider || "").toString().trim().toLowerCase();
    const providerConfig = getAiProvider(providerId);
    if (!providerConfig) {
      return res.status(400).json({ error: "provider_invalid" });
    }
    job.provider = providerId;
  }
  if (req.body.aiModel !== undefined) {
    job.aiModel = (req.body.aiModel || "").toString().trim();
  }
  job.updatedAt = new Date().toISOString();

  if (job.status === "publicado") {
    const item = findItem(db, job.itemId);
    if (item) {
      if (job.modelGlb) item.modelGlb = job.modelGlb;
      if (job.modelUsdz) item.modelUsdz = job.modelUsdz;
    }
  }

  await writeDb(db);
  res.json({ job });
});

app.delete("/api/model-jobs/:id", requireAuth, async (req, res) => {
  const db = req.db;
  ensureModelJobs(db);
  const job = db.modelJobs.find((entry) => entry.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  if (!canAccessRestaurant(req.user, job.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }

  db.modelJobs = db.modelJobs.filter((entry) => entry.id !== job.id);
  await writeDb(db);
  await removeDirIfExists(path.join(JOB_IMAGES_DIR, job.id));
  res.json({ ok: true, removedJobId: job.id });
});

app.post("/api/model-jobs/:id/ai/start", requireAuth, async (req, res) => {
  const db = req.db;
  ensureModelJobs(db);
  const job = db.modelJobs.find((entry) => entry.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  if (!canAccessRestaurant(req.user, job.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const item = findItem(db, job.itemId);
  if (!item) {
    return res.status(400).json({ error: "item_not_found" });
  }

  const providerId = (req.body.provider || job.provider || "manual")
    .toString()
    .trim()
    .toLowerCase();
  const provider = getAiProvider(providerId);
  if (!provider) {
    return res.status(400).json({ error: "provider_invalid" });
  }
  if (!provider.enabled) {
    return res.status(400).json({ error: "provider_not_configured" });
  }
  if (provider.id !== "meshy") {
    return res.status(400).json({ error: "provider_not_implemented" });
  }

  try {
    const imageInputs = await buildJobImageInputs(item, job);
    if (!imageInputs.length) {
      return res.status(400).json({ error: "image_source_not_found" });
    }

    const aiModel = (req.body.aiModel || job.aiModel || MESHY_DEFAULT_MODEL)
      .toString()
      .trim();
    const startResult = await startMeshyImageTo3D(imageInputs, {
      aiModel,
      targetPolycount: req.body.targetPolycount
    });

    job.provider = provider.id;
    job.aiModel = aiModel;
    job.providerTaskId = startResult.taskId;
    job.providerTaskEndpoint = startResult.endpoint || "";
    job.providerStatus = "SUBMITTED";
    job.status = "processando";
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.json({
      job,
      task: {
        id: startResult.taskId,
        endpoint: startResult.endpoint,
        imagesSent: imageInputs.length
      }
    });
  } catch (err) {
    job.providerStatus = "ERROR_ON_START";
    job.status = "erro";
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.status(502).json({ error: "ai_start_failed", detail: err.message });
  }
});

app.post("/api/model-jobs/:id/ai/sync", requireAuth, async (req, res) => {
  const db = req.db;
  ensureModelJobs(db);
  const job = db.modelJobs.find((entry) => entry.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  if (!canAccessRestaurant(req.user, job.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if ((job.provider || "") !== "meshy") {
    return res.status(400).json({ error: "provider_not_implemented" });
  }
  if (!job.providerTaskId) {
    return res.status(400).json({ error: "provider_task_missing" });
  }

  try {
    const providerSync = await fetchMeshyTask(
      job.providerTaskId,
      job.providerTaskEndpoint || ""
    );
    const taskData = providerSync.task || {};
    const taskStatus = (taskData.status || "").toString();
    job.providerTaskEndpoint = providerSync.endpoint || job.providerTaskEndpoint || "";
    job.providerStatus = taskStatus;
    job.status = mapMeshyStatus(taskStatus);

    if (job.status === "revisao") {
      const modelUrls = extractMeshyModelUrls(taskData);
      if (modelUrls.glb && !job.modelGlb) {
        job.modelGlb = await downloadModelToUploads(modelUrls.glb, ".glb");
      }
      if (modelUrls.usdz && !job.modelUsdz) {
        job.modelUsdz = await downloadModelToUploads(modelUrls.usdz, ".usdz");
      }
      if (job.autoMode && req.body && req.body.autoPublish === true) {
        job.status = "publicado";
      }
    }

    job.updatedAt = new Date().toISOString();
    if (job.status === "publicado") {
      const item = findItem(db, job.itemId);
      if (item) {
        if (job.modelGlb) item.modelGlb = job.modelGlb;
        if (job.modelUsdz) item.modelUsdz = job.modelUsdz;
      }
    }

    await writeDb(db);
    res.json({ job, providerStatus: taskStatus });
  } catch (err) {
    job.status = "erro";
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.status(502).json({ error: "ai_sync_failed", detail: err.message });
  }
});

app.put("/api/orders/:id", requireAuth, async (req, res) => {
  const db = req.db;
  ensureOrders(db);
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: "order_not_found" });
  }
  if (!canAccessRestaurant(req.user, order.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const status = (req.body.status || "").toString().toLowerCase();
  const allowed = new Set(["novo", "aceito", "entregue", "cancelado"]);
  if (!allowed.has(status)) {
    return res.status(400).json({ error: "invalid_status" });
  }
  order.status = status;
  await writeDb(db);
  res.json({ order });
});

const assetsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "image") return cb(null, IMAGES_DIR);
    return cb(null, MODELS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${randomUUID()}${ext}`);
  }
});

const uploadAssets = multer({
  storage: assetsStorage,
  limits: {
    files: 3,
    fileSize: 60 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "image") {
      if (!isImageFile(file)) return cb(new Error("image_invalid_type"));
      return cb(null, true);
    }
    if (file.fieldname === "modelGlb") {
      if (!isModelFile(file, ".glb")) return cb(new Error("model_glb_invalid_type"));
      return cb(null, true);
    }
    if (file.fieldname === "modelUsdz") {
      if (!isModelFile(file, ".usdz")) return cb(new Error("model_usdz_invalid_type"));
      return cb(null, true);
    }
    cb(new Error("file_field_invalid"));
  }
});

app.post(
  "/api/items/:id/assets",
  requireAuth,
  authorizeItem,
  uploadAssets.fields([
    { name: "image", maxCount: 1 },
    { name: "modelGlb", maxCount: 1 },
    { name: "modelUsdz", maxCount: 1 }
  ]),
  async (req, res) => {
    const db = req.db;
    const item = req.item;
    const files = req.files || {};
    if (files.image && files.image[0]) {
      item.image = `/uploads/images/${files.image[0].filename}`;
    }
    if (files.modelGlb && files.modelGlb[0]) {
      item.modelGlb = `/uploads/models/${files.modelGlb[0].filename}`;
    }
    if (files.modelUsdz && files.modelUsdz[0]) {
      item.modelUsdz = `/uploads/models/${files.modelUsdz[0].filename}`;
    }
    await writeDb(db);
    res.json({ item });
  }
);

const scanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(SCANS_DIR, req.params.id);
    ensureDirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  }
});

const uploadScan = multer({
  storage: scanStorage,
  limits: {
    files: 1,
    fileSize: 12 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!isImageFile(file)) {
      return cb(new Error("photo_invalid_type"));
    }
    cb(null, true);
  }
});

app.post(
  "/api/items/:id/scan",
  requireAuth,
  authorizeItem,
  uploadScan.single("photo"),
  async (req, res) => {
    const db = req.db;
    const item = req.item;
    if (!req.file) {
      return res.status(400).json({ error: "photo_required" });
    }
    item.scans = item.scans || [];
    const url = `/uploads/scans/${req.params.id}/${req.file.filename}`;
    item.scans.push(url);
    await writeDb(db);
    res.json({ url, count: item.scans.length });
  }
);

app.use((err, req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "file_too_large" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "too_many_files" });
    }
    return res.status(400).json({ error: "upload_invalid" });
  }

  const known = new Set([
    "photos_invalid_type",
    "image_invalid_type",
    "model_glb_invalid_type",
    "model_usdz_invalid_type",
    "file_field_invalid",
    "photo_invalid_type"
  ]);
  if (known.has(err.message)) {
    return res.status(400).json({ error: err.message });
  }

  console.error("Unhandled error", err);
  return res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`Menuz AR running at http://localhost:${PORT}`);
});
