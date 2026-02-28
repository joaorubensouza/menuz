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

  const publicRestaurant = method === "GET" && matchRoute("/api/public/restaurant/:slug", pathname);
  if (publicRestaurant) {
    const restaurant = await getRestaurantBySlug(env, publicRestaurant.slug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    const { results } = await env.DB.prepare(
      "SELECT * FROM items WHERE restaurant_id = ?1 ORDER BY name COLLATE NOCASE"
    )
      .bind(restaurant.id)
      .all();
    return json({ restaurant, items: (results || []).map(mapItemRow) });
  }

  const publicItem = method === "GET" && matchRoute("/api/public/item/:id", pathname);
  if (publicItem) {
    const item = await getItemById(env, publicItem.id);
    if (!item) return json({ error: "item_not_found" }, 404);
    const restaurant = await getRestaurantById(env, item.restaurantId);
    return json({ item, restaurant });
  }

  if (method === "POST" && pathname === "/api/public/orders") {
    const body = await parseJsonBody(request);
    const restaurantSlug = (body.restaurantSlug || "").toString().trim();
    const table = (body.table || "").toString().trim();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!restaurantSlug) return json({ error: "restaurant_required" }, 400);
    if (!table) return json({ error: "table_required" }, 400);
    if (!items.length) return json({ error: "items_required" }, 400);

    const restaurant = await getRestaurantBySlug(env, restaurantSlug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    const { results } = await env.DB.prepare("SELECT * FROM items WHERE restaurant_id = ?1")
      .bind(restaurant.id)
      .all();
    const map = new Map((results || []).map((row) => [row.id, mapItemRow(row)]));
    const orderItems = [];
    let total = 0;
    for (const entry of items) {
      const menuItem = map.get(entry.id);
      if (!menuItem) continue;
      const qty = Math.max(1, Math.min(50, Number(entry.qty) || 1));
      const price = Number(menuItem.price) || 0;
      orderItems.push({ id: menuItem.id, name: menuItem.name, price, qty });
      total += price * qty;
    }
    if (!orderItems.length) return json({ error: "invalid_items" }, 400);
    const order = {
      id: `o-${crypto.randomUUID()}`,
      restaurantId: restaurant.id,
      table,
      items: orderItems,
      total: Math.round(total * 100) / 100,
      status: "novo",
      createdAt: new Date().toISOString()
    };
    await env.DB.prepare(
      `INSERT INTO orders (id, restaurant_id, table_label, items_json, total, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(
        order.id,
        order.restaurantId,
        order.table,
        JSON.stringify(order.items),
        order.total,
        order.status,
        order.createdAt
      )
      .run();
    return json({ order });
  }

  if (method === "POST" && pathname === "/api/login") {
    const body = await parseJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = (body.password || "").toString();
    const ip = getClientIp(request);

    const lock = await isLoginBlocked(env, ip, config);
    if (lock.blocked) {
      return json({ error: "too_many_attempts" }, 429, { "Retry-After": String(lock.retryAfterSeconds) });
    }

    if (!email || !password) {
      await registerLoginFailure(env, ip, config);
      return json({ error: "invalid_credentials" }, 401);
    }

    const user = await env.DB.prepare(
      "SELECT id, email, role, restaurant_id, password_hash, password_plain FROM users WHERE email = ?1"
    )
      .bind(email)
      .first();
    if (!user) {
      await registerLoginFailure(env, ip, config);
      return json({ error: "invalid_credentials" }, 401);
    }

    let ok = false;
    if (user.password_hash) ok = await verifyPasswordHash(password, user.password_hash);
    if (!ok && user.password_plain) ok = timingSafeEqualText(user.password_plain, password);
    if (!ok) {
      await registerLoginFailure(env, ip, config);
      return json({ error: "invalid_credentials" }, 401);
    }

    await clearLoginFailures(env, ip);

    if (!user.password_hash) {
      const newHash = await hashPassword(password);
      await env.DB.prepare("UPDATE users SET password_hash = ?1 WHERE id = ?2").bind(newHash, user.id).run();
      user.password_hash = newHash;
    }

    const token = crypto.randomUUID();
    const tokenHash = await hashSessionToken(token, env);
    const expiresAt = Date.now() + config.tokenTtlMs;
    await env.DB.prepare(
      "INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
      .bind(tokenHash, user.id, expiresAt, Date.now())
      .run();
    return json({ token, user: sanitizeUser(user) });
  }

  const auth = await getAuthUser(request, env, true);
  if (!auth) return unauthorized();
  const currentUser = auth.user;

  if (method === "GET" && pathname === "/api/me") {
    return json({ user: sanitizeUser(currentUser) });
  }

  if (method === "POST" && pathname === "/api/logout") {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(auth.tokenHash).run();
    return json({ ok: true });
  }

  if (method === "GET" && pathname === "/api/ai/providers") {
    return json({ providers: getAiProviders(env) });
  }

  if (method === "GET" && pathname === "/api/my-restaurant") {
    if (currentUser.role !== "client" || !currentUser.restaurant_id) return forbidden();
    const restaurant = await getRestaurantById(env, currentUser.restaurant_id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    return json({ restaurant });
  }

  if (method === "GET" && pathname === "/api/restaurants") {
    if (currentUser.role !== "master") return forbidden();
    const { results } = await env.DB.prepare("SELECT * FROM restaurants ORDER BY name COLLATE NOCASE").all();
    return json({ restaurants: (results || []).map(mapRestaurantRow) });
  }

  if (method === "POST" && pathname === "/api/restaurants") {
    if (currentUser.role !== "master") return forbidden();
    const body = await parseJsonBody(request);
    if (!body.name) return json({ error: "name_required" }, 400);
    const slug = normalizeSlug(body.slug || body.name);
    if (!slug) return json({ error: "slug_invalid" }, 400);
    const existing = await env.DB.prepare("SELECT id FROM restaurants WHERE slug = ?1").bind(slug).first();
    if (existing) return json({ error: "slug_in_use" }, 400);
    const restaurant = {
      id: `r-${crypto.randomUUID()}`,
      name: body.name.toString(),
      slug,
      description: (body.description || "").toString(),
      logo: (body.logo || "").toString(),
      accent: (body.accent || DEFAULT_ACCENT).toString(),
      template: (body.template || "default").toString(),
      heroImages: []
    };
    await env.DB.prepare(
      `INSERT INTO restaurants
      (id, name, slug, description, logo, accent, template, hero_images_json)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        restaurant.id,
        restaurant.name,
        restaurant.slug,
        restaurant.description,
        restaurant.logo,
        restaurant.accent,
        restaurant.template,
        JSON.stringify(restaurant.heroImages)
      )
      .run();
    return json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        logo: restaurant.logo,
        theme: { accent: restaurant.accent },
        template: restaurant.template,
        heroImages: restaurant.heroImages
      }
    });
  }

  const restaurantUpdate = method === "PUT" && matchRoute("/api/restaurants/:id", pathname);
  if (restaurantUpdate) {
    const restaurant = await getRestaurantById(env, restaurantUpdate.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();

    const body = await parseJsonBody(request);
    const next = { ...restaurant };
    if (body.name) next.name = body.name.toString();
    if (body.description !== undefined) next.description = (body.description || "").toString();
    if (body.logo !== undefined) next.logo = (body.logo || "").toString();
    if (body.accent) next.theme.accent = body.accent.toString();
    if (body.template !== undefined) next.template = (body.template || "default").toString();
    if (body.heroImages !== undefined && Array.isArray(body.heroImages)) {
      next.heroImages = body.heroImages.filter(Boolean);
    }
    if (body.slug) {
      const normalized = normalizeSlug(body.slug);
      if (normalized && normalized !== next.slug) {
        const existing = await env.DB.prepare("SELECT id FROM restaurants WHERE slug = ?1 AND id <> ?2")
          .bind(normalized, next.id)
          .first();
        if (existing) return json({ error: "slug_in_use" }, 400);
        next.slug = normalized;
      }
    }
    await env.DB.prepare(
      `UPDATE restaurants
       SET name = ?1, slug = ?2, description = ?3, logo = ?4, accent = ?5, template = ?6, hero_images_json = ?7
       WHERE id = ?8`
    )
      .bind(
        next.name,
        next.slug,
        next.description,
        next.logo,
        next.theme.accent || DEFAULT_ACCENT,
        next.template || "default",
        JSON.stringify(next.heroImages || []),
        next.id
      )
      .run();
    return json({ restaurant: next });
  }

  const createRestaurantUser = method === "POST" && matchRoute("/api/restaurants/:id/users", pathname);
  if (createRestaurantUser) {
    if (currentUser.role !== "master") return forbidden();
    const restaurant = await getRestaurantById(env, createRestaurantUser.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);

    const body = await parseJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = (body.password || "").toString();
    if (!email || !password) return json({ error: "email_password_required" }, 400);
    if (!EMAIL_PATTERN.test(email)) return json({ error: "email_invalid" }, 400);
    if (!isPasswordValid(password)) return json({ error: "password_too_weak" }, 400);
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(email).first();
    if (existing) return json({ error: "email_in_use" }, 400);

    const user = {
      id: `u-${crypto.randomUUID()}`,
      email,
      passwordHash: await hashPassword(password),
      role: "client",
      restaurantId: restaurant.id
    };
    await env.DB.prepare(
      `INSERT INTO users (id, email, role, restaurant_id, password_hash, password_plain)
       VALUES (?1, ?2, ?3, ?4, ?5, '')`
    )
      .bind(user.id, user.email, user.role, user.restaurantId, user.passwordHash)
      .run();
    return json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId
      }
    });
  }

  const getRestaurantItems = method === "GET" && matchRoute("/api/restaurants/:id/items", pathname);
  if (getRestaurantItems) {
    const restaurant = await getRestaurantById(env, getRestaurantItems.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const { results } = await env.DB.prepare(
      "SELECT * FROM items WHERE restaurant_id = ?1 ORDER BY name COLLATE NOCASE"
    )
      .bind(restaurant.id)
      .all();
    return json({ items: (results || []).map(mapItemRow) });
  }

  const createRestaurantItem = method === "POST" && matchRoute("/api/restaurants/:id/items", pathname);
  if (createRestaurantItem) {
    const restaurant = await getRestaurantById(env, createRestaurantItem.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const body = await parseJsonBody(request);
    if (!body.name) return json({ error: "name_required" }, 400);
    const item = {
      id: `i-${crypto.randomUUID()}`,
      restaurantId: restaurant.id,
      name: body.name.toString(),
      description: (body.description || "").toString(),
      price: Number(body.price) || 0,
      image: (body.image || "").toString(),
      modelGlb: (body.modelGlb || "").toString(),
      modelUsdz: (body.modelUsdz || "").toString(),
      category: (body.category || "").toString(),
      scans: []
    };
    await env.DB.prepare(
      `INSERT INTO items
       (id, restaurant_id, name, description, price, image, model_glb, model_usdz, category, scans_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
      .bind(
        item.id,
        item.restaurantId,
        item.name,
        item.description,
        item.price,
        item.image,
        item.modelGlb,
        item.modelUsdz,
        item.category,
        JSON.stringify(item.scans)
      )
      .run();
    return json({ item });
  }

  const updateItem = method === "PUT" && matchRoute("/api/items/:id", pathname);
  if (updateItem) {
    const item = await getItemById(env, updateItem.id);
    if (!item) return json({ error: "item_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, item.restaurantId)) return forbidden();
    const body = await parseJsonBody(request);
    const next = { ...item };
    if (body.name) next.name = body.name.toString();
    if (body.description !== undefined) next.description = (body.description || "").toString();
    if (body.price !== undefined) next.price = Number(body.price) || 0;
    if (body.image !== undefined) next.image = (body.image || "").toString();
    if (body.modelGlb !== undefined) next.modelGlb = (body.modelGlb || "").toString();
    if (body.modelUsdz !== undefined) next.modelUsdz = (body.modelUsdz || "").toString();
    if (body.category !== undefined) next.category = (body.category || "").toString();
    await env.DB.prepare(
      `UPDATE items
       SET name = ?1, description = ?2, price = ?3, image = ?4, model_glb = ?5, model_usdz = ?6, category = ?7, scans_json = ?8
       WHERE id = ?9`
    )
      .bind(
        next.name,
        next.description,
        next.price,
        next.image,
        next.modelGlb,
        next.modelUsdz,
        next.category || "",
        JSON.stringify(next.scans || []),
        next.id
      )
      .run();
    return json({ item: next });
  }

  const deleteItemRoute = method === "DELETE" && matchRoute("/api/items/:id", pathname);
  if (deleteItemRoute) {
    const item = await getItemById(env, deleteItemRoute.id);
    if (!item) return json({ error: "item_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, item.restaurantId)) return forbidden();

    const { results: jobRows } = await env.DB.prepare("SELECT id FROM model_jobs WHERE item_id = ?1")
      .bind(item.id)
      .all();
    const removedJobIds = (jobRows || []).map((row) => row.id);

    await env.DB.prepare("DELETE FROM model_jobs WHERE item_id = ?1").bind(item.id).run();
    await env.DB.prepare("DELETE FROM items WHERE id = ?1").bind(item.id).run();

    await deleteR2Prefix(env, `scans/${item.id}/`);
    for (const jobId of removedJobIds) {
      await deleteR2Prefix(env, `job-images/${jobId}/`);
    }

    return json({ ok: true, removedItemId: item.id, removedModelJobs: removedJobIds });
  }

  const createItemAssets = method === "POST" && matchRoute("/api/items/:id/assets", pathname);
  if (createItemAssets) {
    const item = await getItemById(env, createItemAssets.id);
    if (!item) return json({ error: "item_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, item.restaurantId)) return forbidden();

    const form = await request.formData();
    const image = form.get("image");
    const modelGlb = form.get("modelGlb");
    const modelUsdz = form.get("modelUsdz");
    const next = { ...item };

    if (image instanceof File) {
      next.image = await putR2Upload(env, image, "images", IMAGE_EXTENSIONS, 12 * 1024 * 1024);
    }
    if (modelGlb instanceof File) {
      next.modelGlb = await putR2Upload(env, modelGlb, "models", new Set([".glb"]), 60 * 1024 * 1024, ".glb");
    }
    if (modelUsdz instanceof File) {
      next.modelUsdz = await putR2Upload(env, modelUsdz, "models", new Set([".usdz"]), 60 * 1024 * 1024, ".usdz");
    }

    await env.DB.prepare(
      "UPDATE items SET image = ?1, model_glb = ?2, model_usdz = ?3 WHERE id = ?4"
    )
      .bind(next.image || "", next.modelGlb || "", next.modelUsdz || "", next.id)
      .run();
    return json({ item: next });
  }

  const scanItemRoute = method === "POST" && matchRoute("/api/items/:id/scan", pathname);
  if (scanItemRoute) {
    const item = await getItemById(env, scanItemRoute.id);
    if (!item) return json({ error: "item_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, item.restaurantId)) return forbidden();

    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return json({ error: "photo_required" }, 400);
    const ext = fileExt(photo.name);
    if (!IMAGE_EXTENSIONS.has(ext)) return json({ error: "photo_invalid_type" }, 400);

    const key = `scans/${item.id}/${crypto.randomUUID()}${ext}`;
    const urlValue = await putR2UploadAtPath(env, photo, key, IMAGE_EXTENSIONS, 12 * 1024 * 1024);
    const scans = Array.isArray(item.scans) ? [...item.scans, urlValue] : [urlValue];
    await env.DB.prepare("UPDATE items SET scans_json = ?1 WHERE id = ?2")
      .bind(JSON.stringify(scans), item.id)
      .run();
    return json({ url: urlValue, count: scans.length });
  }

  const listOrdersRoute = method === "GET" && matchRoute("/api/restaurants/:id/orders", pathname);
  if (listOrdersRoute) {
    const restaurant = await getRestaurantById(env, listOrdersRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const { results } = await env.DB.prepare(
      "SELECT * FROM orders WHERE restaurant_id = ?1 ORDER BY created_at DESC"
    )
      .bind(restaurant.id)
      .all();
    return json({ orders: (results || []).map(mapOrderRow) });
  }

  const updateOrderRoute = method === "PUT" && matchRoute("/api/orders/:id", pathname);
  if (updateOrderRoute) {
    const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?1").bind(updateOrderRoute.id).first();
    if (!row) return json({ error: "order_not_found" }, 404);
    const order = mapOrderRow(row);
    if (!canAccessRestaurant(currentUser, order.restaurantId)) return forbidden();
    const body = await parseJsonBody(request);
    const status = (body.status || "").toString().toLowerCase();
    const allowed = new Set(["novo", "aceito", "entregue", "cancelado"]);
    if (!allowed.has(status)) return json({ error: "invalid_status" }, 400);
    await env.DB.prepare("UPDATE orders SET status = ?1 WHERE id = ?2").bind(status, order.id).run();
    order.status = status;
    return json({ order });
  }

  const listJobsRoute = method === "GET" && matchRoute("/api/restaurants/:id/model-jobs", pathname);
  if (listJobsRoute) {
    const restaurant = await getRestaurantById(env, listJobsRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const { results } = await env.DB.prepare(
      "SELECT * FROM model_jobs WHERE restaurant_id = ?1 ORDER BY updated_at DESC"
    )
      .bind(restaurant.id)
      .all();
    return json({ jobs: (results || []).map(mapModelJobRow) });
  }

  const createJobRoute = method === "POST" && matchRoute("/api/restaurants/:id/model-jobs", pathname);
  if (createJobRoute) {
    const restaurant = await getRestaurantById(env, createJobRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();

    const body = await parseJsonBody(request);
    const itemId = (body.itemId || "").toString();
    if (!itemId) return json({ error: "item_required" }, 400);
    const item = await getItemById(env, itemId);
    if (!item || item.restaurantId !== restaurant.id) return json({ error: "item_invalid" }, 400);

    const sourceType = (body.sourceType || "").toString().trim();
    if (!new Set(["scanner", "upload", "api"]).has(sourceType)) return json({ error: "source_invalid" }, 400);
    const providerId = (body.provider || "manual").toString().trim().toLowerCase();
    if (!getAiProvider(env, providerId)) return json({ error: "provider_invalid" }, 400);
    const nowIso = new Date().toISOString();
    const job = {
      id: `mj-${crypto.randomUUID()}`,
      restaurantId: restaurant.id,
      itemId: item.id,
      sourceType,
      provider: providerId,
      aiModel: (body.aiModel || "").toString().trim(),
      autoMode: Boolean(body.autoMode),
      status: "enviado",
      notes: (body.notes || "").toString().slice(0, 500),
      modelGlb: "",
      modelUsdz: "",
      referenceImages: [],
      providerTaskId: "",
      providerTaskEndpoint: "",
      providerStatus: "",
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: currentUser.id
    };
    await env.DB.prepare(
      `INSERT INTO model_jobs
      (id, restaurant_id, item_id, source_type, provider, ai_model, auto_mode, status, notes, model_glb, model_usdz,
       reference_images_json, provider_task_id, provider_task_endpoint, provider_status, created_at, updated_at, created_by)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
    )
      .bind(
        job.id,
        job.restaurantId,
        job.itemId,
        job.sourceType,
        job.provider,
        job.aiModel,
        job.autoMode ? 1 : 0,
        job.status,
        job.notes,
        job.modelGlb,
        job.modelUsdz,
        JSON.stringify(job.referenceImages),
        job.providerTaskId,
        job.providerTaskEndpoint,
        job.providerStatus,
        job.createdAt,
        job.updatedAt,
        job.createdBy
      )
      .run();
    return json({ job });
  }

  const uploadJobImagesRoute = method === "POST" && matchRoute("/api/model-jobs/:id/images", pathname);
  if (uploadJobImagesRoute) {
    const job = await getModelJobById(env, uploadJobImagesRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();

    const form = await request.formData();
    const photos = form.getAll("photos").filter((entry) => entry instanceof File);
    if (!photos.length) return json({ error: "photos_required" }, 400);
    if (photos.length > 20) return json({ error: "too_many_files" }, 400);

    const urls = [];
    for (const photo of photos) {
      const ext = fileExt(photo.name);
      if (!IMAGE_EXTENSIONS.has(ext)) return json({ error: "photos_invalid_type" }, 400);
      const key = `job-images/${job.id}/${crypto.randomUUID()}${ext}`;
      const urlValue = await putR2UploadAtPath(env, photo, key, IMAGE_EXTENSIONS, 12 * 1024 * 1024);
      urls.push(urlValue);
    }
    const nextReferenceImages = Array.isArray(job.referenceImages)
      ? [...job.referenceImages, ...urls]
      : [...urls];
    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE model_jobs SET reference_images_json = ?1, updated_at = ?2 WHERE id = ?3"
    )
      .bind(JSON.stringify(nextReferenceImages), nowIso, job.id)
      .run();
    job.referenceImages = nextReferenceImages;
    job.updatedAt = nowIso;
    return json({ urls, count: nextReferenceImages.length, job });
  }

  const updateJobRoute = method === "PUT" && matchRoute("/api/model-jobs/:id", pathname);
  if (updateJobRoute) {
    const job = await getModelJobById(env, updateJobRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const body = await parseJsonBody(request);
    const allowedStatus = new Set(["enviado", "triagem", "processando", "revisao", "publicado", "erro"]);

    if (body.status !== undefined) {
      const status = (body.status || "").toString().toLowerCase();
      if (!allowedStatus.has(status)) return json({ error: "status_invalid" }, 400);
      job.status = status;
    }
    if (body.notes !== undefined) job.notes = (body.notes || "").toString().slice(0, 500);
    if (body.modelGlb !== undefined) job.modelGlb = (body.modelGlb || "").toString().trim();
    if (body.modelUsdz !== undefined) job.modelUsdz = (body.modelUsdz || "").toString().trim();
    if (body.provider !== undefined) {
      const provider = (body.provider || "").toString().trim().toLowerCase();
      if (!getAiProvider(env, provider)) return json({ error: "provider_invalid" }, 400);
      job.provider = provider;
    }
    if (body.aiModel !== undefined) job.aiModel = (body.aiModel || "").toString().trim();
    job.updatedAt = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE model_jobs
       SET provider = ?1, ai_model = ?2, auto_mode = ?3, status = ?4, notes = ?5, model_glb = ?6, model_usdz = ?7,
           reference_images_json = ?8, provider_task_id = ?9, provider_task_endpoint = ?10, provider_status = ?11, updated_at = ?12
       WHERE id = ?13`
    )
      .bind(
        job.provider,
        job.aiModel,
        job.autoMode ? 1 : 0,
        job.status,
        job.notes,
        job.modelGlb || "",
        job.modelUsdz || "",
        JSON.stringify(job.referenceImages || []),
        job.providerTaskId || "",
        job.providerTaskEndpoint || "",
        job.providerStatus || "",
        job.updatedAt,
        job.id
      )
      .run();

    if (job.status === "publicado") {
      const item = await getItemById(env, job.itemId);
      if (item) {
        const nextModelGlb = job.modelGlb || item.modelGlb;
        const nextModelUsdz = job.modelUsdz || item.modelUsdz;
        await env.DB.prepare("UPDATE items SET model_glb = ?1, model_usdz = ?2 WHERE id = ?3")
          .bind(nextModelGlb || "", nextModelUsdz || "", item.id)
          .run();
      }
    }
    return json({ job });
  }

  const deleteJobRoute = method === "DELETE" && matchRoute("/api/model-jobs/:id", pathname);
  if (deleteJobRoute) {
    const job = await getModelJobById(env, deleteJobRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    await env.DB.prepare("DELETE FROM model_jobs WHERE id = ?1").bind(job.id).run();
    await deleteR2Prefix(env, `job-images/${job.id}/`);
    return json({ ok: true, removedJobId: job.id });
  }

  const startAiRoute = method === "POST" && matchRoute("/api/model-jobs/:id/ai/start", pathname);
  if (startAiRoute) {
    const job = await getModelJobById(env, startAiRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const item = await getItemById(env, job.itemId);
    if (!item) return json({ error: "item_not_found" }, 400);

    const body = await parseJsonBody(request);
    const providerId = (body.provider || job.provider || "manual").toString().trim().toLowerCase();
    const provider = getAiProvider(env, providerId);
    if (!provider) return json({ error: "provider_invalid" }, 400);
    if (!provider.enabled) return json({ error: "provider_not_configured" }, 400);
    if (provider.id !== "meshy") return json({ error: "provider_not_implemented" }, 400);

    try {
      const imageInputs = await buildJobImageInputs(env, item, job);
      if (!imageInputs.length) return json({ error: "image_source_not_found" }, 400);
      const aiModel = (body.aiModel || job.aiModel || getConfig(env).meshyModel).toString().trim();
      const startResult = await startMeshyImageTo3D(env, imageInputs, {
        aiModel,
        targetPolycount: body.targetPolycount
      });

      job.provider = provider.id;
      job.aiModel = aiModel;
      job.providerTaskId = startResult.taskId;
      job.providerTaskEndpoint = startResult.endpoint || "";
      job.providerStatus = "SUBMITTED";
      job.status = "processando";
      job.updatedAt = new Date().toISOString();

      await env.DB.prepare(
        `UPDATE model_jobs
         SET provider = ?1, ai_model = ?2, provider_task_id = ?3, provider_task_endpoint = ?4,
             provider_status = ?5, status = ?6, updated_at = ?7
         WHERE id = ?8`
      )
        .bind(
          job.provider,
          job.aiModel,
          job.providerTaskId,
          job.providerTaskEndpoint,
          job.providerStatus,
          job.status,
          job.updatedAt,
          job.id
        )
        .run();
      return json({
        job,
        task: {
          id: startResult.taskId,
          endpoint: startResult.endpoint,
          imagesSent: imageInputs.length
        }
      });
    } catch (error) {
      job.providerStatus = "ERROR_ON_START";
      job.status = "erro";
      job.updatedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE model_jobs SET provider_status = ?1, status = ?2, updated_at = ?3 WHERE id = ?4"
      )
        .bind(job.providerStatus, job.status, job.updatedAt, job.id)
        .run();
      return json({ error: "ai_start_failed", detail: error.message }, 502);
    }
  }

  const syncAiRoute = method === "POST" && matchRoute("/api/model-jobs/:id/ai/sync", pathname);
  if (syncAiRoute) {
    const job = await getModelJobById(env, syncAiRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    if ((job.provider || "") !== "meshy") return json({ error: "provider_not_implemented" }, 400);
    if (!job.providerTaskId) return json({ error: "provider_task_missing" }, 400);

    const body = await parseJsonBody(request);
    try {
      const sync = await fetchMeshyTask(env, job.providerTaskId, job.providerTaskEndpoint || "");
      const taskData = sync.task || {};
      const taskStatus = (taskData.status || "").toString();
      job.providerTaskEndpoint = sync.endpoint || job.providerTaskEndpoint || "";
      job.providerStatus = taskStatus;
      job.status = mapMeshyStatus(taskStatus);

      if (job.status === "revisao") {
        const modelUrls = extractMeshyModelUrls(taskData);
        if (modelUrls.glb && !job.modelGlb) {
          job.modelGlb = await downloadModelToR2(env, modelUrls.glb, ".glb");
        }
        if (modelUrls.usdz && !job.modelUsdz) {
          job.modelUsdz = await downloadModelToR2(env, modelUrls.usdz, ".usdz");
        }
        if (job.autoMode && body.autoPublish === true) {
          job.status = "publicado";
        }
      }

      job.updatedAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE model_jobs
         SET status = ?1, model_glb = ?2, model_usdz = ?3, provider_task_endpoint = ?4, provider_status = ?5, updated_at = ?6
         WHERE id = ?7`
      )
        .bind(
          job.status,
          job.modelGlb || "",
          job.modelUsdz || "",
          job.providerTaskEndpoint || "",
          job.providerStatus || "",
          job.updatedAt,
          job.id
        )
        .run();

      if (job.status === "publicado") {
        const item = await getItemById(env, job.itemId);
        if (item) {
          await env.DB.prepare("UPDATE items SET model_glb = ?1, model_usdz = ?2 WHERE id = ?3")
            .bind(job.modelGlb || item.modelGlb || "", job.modelUsdz || item.modelUsdz || "", item.id)
            .run();
        }
      }
      return json({ job, providerStatus: taskStatus });
    } catch (error) {
      job.status = "erro";
      job.updatedAt = new Date().toISOString();
      await env.DB.prepare("UPDATE model_jobs SET status = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(job.status, job.updatedAt, job.id)
        .run();
      return json({ error: "ai_sync_failed", detail: error.message }, 502);
    }
  }

  return json({ error: "not_found" }, 404);
}
