import { scrypt } from "scrypt-js";

const MESHY_API_BASE = "https://api.meshy.ai/openapi/v1";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MODEL_EXTENSIONS = new Set([".glb", ".usdz"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const DEFAULT_ACCENT = "#D95F2B";
const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    let response;
    try {
      response = await handleRequest(request, env);
    } catch (error) {
      console.error("Unhandled worker error", error);
      response = json({ error: "internal_error" }, 500);
    }
    return withSecurityHeaders(request, response);
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/uploads/")) {
    return handleUploads(request, env, pathname);
  }

  const redirectRestaurant = matchRoute("/r/:slug", pathname);
  if (redirectRestaurant) {
    return handleRestaurantRedirect(url, env, redirectRestaurant.slug);
  }

  const redirectItem = matchRoute("/i/:id", pathname);
  if (redirectItem) {
    return Response.redirect(`/item.html?id=${encodeURIComponent(redirectItem.id)}`, 302);
  }

  if (pathname.startsWith("/api/")) {
    return handleApi(request, env, url);
  }

  if (pathname === "/admin") {
    return env.ASSETS.fetch(new Request(new URL("/admin.html", request.url), request));
  }

  return env.ASSETS.fetch(request);
}

function withSecurityHeaders(request, response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeEmail(value) {
  return (value || "").toString().trim().toLowerCase();
}

function fileExt(filename) {
  const input = (filename || "").toString();
  const idx = input.lastIndexOf(".");
  if (idx < 0) return "";
  return input.slice(idx).toLowerCase();
}

function extensionToMime(ext) {
  const normalized = (ext || "").toLowerCase();
  if (normalized === ".jpg" || normalized === ".jpeg") return "image/jpeg";
  if (normalized === ".png") return "image/png";
  if (normalized === ".webp") return "image/webp";
  if (normalized === ".glb") return "model/gltf-binary";
  if (normalized === ".usdz") return "model/vnd.usdz+zip";
  return "application/octet-stream";
}

function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test((value || "").toString());
}

function toHex(uint8Array) {
  return [...uint8Array].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const value = (hex || "").toString().trim();
  if (!value || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    const byte = Number.parseInt(value.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i / 2] = byte;
  }
  return bytes;
}

function timingSafeEqualText(a, b) {
  const aa = encoder.encode((a || "").toString());
  const bb = encoder.encode((b || "").toString());
  if (aa.length !== bb.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aa.length; i += 1) mismatch |= aa[i] ^ bb[i];
  return mismatch === 0;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

async function hashSessionToken(token, env) {
  const secret = (env.SESSION_SECRET || "").toString().trim() || "dev-session-secret-change-me";
  return sha256Hex(`${secret}:${token}`);
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const passBytes = encoder.encode((password || "").toString());
  const derived = await scrypt(passBytes, saltBytes, 16384, 8, 1, 64);
  return `scrypt:${toHex(saltBytes)}:${toHex(derived)}`;
}

async function verifyPasswordHash(password, passwordHash) {
  const parts = (passwordHash || "").toString().split(":");
  if (parts.length === 3 && parts[0] === "scrypt") {
    const salt = fromHex(parts[1]);
    const storedHash = fromHex(parts[2]);
    if (!salt || !storedHash) return false;
    const derived = await scrypt(encoder.encode((password || "").toString()), salt, 16384, 8, 1, storedHash.length);
    const derivedHex = toHex(derived);
    return timingSafeEqualText(derivedHex, parts[2]);
  }
  return false;
}

function isPasswordValid(password) {
  const value = (password || "").toString();
  return value.length >= 8 && value.length <= 128;
}

function matchRoute(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const current = decodeURIComponent(pathParts[i]);
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = current;
      continue;
    }
    if (expected !== current) return null;
  }
  return params;
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

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurant_id || null
  };
}

