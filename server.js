const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const multer = require("multer");
const { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } = require("crypto");

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
const GOOGLE_TRANSLATE_API_BASE = "https://translation.googleapis.com/language/translate/v2";
const MESHY_DEFAULT_MODEL = process.env.MESHY_AI_MODEL || "meshy-6";
const MESHY_MAX_REFERENCE_IMAGES = Number(process.env.MESHY_MAX_REFERENCE_IMAGES || 4);
const CAPTURE_MIN_START_FOOD = Number(process.env.CAPTURE_MIN_START_FOOD || 6);
const CAPTURE_MIN_START_GENERAL = Number(process.env.CAPTURE_MIN_START_GENERAL || 4);
const CAPTURE_RECOMMENDED_FOOD = Number(process.env.CAPTURE_RECOMMENDED_FOOD || 20);
const CAPTURE_RECOMMENDED_GENERAL = Number(process.env.CAPTURE_RECOMMENDED_GENERAL || 12);
const SESSION_SECRET = (process.env.SESSION_SECRET || "").toString().trim() || "dev-session-secret-change-me";
const GOOGLE_TRANSLATE_LANGUAGE_MAP = {
  "pt-BR": "pt",
  "en-US": "en",
  "es-ES": "es",
  "fr-FR": "fr",
  "it-IT": "it",
  "de-DE": "de"
};
const TRANSLATE_WINDOW_MS = Number(process.env.TRANSLATE_WINDOW_MS || 60 * 1000);
const TRANSLATE_MAX_PER_WINDOW = Number(process.env.TRANSLATE_MAX_PER_WINDOW || 20);
const TRANSLATE_MAX_TEXTS = Number(process.env.TRANSLATE_MAX_TEXTS || 80);
const TRANSLATE_MAX_CHARS_PER_TEXT = Number(process.env.TRANSLATE_MAX_CHARS_PER_TEXT || 300);
const TRANSLATE_MAX_TOTAL_CHARS = Number(process.env.TRANSLATE_MAX_TOTAL_CHARS || 6000);
const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS || 24 * 60 * 60 * 1000);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 6);
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MS || 15 * 60 * 1000);
const ORDER_WINDOW_MS = Number(process.env.ORDER_WINDOW_MS || 5 * 60 * 1000);
const ORDER_MAX_PER_WINDOW = Number(process.env.ORDER_MAX_PER_WINDOW || 20);
const AI_ACTION_WINDOW_MS = Number(process.env.AI_ACTION_WINDOW_MS || 60 * 1000);
const AI_ACTION_MAX_PER_WINDOW = Number(process.env.AI_ACTION_MAX_PER_WINDOW || 12);
const PUBLIC_EVENT_WINDOW_MS = Number(process.env.PUBLIC_EVENT_WINDOW_MS || 5 * 60 * 1000);
const PUBLIC_EVENT_MAX_PER_WINDOW = Number(process.env.PUBLIC_EVENT_MAX_PER_WINDOW || 200);
const QA_MIN_PUBLISH_SCORE = Number(process.env.QA_MIN_PUBLISH_SCORE || 70);
const DEFAULT_PUBLIC_TEMPLATE = "topo-do-mundo";
const TEMPLATE_NAME_PATTERN = /^[a-z0-9-]{1,60}$/;

