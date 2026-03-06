import { scrypt } from "scrypt-js";

const MESHY_API_BASE = "https://api.meshy.ai/openapi/v1";
const GOOGLE_TRANSLATE_API_BASE = "https://translation.googleapis.com/language/translate/v2";
const GOOGLE_TRANSLATE_LANGUAGE_MAP = {
  "pt-BR": "pt",
  "en-US": "en",
  "es-ES": "es",
  "fr-FR": "fr",
  "it-IT": "it",
  "de-DE": "de"
};
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
  "order_success",
  "language_change",
  "search_use",
  "share_link",
  "qr_scan",
  "lead_submit",
  "reservation_submit",
  "waitlist_join",
  "feedback_submit",
  "pwa_install",
  "map_open",
  "social_open",
  "delivery_open",
  "checkout_start"
]);
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const DEFAULT_ACCENT = "#D95F2B";
const DEFAULT_PUBLIC_TEMPLATE = "topo-do-mundo";
const TEMPLATE_NAME_PATTERN = /^[a-z0-9-]{1,60}$/;
const DEFAULT_LANGUAGE_CODE = "pt-BR";
const DEFAULT_LANGUAGE_OPTIONS = ["pt-BR", "en-US", "es-ES", "fr-FR", "it-IT", "de-DE"];
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
const INTEGRATION_MAX_STRING = 280;
const WEBHOOK_TIMEOUT_MS = 2800;
const encoder = new TextEncoder();
let schemaInitPromise = null;

export default {
  async fetch(request, env) {
    let response;
    try {
      response = await handleRequest(request, env);
    } catch (error) {
      console.error("Unhandled worker error", error);
      if ((env.DEBUG_ERRORS || "").toString() === "1") {
        response = json(
          {
            error: "internal_error",
            detail: error?.message || String(error),
            stack: (error && error.stack) ? String(error.stack) : ""
          },
          500
        );
      } else {
        response = json({ error: "internal_error" }, 500);
      }
    }
    return withSecurityHeaders(request, response);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledAutoProcess(event, env));
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/robots.txt") {
    return buildRobotsTxtResponse(url);
  }

  if (pathname === "/sitemap.xml") {
    return buildSitemapXmlResponse(env, url);
  }

  if (pathname.startsWith("/uploads/")) {
    return handleUploads(request, env, pathname);
  }

  const redirectRestaurant = matchRoute("/r/:slug", pathname);
  if (redirectRestaurant) {
    return handleRestaurantRedirect(url, env, redirectRestaurant.slug);
  }

  const redirectItem = matchRoute("/i/:id", pathname);
  if (redirectItem) {
    const target = new URL(`/item.html?id=${encodeURIComponent(redirectItem.id)}`, url);
    return Response.redirect(target.toString(), 302);
  }

  if (pathname.startsWith("/api/")) {
    return handleApi(request, env, url);
  }

  if (pathname === "/admin") {
    const response = await env.ASSETS.fetch(new Request(new URL("/admin.html", request.url), request));
    return withAssetCacheHeaders("/admin.html", response, { noIndex: true, noStore: true });
  }

  const response = await env.ASSETS.fetch(request);
  return withAssetCacheHeaders(pathname, response);
}

async function ensureRuntimeSchema(env) {
  if (schemaInitPromise) return schemaInitPromise;
  schemaInitPromise = (async () => {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL DEFAULT 0
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        item_id TEXT DEFAULT '',
        event_type TEXT NOT NULL,
        table_label TEXT DEFAULT '',
        ip_hash TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        meta_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        source TEXT DEFAULT '',
        message TEXT DEFAULT '',
        meta_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        guests INTEGER NOT NULL DEFAULT 2,
        date_label TEXT DEFAULT '',
        time_label TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'novo',
        source TEXT DEFAULT '',
        meta_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS waitlist_entries (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        guests INTEGER NOT NULL DEFAULT 2,
        eta_minutes INTEGER NOT NULL DEFAULT 0,
        source TEXT DEFAULT '',
        meta_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )`
    ).run();

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS feedback_entries (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT DEFAULT '',
        email TEXT DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 0,
        comment TEXT DEFAULT '',
        source TEXT DEFAULT '',
        meta_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )`
    ).run();

    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_events_restaurant_created ON events(restaurant_id, created_at)"
    ).run();
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(event_type, created_at)"
    ).run();
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_leads_restaurant_created ON leads(restaurant_id, created_at)"
    ).run();
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_created ON reservations(restaurant_id, created_at)"
    ).run();
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_created ON waitlist_entries(restaurant_id, created_at)"
    ).run();
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_feedback_restaurant_created ON feedback_entries(restaurant_id, created_at)"
    ).run();

    const alterStatements = [
      "ALTER TABLE model_jobs ADD COLUMN qa_score INTEGER DEFAULT 0",
      "ALTER TABLE model_jobs ADD COLUMN qa_band TEXT DEFAULT 'fraca'",
      "ALTER TABLE model_jobs ADD COLUMN qa_checklist_json TEXT DEFAULT '[]'",
      "ALTER TABLE model_jobs ADD COLUMN qa_notes TEXT DEFAULT ''",
      "ALTER TABLE restaurants ADD COLUMN contact_address TEXT DEFAULT ''",
      "ALTER TABLE restaurants ADD COLUMN contact_phone TEXT DEFAULT ''",
      "ALTER TABLE restaurants ADD COLUMN contact_email TEXT DEFAULT ''",
      "ALTER TABLE restaurants ADD COLUMN contact_website TEXT DEFAULT ''",
      "ALTER TABLE restaurants ADD COLUMN languages_json TEXT DEFAULT '[]'",
      "ALTER TABLE restaurants ADD COLUMN default_language TEXT DEFAULT 'pt-BR'",
      "ALTER TABLE restaurants ADD COLUMN ui_messages_json TEXT DEFAULT '{}'",
      "ALTER TABLE restaurants ADD COLUMN category_labels_json TEXT DEFAULT '{}'",
      "ALTER TABLE restaurants ADD COLUMN integrations_json TEXT DEFAULT '{}'"
    ];

    for (const statement of alterStatements) {
      try {
        await env.DB.prepare(statement).run();
      } catch (error) {
        const message = (error && error.message ? error.message : "").toLowerCase();
        if (!message.includes("duplicate column name")) {
          throw error;
        }
      }
    }
  })();

  try {
    await schemaInitPromise;
  } catch (error) {
    schemaInitPromise = null;
    throw error;
  }
}

function withSecurityHeaders(request, response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://analytics.tiktok.com https://www.clarity.ms https://script.hotjar.com https://static.hotjar.com",
      "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' https: data: blob:",
      "connect-src 'self' https://api.meshy.ai https://translation.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.clarity.ms https://analytics.tiktok.com https://www.facebook.com https://graph.facebook.com https://script.hotjar.com https://static.hotjar.com https://ws.hotjar.com wss://ws.hotjar.com",
      "media-src 'self' data: blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, { status: response.status, headers });
}

function withAssetCacheHeaders(pathname, response, options = {}) {
  if (response.status >= 400) return response;
  const headers = new Headers(response.headers);
  const { noIndex = false, noStore = false } = options;
  if (noIndex) {
    headers.set("x-robots-tag", "noindex, nofollow");
  }

  if (noStore) {
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }

  const safePath = (pathname || "").toLowerCase();
  if (safePath === "/sw.js") {
    headers.set("cache-control", "no-cache");
    return new Response(response.body, { status: response.status, headers });
  }

  if (
    /\.(css|js|svg|png|jpg|jpeg|webp|ico|woff2|woff|webmanifest)$/i.test(safePath)
  ) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(response.body, { status: response.status, headers });
  }

  if (safePath === "/" || safePath.endsWith(".html") || safePath.startsWith("/templates/")) {
    headers.set("cache-control", "public, max-age=300");
  }
  return new Response(response.body, { status: response.status, headers });
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildRobotsTxtResponse(url) {
  const base = `${url.protocol}//${url.host}`;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin",
    `Sitemap: ${base}/sitemap.xml`
  ].join("\n");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}

async function buildSitemapXmlResponse(env, url) {
  const base = `${url.protocol}//${url.host}`;
  const nowIso = new Date().toISOString();
  const { results } = await env.DB.prepare("SELECT slug FROM restaurants ORDER BY name COLLATE NOCASE").all();

  const urls = [
    { loc: `${base}/`, lastmod: nowIso }
  ];
  (results || []).forEach((row) => {
    const safeSlug = normalizeSlug(row.slug || "");
    if (!safeSlug) return;
    urls.push({
      loc: `${base}/r/${encodeURIComponent(safeSlug)}`,
      lastmod: nowIso
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (entry) =>
        `  <url><loc>${xmlEscape(entry.loc)}</loc><lastmod>${xmlEscape(String(entry.lastmod).slice(0, 10))}</lastmod></url>`
    )
    .join("\n")}\n</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=900"
    }
  });
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

