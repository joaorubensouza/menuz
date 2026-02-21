const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const multer = require("multer");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 5170;

const DATA_PATH = path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const MODELS_DIR = path.join(UPLOADS_DIR, "models");
const SCANS_DIR = path.join(UPLOADS_DIR, "scans");
const JOB_IMAGES_DIR = path.join(UPLOADS_DIR, "job-images");
const MESHY_API_BASE = "https://api.meshy.ai/openapi/v1";
const MESHY_DEFAULT_MODEL = process.env.MESHY_AI_MODEL || "meshy-6";

const tokens = new Map();
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

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
  const userId = tokens.get(token);
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
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
  return [
    {
      id: "meshy",
      label: "Meshy",
      enabled: Boolean(process.env.MESHY_API_KEY),
      supportsAuto: true,
      notes: process.env.MESHY_API_KEY
        ? "Pronto para gerar imagem para 3D."
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

async function buildJobImageInput(item, job) {
  const candidates = [];
  const referenceImages = Array.isArray(job && job.referenceImages)
    ? job.referenceImages
    : [];
  if (referenceImages.length > 0) {
    candidates.push(referenceImages[referenceImages.length - 1]);
  }
  const scans = Array.isArray(item.scans) ? item.scans : [];
  if (scans.length > 0) {
    candidates.push(scans[scans.length - 1]);
  }
  if (item.image) {
    candidates.push(item.image);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isRemoteHttpUrl(candidate)) {
      const ext = path.extname(new URL(candidate).pathname || "").toLowerCase();
      if (ext && !IMAGE_EXTENSIONS.has(ext)) {
        continue;
      }
      return candidate;
    }
    const localPath = urlToUploadFilePath(candidate);
    if (!localPath) continue;
    const dataUri = await localImageToDataUri(localPath);
    if (dataUri) {
      return dataUri;
    }
  }

  return "";
}

function mapMeshyStatus(meshyStatus) {
  const status = (meshyStatus || "").toString().toUpperCase();
  if (status === "SUCCEEDED") return "revisao";
  if (status === "FAILED" || status === "CANCELED") return "erro";
  return "processando";
}

async function startMeshyImageTo3D(imageInput, options = {}) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    throw new Error("meshy_key_missing");
  }

  const payload = {
    image_url: imageInput,
    ai_model: options.aiModel || MESHY_DEFAULT_MODEL,
    should_texture: true
  };

  if (options.targetPolycount) {
    payload.target_polycount = Number(options.targetPolycount);
  }

  const res = await fetch(`${MESHY_API_BASE}/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`meshy_start_failed:${res.status}:${errorBody.slice(0, 300)}`);
  }
  const data = await res.json();
  const taskId = data.result || data.id || data.task_id;
  if (!taskId) {
    throw new Error("meshy_task_id_missing");
  }
  return { taskId };
}

async function fetchMeshyTask(taskId) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    throw new Error("meshy_key_missing");
  }
  const res = await fetch(`${MESHY_API_BASE}/image-to-3d/${encodeURIComponent(taskId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`meshy_sync_failed:${res.status}:${errorBody.slice(0, 300)}`);
  }
  return res.json();
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
  const { email, password } = req.body || {};
  const db = await readDb();
  const user = db.users.find((u) => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const token = randomUUID();
  tokens.set(token, user.id);
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
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email_password_required" });
    }
    if (db.users.some((u) => u.email === email)) {
      return res.status(400).json({ error: "email_in_use" });
    }
    const user = {
      id: `u-${randomUUID()}`,
      email,
      password,
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
  limits: { files: 20, fileSize: 12 * 1024 * 1024 }
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

    const validFiles = files.filter((file) => {
      const ext = path.extname(file.filename || "").toLowerCase();
      return IMAGE_EXTENSIONS.has(ext);
    });
    if (validFiles.length === 0) {
      return res.status(400).json({ error: "photos_invalid_type" });
    }

    const urls = validFiles.map(
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
    const imageInput = await buildJobImageInput(item, job);
    if (!imageInput) {
      return res.status(400).json({ error: "image_source_not_found" });
    }

    const aiModel = (req.body.aiModel || job.aiModel || MESHY_DEFAULT_MODEL)
      .toString()
      .trim();
    const startResult = await startMeshyImageTo3D(imageInput, {
      aiModel,
      targetPolycount: req.body.targetPolycount
    });

    job.provider = provider.id;
    job.aiModel = aiModel;
    job.providerTaskId = startResult.taskId;
    job.providerStatus = "SUBMITTED";
    job.status = "processando";
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.json({ job });
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
    const taskData = await fetchMeshyTask(job.providerTaskId);
    const taskStatus = (taskData.status || "").toString();
    job.providerStatus = taskStatus;
    job.status = mapMeshyStatus(taskStatus);

    if (job.status === "revisao") {
      const modelUrls =
        taskData.model_urls ||
        (taskData.result && taskData.result.model_urls) ||
        {};
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

const uploadAssets = multer({ storage: assetsStorage });

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

const uploadScan = multer({ storage: scanStorage });

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

app.listen(PORT, () => {
  console.log(`Menuz AR running at http://localhost:${PORT}`);
});