function mapRestaurantRow(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    logo: row.logo || "",
    theme: { accent: row.accent || DEFAULT_ACCENT },
    template: row.template || "default",
    heroImages: parseJsonSafe(row.hero_images_json, [])
  };
}

function mapItemRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description || "",
    price: Number(row.price) || 0,
    image: row.image || "",
    modelGlb: row.model_glb || "",
    modelUsdz: row.model_usdz || "",
    category: row.category || "",
    scans: parseJsonSafe(row.scans_json, [])
  };
}

function mapOrderRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    table: row.table_label || "",
    items: parseJsonSafe(row.items_json, []),
    total: Number(row.total) || 0,
    status: row.status || "novo",
    createdAt: row.created_at
  };
}

function mapModelJobRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    itemId: row.item_id,
    sourceType: row.source_type,
    provider: row.provider || "manual",
    aiModel: row.ai_model || "",
    autoMode: Boolean(row.auto_mode),
    status: row.status || "enviado",
    notes: row.notes || "",
    modelGlb: row.model_glb || "",
    modelUsdz: row.model_usdz || "",
    referenceImages: parseJsonSafe(row.reference_images_json, []),
    providerTaskId: row.provider_task_id || "",
    providerTaskEndpoint: row.provider_task_endpoint || "",
    providerStatus: row.provider_status || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by || ""
  };
}

function canAccessRestaurant(user, restaurantId) {
  return user.role === "master" || user.restaurant_id === restaurantId;
}

function getClientIp(request) {
  const direct = request.headers.get("cf-connecting-ip");
  if (direct) return direct;
  const forwarded = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (forwarded) return forwarded;
  return "unknown";
}

function getConfig(env) {
  return {
    tokenTtlMs: toInt(env.TOKEN_TTL_MS, 24 * 60 * 60 * 1000),
    loginWindowMs: toInt(env.LOGIN_WINDOW_MS, 15 * 60 * 1000),
    loginMaxAttempts: toInt(env.LOGIN_MAX_ATTEMPTS, 6),
    loginLockMs: toInt(env.LOGIN_LOCK_MS, 15 * 60 * 1000),
    meshyModel: (env.MESHY_AI_MODEL || "meshy-6").toString(),
    meshyMaxImages: Math.max(1, Math.min(8, toInt(env.MESHY_MAX_REFERENCE_IMAGES, 4)))
  };
}

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function unauthorized() {
  return json({ error: "unauthorized" }, 401);
}

function forbidden() {
  return json({ error: "forbidden" }, 403);
}

async function getAuthUser(request, env, extendSession = true) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const tokenHash = await hashSessionToken(token, env);
  const now = Date.now();

  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now).run();
  const session = await env.DB.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?1")
    .bind(tokenHash)
    .first();
  if (!session) return null;
  if (toInt(session.expires_at) <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }

  const user = await env.DB.prepare(
    "SELECT id, email, role, restaurant_id, password_hash, password_plain FROM users WHERE id = ?1"
  )
    .bind(session.user_id)
    .first();
  if (!user) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }

  if (extendSession) {
    const nextExpires = now + getConfig(env).tokenTtlMs;
    await env.DB.prepare("UPDATE sessions SET expires_at = ?1 WHERE token_hash = ?2")
      .bind(nextExpires, tokenHash)
      .run();
  }

  return { user, tokenHash };
}

async function getLoginAttempt(env, ip, config) {
  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT ip, count, first_failed_at, locked_until FROM login_attempts WHERE ip = ?1"
  )
    .bind(ip)
    .first();
  if (!row) return { state: null, now };

  const firstFailedAt = toInt(row.first_failed_at);
  const lockedUntil = toInt(row.locked_until);
  if (lockedUntil > 0 && lockedUntil > now) {
    return { state: row, now };
  }
  if (now - firstFailedAt > config.loginWindowMs || (lockedUntil > 0 && lockedUntil <= now)) {
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?1").bind(ip).run();
    return { state: null, now };
  }
  return { state: row, now };
}