async function hashEventIp(ip, env) {
  const secret = (env.SESSION_SECRET || "").toString().trim() || "dev-session-secret-change-me";
  return sha256Hex(`event:${secret}:${ip || "unknown"}`);
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

function sanitizeTemplateName(value) {
  const raw = (value || "").toString().trim().toLowerCase();
  if (!raw || raw === "default") return DEFAULT_PUBLIC_TEMPLATE;
  if (!TEMPLATE_NAME_PATTERN.test(raw)) return DEFAULT_PUBLIC_TEMPLATE;
  return raw;
}

function resolveRestaurantTemplatePath(templateName) {
  return `/templates/${sanitizeTemplateName(templateName)}.html`;
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
  const defaultLanguage = sanitizeLanguageCode(row.default_language || DEFAULT_LANGUAGE_CODE);
  const languages = sanitizeLanguageList(parseJsonSafe(row.languages_json, []), defaultLanguage);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    logo: row.logo || "",
    theme: { accent: row.accent || DEFAULT_ACCENT },
    template: sanitizeTemplateName(row.template),
    heroImages: parseJsonSafe(row.hero_images_json, []),
    contact: {
      address: row.contact_address || "",
      phone: row.contact_phone || "",
      email: row.contact_email || "",
      website: row.contact_website || ""
    },
    languageSettings: {
      defaultLanguage,
      languages
    },
    uiMessages: sanitizeUiMessages(parseJsonSafe(row.ui_messages_json, {})),
    categoryLabels: sanitizeCategoryLabels(parseJsonSafe(row.category_labels_json, {})),
    integrations: sanitizeIntegrations(parseJsonSafe(row.integrations_json, {}))
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

function toPublicItem(item) {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    name: item.name,
    description: item.description || "",
    price: Number(item.price) || 0,
    image: item.image || "",
    modelGlb: item.modelGlb || "",
    modelUsdz: item.modelUsdz || "",
    category: item.category || ""
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

function mapLeadRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    source: row.source || "",
    message: row.message || "",
    meta: parseJsonSafe(row.meta_json, {}),
    createdAt: row.created_at
  };
}

function mapReservationRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    guests: toInt(row.guests, 2),
    date: row.date_label || "",
    time: row.time_label || "",
    notes: row.notes || "",
    status: row.status || "novo",
    source: row.source || "",
    meta: parseJsonSafe(row.meta_json, {}),
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
    qaScore: toInt(row.qa_score, 0),
    qaBand: (row.qa_band || "fraca").toString(),
    qaChecklist: parseJsonSafe(row.qa_checklist_json, []),
    qaNotes: row.qa_notes || "",
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
  const captureMinStartFood = Math.max(3, Math.min(20, toInt(env.CAPTURE_MIN_START_FOOD, 6)));
  const captureMinStartGeneral = Math.max(2, Math.min(20, toInt(env.CAPTURE_MIN_START_GENERAL, 4)));
  const captureRecommendedFood = Math.max(
    captureMinStartFood,
    Math.min(40, toInt(env.CAPTURE_RECOMMENDED_FOOD, 20))
  );
  const captureRecommendedGeneral = Math.max(
    captureMinStartGeneral,
    Math.min(40, toInt(env.CAPTURE_RECOMMENDED_GENERAL, 12))
  );
  return {
    tokenTtlMs: toInt(env.TOKEN_TTL_MS, 24 * 60 * 60 * 1000),
    loginWindowMs: toInt(env.LOGIN_WINDOW_MS, 15 * 60 * 1000),
    loginMaxAttempts: toInt(env.LOGIN_MAX_ATTEMPTS, 6),
    loginLockMs: toInt(env.LOGIN_LOCK_MS, 15 * 60 * 1000),
    orderWindowMs: toInt(env.ORDER_WINDOW_MS, 5 * 60 * 1000),
    orderMaxPerWindow: toInt(env.ORDER_MAX_PER_WINDOW, 20),
    eventWindowMs: toInt(env.PUBLIC_EVENT_WINDOW_MS, 5 * 60 * 1000),
    eventMaxPerWindow: toInt(env.PUBLIC_EVENT_MAX_PER_WINDOW, 200),
    aiActionWindowMs: toInt(env.AI_ACTION_WINDOW_MS, 60 * 1000),
    aiActionMaxPerWindow: toInt(env.AI_ACTION_MAX_PER_WINDOW, 12),
    translateWindowMs: toInt(env.TRANSLATE_WINDOW_MS, 60 * 1000),
    translateMaxPerWindow: toInt(env.TRANSLATE_MAX_PER_WINDOW, 20),
    translateMaxTexts: Math.max(1, Math.min(100, toInt(env.TRANSLATE_MAX_TEXTS, 80))),
    translateMaxCharsPerText: Math.max(1, Math.min(2000, toInt(env.TRANSLATE_MAX_CHARS_PER_TEXT, 300))),
    translateMaxTotalChars: Math.max(1, Math.min(30000, toInt(env.TRANSLATE_MAX_TOTAL_CHARS, 6000))),
    qaMinPublishScore: toInt(env.QA_MIN_PUBLISH_SCORE, 70),
    meshyModel: (env.MESHY_AI_MODEL || "meshy-6").toString(),
    meshyMaxImages: Math.max(1, Math.min(8, toInt(env.MESHY_MAX_REFERENCE_IMAGES, 4))),
    captureMinStartFood,
    captureMinStartGeneral,
    captureRecommendedFood,
    captureRecommendedGeneral
  };
}

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function sanitizeText(value, max = 255) {
  return (value || "").toString().trim().replace(/\s+/g, " ").slice(0, max);
}

function sanitizeLanguageCode(value) {
  const code = sanitizeText(value, 10);
  if (!code) return DEFAULT_LANGUAGE_CODE;
  if (DEFAULT_LANGUAGE_OPTIONS.includes(code)) return code;
  return DEFAULT_LANGUAGE_CODE;
}

function sanitizeLanguageList(value, preferredDefault = DEFAULT_LANGUAGE_CODE) {
  const raw = Array.isArray(value) ? value : [];
  const ordered = [];
  for (const item of raw) {
    const code = sanitizeLanguageCode(item);
    if (!ordered.includes(code)) ordered.push(code);
  }

  if (!ordered.length) {
    ordered.push(...DEFAULT_LANGUAGE_OPTIONS);
  }

  const normalizedDefault = sanitizeLanguageCode(preferredDefault);
  if (!ordered.includes(normalizedDefault)) {
    ordered.unshift(normalizedDefault);
  }

  return ordered.slice(0, DEFAULT_LANGUAGE_OPTIONS.length);
}