const tokens = new Map();
const loginAttempts = new Map();
const translateRate = new Map();
const orderRate = new Map();
const aiActionRate = new Map();
const publicEventRate = new Map();
let dbWriteQueue = Promise.resolve();
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MODEL_EXTENSIONS = new Set([".glb", ".usdz"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TABLE_PATTERN = /^[a-zA-Z0-9\-_.#]{1,32}$/;
const PUBLIC_EVENT_TYPES = new Set([
  "menu_view",
  "item_view",
  "ar_open",
  "add_to_cart",
  "order_submit",
  "qr_scan"
]);
const LANGUAGE_CODES = ["pt-BR", "en-US", "es-ES", "fr-FR", "it-IT", "de-DE"];
const DEFAULT_LANGUAGE_CODE = "pt-BR";
const UI_MESSAGE_KEYS = [
  "searchPlaceholder",
  "modeMenu",
  "menuPersonality",
  "all",
  "ar",
  "add",
  "noItemsFound",
  "orderOfTable",
  "orderSummary",
  "close",
  "noItemsInCart",
  "total",
  "tablePlaceholder",
  "clear",
  "submit",
  "sending",
  "msgNeedTable",
  "msgEmpty",
  "msgFail",
  "msgOk",
  "msgConnection",
  "msgCleared",
  "language"
];

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

function sanitizeTemplateName(value) {
  const raw = (value || "").toString().trim().toLowerCase();
  if (!raw || raw === "default") return DEFAULT_PUBLIC_TEMPLATE;
  if (!TEMPLATE_NAME_PATTERN.test(raw)) return DEFAULT_PUBLIC_TEMPLATE;
  return raw;
}

function resolveRestaurantTemplatePath(templateName) {
  const safeTemplate = sanitizeTemplateName(templateName);
  return `/templates/${safeTemplate}.html`;
}

function normalizeLanguageCode(value) {
  return LANGUAGE_CODES.includes(value) ? value : DEFAULT_LANGUAGE_CODE;
}

function normalizeLanguageList(value, preferredDefault = DEFAULT_LANGUAGE_CODE) {
  const input = Array.isArray(value) ? value : [];
  const unique = [];
  input.forEach((code) => {
    const normalized = normalizeLanguageCode(code);
    if (!unique.includes(normalized)) unique.push(normalized);
  });
  if (!unique.length) unique.push(...LANGUAGE_CODES);
  const defaultCode = normalizeLanguageCode(preferredDefault);
  if (!unique.includes(defaultCode)) unique.unshift(defaultCode);
  return unique.slice(0, LANGUAGE_CODES.length);
}

function sanitizeText(value, max = 255) {
  return (value || "").toString().trim().replace(/\s+/g, " ").slice(0, max);
}

function toGoogleLanguageCode(code, fallback = "pt") {
  const normalized = normalizeLanguageCode(code);
  return GOOGLE_TRANSLATE_LANGUAGE_MAP[normalized] || fallback;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function consumeInMemoryRateLimit(bucket, key, maxPerWindow, windowMs) {
  const safeKey = key || "unknown";
  const now = Date.now();
  const current = bucket.get(safeKey);

  if (!current || now - current.windowStart > windowMs) {
    bucket.set(safeKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxPerWindow) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - current.windowStart)) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;
  bucket.set(safeKey, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

function consumeTranslateRateLimit(ip) {
  return consumeInMemoryRateLimit(
    translateRate,
    ip || "unknown",
    TRANSLATE_MAX_PER_WINDOW,
    TRANSLATE_WINDOW_MS
  );
}

function consumeOrderRateLimit(ip) {
  return consumeInMemoryRateLimit(
    orderRate,
    ip || "unknown",
    ORDER_MAX_PER_WINDOW,
    ORDER_WINDOW_MS
  );
}

function consumePublicEventRateLimit(ip) {
  return consumeInMemoryRateLimit(
    publicEventRate,
    ip || "unknown",
    PUBLIC_EVENT_MAX_PER_WINDOW,
    PUBLIC_EVENT_WINDOW_MS
  );
}

function consumeAiActionRateLimit(userId, action) {
  return consumeInMemoryRateLimit(
    aiActionRate,
    `${action || "unknown"}:${userId || "unknown"}`,
    AI_ACTION_MAX_PER_WINDOW,
    AI_ACTION_WINDOW_MS
  );
}

function sanitizeTableLabel(value) {
  const table = sanitizeText(value, 32);
  if (!TABLE_PATTERN.test(table)) return "";
  return table;
}

function sanitizeEventType(value) {
  const eventType = sanitizeText(value, 40).toLowerCase();
  if (!PUBLIC_EVENT_TYPES.has(eventType)) return "";
  return eventType;
}

function hashEventIp(ip) {
  return createHash("sha256")
    .update(`event:${SESSION_SECRET}:${ip || "unknown"}`)
    .digest("hex");
}

function sanitizeTranslatePayload(body) {
  const rawTexts = Array.isArray(body && body.texts) ? body.texts : [];
  if (!rawTexts.length) return { ok: false, error: "texts_required" };
  if (rawTexts.length > TRANSLATE_MAX_TEXTS) return { ok: false, error: "too_many_texts" };

  const texts = [];
  let totalChars = 0;
  for (const rawText of rawTexts) {
    const text = sanitizeText(rawText, TRANSLATE_MAX_CHARS_PER_TEXT);
    texts.push(text);
    totalChars += text.length;
  }
  if (totalChars > TRANSLATE_MAX_TOTAL_CHARS) return { ok: false, error: "texts_too_large" };

  const targetLanguage = normalizeLanguageCode(body.targetLanguage || body.target || "");
  const requestedSource = sanitizeText(body.sourceLanguage || body.source || "", 16);

  return {
    ok: true,
    texts,
    targetLanguage,
    targetGoogleCode: toGoogleLanguageCode(targetLanguage, "pt"),
    sourceLanguage: requestedSource ? toGoogleLanguageCode(requestedSource, "pt") : ""
  };
}

async function requestGoogleTranslations(payload) {
  const apiKey = sanitizeText(process.env.GOOGLE_TRANSLATE_API_KEY || "", 256);
  if (!apiKey) {
    return { ok: false, status: 503, error: "google_translate_not_configured" };
  }

  const nonEmpty = [];
  const nonEmptyIndexes = [];
  payload.texts.forEach((text, index) => {
    if (!text) return;
    nonEmpty.push(text);
    nonEmptyIndexes.push(index);
  });

  const output = payload.texts.map(() => "");
  if (!nonEmpty.length) return { ok: true, translations: output };

  const reqBody = {
    q: nonEmpty,
    target: payload.targetGoogleCode,
    format: "text"
  };
  if (payload.sourceLanguage) reqBody.source = payload.sourceLanguage;

  let response;
  try {
    response = await fetch(`${GOOGLE_TRANSLATE_API_BASE}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(reqBody)
    });
  } catch {
    return { ok: false, status: 502, error: "translate_failed" };
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      error: "translate_failed",
      detail: sanitizeText(data && data.error && data.error.message ? data.error.message : "", 220)
    };
  }

  const translated = Array.isArray(data && data.data && data.data.translations)
    ? data.data.translations
    : [];
  if (translated.length !== nonEmpty.length) {
    return { ok: false, status: 502, error: "translate_failed" };
  }

  translated.forEach((entry, listIndex) => {
    const originalIndex = nonEmptyIndexes[listIndex];
    const maxLen = payload.texts[originalIndex].length + 120;
    output[originalIndex] = sanitizeText(decodeHtmlEntities(entry.translatedText || ""), maxLen);
  });

  return { ok: true, translations: output };
}

function sanitizeContactEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return "";
  return EMAIL_PATTERN.test(email) ? email : "";
}

function sanitizeUiMessages(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  Object.entries(value).forEach(([langCode, entriesRaw]) => {
    const code = normalizeLanguageCode(langCode);
    if (!entriesRaw || typeof entriesRaw !== "object" || Array.isArray(entriesRaw)) return;
    const entries = {};
    UI_MESSAGE_KEYS.forEach((key) => {
      if (entriesRaw[key] === undefined || entriesRaw[key] === null) return;
      const text = entriesRaw[key].toString().trim().slice(0, 180);
      if (text) entries[key] = text;
    });
    if (Object.keys(entries).length > 0) {
      output[code] = entries;
    }
  });
  return output;
}

function sanitizeCategoryLabels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  Object.entries(value).forEach(([categoryRaw, translationsRaw]) => {
    const categoryKey = normalizeSlug(categoryRaw);
    if (!categoryKey || !translationsRaw || typeof translationsRaw !== "object" || Array.isArray(translationsRaw)) {
      return;
    }
    const translations = {};
    Object.entries(translationsRaw).forEach(([langCode, textRaw]) => {
      const code = normalizeLanguageCode(langCode);
      const text = (textRaw || "").toString().trim().slice(0, 80);
      if (text) translations[code] = text;
    });
    if (Object.keys(translations).length > 0) {
      output[categoryKey] = translations;
    }
  });
  return output;
}

function sanitizeNullableUrl(value, max = 600) {
  const text = sanitizeText(value, max);
  if (!text) return "";
  if (text.startsWith("/uploads/")) return text;
  if (isRemoteHttpUrl(text)) return text;
  return "";
}

function sanitizePrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 99999) return 99999;
  return Math.round(num * 100) / 100;
}

function normalizeRestaurantRecord(raw = {}) {
  const next = { ...raw };
  if (!next.theme || typeof next.theme !== "object") {
    next.theme = { accent: "#D95F2B" };
  } else if (!next.theme.accent) {
    next.theme.accent = "#D95F2B";
  }
  if (!Array.isArray(next.heroImages)) {
    next.heroImages = [];
  }
  if (!next.contact || typeof next.contact !== "object") {
    next.contact = { address: "", phone: "", email: "", website: "" };
  } else {
    next.contact = {
      address: next.contact.address || "",
      phone: next.contact.phone || "",
      email: next.contact.email || "",
      website: next.contact.website || ""
    };
  }
  const currentDefault =
    (next.languageSettings && next.languageSettings.defaultLanguage) || DEFAULT_LANGUAGE_CODE;
  const languageSettings = next.languageSettings || {};
  next.languageSettings = {
    defaultLanguage: normalizeLanguageCode(currentDefault),
    languages: normalizeLanguageList(languageSettings.languages, currentDefault)
  };
  next.uiMessages = sanitizeUiMessages(next.uiMessages);
  next.categoryLabels = sanitizeCategoryLabels(next.categoryLabels);
  next.template = sanitizeTemplateName(next.template);
  return next;
}

function sanitizePublicItemRecord(raw = {}) {
  const item = raw || {};
  return {
    id: sanitizeText(item.id, 80),
    name: sanitizeText(item.name, 160),
    description: sanitizeText(item.description, 800),
    price: sanitizePrice(item.price),
    image: sanitizeNullableUrl(item.image),
    modelGlb: sanitizeNullableUrl(item.modelGlb),
    modelUsdz: sanitizeNullableUrl(item.modelUsdz),
    category: sanitizeText(item.category, 80)
  };
}

async function readDb() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  const db = JSON.parse(raw);
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.restaurants)) db.restaurants = [];
  if (!Array.isArray(db.items)) db.items = [];
  ensureDbShape(db);
  return db;
}

async function writeDb(db) {
  const snapshot = JSON.stringify(db, null, 2);
  const runWrite = async () => {
    const tempPath = `${DATA_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, snapshot, "utf-8");
    await fs.rename(tempPath, DATA_PATH);
  };
  dbWriteQueue = dbWriteQueue.then(runWrite, runWrite);
  await dbWriteQueue;
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

function findModelJob(db, id) {
  ensureModelJobs(db);
  return db.modelJobs.find((job) => job.id === id);
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

function authorizeModelJob(req, res, next) {
  const job = findModelJob(req.db, req.params.id);
  if (!job) {
    return res.status(404).json({ error: "job_not_found" });
  }
  if (!canAccessRestaurant(req.user, job.restaurantId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  req.modelJob = job;
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

function ensurePublicEvents(db) {
  if (!Array.isArray(db.publicEvents)) {
    db.publicEvents = [];
  }
}

function toModelQualityBand(score) {
  if (score >= 85) return "excelente";
  if (score >= 70) return "boa";
  if (score >= 55) return "aceitavel";
  return "fraca";
}

function ensureModelJobQualityFields(job) {
  if (!job || typeof job !== "object") return;
  if (!Array.isArray(job.referenceImages)) {
    job.referenceImages = [];
  }
  if (!Array.isArray(job.qaChecklist)) {
    job.qaChecklist = [];
  }
  if (job.qaNotes === undefined || job.qaNotes === null) {
    job.qaNotes = "";
  }
  const score = Number.isFinite(Number(job.qaScore)) ? Number(job.qaScore) : 0;
  job.qaScore = Math.max(0, Math.min(100, Math.round(score)));
  job.qaBand = sanitizeText(job.qaBand || toModelQualityBand(job.qaScore), 20) || "fraca";
}

function ensureModelJobs(db) {
  if (!Array.isArray(db.modelJobs)) {
    db.modelJobs = [];
  }
  db.modelJobs.forEach(ensureModelJobQualityFields);
}

function ensureDbShape(db) {
  ensureOrders(db);
  ensureModelJobs(db);
  ensurePublicEvents(db);
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

function looksLikeFoodItem(item) {
  const text = `${item?.name || ""} ${item?.description || ""}`.toLowerCase();
  const foodHints = [
    "prato",
    "massa",
    "penne",
    "pizza",
    "burger",
    "hamb",
    "sobremesa",
    "dessert",
    "bolo",
    "cheese",
    "frango",
    "carne",
    "peixe",
    "salada",
    "food",
    "menu"
  ];
  return foodHints.some((hint) => text.includes(hint));
}

function evaluateCaptureReadiness(item, job) {
  const referenceCount = Array.isArray(job?.referenceImages) ? job.referenceImages.length : 0;
  const scanCount = Array.isArray(item?.scans) ? item.scans.length : 0;
  const heroImageCount = item?.image ? 1 : 0;
  const isFoodItem = looksLikeFoodItem(item);
  const requiredToStart = isFoodItem ? CAPTURE_MIN_START_FOOD : CAPTURE_MIN_START_GENERAL;
  const recommendedForQuality = Math.max(
    requiredToStart,
    isFoodItem ? CAPTURE_RECOMMENDED_FOOD : CAPTURE_RECOMMENDED_GENERAL
  );
  const totalVisualInputs = referenceCount + scanCount + heroImageCount;
  const progress = Math.min(
    100,
    Math.round((totalVisualInputs / Math.max(1, recommendedForQuality)) * 100)
  );
  const readyToStart = totalVisualInputs >= requiredToStart;
  const qualityReady = totalVisualInputs >= recommendedForQuality;
  return {
    isFoodItem,
    referenceCount,
    scanCount,
    heroImageCount,
    totalVisualInputs,
    requiredToStart,
    recommendedForQuality,
    readyToStart,
    qualityReady,
    progress
  };
}

async function inspectUploadedModel(urlValue) {
  const safeUrl = (urlValue || "").toString().trim();
  if (!safeUrl) return { exists: false, size: 0 };
  if (safeUrl.startsWith("/uploads/")) {
    const localPath = urlToUploadFilePath(safeUrl);
    if (!localPath) return { exists: false, size: 0 };
    try {
      const stat = await fs.stat(localPath);
      return { exists: stat.isFile(), size: Number(stat.size) || 0 };
    } catch {
      return { exists: false, size: 0 };
    }
  }
  if (!isRemoteHttpUrl(safeUrl)) return { exists: false, size: 0 };
  try {
    const head = await fetch(safeUrl, { method: "HEAD" });
    if (!head.ok) return { exists: false, size: 0 };
    const contentLength = Number(head.headers.get("content-length") || 0);
    return { exists: true, size: Number.isFinite(contentLength) ? contentLength : 0 };
  } catch {
    return { exists: false, size: 0 };
  }
}

async function evaluateJobQuality(item, job) {
  let score = 0;
  const checklist = [];
  const capture = evaluateCaptureReadiness(item, job);
  const totalRefs = capture.totalVisualInputs;
  const isFood = capture.isFoodItem;

  if (capture.qualityReady && totalRefs >= capture.recommendedForQuality + 4) {
    score += 24;
    checklist.push("captura_fotos:excelente");
  } else if (capture.qualityReady) {
    score += 20;
    checklist.push("captura_fotos:ok");
  } else if (capture.readyToStart) {
    score += 14;
    checklist.push("captura_fotos:minima");
  } else if (totalRefs >= Math.max(1, capture.requiredToStart - 2)) {
    score += 8;
    checklist.push("captura_fotos:baixa");
  } else {
    checklist.push("captura_fotos:insuficiente");
  }

  if (!capture.readyToStart) score -= 10;

  if (capture.scanCount > 0 && capture.referenceCount > 0) {
    score += 4;
    checklist.push("captura_fontes:mista");
  } else {
    checklist.push("captura_fontes:unica");
  }

  const glbInfo = await inspectUploadedModel(job.modelGlb || "");
  const usdzInfo = await inspectUploadedModel(job.modelUsdz || "");
  const hasGlb = Boolean(job.modelGlb);
  const hasUsdz = Boolean(job.modelUsdz);

  if (hasGlb) {
    score += 18;
    checklist.push("arquivo_glb:ok");
  } else {
    checklist.push("arquivo_glb:ausente");
  }
  if (hasUsdz) {
    score += 18;
    checklist.push("arquivo_usdz:ok");
  } else {
    checklist.push("arquivo_usdz:ausente");
  }

  if (glbInfo.exists && glbInfo.size >= 150 * 1024 && glbInfo.size <= 40 * 1024 * 1024) {
    score += 10;
    checklist.push("peso_glb:ok");
  } else if (hasGlb) {
    checklist.push("peso_glb:revisar");
  }

  if (usdzInfo.exists && usdzInfo.size >= 150 * 1024 && usdzInfo.size <= 40 * 1024 * 1024) {
    score += 10;
    checklist.push("peso_usdz:ok");
  } else if (hasUsdz) {
    checklist.push("peso_usdz:revisar");
  }

  if (isFood) {
    if (totalRefs >= capture.recommendedForQuality) {
      score += 12;
      checklist.push("food_refs:alto");
    } else if (totalRefs >= capture.requiredToStart) {
      score += 6;
      checklist.push("food_refs:minimo");
    } else {
      score -= 8;
      checklist.push("food_refs:baixo");
    }

    if (capture.scanCount < 3) {
      score -= 4;
      checklist.push("food_angulo_scanner:baixo");
    } else {
      checklist.push("food_angulo_scanner:ok");
    }

    if (glbInfo.exists && usdzInfo.exists) {
      const ratio = Math.max(glbInfo.size, usdzInfo.size) / Math.max(1, Math.min(glbInfo.size, usdzInfo.size));
      if (ratio <= 4) {
        score += 6;
        checklist.push("food_consistencia_arquivos:ok");
      } else if (ratio > 8) {
        score -= 6;
        checklist.push("food_consistencia_arquivos:revisar");
      }
    }
  }

  const providerStatus = (job.providerStatus || "").toString().toUpperCase();
  if (providerStatus === "SUCCEEDED") {
    score += 10;
    checklist.push("status_ia:sucesso");
  } else if (providerStatus === "FAILED") {
    checklist.push("status_ia:falha");
  } else {
    checklist.push("status_ia:pendente");
  }

  if ((job.notes || "").length >= 20) {
    score += 4;
    checklist.push("observacoes:ok");
  } else {
    checklist.push("observacoes:curtas");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: boundedScore,
    band: toModelQualityBand(boundedScore),
    checklist,
    capture
  };
}

function recordPublicEvent(db, req, payload = {}) {
  ensurePublicEvents(db);
  const eventType = sanitizeEventType(payload.eventType || payload.type || "");
  if (!eventType) return { ok: false, error: "event_invalid" };
  const restaurantId = sanitizeText(payload.restaurantId, 80);
  if (!restaurantId) return { ok: false, error: "restaurant_required" };
  const itemId = sanitizeText(payload.itemId, 80);
  const tableLabel = sanitizeTableLabel(payload.table || payload.tableLabel || "");
  const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};

  db.publicEvents.push({
    id: `e-${randomUUID()}`,
    restaurantId,
    itemId: itemId || "",
    eventType,
    tableLabel,
    ipHash: hashEventIp(getClientIp(req)),
    userAgent: sanitizeText(req.headers["user-agent"] || "", 220),
    meta,
    createdAt: new Date().toISOString()
  });
  return { ok: true };
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
  }

  if (unique.length <= MESHY_MAX_REFERENCE_IMAGES) {
    return unique;
  }

  const sampled = [];
  for (let index = 0; index < MESHY_MAX_REFERENCE_IMAGES; index += 1) {
    const ratio = MESHY_MAX_REFERENCE_IMAGES === 1
      ? 0
      : index / (MESHY_MAX_REFERENCE_IMAGES - 1);
    const sourceIndex = Math.round(ratio * (unique.length - 1));
    sampled.push(unique[sourceIndex]);
  }

  return [...new Set(sampled)].slice(0, MESHY_MAX_REFERENCE_IMAGES);
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

async function autoProcessRestaurantJobs(db, restaurantId, options = {}) {
  ensureModelJobs(db);
  const maxJobs = Math.max(1, Math.min(30, Number(options.maxJobs) || 12));
  const providerMeshy = getAiProvider("meshy");
  const summary = {
    restaurantId,
    total: 0,
    started: 0,
    synced: 0,
    published: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  const jobs = db.modelJobs
    .filter((job) => job.restaurantId === restaurantId && job.autoMode)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, maxJobs);
  summary.total = jobs.length;

  for (const job of jobs) {
    ensureModelJobQualityFields(job);
    const detail = { jobId: job.id, itemId: job.itemId, action: "skip", status: job.status, reason: "" };
    const item = findItem(db, job.itemId);
    if (!item) {
      summary.failed += 1;
      detail.action = "error";
      detail.reason = "item_not_found";
      summary.details.push(detail);
      continue;
    }

    try {
      if (["enviado", "triagem"].includes(job.status) && !job.providerTaskId) {
        if (!providerMeshy || !providerMeshy.enabled) {
          summary.skipped += 1;
          detail.reason = "provider_not_configured";
          summary.details.push(detail);
          continue;
        }
        const capture = evaluateCaptureReadiness(item, job);
        if (!capture.readyToStart) {
          job.status = "triagem";
          job.updatedAt = new Date().toISOString();
          summary.skipped += 1;
          detail.reason = "capture_insufficient";
          detail.status = job.status;
          detail.capture = capture;
          summary.details.push(detail);
          continue;
        }
        const imageInputs = await buildJobImageInputs(item, job);
        if (!imageInputs.length) {
          job.status = "triagem";
          job.updatedAt = new Date().toISOString();
          summary.skipped += 1;
          detail.reason = "image_source_not_found";
          detail.status = job.status;
          summary.details.push(detail);
          continue;
        }

        const aiModel = sanitizeText(job.aiModel || MESHY_DEFAULT_MODEL, 60);
        const startResult = await startMeshyImageTo3D(imageInputs, { aiModel });
        job.provider = "meshy";
        job.aiModel = aiModel;
        job.providerTaskId = startResult.taskId;
        job.providerTaskEndpoint = startResult.endpoint || "";
        job.providerStatus = "SUBMITTED";
        job.status = "processando";
        job.qaScore = 0;
        job.qaBand = "fraca";
        job.qaChecklist = [];
        job.qaNotes = "";
        job.updatedAt = new Date().toISOString();
        summary.started += 1;
        detail.action = "started";
        detail.status = job.status;
        detail.reason = "ok";
        summary.details.push(detail);
        continue;
      }

      if (job.provider === "meshy" && job.providerTaskId && ["processando", "triagem"].includes(job.status)) {
        const sync = await fetchMeshyTask(job.providerTaskId, job.providerTaskEndpoint || "");
        const taskData = sync.task || {};
        const taskStatus = (taskData.status || "").toString();
        job.providerTaskEndpoint = sync.endpoint || job.providerTaskEndpoint || "";
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
          const evaluation = await evaluateJobQuality(item, job);
          job.qaScore = evaluation.score;
          job.qaBand = evaluation.band;
          job.qaChecklist = evaluation.checklist;
          const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
          if (evaluation.score >= QA_MIN_PUBLISH_SCORE && hasRequiredModels) {
            job.status = "publicado";
          }
        }

        job.updatedAt = new Date().toISOString();
        if (job.status === "publicado") {
          if (job.modelGlb) item.modelGlb = job.modelGlb;
          if (job.modelUsdz) item.modelUsdz = job.modelUsdz;
          summary.published += 1;
        }
        summary.synced += 1;
        detail.action = "synced";
        detail.status = job.status;
        detail.reason = "ok";
        summary.details.push(detail);
        continue;
      }

      if (job.status === "revisao") {
        const evaluation = await evaluateJobQuality(item, job);
        job.qaScore = evaluation.score;
        job.qaBand = evaluation.band;
        job.qaChecklist = evaluation.checklist;
        const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
        if (evaluation.score >= QA_MIN_PUBLISH_SCORE && hasRequiredModels) {
          job.status = "publicado";
          if (job.modelGlb) item.modelGlb = job.modelGlb;
          if (job.modelUsdz) item.modelUsdz = job.modelUsdz;
          summary.published += 1;
        }
        job.updatedAt = new Date().toISOString();
        detail.action = "qa_review";
        detail.status = job.status;
        detail.reason = "ok";
        summary.details.push(detail);
        continue;
      }

      summary.skipped += 1;
      detail.reason = "status_not_eligible";
      summary.details.push(detail);
    } catch (error) {
      summary.failed += 1;
      detail.action = "error";
      detail.reason = error?.message || "auto_process_failed";
      summary.details.push(detail);
    }
  }

  return summary;
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
  const safeSlug = normalizeSlug(req.params.slug);
  if (!safeSlug) {
    return res.redirect("/");
  }
  const params = new URLSearchParams(req.query);
  params.set("r", safeSlug);

  try {
    const db = await readDb();
    const restaurant = db.restaurants.find((r) => r.slug === safeSlug);
    if (restaurant) {
      let templatePath = resolveRestaurantTemplatePath(restaurant.template);
      const localTemplatePath = path.join(PUBLIC_DIR, templatePath.replace(/^\//, ""));
      if (!fsSync.existsSync(localTemplatePath)) {
        templatePath = resolveRestaurantTemplatePath(DEFAULT_PUBLIC_TEMPLATE);
      }
      return res.redirect(`${templatePath}?${params.toString()}`);
    }
  } catch (err) {
    // Fallback to default menu page if DB read fails.
  }

  const fallbackTemplate = resolveRestaurantTemplatePath(DEFAULT_PUBLIC_TEMPLATE);
  res.redirect(`${fallbackTemplate}?${params.toString()}`);
});

app.get("/i/:id", (req, res) => {
  res.redirect(`/item.html?id=${encodeURIComponent(req.params.id)}`);
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/api/health", async (req, res) => {
  const db = await readDb();
  res.json({
    ok: true,
    now: new Date().toISOString(),
    counts: {
      users: Array.isArray(db.users) ? db.users.length : 0,
      restaurants: Array.isArray(db.restaurants) ? db.restaurants.length : 0,
      items: Array.isArray(db.items) ? db.items.length : 0,
      orders: Array.isArray(db.orders) ? db.orders.length : 0,
      modelJobs: Array.isArray(db.modelJobs) ? db.modelJobs.length : 0,
      publicEvents: Array.isArray(db.publicEvents) ? db.publicEvents.length : 0
    }
  });
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
      template: sanitizeTemplateName(restaurant.template),
      itemCount: itemCounts.get(restaurant.id) || 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  res.json({ restaurants });
});

app.get("/api/public/restaurant/:slug", async (req, res) => {
  const safeSlug = normalizeSlug(req.params.slug);
  if (!safeSlug) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  const db = await readDb();
  const restaurant = db.restaurants.find((r) => r.slug === safeSlug);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  const items = db.items
    .filter((i) => i.restaurantId === restaurant.id)
    .map((item) => sanitizePublicItemRecord(item));
  res.json({ restaurant: normalizeRestaurantRecord(restaurant), items });
});

app.get("/api/public/item/:id", async (req, res) => {
  const db = await readDb();
  const item = findItem(db, req.params.id);
  if (!item) {
    return res.status(404).json({ error: "item_not_found" });
  }
  const restaurant = findRestaurant(db, item.restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  const requestedSlug = normalizeSlug(req.query && req.query.r);
  if (requestedSlug && restaurant.slug !== requestedSlug) {
    return res.status(404).json({ error: "item_not_found" });
  }
  res.json({
    item: sanitizePublicItemRecord(item),
    restaurant: normalizeRestaurantRecord(restaurant)
  });
});

app.post("/api/public/events", async (req, res) => {
  const ip = getClientIp(req);
  const rate = consumePublicEventRateLimit(ip);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "too_many_events" });
  }

  const db = await readDb();
  const restaurantSlug = normalizeSlug(req.body && req.body.restaurantSlug);
  let restaurantId = sanitizeText(req.body && req.body.restaurantId, 80);
  if (!restaurantId && restaurantSlug) {
    const restaurant = db.restaurants.find((entry) => entry.slug === restaurantSlug);
    if (restaurant) restaurantId = restaurant.id;
  }
  if (!restaurantId) {
    return res.status(400).json({ error: "restaurant_required" });
  }

  const restaurant = findRestaurant(db, restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }

  const itemId = sanitizeText(req.body && req.body.itemId, 80);
  if (itemId) {
    const item = findItem(db, itemId);
    if (!item || item.restaurantId !== restaurant.id) {
      return res.status(400).json({ error: "item_invalid" });
    }
  }

  const result = recordPublicEvent(db, req, {
    restaurantId: restaurant.id,
    itemId,
    type: req.body && (req.body.type || req.body.eventType),
    table: req.body && (req.body.table || req.body.tableLabel),
    meta: req.body && req.body.meta
  });
  if (!result.ok) {
    return res.status(400).json({ error: result.error || "event_invalid" });
  }

  await writeDb(db);
  res.json({ ok: true });
});

app.post("/api/public/translate", async (req, res) => {
  const ip = getClientIp(req);
  const rate = consumeTranslateRateLimit(ip);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "too_many_translate_requests" });
  }

  const parsed = sanitizeTranslatePayload(req.body || {});
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const result = await requestGoogleTranslations(parsed);
  if (!result.ok) {
    const payload = { error: result.error };
    if (result.detail && process.env.DEBUG_ERRORS === "1") {
      payload.detail = result.detail;
    }
    return res.status(result.status || 502).json(payload);
  }

  res.json({
    targetLanguage: parsed.targetLanguage,
    sourceLanguage: parsed.sourceLanguage || "",
    translations: result.translations
  });
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
  res.json({
    providers: getAiProviders(),
    qa: { minPublishScore: QA_MIN_PUBLISH_SCORE },
    captureGuide: {
      minStartFood: CAPTURE_MIN_START_FOOD,
      minStartGeneral: CAPTURE_MIN_START_GENERAL,
      recommendedFood: CAPTURE_RECOMMENDED_FOOD,
      recommendedGeneral: CAPTURE_RECOMMENDED_GENERAL
    }
  });
});

app.get("/api/my-restaurant", requireAuth, async (req, res) => {
  if (req.user.role !== "client" || !req.user.restaurantId) {
    return res.status(403).json({ error: "forbidden" });
  }
  const restaurant = findRestaurant(req.db, req.user.restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  res.json({ restaurant: normalizeRestaurantRecord(restaurant) });
});

app.post("/api/logout", requireAuth, async (req, res) => {
  const token = getToken(req);
  tokens.delete(token);
  res.json({ ok: true });
});

app.get("/api/restaurants", requireAuth, requireMaster, async (req, res) => {
  res.json({ restaurants: (req.db.restaurants || []).map(normalizeRestaurantRecord) });
});

app.post("/api/restaurants", requireAuth, requireMaster, async (req, res) => {
  const db = req.db;
  const name = sanitizeText(req.body && req.body.name, 120);
  const description = sanitizeText(req.body && req.body.description, 500);
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
    logo: sanitizeNullableUrl(req.body.logo),
    theme: { accent: sanitizeText(req.body.accent, 16) || "#D95F2B" },
    template: sanitizeTemplateName(req.body.template || DEFAULT_PUBLIC_TEMPLATE),
    contact: {
      address: sanitizeText(req.body.contactAddress || req.body.address, 220),
      phone: sanitizeText(req.body.contactPhone || req.body.phone, 80),
      email: sanitizeContactEmail(req.body.contactEmail || req.body.email),
      website: sanitizeText(req.body.contactWebsite || req.body.website, 220)
    },
    languageSettings: {
      defaultLanguage: normalizeLanguageCode(req.body.defaultLanguage),
      languages: normalizeLanguageList(req.body.languages, req.body.defaultLanguage)
    },
    uiMessages: sanitizeUiMessages(req.body.uiMessages),
    categoryLabels: sanitizeCategoryLabels(req.body.categoryLabels)
  };
  db.restaurants.push(restaurant);
  await writeDb(db);
  res.json({ restaurant: normalizeRestaurantRecord(restaurant) });
});

app.put("/api/restaurants/:id", requireAuth, authorizeRestaurant, async (req, res) => {
  const db = req.db;
  const restaurant = req.restaurant;
  if (req.body.name !== undefined) {
    const nextName = sanitizeText(req.body.name, 120);
    if (nextName) restaurant.name = nextName;
  }
  if (req.body.description !== undefined) {
    restaurant.description = sanitizeText(req.body.description, 500);
  }
  if (req.body.slug) {
    const slug = normalizeSlug(req.body.slug);
    if (slug && slug !== restaurant.slug) {
      if (db.restaurants.some((r) => r.slug === slug)) {
        return res.status(400).json({ error: "slug_in_use" });
      }
      restaurant.slug = slug;
    }
  }
  if (req.body.logo !== undefined) restaurant.logo = sanitizeNullableUrl(req.body.logo);
  if (req.body.accent !== undefined) {
    restaurant.theme.accent = sanitizeText(req.body.accent, 16) || restaurant.theme.accent || "#D95F2B";
  }
  if (req.body.template !== undefined) {
    restaurant.template = sanitizeTemplateName(req.body.template || DEFAULT_PUBLIC_TEMPLATE);
  }
  if (req.body.contactAddress !== undefined || req.body.address !== undefined) {
    restaurant.contact = restaurant.contact || {};
    restaurant.contact.address = sanitizeText(req.body.contactAddress || req.body.address, 220);
  }
  if (req.body.contactPhone !== undefined || req.body.phone !== undefined) {
    restaurant.contact = restaurant.contact || {};
    restaurant.contact.phone = sanitizeText(req.body.contactPhone || req.body.phone, 80);
  }
  if (req.body.contactEmail !== undefined || req.body.email !== undefined) {
    restaurant.contact = restaurant.contact || {};
    restaurant.contact.email = sanitizeContactEmail(req.body.contactEmail || req.body.email);
  }
  if (req.body.contactWebsite !== undefined || req.body.website !== undefined) {
    restaurant.contact = restaurant.contact || {};
    restaurant.contact.website = sanitizeText(req.body.contactWebsite || req.body.website, 220);
  }
  const currentDefaultLanguage =
    restaurant.languageSettings && restaurant.languageSettings.defaultLanguage
      ? restaurant.languageSettings.defaultLanguage
      : DEFAULT_LANGUAGE_CODE;
  if (req.body.defaultLanguage !== undefined) {
    restaurant.languageSettings = restaurant.languageSettings || {};
    restaurant.languageSettings.defaultLanguage = normalizeLanguageCode(req.body.defaultLanguage);
  }
  if (req.body.languages !== undefined) {
    restaurant.languageSettings = restaurant.languageSettings || {};
    restaurant.languageSettings.languages = normalizeLanguageList(
      req.body.languages,
      restaurant.languageSettings.defaultLanguage || currentDefaultLanguage
    );
  }
  restaurant.languageSettings = {
    defaultLanguage: normalizeLanguageCode(
      (restaurant.languageSettings && restaurant.languageSettings.defaultLanguage) || currentDefaultLanguage
    ),
    languages: normalizeLanguageList(
      restaurant.languageSettings && restaurant.languageSettings.languages,
      (restaurant.languageSettings && restaurant.languageSettings.defaultLanguage) || currentDefaultLanguage
    )
  };
  if (req.body.uiMessages !== undefined) {
    restaurant.uiMessages = sanitizeUiMessages(req.body.uiMessages);
  }
  if (req.body.categoryLabels !== undefined) {
    restaurant.categoryLabels = sanitizeCategoryLabels(req.body.categoryLabels);
  }
  await writeDb(db);
  res.json({ restaurant: normalizeRestaurantRecord(restaurant) });
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
      name: sanitizeText(name, 160),
      description: sanitizeText(description, 800),
      price: sanitizePrice(price),
      image: sanitizeNullableUrl(req.body.image),
      modelGlb: sanitizeNullableUrl(req.body.modelGlb),
      modelUsdz: sanitizeNullableUrl(req.body.modelUsdz),
      category: sanitizeText(req.body.category, 80),
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
  if (req.body.name !== undefined) {
    const nextName = sanitizeText(req.body.name, 160);
    if (!nextName) return res.status(400).json({ error: "name_required" });
    item.name = nextName;
  }
  if (req.body.description !== undefined) item.description = sanitizeText(req.body.description, 800);
  if (req.body.price !== undefined) item.price = sanitizePrice(req.body.price);
  if (req.body.image !== undefined) item.image = sanitizeNullableUrl(req.body.image);
  if (req.body.modelGlb !== undefined) item.modelGlb = sanitizeNullableUrl(req.body.modelGlb);
  if (req.body.modelUsdz !== undefined) item.modelUsdz = sanitizeNullableUrl(req.body.modelUsdz);
  if (req.body.category !== undefined) item.category = sanitizeText(req.body.category, 80);
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
  const ip = getClientIp(req);
  const rate = consumeOrderRateLimit(ip);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "too_many_orders" });
  }

  const db = await readDb();
  ensureDbShape(db);
  const { table, items } = req.body || {};
  const restaurantSlug = normalizeSlug(req.body && req.body.restaurantSlug);
  if (!restaurantSlug) {
    return res.status(400).json({ error: "restaurant_required" });
  }
  const restaurant = db.restaurants.find((r) => r.slug === restaurantSlug);
  if (!restaurant) {
    return res.status(404).json({ error: "restaurant_not_found" });
  }
  const tableValue = sanitizeTableLabel(table || "");
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

  items.slice(0, 30).forEach((entry) => {
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
  recordPublicEvent(db, req, {
    restaurantId: restaurant.id,
    type: "order_submit",
    table: tableValue,
    meta: { orderId: order.id, items: orderItems.length, total: order.total }
  });
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
  "/api/restaurants/:id/analytics",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    ensureDbShape(db);
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const sinceIso = new Date(sinceMs).toISOString();

    const orders = db.orders.filter(
      (order) => order.restaurantId === req.restaurant.id && (order.createdAt || "") >= sinceIso
    );
    const events = db.publicEvents.filter(
      (event) => event.restaurantId === req.restaurant.id && (event.createdAt || "") >= sinceIso
    );

    const itemNameMap = new Map(
      db.items
        .filter((item) => item.restaurantId === req.restaurant.id)
        .map((item) => [item.id, item.name || "Item"])
    );

    const eventCounter = Object.create(null);
    for (const event of events) {
      const type = sanitizeEventType(event.eventType || event.type || "");
      if (!type) continue;
      eventCounter[type] = (eventCounter[type] || 0) + 1;
    }

    const orderedCounter = new Map();
    let revenueTotal = 0;
    for (const order of orders) {
      revenueTotal += Number(order.total) || 0;
      const orderItems = Array.isArray(order.items) ? order.items : [];
      for (const entry of orderItems) {
        if (!entry || !entry.id) continue;
        const qty = Math.max(1, Math.min(99, Number(entry.qty) || 1));
        orderedCounter.set(entry.id, (orderedCounter.get(entry.id) || 0) + qty);
      }
    }

    const arCounter = new Map();
    for (const event of events) {
      const type = sanitizeEventType(event.eventType || event.type || "");
      const itemId = sanitizeText(event.itemId, 80);
      if (type !== "ar_open" || !itemId) continue;
      arCounter.set(itemId, (arCounter.get(itemId) || 0) + 1);
    }

    const topArItems = [...arCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([itemId, opens]) => ({
        itemId,
        itemName: itemNameMap.get(itemId) || "Item",
        opens
      }));

    const topOrderedItems = [...orderedCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([itemId, qty]) => ({
        itemId,
        itemName: itemNameMap.get(itemId) || "Item",
        qty
      }));

    const menuViews = Number(eventCounter.menu_view || 0);
    const arOpens = Number(eventCounter.ar_open || 0);
    const ordersTotal = orders.length;

    const analytics = {
      windowDays: days,
      since: sinceIso,
      summary: {
        ordersTotal,
        revenueTotal: Number(revenueTotal.toFixed(2)),
        avgTicket: ordersTotal > 0 ? Number((revenueTotal / ordersTotal).toFixed(2)) : 0,
        menuViews,
        arOpens,
        addToCart: Number(eventCounter.add_to_cart || 0),
        itemViews: Number(eventCounter.item_view || 0),
        orderSubmitEvents: Number(eventCounter.order_submit || 0)
      },
      conversion: {
        menuToAr: menuViews > 0 ? Number(((arOpens / menuViews) * 100).toFixed(2)) : 0,
        arToOrder: arOpens > 0 ? Number(((ordersTotal / arOpens) * 100).toFixed(2)) : 0,
        menuToOrder: menuViews > 0 ? Number(((ordersTotal / menuViews) * 100).toFixed(2)) : 0
      },
      topArItems,
      topOrderedItems
    };

    res.json({ analytics });
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
  authorizeModelJob,
  uploadModelJobImages.array("photos", 20),
  async (req, res) => {
    const db = req.db;
    const job = req.modelJob;
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: "photos_required" });
    }
    const currentReferenceCount = Array.isArray(job.referenceImages) ? job.referenceImages.length : 0;
    if (currentReferenceCount + files.length > 40) {
      return res.status(400).json({ error: "too_many_reference_images", max: 40 });
    }

    const urls = files.map((file) => `/uploads/job-images/${job.id}/${file.filename}`);
    if (!Array.isArray(job.referenceImages)) {
      job.referenceImages = [];
    }
    job.referenceImages.push(...urls);
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    const item = findItem(db, job.itemId);
    const capture = item ? evaluateCaptureReadiness(item, job) : null;
    res.json({ urls, count: job.referenceImages.length, job, capture });
  }
);

app.get("/api/model-jobs/:id/capture/analyze", requireAuth, async (req, res) => {
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
    return res.status(404).json({ error: "item_not_found" });
  }
  const capture = evaluateCaptureReadiness(item, job);
  res.json({ capture });
});

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
      qaScore: 0,
      qaBand: "fraca",
      qaChecklist: [],
      qaNotes: "",
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
  let requestedStatus = null;
  if (req.body.status !== undefined) {
    const status = (req.body.status || "").toString().toLowerCase();
    if (!allowedStatus.has(status)) {
      return res.status(400).json({ error: "status_invalid" });
    }
    requestedStatus = status;
  }
  if (req.body.notes !== undefined) {
    job.notes = (req.body.notes || "").toString().slice(0, 500);
  }
  if (req.body.modelGlb !== undefined) {
    job.modelGlb = sanitizeNullableUrl(req.body.modelGlb);
  }
  if (req.body.modelUsdz !== undefined) {
    job.modelUsdz = sanitizeNullableUrl(req.body.modelUsdz);
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
  if (req.body.qaNotes !== undefined) {
    job.qaNotes = sanitizeText(req.body.qaNotes, 1000);
  }
  if (Array.isArray(req.body.qaChecklist)) {
    job.qaChecklist = req.body.qaChecklist
      .map((entry) => sanitizeText(entry, 80))
      .filter(Boolean)
      .slice(0, 30);
  }
  if (req.body.qaScore !== undefined) {
    const nextScore = Number(req.body.qaScore);
    job.qaScore = Number.isFinite(nextScore) ? Math.max(0, Math.min(100, Math.round(nextScore))) : 0;
    job.qaBand = toModelQualityBand(job.qaScore);
  }

  if (requestedStatus === "publicado") {
    const qaScore = Number(job.qaScore) || 0;
    const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
    if (qaScore < QA_MIN_PUBLISH_SCORE || !hasRequiredModels) {
      return res.status(400).json({
        error: "publish_gate_failed",
        requiredScore: QA_MIN_PUBLISH_SCORE,
        currentScore: qaScore,
        hasRequiredModels
      });
    }
  }
  if (requestedStatus) {
    job.status = requestedStatus;
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
  const aiLimit = consumeAiActionRateLimit(req.user && req.user.id, "start");
  if (!aiLimit.allowed) {
    res.setHeader("Retry-After", String(aiLimit.retryAfterSeconds));
    return res.status(429).json({ error: "ai_rate_limited" });
  }

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
  const capture = evaluateCaptureReadiness(item, job);
  if (!capture.readyToStart) {
    return res.status(400).json({ error: "capture_insufficient", capture });
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
    job.qaScore = 0;
    job.qaBand = "fraca";
    job.qaChecklist = [];
    job.qaNotes = "";
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
  const aiLimit = consumeAiActionRateLimit(req.user && req.user.id, "sync");
  if (!aiLimit.allowed) {
    res.setHeader("Retry-After", String(aiLimit.retryAfterSeconds));
    return res.status(429).json({ error: "ai_rate_limited" });
  }

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
        const itemForQuality = findItem(db, job.itemId);
        if (itemForQuality) {
          const evaluation = await evaluateJobQuality(itemForQuality, job);
          job.qaScore = evaluation.score;
          job.qaBand = evaluation.band;
          job.qaChecklist = evaluation.checklist;
          const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
          if (evaluation.score >= QA_MIN_PUBLISH_SCORE && hasRequiredModels) {
            job.status = "publicado";
          }
        }
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

app.post("/api/model-jobs/:id/qa/evaluate", requireAuth, async (req, res) => {
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

  const evaluation = await evaluateJobQuality(item, job);
  const extraChecks = Array.isArray(req.body && req.body.extraChecklist)
    ? req.body.extraChecklist
        .map((entry) => sanitizeText(entry, 80))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  job.qaScore = evaluation.score;
  job.qaBand = evaluation.band;
  job.qaChecklist = [...evaluation.checklist, ...extraChecks];
  if (req.body && req.body.qaNotes !== undefined) {
    job.qaNotes = sanitizeText(req.body.qaNotes, 1000);
  }
  job.updatedAt = new Date().toISOString();
  await writeDb(db);
  res.json({ job, evaluation, capture: evaluation.capture || null });
});

app.post("/api/model-jobs/:id/publish", requireAuth, async (req, res) => {
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

  const evaluation = await evaluateJobQuality(item, job);
  job.qaScore = evaluation.score;
  job.qaBand = evaluation.band;
  job.qaChecklist = evaluation.checklist;

  const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
  if (!hasRequiredModels || evaluation.score < QA_MIN_PUBLISH_SCORE) {
    job.status = "revisao";
    job.updatedAt = new Date().toISOString();
    await writeDb(db);
    return res.status(400).json({
      error: "publish_gate_failed",
      requiredScore: QA_MIN_PUBLISH_SCORE,
      currentScore: evaluation.score,
      hasRequiredModels,
      checklist: evaluation.checklist
    });
  }

  job.status = "publicado";
  job.updatedAt = new Date().toISOString();
  if (job.modelGlb) item.modelGlb = job.modelGlb;
  if (job.modelUsdz) item.modelUsdz = job.modelUsdz;
  await writeDb(db);
  res.json({
    ok: true,
    status: "publicado",
    qaScore: evaluation.score,
    qaBand: evaluation.band
  });
});

app.post(
  "/api/restaurants/:id/model-jobs/auto-process",
  requireAuth,
  authorizeRestaurant,
  async (req, res) => {
    const db = req.db;
    ensureModelJobs(db);
    const summary = await autoProcessRestaurantJobs(db, req.restaurant.id, {
      maxJobs: req.body && req.body.maxJobs
    });
    await writeDb(db);
    res.json({ ok: true, summary });
  }
);

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