async function isLoginBlocked(env, ip, config) {
  const { state, now } = await getLoginAttempt(env, ip, config);
  if (!state) return { blocked: false, retryAfterSeconds: 0 };
  const lockedUntil = toInt(state.locked_until);
  if (!lockedUntil || lockedUntil <= now) return { blocked: false, retryAfterSeconds: 0 };
  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000))
  };
}

async function registerLoginFailure(env, ip, config) {
  const { state, now } = await getLoginAttempt(env, ip, config);
  if (!state) {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO login_attempts (ip, count, first_failed_at, locked_until) VALUES (?1, 1, ?2, 0)"
    )
      .bind(ip, now)
      .run();
    return;
  }

  const nextCount = toInt(state.count, 0) + 1;
  let lockedUntil = toInt(state.locked_until);
  if (nextCount >= config.loginMaxAttempts) {
    lockedUntil = now + config.loginLockMs;
  }
  await env.DB.prepare(
    "UPDATE login_attempts SET count = ?1, locked_until = ?2 WHERE ip = ?3"
  )
    .bind(nextCount, lockedUntil, ip)
    .run();
}

async function clearLoginFailures(env, ip) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?1").bind(ip).run();
}

async function getRestaurantById(env, id) {
  const row = await env.DB.prepare("SELECT * FROM restaurants WHERE id = ?1").bind(id).first();
  return row ? mapRestaurantRow(row) : null;
}

async function getRestaurantBySlug(env, slug) {
  const row = await env.DB.prepare("SELECT * FROM restaurants WHERE slug = ?1").bind(slug).first();
  return row ? mapRestaurantRow(row) : null;
}

async function getItemById(env, id) {
  const row = await env.DB.prepare("SELECT * FROM items WHERE id = ?1").bind(id).first();
  return row ? mapItemRow(row) : null;
}

async function getModelJobById(env, id) {
  const row = await env.DB.prepare("SELECT * FROM model_jobs WHERE id = ?1").bind(id).first();
  return row ? mapModelJobRow(row) : null;
}

async function handleRestaurantRedirect(url, env, slug) {
  const params = new URLSearchParams(url.search);
  params.set("r", slug);

  const restaurant = await getRestaurantBySlug(env, slug);
  if (restaurant && restaurant.template === "topo-do-mundo") {
    return Response.redirect(`/templates/topo-do-mundo.html?${params.toString()}`, 302);
  }
  return Response.redirect(`/?${params.toString()}`, 302);
}

async function handleUploads(request, env, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const key = decodeURIComponent(pathname.slice("/uploads/".length)).replace(/^\/+/, "");
  if (!key || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.UPLOADS.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(object.body, { status: 200, headers });
}

async function putR2Upload(env, file, folder, allowedExtensions, maxSizeBytes, fixedExt = "") {
  if (!(file instanceof File)) return "";
  if (file.size <= 0 || file.size > maxSizeBytes) {
    throw new Error("file_too_large");
  }
  const ext = fixedExt || fileExt(file.name || "");
  if (!allowedExtensions.has(ext)) throw new Error("upload_invalid_type");
  const filename = `${crypto.randomUUID()}${ext}`;
  const key = `${folder}/${filename}`;
  const contentType = file.type || extensionToMime(ext);
  await env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType }
  });
  return `/uploads/${key}`;
}

async function putR2UploadAtPath(env, file, targetKey, allowedExtensions, maxSizeBytes) {
  if (!(file instanceof File)) return "";
  if (file.size <= 0 || file.size > maxSizeBytes) {
    throw new Error("file_too_large");
  }
  const ext = fileExt(file.name || "");
  if (!allowedExtensions.has(ext)) throw new Error("upload_invalid_type");
  const contentType = file.type || extensionToMime(ext);
  await env.UPLOADS.put(targetKey, await file.arrayBuffer(), {
    httpMetadata: { contentType }
  });
  return `/uploads/${targetKey}`;
}