function toGoogleLanguageCode(value, fallback = "pt") {
  const normalized = sanitizeLanguageCode(value);
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

function sanitizeTranslatePayload(body, config) {
  const rawTexts = Array.isArray(body?.texts) ? body.texts : [];
  if (!rawTexts.length) {
    return { ok: false, error: "texts_required" };
  }
  if (rawTexts.length > config.translateMaxTexts) {
    return { ok: false, error: "too_many_texts" };
  }

  const sanitized = [];
  let totalChars = 0;
  for (const value of rawTexts) {
    const text = sanitizeText(value, config.translateMaxCharsPerText);
    sanitized.push(text);
    totalChars += text.length;
  }

  if (totalChars > config.translateMaxTotalChars) {
    return { ok: false, error: "texts_too_large" };
  }

  const targetLanguage = sanitizeLanguageCode(body?.targetLanguage || body?.target || "");
  const requestedSource = sanitizeText(body?.sourceLanguage || body?.source || "", 16);
  const sourceLanguage = requestedSource
    ? toGoogleLanguageCode(requestedSource, "pt")
    : "";

  return {
    ok: true,
    texts: sanitized,
    targetLanguage,
    targetGoogleCode: toGoogleLanguageCode(targetLanguage, "pt"),
    sourceLanguage
  };
}

async function requestGoogleTranslations(env, payload) {
  const apiKey = sanitizeText(env.GOOGLE_TRANSLATE_API_KEY || "", 256);
  if (!apiKey) {
    return { ok: false, status: 503, error: "google_translate_not_configured" };
  }

  const nonEmpty = [];
  const nonEmptyIndices = [];
  payload.texts.forEach((text, index) => {
    if (!text) return;
    nonEmpty.push(text);
    nonEmptyIndices.push(index);
  });

  const output = payload.texts.map(() => "");
  if (!nonEmpty.length) {
    return { ok: true, translations: output };
  }

  const requestBody = {
    q: nonEmpty,
    target: payload.targetGoogleCode,
    format: "text"
  };
  if (payload.sourceLanguage) {
    requestBody.source = payload.sourceLanguage;
  }

  let response;
  try {
    response = await fetch(`${GOOGLE_TRANSLATE_API_BASE}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(requestBody)
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
    const detail = sanitizeText(data?.error?.message || `translate_http_${response.status}`, 220);
    return { ok: false, status: 502, error: "translate_failed", detail };
  }

  const translatedEntries = Array.isArray(data?.data?.translations) ? data.data.translations : [];
  if (translatedEntries.length !== nonEmpty.length) {
    return { ok: false, status: 502, error: "translate_failed" };
  }

  translatedEntries.forEach((entry, listIndex) => {
    const safeText = sanitizeText(
      decodeHtmlEntities(entry?.translatedText || ""),
      payload.texts[nonEmptyIndices[listIndex]].length + 120
    );
    output[nonEmptyIndices[listIndex]] = safeText;
  });

  return { ok: true, translations: output };
}

function sanitizeContactEmail(value) {
  const email = sanitizeText(value, 160).toLowerCase();
  if (!email) return "";
  return EMAIL_PATTERN.test(email) ? email : "";
}

function sanitizeUiMessages(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};

  for (const [langCode, rawEntries] of Object.entries(value)) {
    const code = sanitizeLanguageCode(langCode);
    if (!rawEntries || typeof rawEntries !== "object" || Array.isArray(rawEntries)) continue;
    const entries = {};
    for (const key of UI_MESSAGE_KEYS) {
      if (rawEntries[key] === undefined || rawEntries[key] === null) continue;
      const text = sanitizeText(rawEntries[key], 180);
      if (text) entries[key] = text;
    }
    if (Object.keys(entries).length > 0) {
      output[code] = entries;
    }
  }

  return output;
}

function sanitizeCategoryLabels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};

  for (const [categoryKeyRaw, translationsRaw] of Object.entries(value)) {
    const categoryKey = normalizeSlug(categoryKeyRaw);
    if (!categoryKey) continue;
    if (!translationsRaw || typeof translationsRaw !== "object" || Array.isArray(translationsRaw)) continue;

    const translations = {};
    for (const [langCode, textRaw] of Object.entries(translationsRaw)) {
      const code = sanitizeLanguageCode(langCode);
      const text = sanitizeText(textRaw, 80);
      if (!text) continue;
      translations[code] = text;
    }

    if (Object.keys(translations).length > 0) {
      output[categoryKey] = translations;
    }
  }

  return output;
}

function sanitizeEnumValue(value, allowed, fallback) {
  const normalized = sanitizeText(value, 48).toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  return fallback;
}

function sanitizePublicUrl(value, max = INTEGRATION_MAX_STRING) {
  const text = sanitizeText(value, max);
  if (!text) return "";
  if (text.startsWith("/")) return text;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(text)) return text;
  return "";
}

function sanitizeWebhookUrl(value) {
  const text = sanitizeText(value, INTEGRATION_MAX_STRING);
  if (!text) return "";
  if (/^https:\/\//i.test(text)) return text;
  return "";
}

function sanitizeShortToken(value, max = 80) {
  return sanitizeText(value, max).replace(/[^\w\-.:/]/g, "");
}

function sanitizeIntegrations(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const quickLinksRaw = source.quickLinks && typeof source.quickLinks === "object" ? source.quickLinks : {};
  const analyticsRaw = source.analytics && typeof source.analytics === "object" ? source.analytics : {};
  const paymentsRaw = source.payments && typeof source.payments === "object" ? source.payments : {};
  const webhooksRaw = source.webhooks && typeof source.webhooks === "object" ? source.webhooks : {};
  const featuresRaw = source.features && typeof source.features === "object" ? source.features : {};
  const visualRaw = source.visual && typeof source.visual === "object" ? source.visual : {};

  return {
    quickLinks: {
      whatsapp: sanitizePublicUrl(quickLinksRaw.whatsapp),
      telegram: sanitizePublicUrl(quickLinksRaw.telegram),
      instagram: sanitizePublicUrl(quickLinksRaw.instagram),
      facebook: sanitizePublicUrl(quickLinksRaw.facebook),
      tiktok: sanitizePublicUrl(quickLinksRaw.tiktok),
      maps: sanitizePublicUrl(quickLinksRaw.maps),
      website: sanitizePublicUrl(quickLinksRaw.website),
      reservation: sanitizePublicUrl(quickLinksRaw.reservation),
      delivery: sanitizePublicUrl(quickLinksRaw.delivery),
      pickup: sanitizePublicUrl(quickLinksRaw.pickup),
      review: sanitizePublicUrl(quickLinksRaw.review),
      loyalty: sanitizePublicUrl(quickLinksRaw.loyalty)
    },
    analytics: {
      gtmId: sanitizeShortToken(analyticsRaw.gtmId, 32).toUpperCase(),
      ga4Id: sanitizeShortToken(analyticsRaw.ga4Id, 32).toUpperCase(),
      metaPixelId: sanitizeShortToken(analyticsRaw.metaPixelId, 40),
      tiktokPixelId: sanitizeShortToken(analyticsRaw.tiktokPixelId, 40),
      clarityId: sanitizeShortToken(analyticsRaw.clarityId, 40),
      hotjarId: sanitizeShortToken(analyticsRaw.hotjarId, 40)
    },
    payments: {
      stripeCheckoutUrl: sanitizePublicUrl(paymentsRaw.stripeCheckoutUrl),
      paypalMeUrl: sanitizePublicUrl(paymentsRaw.paypalMeUrl),
      mbwayPhone: sanitizeText(paymentsRaw.mbwayPhone, 40),
      pixKey: sanitizeText(paymentsRaw.pixKey, 120)
    },
    webhooks: {
      events: sanitizeWebhookUrl(webhooksRaw.events),
      orders: sanitizeWebhookUrl(webhooksRaw.orders),
      leads: sanitizeWebhookUrl(webhooksRaw.leads),
      reservations: sanitizeWebhookUrl(webhooksRaw.reservations),
      waitlist: sanitizeWebhookUrl(webhooksRaw.waitlist),
      feedback: sanitizeWebhookUrl(webhooksRaw.feedback)
    },
    features: {
      showLeadForm: Boolean(featuresRaw.showLeadForm),
      showReservationForm: Boolean(featuresRaw.showReservationForm),
      showWaitlistForm: Boolean(featuresRaw.showWaitlistForm),
      showFeedbackForm: Boolean(featuresRaw.showFeedbackForm),
      enableInstallPrompt: featuresRaw.enableInstallPrompt !== false,
      enableFavorites: featuresRaw.enableFavorites !== false,
      enableCompactMode: featuresRaw.enableCompactMode !== false,
      enableQuickActions: featuresRaw.enableQuickActions !== false
    },
    visual: {
      preset: sanitizeEnumValue(
        visualRaw.preset,
        ["clean", "editorial", "bold", "night", "beach", "bistro"],
        "clean"
      ),
      density: sanitizeEnumValue(visualRaw.density, ["compact", "comfortable", "spacious"], "comfortable"),
      cardStyle: sanitizeEnumValue(visualRaw.cardStyle, ["soft", "glass", "flat"], "soft")
    }
  };
}

function getRestaurantWebhookUrl(restaurant, channel) {
  if (!restaurant || !restaurant.integrations || !restaurant.integrations.webhooks) return "";
  const url = restaurant.integrations.webhooks[channel];
  return sanitizeWebhookUrl(url);
}

async function sendWebhook(url, payload) {
  if (!url) return { ok: false, skipped: true };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function fireRestaurantWebhook(env, restaurant, channel, payload) {
  const url = getRestaurantWebhookUrl(restaurant, channel);
  if (!url) return;
  await sendWebhook(url, payload);
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

function sanitizeTableLabel(value) {
  const table = sanitizeText(value, 32);
  if (!TABLE_PATTERN.test(table)) return "";
  return table;
}

function sanitizePublicSource(value) {
  return sanitizeText(value || "site", 40).toLowerCase() || "site";
}

function sanitizeLeadPayload(body) {
  const payload = body && typeof body === "object" ? body : {};
  return {
    name: sanitizeText(payload.name, 120),
    email: sanitizeContactEmail(payload.email),
    phone: sanitizeText(payload.phone, 40),
    source: sanitizePublicSource(payload.source),
    message: sanitizeText(payload.message, 800),
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {}
  };
}

function sanitizeReservationPayload(body) {
  const payload = body && typeof body === "object" ? body : {};
  return {
    name: sanitizeText(payload.name, 120),
    phone: sanitizeText(payload.phone, 40),
    email: sanitizeContactEmail(payload.email),
    guests: Math.max(1, Math.min(20, toInt(payload.guests, 2))),
    dateLabel: sanitizeText(payload.date || payload.dateLabel, 40),
    timeLabel: sanitizeText(payload.time || payload.timeLabel, 24),
    notes: sanitizeText(payload.notes, 800),
    source: sanitizePublicSource(payload.source),
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {}
  };
}

function sanitizeWaitlistPayload(body) {
  const payload = body && typeof body === "object" ? body : {};
  return {
    name: sanitizeText(payload.name, 120),
    phone: sanitizeText(payload.phone, 40),
    guests: Math.max(1, Math.min(20, toInt(payload.guests, 2))),
    etaMinutes: Math.max(0, Math.min(300, toInt(payload.etaMinutes, 0))),
    source: sanitizePublicSource(payload.source),
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {}
  };
}

function sanitizeFeedbackPayload(body) {
  const payload = body && typeof body === "object" ? body : {};
  return {
    name: sanitizeText(payload.name, 120),
    email: sanitizeContactEmail(payload.email),
    rating: Math.max(1, Math.min(5, toInt(payload.rating, 5))),
    comment: sanitizeText(payload.comment, 1200),
    source: sanitizePublicSource(payload.source),
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {}
  };
}

function sanitizeEventType(value) {
  const eventType = sanitizeText(value, 40).toLowerCase();
  if (!PUBLIC_EVENT_TYPES.has(eventType)) return "";
  return eventType;
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

function getCaptureTargets(config, isFoodItem) {
  const requiredToStart = isFoodItem
    ? config.captureMinStartFood
    : config.captureMinStartGeneral;
  const recommendedForQuality = Math.max(
    requiredToStart,
    isFoodItem ? config.captureRecommendedFood : config.captureRecommendedGeneral
  );
  return { requiredToStart, recommendedForQuality };
}

function evaluateCaptureReadiness(item, job, config) {
  const referenceCount = Array.isArray(job?.referenceImages) ? job.referenceImages.length : 0;
  const scanCount = Array.isArray(item?.scans) ? item.scans.length : 0;
  const heroImageCount = item?.image ? 1 : 0;
  const isFoodItem = looksLikeFoodItem(item);
  const targets = getCaptureTargets(config, isFoodItem);
  const totalVisualInputs = referenceCount + scanCount + heroImageCount;
  const progress = Math.min(
    100,
    Math.round((totalVisualInputs / Math.max(1, targets.recommendedForQuality)) * 100)
  );
  const readyToStart = totalVisualInputs >= targets.requiredToStart;
  const qualityReady = totalVisualInputs >= targets.recommendedForQuality;
  const hints = [];

  if (!readyToStart) {
    hints.push(
      `Capture pelo menos ${targets.requiredToStart} fotos (atual: ${totalVisualInputs}).`
    );
  }
  if (scanCount < Math.ceil(targets.requiredToStart / 2)) {
    hints.push("Use o scanner para capturar fotos em 360 graus na mesa.");
  }
  if (referenceCount < Math.ceil(targets.requiredToStart / 3)) {
    hints.push("Envie fotos extras no job para cobrir detalhes e evitar malha estourada.");
  }
  if (isFoodItem && totalVisualInputs < targets.recommendedForQuality) {
    hints.push(
      `Para comida, recomendamos ${targets.recommendedForQuality}+ fotos para realismo de textura.`
    );
  }
  if (qualityReady) {
    hints.push("Captura forte para pipeline automatico.");
  }

  return {
    isFoodItem,
    referenceCount,
    scanCount,
    heroImageCount,
    totalVisualInputs,
    requiredToStart: targets.requiredToStart,
    recommendedForQuality: targets.recommendedForQuality,
    readyToStart,
    qualityReady,
    progress,
    hints
  };
}

function toModelQualityBand(score) {
  if (score >= 85) return "excelente";
  if (score >= 70) return "boa";
  if (score >= 55) return "aceitavel";
  return "fraca";
}

async function inspectUploadedModel(env, urlValue) {
  const key = urlToR2Key(urlValue);
  if (!key) return { exists: false, size: 0 };
  const object = await env.UPLOADS.head(key);
  if (!object) return { exists: false, size: 0 };
  return { exists: true, size: Number(object.size) || 0 };
}

async function evaluateJobQuality(env, item, job) {
  const config = getConfig(env);
  let score = 0;
  const checklist = [];
  const capture = evaluateCaptureReadiness(item, job, config);
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
  if (!capture.readyToStart) {
    score -= 10;
  }
  if (capture.scanCount > 0 && capture.referenceCount > 0) {
    score += 4;
    checklist.push("captura_fontes:mista");
  } else {
    checklist.push("captura_fontes:unica");
  }

  const glbInfo = await inspectUploadedModel(env, job.modelGlb || "");
  const usdzInfo = await inspectUploadedModel(env, job.modelUsdz || "");
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

    if ((glbInfo.size > 20 * 1024 * 1024) || (usdzInfo.size > 20 * 1024 * 1024)) {
      score -= 4;
      checklist.push("food_tamanho_mobile:alto");
    }
  }

  if ((job.providerStatus || "").toUpperCase() === "SUCCEEDED") {
    score += 10;
    checklist.push("status_ia:sucesso");
  } else if ((job.providerStatus || "").toUpperCase() === "FAILED") {
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
  if (Array.isArray(capture.hints) && capture.hints.length > 0) {
    capture.hints.slice(0, 4).forEach((hint) => {
      checklist.push(`captura_hint:${sanitizeText(hint, 70)}`);
    });
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: boundedScore,
    band: toModelQualityBand(boundedScore),
    checklist,
    capture
  };
}

async function recordPublicEvent(env, request, payload) {
  const eventType = sanitizeEventType(payload.eventType);
  if (!eventType) return { ok: false, error: "event_invalid" };
  const restaurantId = sanitizeText(payload.restaurantId, 80);
  if (!restaurantId) return { ok: false, error: "restaurant_required" };
  const restaurant =
    payload.restaurant && payload.restaurant.id === restaurantId
      ? payload.restaurant
      : await getRestaurantById(env, restaurantId);
  const itemId = sanitizeText(payload.itemId, 80);
  const tableLabel = sanitizeTableLabel(payload.table || "");
  const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};
  const safeMeta = JSON.stringify(meta).slice(0, 2000);
  const nowIso = new Date().toISOString();
  const ipHash = await hashEventIp(getClientIp(request), env);
  const userAgent = sanitizeText(request.headers.get("user-agent") || "", 220);

  await env.DB.prepare(
    `INSERT INTO events
      (id, restaurant_id, item_id, event_type, table_label, ip_hash, user_agent, meta_json, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(
      `e-${crypto.randomUUID()}`,
      restaurantId,
      itemId || null,
      eventType,
      tableLabel || "",
      ipHash,
      userAgent,
      safeMeta,
      nowIso
    )
    .run();

  if (restaurant) {
    await fireRestaurantWebhook(env, restaurant, "events", {
      type: "public_event",
      restaurantId,
      eventType,
      itemId: itemId || "",
      table: tableLabel || "",
      meta,
      createdAt: nowIso
    });
  }

  return { ok: true };
}

async function consumeRateLimit(env, key, max, windowMs) {
  const now = Date.now();
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?1")
      .bind(now - 24 * 60 * 60 * 1000)
      .run();
  }
  const row = await env.DB.prepare(
    "SELECT key, count, window_start FROM rate_limits WHERE key = ?1"
  )
    .bind(key)
    .first();

  if (!row) {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)"
    )
      .bind(key, now)
      .run();
    return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSeconds: 0 };
  }

  const start = toInt(row.window_start);
  const count = toInt(row.count);
  if (now - start >= windowMs) {
    await env.DB.prepare(
      "UPDATE rate_limits SET count = 1, window_start = ?1 WHERE key = ?2"
    )
      .bind(now, key)
      .run();
    return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSeconds: 0 };
  }

  if (count >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - start)) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?1")
    .bind(key)
    .run();
  return { allowed: true, remaining: Math.max(0, max - (count + 1)), retryAfterSeconds: 0 };
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
  const safeSlug = normalizeSlug(slug);
  if (!safeSlug) {
    return Response.redirect(new URL("/", url).toString(), 302);
  }
  const params = new URLSearchParams(url.search);
  params.set("r", safeSlug);

  const restaurant = await getRestaurantBySlug(env, safeSlug);
  const target = new URL(
    `${resolveRestaurantTemplatePath(restaurant ? restaurant.template : DEFAULT_PUBLIC_TEMPLATE)}?${params.toString()}`,
    url
  );
  return Response.redirect(target.toString(), 302);
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
  }

  if (unique.length <= config.meshyMaxImages) {
    return unique;
  }

  const sampled = [];
  for (let index = 0; index < config.meshyMaxImages; index += 1) {
    const ratio = config.meshyMaxImages === 1 ? 0 : index / (config.meshyMaxImages - 1);
    const sourceIndex = Math.round(ratio * (unique.length - 1));
    sampled.push(unique[sourceIndex]);
  }

  return [...new Set(sampled)].slice(0, config.meshyMaxImages);
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