async function deleteR2Prefix(env, prefix) {
  let cursor;
  do {
    const list = await env.UPLOADS.list({ prefix, cursor });
    if (list.objects.length > 0) {
      await env.UPLOADS.delete(list.objects.map((obj) => obj.key));
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

function getAiProviders(env) {
  const config = getConfig(env);
  const hasMeshy = Boolean((env.MESHY_API_KEY || "").trim());
  return [
    {
      id: "meshy",
      label: "Meshy",
      enabled: hasMeshy,
      supportsAuto: true,
      supportsMultiImage: true,
      notes: hasMeshy
        ? `Pronto para gerar 3D (ate ${config.meshyMaxImages} fotos por job).`
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

function getAiProvider(env, providerId) {
  return getAiProviders(env).find((provider) => provider.id === providerId);
}

function urlToR2Key(urlValue) {
  if (!urlValue || !urlValue.startsWith("/uploads/")) return "";
  return decodeURIComponent(urlValue.slice("/uploads/".length)).replace(/^\/+/, "");
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function r2ImageToDataUri(env, key) {
  if (!key) return "";
  const object = await env.UPLOADS.get(key);
  if (!object) return "";
  const ext = fileExt(key);
  if (!IMAGE_EXTENSIONS.has(ext)) return "";
  const contentType = object.httpMetadata?.contentType || extensionToMime(ext);
  const arrayBuffer = await object.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(arrayBuffer));
  return `data:${contentType};base64,${base64}`;
}

async function resolveImageCandidate(env, candidate) {
  if (!candidate) return "";
  if (isRemoteHttpUrl(candidate)) {
    const ext = fileExt(new URL(candidate).pathname || "");
    if (ext && !IMAGE_EXTENSIONS.has(ext)) return "";
    return candidate;
  }
  const key = urlToR2Key(candidate);
  if (!key) return "";
  return r2ImageToDataUri(env, key);
}

async function buildJobImageInputs(env, item, job) {
  const config = getConfig(env);
  const referenceImages = Array.isArray(job.referenceImages) ? [...job.referenceImages].reverse() : [];
  const scans = Array.isArray(item.scans) ? [...item.scans].reverse() : [];
  const candidates = [...referenceImages, ...scans, item.image || ""].filter(Boolean);
  const unique = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const resolved = await resolveImageCandidate(env, candidate);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    unique.push(resolved);
    if (unique.length >= config.meshyMaxImages) break;
  }
  return unique;
}

function buildMeshyStartRequest(env, imageInputs, options = {}) {
  const config = getConfig(env);
  const aiModel = (options.aiModel || config.meshyModel || "").toString().trim();
  const payload = { should_texture: true };
  if (aiModel) payload.ai_model = aiModel;
  if (options.targetPolycount) payload.target_polycount = Number(options.targetPolycount);

  if (imageInputs.length > 1) {
    payload.image_urls = imageInputs.slice(0, config.meshyMaxImages);
    return { endpoint: "multi-image-to-3d", payload };
  }
  payload.image_url = imageInputs[0];
  return { endpoint: "image-to-3d", payload };
}

function extractMeshyTaskId(payload) {
  if (!payload || typeof payload !== "object") return "";
  const values = [
    payload.result,
    payload.id,
    payload.task_id,
    payload.taskId,
    payload.task && payload.task.id,
    payload.data && payload.data.id,
    payload.result && payload.result.id
  ];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function startMeshyImageTo3D(env, imageInputs, options = {}) {
  const apiKey = (env.MESHY_API_KEY || "").trim();
  if (!apiKey) throw new Error("meshy_key_missing");
  const normalizedInputs = Array.isArray(imageInputs) ? imageInputs.filter(Boolean) : [];
  if (!normalizedInputs.length) throw new Error("meshy_image_input_missing");
  const request = buildMeshyStartRequest(env, normalizedInputs, options);
  const response = await fetch(`${MESHY_API_BASE}/${request.endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request.payload)
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`meshy_start_failed:${request.endpoint}:${response.status}:${details.slice(0, 300)}`);
  }
  const payload = await response.json();
  const taskId = extractMeshyTaskId(payload);
  if (!taskId) throw new Error("meshy_task_id_missing");
  return { taskId, endpoint: request.endpoint };
}

function getMeshyTaskEndpoints(endpointHint) {
  const hint = (endpointHint || "").toLowerCase().trim();
  if (hint.includes("multi-image-to-3d")) return ["multi-image-to-3d", "image-to-3d"];
  if (hint.includes("image-to-3d")) return ["image-to-3d", "multi-image-to-3d"];
  return ["image-to-3d", "multi-image-to-3d"];
}

async function fetchMeshyTask(env, taskId, endpointHint = "") {
  const apiKey = (env.MESHY_API_KEY || "").trim();
  if (!apiKey) throw new Error("meshy_key_missing");
  const errors = [];
  for (const endpoint of getMeshyTaskEndpoints(endpointHint)) {
    const response = await fetch(`${MESHY_API_BASE}/${endpoint}/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (response.ok) {
      return { endpoint, task: await response.json() };
    }
    const details = await response.text();
    errors.push(`${endpoint}:${response.status}:${details.slice(0, 200)}`);
    if (response.status !== 404) break;
  }
  throw new Error(`meshy_sync_failed:${errors.join(" | ")}`);
}

function mapMeshyStatus(statusRaw) {
  const status = (statusRaw || "").toString().toUpperCase();
  if (status === "SUCCEEDED" || status === "COMPLETED") return "revisao";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "erro";
  return "processando";
}

function extractMeshyModelUrls(taskData) {
  const containers = [
    taskData?.model_urls,
    taskData?.result?.model_urls,
    taskData?.result?.modelUrls,
    taskData?.output?.model_urls,
    taskData?.data?.model_urls
  ].filter(Boolean);
  const urls = {};
  for (const entry of containers) {
    if (!urls.glb && isRemoteHttpUrl(entry.glb)) urls.glb = entry.glb;
    if (!urls.usdz && isRemoteHttpUrl(entry.usdz)) urls.usdz = entry.usdz;
  }
  if (!urls.glb && isRemoteHttpUrl(taskData?.glb_url)) urls.glb = taskData.glb_url;
  if (!urls.glb && isRemoteHttpUrl(taskData?.result?.glb_url)) urls.glb = taskData.result.glb_url;
  if (!urls.usdz && isRemoteHttpUrl(taskData?.usdz_url)) urls.usdz = taskData.usdz_url;
  if (!urls.usdz && isRemoteHttpUrl(taskData?.result?.usdz_url)) urls.usdz = taskData.result.usdz_url;
  return urls;
}

async function downloadModelToR2(env, remoteUrl, extension) {
  if (!isRemoteHttpUrl(remoteUrl)) return "";
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const filename = `${crypto.randomUUID()}${ext}`;
  const key = `models/${filename}`;
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`model_download_failed:${response.status}`);
  await env.UPLOADS.put(key, await response.arrayBuffer(), {
    httpMetadata: { contentType: extensionToMime(ext) }
  });
  return `/uploads/${key}`;
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method.toUpperCase();
  const config = getConfig(env);

  if (method === "GET" && pathname === "/api/public/restaurants") {
    const { results } = await env.DB.prepare(
      `SELECT r.*, COUNT(i.id) AS item_count
       FROM restaurants r
       LEFT JOIN items i ON i.restaurant_id = r.id
       GROUP BY r.id
       ORDER BY r.name COLLATE NOCASE`
    ).all();
    const restaurants = (results || []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || "",
      logo: row.logo || "",
      template: row.template || "default",
      itemCount: toInt(row.item_count)
    }));
    return json({ restaurants });
  }