async function autoProcessRestaurantJobs(env, restaurantId, options = {}) {
  const config = getConfig(env);
  const maxJobs = Math.max(1, Math.min(30, toInt(options.maxJobs, 12)));
  const providerMeshy = getAiProvider(env, "meshy");
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

  const { results: rows } = await env.DB.prepare(
    `SELECT * FROM model_jobs
     WHERE restaurant_id = ?1 AND auto_mode = 1
     ORDER BY updated_at DESC
     LIMIT ?2`
  )
    .bind(restaurantId, maxJobs)
    .all();

  const jobs = (rows || []).map(mapModelJobRow);
  summary.total = jobs.length;

  for (const job of jobs) {
    const detail = { jobId: job.id, itemId: job.itemId, action: "skip", status: job.status, reason: "" };
    const item = await getItemById(env, job.itemId);
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
        const capture = evaluateCaptureReadiness(item, job, config);
        if (!capture.readyToStart) {
          job.status = "triagem";
          job.updatedAt = new Date().toISOString();
          await env.DB.prepare("UPDATE model_jobs SET status = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(job.status, job.updatedAt, job.id)
            .run();
          summary.skipped += 1;
          detail.reason = "capture_insufficient";
          detail.status = job.status;
          detail.capture = capture;
          summary.details.push(detail);
          continue;
        }
        const imageInputs = await buildJobImageInputs(env, item, job);
        if (!imageInputs.length) {
          job.status = "triagem";
          job.updatedAt = new Date().toISOString();
          await env.DB.prepare("UPDATE model_jobs SET status = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(job.status, job.updatedAt, job.id)
            .run();
          summary.skipped += 1;
          detail.reason = "image_source_not_found";
          detail.status = job.status;
          summary.details.push(detail);
          continue;
        }

        const aiModel = sanitizeText(job.aiModel || config.meshyModel, 60);
        const startResult = await startMeshyImageTo3D(env, imageInputs, { aiModel });
        job.provider = "meshy";
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
        summary.started += 1;
        detail.action = "started";
        detail.status = job.status;
        detail.reason = "ok";
        summary.details.push(detail);
        continue;
      }

      if (job.provider === "meshy" && job.providerTaskId && ["processando", "triagem"].includes(job.status)) {
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
        }

        if (job.status === "revisao") {
          const evaluation = await evaluateJobQuality(env, item, job);
          job.qaScore = evaluation.score;
          job.qaBand = evaluation.band;
          job.qaChecklist = evaluation.checklist;
          const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
          if (evaluation.score >= config.qaMinPublishScore && hasRequiredModels) {
            job.status = "publicado";
          }
        }

        job.updatedAt = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE model_jobs
           SET status = ?1, model_glb = ?2, model_usdz = ?3, provider_task_endpoint = ?4, provider_status = ?5,
               qa_score = ?6, qa_band = ?7, qa_checklist_json = ?8, updated_at = ?9
           WHERE id = ?10`
        )
          .bind(
            job.status,
            job.modelGlb || "",
            job.modelUsdz || "",
            job.providerTaskEndpoint || "",
            job.providerStatus || "",
            toInt(job.qaScore, 0),
            (job.qaBand || "fraca").toString(),
            JSON.stringify(job.qaChecklist || []),
            job.updatedAt,
            job.id
          )
          .run();

        if (job.status === "publicado") {
          await env.DB.prepare("UPDATE items SET model_glb = ?1, model_usdz = ?2 WHERE id = ?3")
            .bind(job.modelGlb || item.modelGlb || "", job.modelUsdz || item.modelUsdz || "", item.id)
            .run();
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
        const evaluation = await evaluateJobQuality(env, item, job);
        job.qaScore = evaluation.score;
        job.qaBand = evaluation.band;
        job.qaChecklist = evaluation.checklist;
        const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
        if (evaluation.score >= config.qaMinPublishScore && hasRequiredModels) {
          job.status = "publicado";
          summary.published += 1;
          await env.DB.prepare("UPDATE items SET model_glb = ?1, model_usdz = ?2 WHERE id = ?3")
            .bind(job.modelGlb || item.modelGlb || "", job.modelUsdz || item.modelUsdz || "", item.id)
            .run();
        }
        job.updatedAt = new Date().toISOString();
        await env.DB.prepare(
          "UPDATE model_jobs SET status = ?1, qa_score = ?2, qa_band = ?3, qa_checklist_json = ?4, updated_at = ?5 WHERE id = ?6"
        )
          .bind(
            job.status,
            toInt(job.qaScore, 0),
            (job.qaBand || "fraca").toString(),
            JSON.stringify(job.qaChecklist || []),
            job.updatedAt,
            job.id
          )
          .run();
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

async function autoProcessAllRestaurants(env, options = {}) {
  const maxRestaurants = Math.max(1, Math.min(100, toInt(options.maxRestaurants, 40)));
  const { results } = await env.DB.prepare(
    "SELECT id FROM restaurants ORDER BY name COLLATE NOCASE LIMIT ?1"
  )
    .bind(maxRestaurants)
    .all();

  const rollup = {
    restaurants: 0,
    jobsTotal: 0,
    started: 0,
    synced: 0,
    published: 0,
    skipped: 0,
    failed: 0,
    perRestaurant: []
  };

  for (const row of results || []) {
    const summary = await autoProcessRestaurantJobs(env, row.id, options);
    rollup.restaurants += 1;
    rollup.jobsTotal += summary.total;
    rollup.started += summary.started;
    rollup.synced += summary.synced;
    rollup.published += summary.published;
    rollup.skipped += summary.skipped;
    rollup.failed += summary.failed;
    rollup.perRestaurant.push(summary);
  }

  return rollup;
}

async function runScheduledAutoProcess(event, env) {
  try {
    const rollup = await autoProcessAllRestaurants(env, { maxJobs: 10, maxRestaurants: 50 });
    console.log(
      JSON.stringify({
        type: "scheduled_auto_process",
        cron: event.cron,
        at: new Date().toISOString(),
        ...rollup
      })
    );
  } catch (error) {
    console.error("scheduled_auto_process_failed", error);
  }
}

async function handleApi(request, env, url) {
  await ensureRuntimeSchema(env);
  const { pathname } = url;
  const method = request.method.toUpperCase();
  const config = getConfig(env);

  if (method === "POST" && pathname === "/api/public/translate") {
    const ip = getClientIp(request);
    const rate = await consumeRateLimit(
      env,
      `translate:${ip}`,
      config.translateMaxPerWindow,
      config.translateWindowMs
    );
    if (!rate.allowed) {
      return json(
        { error: "too_many_translate_requests", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const parsed = sanitizeTranslatePayload(body, config);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const result = await requestGoogleTranslations(env, parsed);
    if (!result.ok) {
      const payload = { error: result.error };
      if (result.detail && (env.DEBUG_ERRORS || "").toString() === "1") {
        payload.detail = result.detail;
      }
      return json(payload, result.status || 502);
    }

    return json({
      targetLanguage: parsed.targetLanguage,
      sourceLanguage: parsed.sourceLanguage || "",
      translations: result.translations
    });
  }

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
      template: sanitizeTemplateName(row.template),
      itemCount: toInt(row.item_count)
    }));
    return json({ restaurants });
  }

  const publicRestaurant = method === "GET" && matchRoute("/api/public/restaurant/:slug", pathname);
  if (publicRestaurant) {
    const safeSlug = normalizeSlug(publicRestaurant.slug);
    if (!safeSlug) return json({ error: "restaurant_not_found" }, 404);
    const restaurant = await getRestaurantBySlug(env, safeSlug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    const { results } = await env.DB.prepare(
      "SELECT * FROM items WHERE restaurant_id = ?1 ORDER BY name COLLATE NOCASE"
    )
      .bind(restaurant.id)
      .all();
    return json({ restaurant, items: (results || []).map(mapItemRow).map(toPublicItem) });
  }

  const publicItem = method === "GET" && matchRoute("/api/public/item/:id", pathname);
  if (publicItem) {
    const item = await getItemById(env, publicItem.id);
    if (!item) return json({ error: "item_not_found" }, 404);
    const restaurant = await getRestaurantById(env, item.restaurantId);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    const requestedSlug = normalizeSlug(url.searchParams.get("r") || "");
    if (requestedSlug && restaurant.slug !== requestedSlug) {
      return json({ error: "item_not_found" }, 404);
    }
    return json({ item: toPublicItem(item), restaurant });
  }

  if (method === "POST" && pathname === "/api/public/events") {
    const ip = getClientIp(request);
    const eventRate = await consumeRateLimit(
      env,
      `events:${ip}`,
      config.eventMaxPerWindow,
      config.eventWindowMs
    );
    if (!eventRate.allowed) {
      return json(
        { error: "too_many_events", retryAfterSeconds: eventRate.retryAfterSeconds },
        429,
        { "Retry-After": String(eventRate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const restaurantSlug = normalizeSlug(body.restaurantSlug || "");
    let restaurantId = sanitizeText(body.restaurantId, 80);
    let resolvedRestaurant = null;
    if (!restaurantId && restaurantSlug) {
      const restaurant = await getRestaurantBySlug(env, restaurantSlug);
      if (restaurant) {
        restaurantId = restaurant.id;
        resolvedRestaurant = restaurant;
      }
    }
    if (!restaurantId) return json({ error: "restaurant_required" }, 400);

    const itemId = sanitizeText(body.itemId, 80);
    if (itemId) {
      const item = await getItemById(env, itemId);
      if (!item || item.restaurantId !== restaurantId) {
        return json({ error: "item_invalid" }, 400);
      }
    }

    const eventType = sanitizeEventType(body.type || body.eventType || "");
    if (!eventType) return json({ error: "event_invalid" }, 400);

    const result = await recordPublicEvent(env, request, {
      restaurantId,
      restaurant: resolvedRestaurant,
      itemId,
      eventType,
      table: body.table || body.tableLabel || "",
      meta: body.meta || {}
    });
    if (!result.ok) return json({ error: result.error || "event_invalid" }, 400);
    return json({ ok: true });
  }

  if (method === "POST" && pathname === "/api/public/orders") {
    const ip = getClientIp(request);
    const orderRate = await consumeRateLimit(
      env,
      `orders:${ip}`,
      config.orderMaxPerWindow,
      config.orderWindowMs
    );
    if (!orderRate.allowed) {
      return json(
        { error: "too_many_orders", retryAfterSeconds: orderRate.retryAfterSeconds },
        429,
        { "Retry-After": String(orderRate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const restaurantSlug = normalizeSlug(body.restaurantSlug || "");
    const table = sanitizeTableLabel(body.table || "");
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
    for (const entry of items.slice(0, 30)) {
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

    await recordPublicEvent(env, request, {
      restaurantId: restaurant.id,
      restaurant,
      eventType: "order_submit",
      table,
      meta: {
        orderId: order.id,
        items: orderItems.length,
        total: order.total
      }
    });
    await fireRestaurantWebhook(env, restaurant, "orders", {
      type: "order_created",
      order,
      restaurantId: restaurant.id
    });
    return json({ order });
  }

  if (method === "POST" && pathname === "/api/public/leads") {
    const ip = getClientIp(request);
    const rate = await consumeRateLimit(
      env,
      `leads:${ip}`,
      config.eventMaxPerWindow,
      config.eventWindowMs
    );
    if (!rate.allowed) {
      return json(
        { error: "too_many_requests", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const restaurantSlug = normalizeSlug(body.restaurantSlug || "");
    if (!restaurantSlug) return json({ error: "restaurant_required" }, 400);
    const restaurant = await getRestaurantBySlug(env, restaurantSlug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);

    const lead = sanitizeLeadPayload(body);
    if (!lead.email && !lead.phone) {
      return json({ error: "contact_required" }, 400);
    }

    const leadId = `lead-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO leads
       (id, restaurant_id, name, email, phone, source, message, meta_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(
        leadId,
        restaurant.id,
        lead.name,
        lead.email,
        lead.phone,
        lead.source,
        lead.message,
        JSON.stringify(lead.meta || {}),
        nowIso
      )
      .run();

    await recordPublicEvent(env, request, {
      restaurantId: restaurant.id,
      restaurant,
      eventType: "lead_submit",
      table: "",
      meta: { leadId, source: lead.source }
    });
    await fireRestaurantWebhook(env, restaurant, "leads", {
      type: "lead_created",
      lead: { id: leadId, ...lead, createdAt: nowIso },
      restaurantId: restaurant.id
    });
    return json({ ok: true, leadId });
  }

  if (method === "POST" && pathname === "/api/public/reservations") {
    const ip = getClientIp(request);
    const rate = await consumeRateLimit(
      env,
      `reservations:${ip}`,
      config.eventMaxPerWindow,
      config.eventWindowMs
    );
    if (!rate.allowed) {
      return json(
        { error: "too_many_requests", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const restaurantSlug = normalizeSlug(body.restaurantSlug || "");
    if (!restaurantSlug) return json({ error: "restaurant_required" }, 400);
    const restaurant = await getRestaurantBySlug(env, restaurantSlug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);

    const reservation = sanitizeReservationPayload(body);
    if (!reservation.name || !reservation.phone) {
      return json({ error: "name_phone_required" }, 400);
    }

    const reservationId = `res-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO reservations
       (id, restaurant_id, name, phone, email, guests, date_label, time_label, notes, status, source, meta_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'novo', ?10, ?11, ?12)`
    )
      .bind(
        reservationId,
        restaurant.id,
        reservation.name,
        reservation.phone,
        reservation.email,
        reservation.guests,
        reservation.dateLabel,
        reservation.timeLabel,
        reservation.notes,
        reservation.source,
        JSON.stringify(reservation.meta || {}),
        nowIso
      )
      .run();

    await recordPublicEvent(env, request, {
      restaurantId: restaurant.id,
      restaurant,
      eventType: "reservation_submit",
      table: "",
      meta: { reservationId, guests: reservation.guests, source: reservation.source }
    });
    await fireRestaurantWebhook(env, restaurant, "reservations", {
      type: "reservation_created",
      reservation: { id: reservationId, ...reservation, createdAt: nowIso, status: "novo" },
      restaurantId: restaurant.id
    });
    return json({ ok: true, reservationId });
  }

  if (method === "POST" && pathname === "/api/public/waitlist") {
    const ip = getClientIp(request);
    const rate = await consumeRateLimit(
      env,
      `waitlist:${ip}`,
      config.eventMaxPerWindow,
      config.eventWindowMs
    );
    if (!rate.allowed) {
      return json(
        { error: "too_many_requests", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const restaurantSlug = normalizeSlug(body.restaurantSlug || "");
    if (!restaurantSlug) return json({ error: "restaurant_required" }, 400);
    const restaurant = await getRestaurantBySlug(env, restaurantSlug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);

    const waitEntry = sanitizeWaitlistPayload(body);
    if (!waitEntry.name || !waitEntry.phone) {
      return json({ error: "name_phone_required" }, 400);
    }

    const waitlistId = `wait-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO waitlist_entries
       (id, restaurant_id, name, phone, guests, eta_minutes, source, meta_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(
        waitlistId,
        restaurant.id,
        waitEntry.name,
        waitEntry.phone,
        waitEntry.guests,
        waitEntry.etaMinutes,
        waitEntry.source,
        JSON.stringify(waitEntry.meta || {}),
        nowIso
      )
      .run();

    await recordPublicEvent(env, request, {
      restaurantId: restaurant.id,
      restaurant,
      eventType: "waitlist_join",
      table: "",
      meta: { waitlistId, guests: waitEntry.guests, source: waitEntry.source }
    });
    await fireRestaurantWebhook(env, restaurant, "waitlist", {
      type: "waitlist_created",
      waitlist: { id: waitlistId, ...waitEntry, createdAt: nowIso },
      restaurantId: restaurant.id
    });
    return json({ ok: true, waitlistId });
  }

  if (method === "POST" && pathname === "/api/public/feedback") {
    const ip = getClientIp(request);
    const rate = await consumeRateLimit(
      env,
      `feedback:${ip}`,
      config.eventMaxPerWindow,
      config.eventWindowMs
    );
    if (!rate.allowed) {
      return json(
        { error: "too_many_requests", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await parseJsonBody(request);
    const restaurantSlug = normalizeSlug(body.restaurantSlug || "");
    if (!restaurantSlug) return json({ error: "restaurant_required" }, 400);
    const restaurant = await getRestaurantBySlug(env, restaurantSlug);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);

    const feedback = sanitizeFeedbackPayload(body);
    if (!feedback.comment && !feedback.email) {
      return json({ error: "feedback_required" }, 400);
    }

    const feedbackId = `fb-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO feedback_entries
       (id, restaurant_id, name, email, rating, comment, source, meta_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(
        feedbackId,
        restaurant.id,
        feedback.name,
        feedback.email,
        feedback.rating,
        feedback.comment,
        feedback.source,
        JSON.stringify(feedback.meta || {}),
        nowIso
      )
      .run();

    await recordPublicEvent(env, request, {
      restaurantId: restaurant.id,
      restaurant,
      eventType: "feedback_submit",
      table: "",
      meta: { feedbackId, rating: feedback.rating, source: feedback.source }
    });
    await fireRestaurantWebhook(env, restaurant, "feedback", {
      type: "feedback_created",
      feedback: { id: feedbackId, ...feedback, createdAt: nowIso },
      restaurantId: restaurant.id
    });
    return json({ ok: true, feedbackId });
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
    if (!EMAIL_PATTERN.test(email) || password.length > 128) {
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
      await env.DB.prepare("UPDATE users SET password_hash = ?1, password_plain = '' WHERE id = ?2")
        .bind(newHash, user.id)
        .run();
      user.password_hash = newHash;
      user.password_plain = "";
    } else if (user.password_plain) {
      await env.DB.prepare("UPDATE users SET password_plain = '' WHERE id = ?1").bind(user.id).run();
      user.password_plain = "";
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
    const config = getConfig(env);
    return json({
      providers: getAiProviders(env),
      qa: { minPublishScore: config.qaMinPublishScore },
      captureGuide: {
        minStartFood: config.captureMinStartFood,
        minStartGeneral: config.captureMinStartGeneral,
        recommendedFood: config.captureRecommendedFood,
        recommendedGeneral: config.captureRecommendedGeneral
      }
    });
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
    const name = sanitizeText(body.name, 120);
    if (!name) return json({ error: "name_required" }, 400);
    const slug = normalizeSlug(body.slug || name);
    if (!slug) return json({ error: "slug_invalid" }, 400);
    const existing = await env.DB.prepare("SELECT id FROM restaurants WHERE slug = ?1").bind(slug).first();
    if (existing) return json({ error: "slug_in_use" }, 400);
    const restaurant = {
      id: `r-${crypto.randomUUID()}`,
      name,
      slug,
      description: sanitizeText(body.description, 500),
      logo: sanitizeNullableUrl(body.logo),
      accent: sanitizeText(body.accent || DEFAULT_ACCENT, 16) || DEFAULT_ACCENT,
      template: sanitizeTemplateName(body.template || DEFAULT_PUBLIC_TEMPLATE),
      heroImages: [],
      contactAddress: sanitizeText(body.contactAddress || body.address, 220),
      contactPhone: sanitizeText(body.contactPhone || body.phone, 80),
      contactEmail: sanitizeContactEmail(body.contactEmail || body.email),
      contactWebsite: sanitizeText(body.contactWebsite || body.website, 220),
      defaultLanguage: sanitizeLanguageCode(body.defaultLanguage || DEFAULT_LANGUAGE_CODE),
      languages: sanitizeLanguageList(body.languages, body.defaultLanguage || DEFAULT_LANGUAGE_CODE),
      uiMessages: sanitizeUiMessages(body.uiMessages),
      categoryLabels: sanitizeCategoryLabels(body.categoryLabels),
      integrations: sanitizeIntegrations(body.integrations)
    };
    if (!restaurant.languages.includes(restaurant.defaultLanguage)) {
      restaurant.languages.unshift(restaurant.defaultLanguage);
      restaurant.languages = restaurant.languages.slice(0, DEFAULT_LANGUAGE_OPTIONS.length);
    }
    await env.DB.prepare(
      `INSERT INTO restaurants
      (id, name, slug, description, logo, accent, template, hero_images_json, contact_address, contact_phone, contact_email, contact_website, languages_json, default_language, ui_messages_json, category_labels_json, integrations_json)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
    )
      .bind(
        restaurant.id,
        restaurant.name,
        restaurant.slug,
        restaurant.description,
        restaurant.logo,
        restaurant.accent,
        restaurant.template,
        JSON.stringify(restaurant.heroImages),
        restaurant.contactAddress,
        restaurant.contactPhone,
        restaurant.contactEmail,
        restaurant.contactWebsite,
        JSON.stringify(restaurant.languages),
        restaurant.defaultLanguage,
        JSON.stringify(restaurant.uiMessages),
        JSON.stringify(restaurant.categoryLabels),
        JSON.stringify(restaurant.integrations)
      )
      .run();
    const persisted = await getRestaurantById(env, restaurant.id);
    return json({ restaurant: persisted });
  }

  const restaurantUpdate = method === "PUT" && matchRoute("/api/restaurants/:id", pathname);
  if (restaurantUpdate) {
    const restaurant = await getRestaurantById(env, restaurantUpdate.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();

    const body = await parseJsonBody(request);
    const next = { ...restaurant };
    if (body.name !== undefined) next.name = sanitizeText(body.name, 120) || next.name;
    if (body.description !== undefined) next.description = sanitizeText(body.description, 500);
    if (body.logo !== undefined) next.logo = sanitizeNullableUrl(body.logo);
    if (body.accent !== undefined) next.theme.accent = sanitizeText(body.accent, 16) || DEFAULT_ACCENT;
    if (body.template !== undefined) {
      next.template = sanitizeTemplateName(body.template || DEFAULT_PUBLIC_TEMPLATE);
    }
    if (body.contactAddress !== undefined || body.address !== undefined) {
      next.contact = next.contact || {};
      next.contact.address = sanitizeText(body.contactAddress ?? body.address, 220);
    }
    if (body.contactPhone !== undefined || body.phone !== undefined) {
      next.contact = next.contact || {};
      next.contact.phone = sanitizeText(body.contactPhone ?? body.phone, 80);
    }
    if (body.contactEmail !== undefined || body.email !== undefined) {
      next.contact = next.contact || {};
      next.contact.email = sanitizeContactEmail(body.contactEmail ?? body.email);
    }
    if (body.contactWebsite !== undefined || body.website !== undefined) {
      next.contact = next.contact || {};
      next.contact.website = sanitizeText(body.contactWebsite ?? body.website, 220);
    }
    const currentDefaultLanguage =
      (next.languageSettings && next.languageSettings.defaultLanguage) || DEFAULT_LANGUAGE_CODE;
    if (body.defaultLanguage !== undefined) {
      next.languageSettings = next.languageSettings || {};
      next.languageSettings.defaultLanguage = sanitizeLanguageCode(body.defaultLanguage);
    }
    if (body.languages !== undefined) {
      next.languageSettings = next.languageSettings || {};
      const defaultCandidate =
        (next.languageSettings && next.languageSettings.defaultLanguage) || currentDefaultLanguage;
      next.languageSettings.languages = sanitizeLanguageList(body.languages, defaultCandidate);
    }
    if (body.uiMessages !== undefined) {
      next.uiMessages = sanitizeUiMessages(body.uiMessages);
    }
    if (body.categoryLabels !== undefined) {
      next.categoryLabels = sanitizeCategoryLabels(body.categoryLabels);
    }
    if (body.integrations !== undefined) {
      next.integrations = sanitizeIntegrations(body.integrations);
    }
    next.languageSettings = next.languageSettings || {};
    next.languageSettings.defaultLanguage = sanitizeLanguageCode(
      next.languageSettings.defaultLanguage || currentDefaultLanguage
    );
    next.languageSettings.languages = sanitizeLanguageList(
      next.languageSettings.languages || DEFAULT_LANGUAGE_OPTIONS,
      next.languageSettings.defaultLanguage
    );
    if (body.heroImages !== undefined && Array.isArray(body.heroImages)) {
      next.heroImages = body.heroImages
        .map((value) => sanitizeNullableUrl(value))
        .filter(Boolean)
        .slice(0, 8);
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
       SET name = ?1, slug = ?2, description = ?3, logo = ?4, accent = ?5, template = ?6, hero_images_json = ?7,
           contact_address = ?8, contact_phone = ?9, contact_email = ?10, contact_website = ?11,
           languages_json = ?12, default_language = ?13, ui_messages_json = ?14, category_labels_json = ?15,
           integrations_json = ?16
       WHERE id = ?17`
    )
      .bind(
        next.name,
        next.slug,
        next.description,
        next.logo,
        next.theme.accent || DEFAULT_ACCENT,
        sanitizeTemplateName(next.template),
        JSON.stringify(next.heroImages || []),
        (next.contact && next.contact.address) || "",
        (next.contact && next.contact.phone) || "",
        (next.contact && next.contact.email) || "",
        (next.contact && next.contact.website) || "",
        JSON.stringify((next.languageSettings && next.languageSettings.languages) || DEFAULT_LANGUAGE_OPTIONS),
        (next.languageSettings && next.languageSettings.defaultLanguage) || DEFAULT_LANGUAGE_CODE,
        JSON.stringify(next.uiMessages || {}),
        JSON.stringify(next.categoryLabels || {}),
        JSON.stringify(next.integrations || {}),
        next.id
      )
      .run();
    const persisted = await getRestaurantById(env, next.id);
    return json({ restaurant: persisted || next });
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
    const itemName = sanitizeText(body.name, 160);
    if (!itemName) return json({ error: "name_required" }, 400);
    const item = {
      id: `i-${crypto.randomUUID()}`,
      restaurantId: restaurant.id,
      name: itemName,
      description: sanitizeText(body.description, 800),
      price: sanitizePrice(body.price),
      image: sanitizeNullableUrl(body.image),
      modelGlb: sanitizeNullableUrl(body.modelGlb),
      modelUsdz: sanitizeNullableUrl(body.modelUsdz),
      category: sanitizeText(body.category, 80),
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
    if (body.name !== undefined) {
      const sanitizedName = sanitizeText(body.name, 160);
      if (!sanitizedName) return json({ error: "name_required" }, 400);
      next.name = sanitizedName;
    }
    if (body.description !== undefined) next.description = sanitizeText(body.description, 800);
    if (body.price !== undefined) next.price = sanitizePrice(body.price);
    if (body.image !== undefined) next.image = sanitizeNullableUrl(body.image);
    if (body.modelGlb !== undefined) next.modelGlb = sanitizeNullableUrl(body.modelGlb);
    if (body.modelUsdz !== undefined) next.modelUsdz = sanitizeNullableUrl(body.modelUsdz);
    if (body.category !== undefined) next.category = sanitizeText(body.category, 80);
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

  const analyticsRoute = method === "GET" && matchRoute("/api/restaurants/:id/analytics", pathname);
  if (analyticsRoute) {
    const restaurant = await getRestaurantById(env, analyticsRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();

    const daysParam = Math.max(1, Math.min(90, toInt(url.searchParams.get("days"), 30)));
    const sinceMs = Date.now() - daysParam * 24 * 60 * 60 * 1000;
    const sinceIso = new Date(sinceMs).toISOString();

    const orderSummary = await env.DB.prepare(
      `SELECT
        COUNT(*) AS orders_total,
        COALESCE(SUM(total), 0) AS revenue_total,
        COALESCE(AVG(total), 0) AS avg_ticket
       FROM orders
       WHERE restaurant_id = ?1 AND created_at >= ?2`
    )
      .bind(restaurant.id, sinceIso)
      .first();

    const eventRows = await env.DB.prepare(
      `SELECT event_type, COUNT(*) AS total
       FROM events
       WHERE restaurant_id = ?1 AND created_at >= ?2
       GROUP BY event_type`
    )
      .bind(restaurant.id, sinceIso)
      .all();
    const events = Object.create(null);
    for (const row of eventRows.results || []) {
      events[row.event_type] = toInt(row.total, 0);
    }

    const arRows = await env.DB.prepare(
      `SELECT item_id, COUNT(*) AS total
       FROM events
       WHERE restaurant_id = ?1 AND created_at >= ?2 AND event_type = 'ar_open' AND item_id IS NOT NULL
       GROUP BY item_id
       ORDER BY total DESC
       LIMIT 10`
    )
      .bind(restaurant.id, sinceIso)
      .all();

    const ordersRows = await env.DB.prepare(
      "SELECT items_json FROM orders WHERE restaurant_id = ?1 AND created_at >= ?2"
    )
      .bind(restaurant.id, sinceIso)
      .all();

    const orderedCounter = new Map();
    for (const row of ordersRows.results || []) {
      const parsed = parseJsonSafe(row.items_json, []);
      for (const entry of parsed) {
        if (!entry || !entry.id) continue;
        const qty = Math.max(1, Math.min(99, toInt(entry.qty, 1)));
        const current = orderedCounter.get(entry.id) || 0;
        orderedCounter.set(entry.id, current + qty);
      }
    }

    const { results: itemRows } = await env.DB.prepare(
      "SELECT id, name FROM items WHERE restaurant_id = ?1"
    )
      .bind(restaurant.id)
      .all();
    const itemNameMap = new Map((itemRows || []).map((row) => [row.id, row.name]));

    const topOrderedItems = [...orderedCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([itemId, qty]) => ({
        itemId,
        itemName: itemNameMap.get(itemId) || "Item",
        qty
      }));

    const topArItems = (arRows.results || []).map((row) => ({
      itemId: row.item_id,
      itemName: itemNameMap.get(row.item_id) || "Item",
      opens: toInt(row.total, 0)
    }));

    const menuViews = toInt(events.menu_view, 0);
    const arOpens = toInt(events.ar_open, 0);
    const orderSubmitEvents = toInt(events.order_submit, 0);
    const ordersTotal = toInt(orderSummary.orders_total, 0);

    const conversion = {
      menuToAr: menuViews > 0 ? Number(((arOpens / menuViews) * 100).toFixed(2)) : 0,
      arToOrder: arOpens > 0 ? Number(((ordersTotal / arOpens) * 100).toFixed(2)) : 0,
      menuToOrder: menuViews > 0 ? Number(((ordersTotal / menuViews) * 100).toFixed(2)) : 0
    };

    return json({
      analytics: {
        windowDays: daysParam,
        since: sinceIso,
        summary: {
          ordersTotal,
          revenueTotal: Number(orderSummary?.revenue_total || 0),
          avgTicket: Number(orderSummary?.avg_ticket || 0),
          menuViews,
          arOpens,
          addToCart: toInt(events.add_to_cart, 0),
          itemViews: toInt(events.item_view, 0),
          orderSubmitEvents
        },
        conversion,
        topArItems,
        topOrderedItems
      }
    });
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

  const listLeadsRoute = method === "GET" && matchRoute("/api/restaurants/:id/leads", pathname);
  if (listLeadsRoute) {
    const restaurant = await getRestaurantById(env, listLeadsRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const limit = Math.max(10, Math.min(200, toInt(url.searchParams.get("limit"), 80)));
    const { results } = await env.DB.prepare(
      "SELECT * FROM leads WHERE restaurant_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    )
      .bind(restaurant.id, limit)
      .all();
    return json({ leads: (results || []).map(mapLeadRow) });
  }

  const listReservationsRoute = method === "GET" && matchRoute("/api/restaurants/:id/reservations", pathname);
  if (listReservationsRoute) {
    const restaurant = await getRestaurantById(env, listReservationsRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const limit = Math.max(10, Math.min(200, toInt(url.searchParams.get("limit"), 80)));
    const { results } = await env.DB.prepare(
      "SELECT * FROM reservations WHERE restaurant_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    )
      .bind(restaurant.id, limit)
      .all();
    return json({ reservations: (results || []).map(mapReservationRow) });
  }

  const updateReservationRoute = method === "PUT" && matchRoute("/api/reservations/:id", pathname);
  if (updateReservationRoute) {
    const row = await env.DB.prepare("SELECT * FROM reservations WHERE id = ?1").bind(updateReservationRoute.id).first();
    if (!row) return json({ error: "reservation_not_found" }, 404);
    const reservation = mapReservationRow(row);
    if (!canAccessRestaurant(currentUser, reservation.restaurantId)) return forbidden();
    const body = await parseJsonBody(request);
    const status = sanitizeText(body.status, 24).toLowerCase();
    const allowed = new Set(["novo", "confirmado", "cancelado", "finalizado"]);
    if (!allowed.has(status)) return json({ error: "invalid_status" }, 400);
    await env.DB.prepare("UPDATE reservations SET status = ?1 WHERE id = ?2")
      .bind(status, reservation.id)
      .run();
    reservation.status = status;
    return json({ reservation });
  }

  const listWaitlistRoute = method === "GET" && matchRoute("/api/restaurants/:id/waitlist", pathname);
  if (listWaitlistRoute) {
    const restaurant = await getRestaurantById(env, listWaitlistRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const limit = Math.max(10, Math.min(200, toInt(url.searchParams.get("limit"), 80)));
    const { results } = await env.DB.prepare(
      "SELECT * FROM waitlist_entries WHERE restaurant_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    )
      .bind(restaurant.id, limit)
      .all();
    const waitlist = (results || []).map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name || "",
      phone: row.phone || "",
      guests: toInt(row.guests, 2),
      etaMinutes: toInt(row.eta_minutes, 0),
      source: row.source || "",
      meta: parseJsonSafe(row.meta_json, {}),
      createdAt: row.created_at
    }));
    return json({ waitlist });
  }

  const listFeedbackRoute = method === "GET" && matchRoute("/api/restaurants/:id/feedback", pathname);
  if (listFeedbackRoute) {
    const restaurant = await getRestaurantById(env, listFeedbackRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const limit = Math.max(10, Math.min(200, toInt(url.searchParams.get("limit"), 80)));
    const { results } = await env.DB.prepare(
      "SELECT * FROM feedback_entries WHERE restaurant_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    )
      .bind(restaurant.id, limit)
      .all();
    const feedback = (results || []).map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name || "",
      email: row.email || "",
      rating: toInt(row.rating, 0),
      comment: row.comment || "",
      source: row.source || "",
      meta: parseJsonSafe(row.meta_json, {}),
      createdAt: row.created_at
    }));
    return json({ feedback });
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
      aiModel: sanitizeText(body.aiModel, 60),
      autoMode: Boolean(body.autoMode),
      status: "enviado",
      notes: sanitizeText(body.notes, 500),
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
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: currentUser.id
    };
    await env.DB.prepare(
      `INSERT INTO model_jobs
      (id, restaurant_id, item_id, source_type, provider, ai_model, auto_mode, status, notes, model_glb, model_usdz,
       reference_images_json, provider_task_id, provider_task_endpoint, provider_status, qa_score, qa_band, qa_checklist_json,
       qa_notes, created_at, updated_at, created_by)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)`
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
        job.qaScore,
        job.qaBand,
        JSON.stringify(job.qaChecklist),
        job.qaNotes,
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
    const currentReferenceCount = Array.isArray(job.referenceImages) ? job.referenceImages.length : 0;
    if (currentReferenceCount + photos.length > 40) {
      return json({ error: "too_many_reference_images", max: 40 }, 400);
    }

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
    const item = await getItemById(env, job.itemId);
    const capture = item ? evaluateCaptureReadiness(item, job, getConfig(env)) : null;
    return json({ urls, count: nextReferenceImages.length, job, capture });
  }

  const captureAnalyzeRoute = method === "GET" && matchRoute("/api/model-jobs/:id/capture/analyze", pathname);
  if (captureAnalyzeRoute) {
    const job = await getModelJobById(env, captureAnalyzeRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const item = await getItemById(env, job.itemId);
    if (!item) return json({ error: "item_not_found" }, 404);
    const capture = evaluateCaptureReadiness(item, job, getConfig(env));
    return json({ capture });
  }

  const updateJobRoute = method === "PUT" && matchRoute("/api/model-jobs/:id", pathname);
  if (updateJobRoute) {
    const job = await getModelJobById(env, updateJobRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const body = await parseJsonBody(request);
    const allowedStatus = new Set(["enviado", "triagem", "processando", "revisao", "publicado", "erro"]);
    let requestedStatus = null;

    if (body.status !== undefined) {
      const status = (body.status || "").toString().toLowerCase();
      if (!allowedStatus.has(status)) return json({ error: "status_invalid" }, 400);
      requestedStatus = status;
    }
    if (body.notes !== undefined) job.notes = sanitizeText(body.notes, 500);
    if (body.modelGlb !== undefined) job.modelGlb = sanitizeNullableUrl(body.modelGlb);
    if (body.modelUsdz !== undefined) job.modelUsdz = sanitizeNullableUrl(body.modelUsdz);
    if (body.provider !== undefined) {
      const provider = (body.provider || "").toString().trim().toLowerCase();
      if (!getAiProvider(env, provider)) return json({ error: "provider_invalid" }, 400);
      job.provider = provider;
    }
    if (body.aiModel !== undefined) job.aiModel = sanitizeText(body.aiModel, 60);
    if (body.qaNotes !== undefined) job.qaNotes = sanitizeText(body.qaNotes, 1000);
    if (Array.isArray(body.qaChecklist)) {
      job.qaChecklist = body.qaChecklist
        .map((entry) => sanitizeText(entry, 80))
        .filter(Boolean)
        .slice(0, 30);
    }
    if (body.qaScore !== undefined) {
      job.qaScore = Math.max(0, Math.min(100, toInt(body.qaScore, 0)));
      job.qaBand = toModelQualityBand(job.qaScore);
    }
    if (requestedStatus === "publicado") {
      const qaScore = toInt(job.qaScore, 0);
      const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
      if (qaScore < config.qaMinPublishScore || !hasRequiredModels) {
        return json(
          {
            error: "publish_gate_failed",
            requiredScore: config.qaMinPublishScore,
            currentScore: qaScore,
            hasRequiredModels
          },
          400
        );
      }
    }
    if (requestedStatus) {
      job.status = requestedStatus;
    }
    job.updatedAt = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE model_jobs
       SET provider = ?1, ai_model = ?2, auto_mode = ?3, status = ?4, notes = ?5, model_glb = ?6, model_usdz = ?7,
           reference_images_json = ?8, provider_task_id = ?9, provider_task_endpoint = ?10, provider_status = ?11,
           qa_score = ?12, qa_band = ?13, qa_checklist_json = ?14, qa_notes = ?15, updated_at = ?16
       WHERE id = ?17`
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
        toInt(job.qaScore, 0),
        (job.qaBand || "fraca").toString(),
        JSON.stringify(job.qaChecklist || []),
        job.qaNotes || "",
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

  const evaluateQaRoute = method === "POST" && matchRoute("/api/model-jobs/:id/qa/evaluate", pathname);
  if (evaluateQaRoute) {
    const job = await getModelJobById(env, evaluateQaRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const item = await getItemById(env, job.itemId);
    if (!item) return json({ error: "item_not_found" }, 400);
    const body = await parseJsonBody(request);

    const evaluation = await evaluateJobQuality(env, item, job);
    const extraChecks = Array.isArray(body.extraChecklist)
      ? body.extraChecklist.map((entry) => sanitizeText(entry, 80)).filter(Boolean).slice(0, 20)
      : [];

    job.qaScore = evaluation.score;
    job.qaBand = evaluation.band;
    job.qaChecklist = [...evaluation.checklist, ...extraChecks];
    job.qaNotes = body.qaNotes !== undefined ? sanitizeText(body.qaNotes, 1000) : job.qaNotes || "";
    job.updatedAt = new Date().toISOString();

    await env.DB.prepare(
      "UPDATE model_jobs SET qa_score = ?1, qa_band = ?2, qa_checklist_json = ?3, qa_notes = ?4, updated_at = ?5 WHERE id = ?6"
    )
      .bind(
        toInt(job.qaScore, 0),
        job.qaBand || "fraca",
        JSON.stringify(job.qaChecklist || []),
        job.qaNotes || "",
        job.updatedAt,
        job.id
      )
      .run();

    return json({ job, evaluation, capture: evaluation.capture || null });
  }

  const publishJobRoute = method === "POST" && matchRoute("/api/model-jobs/:id/publish", pathname);
  if (publishJobRoute) {
    const job = await getModelJobById(env, publishJobRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const item = await getItemById(env, job.itemId);
    if (!item) return json({ error: "item_not_found" }, 400);

    const evaluation = await evaluateJobQuality(env, item, job);
    const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
    if (!hasRequiredModels || evaluation.score < config.qaMinPublishScore) {
      await env.DB.prepare(
        "UPDATE model_jobs SET qa_score = ?1, qa_band = ?2, qa_checklist_json = ?3, status = 'revisao', updated_at = ?4 WHERE id = ?5"
      )
        .bind(
          evaluation.score,
          evaluation.band,
          JSON.stringify(evaluation.checklist),
          new Date().toISOString(),
          job.id
        )
        .run();
      return json(
        {
          error: "publish_gate_failed",
          requiredScore: config.qaMinPublishScore,
          currentScore: evaluation.score,
          hasRequiredModels,
          checklist: evaluation.checklist
        },
        400
      );
    }

    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE model_jobs SET status = 'publicado', qa_score = ?1, qa_band = ?2, qa_checklist_json = ?3, updated_at = ?4 WHERE id = ?5"
    )
      .bind(evaluation.score, evaluation.band, JSON.stringify(evaluation.checklist), nowIso, job.id)
      .run();

    await env.DB.prepare("UPDATE items SET model_glb = ?1, model_usdz = ?2 WHERE id = ?3")
      .bind(job.modelGlb || item.modelGlb || "", job.modelUsdz || item.modelUsdz || "", item.id)
      .run();

    return json({
      ok: true,
      status: "publicado",
      qaScore: evaluation.score,
      qaBand: evaluation.band
    });
  }

  const startAiRoute = method === "POST" && matchRoute("/api/model-jobs/:id/ai/start", pathname);
  if (startAiRoute) {
    const aiLimit = await consumeRateLimit(
      env,
      `ai:start:${currentUser.id}`,
      config.aiActionMaxPerWindow,
      config.aiActionWindowMs
    );
    if (!aiLimit.allowed) {
      return json(
        { error: "ai_rate_limited", retryAfterSeconds: aiLimit.retryAfterSeconds },
        429,
        { "Retry-After": String(aiLimit.retryAfterSeconds) }
      );
    }
    const job = await getModelJobById(env, startAiRoute.id);
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, job.restaurantId)) return forbidden();
    const item = await getItemById(env, job.itemId);
    if (!item) return json({ error: "item_not_found" }, 400);

    const body = await parseJsonBody(request);
    const providerId = sanitizeText(body.provider || job.provider || "manual", 32).toLowerCase();
    const provider = getAiProvider(env, providerId);
    if (!provider) return json({ error: "provider_invalid" }, 400);
    if (!provider.enabled) return json({ error: "provider_not_configured" }, 400);
    if (provider.id !== "meshy") return json({ error: "provider_not_implemented" }, 400);
    const capture = evaluateCaptureReadiness(item, job, config);
    if (!capture.readyToStart) {
      return json({ error: "capture_insufficient", capture }, 400);
    }

    try {
      const imageInputs = await buildJobImageInputs(env, item, job);
      if (!imageInputs.length) return json({ error: "image_source_not_found" }, 400);
      const aiModel = sanitizeText(body.aiModel || job.aiModel || config.meshyModel, 60);
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
      job.qaScore = 0;
      job.qaBand = "fraca";
      job.qaChecklist = [];
      job.qaNotes = "";
      job.updatedAt = new Date().toISOString();

      await env.DB.prepare(
        `UPDATE model_jobs
         SET provider = ?1, ai_model = ?2, provider_task_id = ?3, provider_task_endpoint = ?4,
             provider_status = ?5, status = ?6, qa_score = ?7, qa_band = ?8, qa_checklist_json = ?9, qa_notes = ?10,
             updated_at = ?11
         WHERE id = ?12`
      )
        .bind(
          job.provider,
          job.aiModel,
          job.providerTaskId,
          job.providerTaskEndpoint,
          job.providerStatus,
          job.status,
          job.qaScore,
          job.qaBand,
          JSON.stringify(job.qaChecklist),
          job.qaNotes,
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
    const aiLimit = await consumeRateLimit(
      env,
      `ai:sync:${currentUser.id}`,
      config.aiActionMaxPerWindow,
      config.aiActionWindowMs
    );
    if (!aiLimit.allowed) {
      return json(
        { error: "ai_rate_limited", retryAfterSeconds: aiLimit.retryAfterSeconds },
        429,
        { "Retry-After": String(aiLimit.retryAfterSeconds) }
      );
    }
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
          const item = await getItemById(env, job.itemId);
          if (item) {
            const evaluation = await evaluateJobQuality(env, item, job);
            job.qaScore = evaluation.score;
            job.qaBand = evaluation.band;
            job.qaChecklist = evaluation.checklist;
            const hasRequiredModels = Boolean(job.modelGlb) && Boolean(job.modelUsdz);
            if (evaluation.score >= config.qaMinPublishScore && hasRequiredModels) {
              job.status = "publicado";
            }
          }
        }
      }

      job.updatedAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE model_jobs
         SET status = ?1, model_glb = ?2, model_usdz = ?3, provider_task_endpoint = ?4, provider_status = ?5,
             qa_score = ?6, qa_band = ?7, qa_checklist_json = ?8, updated_at = ?9
         WHERE id = ?10`
      )
        .bind(
          job.status,
          job.modelGlb || "",
          job.modelUsdz || "",
          job.providerTaskEndpoint || "",
          job.providerStatus || "",
          toInt(job.qaScore, 0),
          (job.qaBand || "fraca").toString(),
          JSON.stringify(job.qaChecklist || []),
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

  const autoProcessRoute = method === "POST" && matchRoute("/api/restaurants/:id/model-jobs/auto-process", pathname);
  if (autoProcessRoute) {
    const restaurant = await getRestaurantById(env, autoProcessRoute.id);
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);
    if (!canAccessRestaurant(currentUser, restaurant.id)) return forbidden();
    const body = await parseJsonBody(request);
    const summary = await autoProcessRestaurantJobs(env, restaurant.id, {
      maxJobs: body.maxJobs
    });
    return json({ ok: true, summary });
  }

  return json({ error: "not_found" }, 404);
}
