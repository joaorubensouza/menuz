const params = new URLSearchParams(window.location.search);
const slug = (params.get("r") || "").trim();
const tableFromUrl = (params.get("mesa") || "").trim();
const languageKey = slug ? `menuz_lang_${slug}` : "menuz_lang_template";
const translationCacheKey = slug ? `menuz_translate_cache_${slug}` : "menuz_translate_cache_template";

const searchToggle = document.getElementById("search-toggle");
const searchWrap = document.getElementById("search-wrap");
const searchInput = document.getElementById("search-input");
const menuToggle = document.getElementById("menu-toggle");
const sideOverlay = document.getElementById("side-overlay");
const sideDrawer = document.getElementById("side-drawer");
const drawerClose = document.getElementById("drawer-close");
const drawerLang = document.getElementById("drawer-lang");
const drawerInfo = document.getElementById("drawer-info");
const brandLogo = document.getElementById("brand-logo");
const brandTitle = document.getElementById("brand-title");
const brandSub = document.getElementById("brand-sub");
const drawerBrandLogo = document.getElementById("drawer-brand-logo");
const drawerBrandTitle = document.getElementById("drawer-brand-title");
const drawerBrandSub = document.getElementById("drawer-brand-sub");

const langModal = document.getElementById("lang-modal");
const langClose = document.getElementById("lang-close");
const langTitle = document.getElementById("lang-title");
const langList = document.getElementById("lang-list");

const heroTrack = document.getElementById("hero-track");
const heroDots = document.getElementById("hero-dots");
const heroPrev = document.getElementById("hero-prev");
const heroNext = document.getElementById("hero-next");

const restaurantName = document.getElementById("restaurant-name");
const restaurantDesc = document.getElementById("restaurant-desc");
const shareToggle = document.getElementById("share-toggle");
const modeStrip = document.getElementById("mode-strip");
const categoryList = document.getElementById("category-list");
const menuList = document.getElementById("menu-list");
const emptyState = document.getElementById("empty-state");

const cartButton = document.getElementById("cart-button");
const cartModal = document.getElementById("cart-modal");
const cartClose = document.getElementById("cart-close");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const tableInput = document.getElementById("table-input");
const cartClear = document.getElementById("cart-clear");
const cartSubmit = document.getElementById("cart-submit");
const cartMessage = document.getElementById("cart-message");
const backTopButton = document.getElementById("back-top");
const srLive = document.getElementById("sr-live");
const canonicalLink = document.getElementById("canonical-link");
const metaDescription = document.getElementById("meta-description");
const ogTitle = document.getElementById("og-title");
const ogDescription = document.getElementById("og-description");
const ogImage = document.getElementById("og-image");
const twitterTitle = document.getElementById("twitter-title");
const twitterDescription = document.getElementById("twitter-description");
const twitterImage = document.getElementById("twitter-image");
const restaurantJsonLd = document.getElementById("restaurant-jsonld");
const networkPill = document.getElementById("network-pill");
const techClockPill = document.getElementById("tech-clock");
const techLatencyPill = document.getElementById("tech-latency");
const installAppButton = document.getElementById("install-app");
const voiceSearchButton = document.getElementById("voice-search");
const commandPaletteToggle = document.getElementById("command-palette-toggle");
const techModeToggle = document.getElementById("tech-mode-toggle");
const compactToggle = document.getElementById("compact-toggle");
const favoritesToggle = document.getElementById("favorites-toggle");
const quickActions = document.getElementById("quick-actions");
const aiRail = document.getElementById("ai-rail");
const commandModal = document.getElementById("command-modal");
const commandClose = document.getElementById("command-close");
const commandInput = document.getElementById("command-input");
const commandList = document.getElementById("command-list");
const engagementForms = document.getElementById("engagement-forms");
const reservationForm = document.getElementById("reservation-form");
const reservationNameInput = document.getElementById("reservation-name");
const reservationPhoneInput = document.getElementById("reservation-phone");
const reservationGuestsInput = document.getElementById("reservation-guests");
const reservationDateInput = document.getElementById("reservation-date");
const reservationTimeInput = document.getElementById("reservation-time");
const reservationStatus = document.getElementById("reservation-status");
const leadForm = document.getElementById("lead-form");
const leadNameInput = document.getElementById("lead-name");
const leadEmailInput = document.getElementById("lead-email");
const leadPhoneInput = document.getElementById("lead-phone");
const leadStatus = document.getElementById("lead-status");
const waitlistForm = document.getElementById("waitlist-form");
const waitlistNameInput = document.getElementById("waitlist-name");
const waitlistPhoneInput = document.getElementById("waitlist-phone");
const waitlistGuestsInput = document.getElementById("waitlist-guests");
const waitlistEtaInput = document.getElementById("waitlist-eta");
const waitlistStatus = document.getElementById("waitlist-status");
const feedbackForm = document.getElementById("feedback-form");
const feedbackNameInput = document.getElementById("feedback-name");
const feedbackEmailInput = document.getElementById("feedback-email");
const feedbackRatingInput = document.getElementById("feedback-rating");
const feedbackCommentInput = document.getElementById("feedback-comment");
const feedbackStatus = document.getElementById("feedback-status");

const LANGUAGES = [
  { code: "pt-BR", tag: "PT", label: "Português do Brasil", subtitle: "Padrão do restaurante" },
  { code: "en-US", tag: "EN", label: "English", subtitle: "For foreigners" },
  { code: "es-ES", tag: "ES", label: "Español", subtitle: "Para extranjeros" },
  { code: "fr-FR", tag: "FR", label: "Français", subtitle: "Pour les étrangers" },
  { code: "it-IT", tag: "IT", label: "Italiano", subtitle: "Per gli stranieri" },
  { code: "de-DE", tag: "DE", label: "Deutsch", subtitle: "Für Ausländer" }
];

const MESSAGES = {
  "pt-BR": {
    searchPlaceholder: "Buscar no cardapio",
    modeMenu: "Menu",
    menuPersonality: "Menu Personnalite",
    all: "Todos",
    ar: "Realidade Aumentada",
    add: "+ pedido",
    noItemsFound: "Nenhum item encontrado para este filtro.",
    orderFab: (count, total) => `Pedido (${count}) | R$ ${total}`,
    orderOfTable: "Pedido da mesa",
    orderSummary: "Resumo do pedido",
    close: "Fechar",
    noItemsInCart: "Nenhum item no pedido.",
    total: "Total",
    tablePlaceholder: "Mesa (ex: 12)",
    clear: "Limpar",
    submit: "Enviar pedido",
    sending: "Enviando...",
    msgNeedTable: "Informe a mesa antes de enviar.",
    msgEmpty: "Seu pedido esta vazio.",
    msgFail: "Nao foi possivel enviar o pedido.",
    msgOk: "Pedido enviado com sucesso.",
    msgConnection: "Erro de conexao ao enviar pedido.",
    msgCleared: "Pedido limpo.",
    language: "Idioma"
  },
  "en-US": {
    searchPlaceholder: "Search menu",
    modeMenu: "Menu",
    menuPersonality: "Signature Menu",
    all: "All",
    ar: "Augmented Reality",
    add: "+ order",
    noItemsFound: "No items found for this filter.",
    orderFab: (count, total) => `Order (${count}) | R$ ${total}`,
    orderOfTable: "Table order",
    orderSummary: "Order summary",
    close: "Close",
    noItemsInCart: "No items in this order.",
    total: "Total",
    tablePlaceholder: "Table (ex: 12)",
    clear: "Clear",
    submit: "Send order",
    sending: "Sending...",
    msgNeedTable: "Enter table before sending.",
    msgEmpty: "Your order is empty.",
    msgFail: "Could not send order.",
    msgOk: "Order sent successfully.",
    msgConnection: "Connection error while sending order.",
    msgCleared: "Order cleared.",
    language: "Language"
  },
  "es-ES": {
    searchPlaceholder: "Buscar en el menu",
    modeMenu: "Menu",
    menuPersonality: "Menu Signature",
    all: "Todo",
    ar: "Realidad Aumentada",
    add: "+ pedido",
    noItemsFound: "No se encontraron items para este filtro.",
    orderFab: (count, total) => `Pedido (${count}) | R$ ${total}`,
    orderOfTable: "Pedido de mesa",
    orderSummary: "Resumen del pedido",
    close: "Cerrar",
    noItemsInCart: "No hay items en el pedido.",
    total: "Total",
    tablePlaceholder: "Mesa (ej: 12)",
    clear: "Limpiar",
    submit: "Enviar pedido",
    sending: "Enviando...",
    msgNeedTable: "Informe la mesa antes de enviar.",
    msgEmpty: "Tu pedido esta vacio.",
    msgFail: "No se pudo enviar el pedido.",
    msgOk: "Pedido enviado correctamente.",
    msgConnection: "Error de conexion al enviar.",
    msgCleared: "Pedido limpiado.",
    language: "Idioma"
  },
  "fr-FR": {
    searchPlaceholder: "Rechercher dans le menu",
    modeMenu: "Menu",
    menuPersonality: "Menu Signature",
    all: "Tous",
    ar: "Réalité augmentée",
    add: "+ commande",
    noItemsFound: "Aucun article pour ce filtre.",
    orderFab: (count, total) => `Commande (${count}) | R$ ${total}`,
    orderOfTable: "Commande de table",
    orderSummary: "Résumé de commande",
    close: "Fermer",
    noItemsInCart: "Aucun article dans la commande.",
    total: "Total",
    tablePlaceholder: "Table (ex: 12)",
    clear: "Vider",
    submit: "Envoyer la commande",
    sending: "Envoi...",
    msgNeedTable: "Informez la table avant envoi.",
    msgEmpty: "Votre commande est vide.",
    msgFail: "Impossible d'envoyer la commande.",
    msgOk: "Commande envoyée avec succès.",
    msgConnection: "Erreur de connexion lors de l'envoi.",
    msgCleared: "Commande vidée.",
    language: "Langue"
  },
  "it-IT": {
    searchPlaceholder: "Cerca nel menu",
    modeMenu: "Menu",
    menuPersonality: "Menu Signature",
    all: "Tutti",
    ar: "Realtà aumentata",
    add: "+ ordine",
    noItemsFound: "Nessun elemento trovato per questo filtro.",
    orderFab: (count, total) => `Ordine (${count}) | R$ ${total}`,
    orderOfTable: "Ordine del tavolo",
    orderSummary: "Riepilogo ordine",
    close: "Chiudi",
    noItemsInCart: "Nessun articolo nell'ordine.",
    total: "Totale",
    tablePlaceholder: "Tavolo (es: 12)",
    clear: "Pulisci",
    submit: "Invia ordine",
    sending: "Invio...",
    msgNeedTable: "Inserisci il tavolo prima di inviare.",
    msgEmpty: "Il tuo ordine è vuoto.",
    msgFail: "Impossibile inviare l'ordine.",
    msgOk: "Ordine inviato con successo.",
    msgConnection: "Errore di connessione durante l'invio.",
    msgCleared: "Ordine pulito.",
    language: "Lingua"
  },
  "de-DE": {
    searchPlaceholder: "Menü durchsuchen",
    modeMenu: "Menü",
    menuPersonality: "Signature Menü",
    all: "Alle",
    ar: "Augmented Reality",
    add: "+ bestellen",
    noItemsFound: "Keine Artikel für diesen Filter gefunden.",
    orderFab: (count, total) => `Bestellung (${count}) | R$ ${total}`,
    orderOfTable: "Tischbestellung",
    orderSummary: "Bestellübersicht",
    close: "Schließen",
    noItemsInCart: "Keine Artikel in der Bestellung.",
    total: "Gesamt",
    tablePlaceholder: "Tisch (z.B. 12)",
    clear: "Leeren",
    submit: "Bestellung senden",
    sending: "Wird gesendet...",
    msgNeedTable: "Tischnummer vor dem Senden angeben.",
    msgEmpty: "Deine Bestellung ist leer.",
    msgFail: "Bestellung konnte nicht gesendet werden.",
    msgOk: "Bestellung erfolgreich gesendet.",
    msgConnection: "Verbindungsfehler beim Senden.",
    msgCleared: "Bestellung geleert.",
    language: "Sprache"
  }
};

const CATEGORY_TRANSLATIONS = {
  "pratos-principais": {
    "pt-BR": "Pratos Principais",
    "en-US": "Main Courses",
    "es-ES": "Platos Principales",
    "fr-FR": "Plats Principaux",
    "it-IT": "Piatti Principali",
    "de-DE": "Hauptgerichte"
  },
  sobremesas: {
    "pt-BR": "Sobremesas",
    "en-US": "Desserts",
    "es-ES": "Postres",
    "fr-FR": "Desserts",
    "it-IT": "Dolci",
    "de-DE": "Desserts"
  },
  entries: {
    "pt-BR": "Entradas",
    "en-US": "Entries",
    "es-ES": "Entradas",
    "fr-FR": "Entrées",
    "it-IT": "Antipasti",
    "de-DE": "Vorspeisen"
  },
  salads: {
    "pt-BR": "Saladas",
    "en-US": "Salads",
    "es-ES": "Ensaladas",
    "fr-FR": "Salades",
    "it-IT": "Insalate",
    "de-DE": "Salate"
  },
  meat: {
    "pt-BR": "Carnes",
    "en-US": "Meat",
    "es-ES": "Carnes",
    "fr-FR": "Viandes",
    "it-IT": "Carni",
    "de-DE": "Fleisch"
  },
  fish: {
    "pt-BR": "Peixes",
    "en-US": "Fish",
    "es-ES": "Pescados",
    "fr-FR": "Poissons",
    "it-IT": "Pesce",
    "de-DE": "Fisch"
  },
  accompaniments: {
    "pt-BR": "Acompanhamentos",
    "en-US": "Accompaniments",
    "es-ES": "Acompañamientos",
    "fr-FR": "Accompagnements",
    "it-IT": "Contorni",
    "de-DE": "Beilagen"
  }
};

function loadTranslationCache() {
  try {
    const raw = localStorage.getItem(translationCacheKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveTranslationCache(cache) {
  try {
    localStorage.setItem(translationCacheKey, JSON.stringify(cache || {}));
  } catch {
    // no-op
  }
}

const cartKey = slug ? `menuz_cart_${slug}` : "menuz_cart_template";
const tableKey = slug ? `menuz_table_${slug}` : "menuz_table_template";
const categoryKey = slug ? `menuz_category_${slug}` : "menuz_category_template";
const searchTermKey = slug ? `menuz_search_${slug}` : "menuz_search_template";
const favoritesKey = slug ? `menuz_favorites_${slug}` : "menuz_favorites_template";
const densityKey = slug ? `menuz_density_${slug}` : "menuz_density_template";
const guestProfileKey = slug ? `menuz_guest_${slug}` : "menuz_guest_template";
const techModeKey = slug ? `menuz_tech_mode_${slug}` : "menuz_tech_mode_template";
let searchDebounceTimer = null;
let lastFocusedElement = null;
const TABLE_PATTERN = /^[a-zA-Z0-9\-_.#]{1,32}$/;

const state = {
  restaurant: null,
  items: [],
  baseItems: [],
  baseDescription: "",
  baseCategories: [],
  integrations: {},
  cart: [],
  selectedCategory: (() => {
    try {
      return localStorage.getItem(categoryKey) || "all";
    } catch {
      return "all";
    }
  })(),
  categories: [],
  modeItems: [],
  heroImages: [],
  heroIndex: 0,
  heroTimer: null,
  language: localStorage.getItem(languageKey) || "pt-BR",
  defaultLanguage: "pt-BR",
  translationCache: loadTranslationCache(),
  isTranslating: false,
  favorites: (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  })(),
  showFavoritesOnly: false,
  techModeEnabled: (() => {
    try {
      return localStorage.getItem(techModeKey) === "1";
    } catch {
      return false;
    }
  })(),
  commandIndex: 0,
  commandResults: [],
  commandShortcuts: [],
  voiceRecognition: null,
  heroTouchStartX: 0,
  deferredInstallPrompt: null,
  loadedIntegrationScripts: new Set()
};
const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80";

if (!LANGUAGES.some((lang) => lang.code === state.language)) {
  state.language = "pt-BR";
}

function trackPublicEvent(type, payload = {}) {
  const body = JSON.stringify({
    type,
    restaurantSlug: slug || payload.restaurantSlug || "",
    itemId: payload.itemId || "",
    table: payload.table || "",
    meta: payload.meta || {}
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/public/events", blob);
    return;
  }

  fetch("/api/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  }).catch(() => {});
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function announce(message) {
  if (!srLive || !message) return;
  srLive.textContent = "";
  setTimeout(() => {
    srLive.textContent = message;
  }, 20);
}

function debounce(fn, waitMs = 180) {
  return (...args) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => fn(...args), waitMs);
  };
}

function getCurrencyLocale() {
  const localeMap = {
    "pt-BR": "pt-BR",
    "en-US": "en-US",
    "es-ES": "es-ES",
    "fr-FR": "fr-FR",
    "it-IT": "it-IT",
    "de-DE": "de-DE"
  };
  return localeMap[state.language] || "pt-BR";
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(getCurrencyLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTextKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setCanonicalUrl() {
  if (!canonicalLink) return;
  canonicalLink.href = window.location.href;
}

function setSeoMeta({ title, description, image }) {
  const safeTitle = (title || "Cardapio digital").toString().trim();
  const safeDescription = (description || "Cardapio digital com pedido rapido e experiencia AR.")
    .toString()
    .trim()
    .slice(0, 180);
  const safeImage = (image || "/assets/landing/hero-restaurant.webp").toString().trim();
  document.title = safeTitle;
  if (metaDescription) metaDescription.setAttribute("content", safeDescription);
  if (ogTitle) ogTitle.setAttribute("content", safeTitle);
  if (ogDescription) ogDescription.setAttribute("content", safeDescription);
  if (ogImage) ogImage.setAttribute("content", safeImage);
  if (twitterTitle) twitterTitle.setAttribute("content", safeTitle);
  if (twitterDescription) twitterDescription.setAttribute("content", safeDescription);
  if (twitterImage) twitterImage.setAttribute("content", safeImage);
}

function updateStructuredData(restaurant, heroImage) {
  if (!restaurantJsonLd || !restaurant) return;
  const contact = getRestaurantContact();
  const payload = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name || "Cardapio",
    description: (restaurant.description || "").toString().slice(0, 220),
    image: heroImage || undefined,
    url: window.location.href,
    telephone: contact.phone !== "-" ? contact.phone : undefined,
    email: contact.email !== "-" ? contact.email : undefined,
    address: contact.address !== "-" ? contact.address : undefined,
    sameAs: contact.website !== "-" ? [contact.website] : undefined
  };
  restaurantJsonLd.textContent = JSON.stringify(payload);
}

function currentMessages() {
  const base = MESSAGES[state.language] || MESSAGES["pt-BR"];
  const customRoot = (state.restaurant && state.restaurant.uiMessages) || {};
  const custom = customRoot[state.language] || {};
  const merged = { ...base };
  Object.entries(custom).forEach(([key, value]) => {
    if (typeof value !== "string") return;
    if (key === "orderFab") return;
    merged[key] = value;
  });
  return merged;
}

function t(key) {
  return currentMessages()[key] || MESSAGES["pt-BR"][key] || key;
}

function getLanguageConfig(code = state.language) {
  return LANGUAGES.find((lang) => lang.code === code) || LANGUAGES[0];
}

function updateLanguageButton() {
  const lang = getLanguageConfig();
  if (!drawerLang) return;
  drawerLang.setAttribute("aria-label", `${t("language")}: ${lang.label || lang.code}`);
  drawerLang.setAttribute("title", `${t("language")}: ${lang.label || lang.code}`);
}

function getEnabledLanguages() {
  const settings = (state.restaurant && state.restaurant.languageSettings) || {};
  const configured = Array.isArray(settings.languages)
    ? settings.languages
    : [];
  const filtered = LANGUAGES.filter((lang) => configured.includes(lang.code));
  return filtered.length > 0 ? filtered : LANGUAGES;
}

function getDefaultLanguageCode() {
  const settings = (state.restaurant && state.restaurant.languageSettings) || {};
  const candidate = settings.defaultLanguage;
  const enabled = getEnabledLanguages();
  if (enabled.some((lang) => lang.code === candidate)) {
    return candidate;
  }
  return enabled[0].code;
}

function getCachedTranslation(languageCode, text) {
  const safeText = (text || "").toString().trim();
  if (!safeText) return "";
  const langCache = state.translationCache[languageCode];
  if (!langCache || typeof langCache !== "object") return "";
  return (langCache[safeText] || "").toString().trim();
}

function setCachedTranslations(languageCode, translationsMap) {
  const input = translationsMap && typeof translationsMap === "object" ? translationsMap : {};
  if (!state.translationCache[languageCode] || typeof state.translationCache[languageCode] !== "object") {
    state.translationCache[languageCode] = {};
  }
  let changed = false;
  Object.entries(input).forEach(([sourceText, targetText]) => {
    const source = (sourceText || "").toString().trim();
    const target = (targetText || "").toString().trim();
    if (!source || !target) return;
    if (state.translationCache[languageCode][source] === target) return;
    state.translationCache[languageCode][source] = target;
    changed = true;
  });
  if (changed) {
    saveTranslationCache(state.translationCache);
  }
}

async function requestTranslations(texts, targetLanguage, sourceLanguage) {
  const uniqueTexts = [...new Set((texts || []).map((text) => (text || "").toString().trim()).filter(Boolean))];
  if (!uniqueTexts.length) return {};

  const missing = uniqueTexts.filter((text) => !getCachedTranslation(targetLanguage, text));
  if (missing.length > 0) {
    const chunks = [];
    let currentChunk = [];
    let currentChars = 0;
    const MAX_TEXTS_PER_CHUNK = 60;
    const MAX_CHARS_PER_CHUNK = 5000;

    missing.forEach((text) => {
      const safeText = (text || "").toString();
      const nextChars = currentChars + safeText.length;
      if (
        currentChunk.length >= MAX_TEXTS_PER_CHUNK ||
        nextChars > MAX_CHARS_PER_CHUNK
      ) {
        if (currentChunk.length) chunks.push(currentChunk);
        currentChunk = [];
        currentChars = 0;
      }
      currentChunk.push(safeText);
      currentChars += safeText.length;
    });
    if (currentChunk.length) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const response = await fetch("/api/public/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: chunk,
          targetLanguage,
          sourceLanguage
        })
      });
      if (!response.ok) {
        throw new Error("translate_failed");
      }
      const data = await response.json();
      const translated = Array.isArray(data.translations) ? data.translations : [];
      const toCache = {};
      chunk.forEach((original, index) => {
        const translatedText = (translated[index] || "").toString().trim();
        if (translatedText) {
          toCache[original] = translatedText;
        }
      });
      setCachedTranslations(targetLanguage, toCache);
    }
  }

  const map = {};
  uniqueTexts.forEach((text) => {
    map[text] = getCachedTranslation(targetLanguage, text) || text;
  });
  return map;
}

async function applyTranslatedContent() {
  if (!state.restaurant) return;

  const defaultLanguage = state.defaultLanguage || getDefaultLanguageCode();
  if (state.language === defaultLanguage) {
    state.items = state.baseItems.map((item) => ({ ...item }));
    state.categories = [...state.baseCategories];
    restaurantDesc.textContent = state.baseDescription || "";
    return;
  }

  const texts = [];
  if (state.baseDescription) texts.push(state.baseDescription);
  state.baseItems.forEach((item) => {
    if (item.name) texts.push(item.name);
    if (item.description) texts.push(item.description);
    const category = inferCategory(item);
    if (category) texts.push(category);
  });

  if (!texts.length) {
    state.items = state.baseItems.map((item) => ({ ...item }));
    state.categories = [...state.baseCategories];
    restaurantDesc.textContent = state.baseDescription || "";
    return;
  }

  state.isTranslating = true;
  try {
    const map = await requestTranslations(texts, state.language, defaultLanguage);
    state.items = state.baseItems.map((item) => {
      const name = item.name ? map[item.name] || item.name : item.name;
      const description = item.description ? map[item.description] || item.description : item.description;
      const rawCategory = inferCategory(item);
      const category = rawCategory ? map[rawCategory] || rawCategory : rawCategory;
      return { ...item, name, description, category };
    });
    state.categories = [...new Set(state.items.map((item) => inferCategory(item)))];
    restaurantDesc.textContent = state.baseDescription ? map[state.baseDescription] || state.baseDescription : "";
  } catch (error) {
    state.items = state.baseItems.map((item) => ({ ...item }));
    state.categories = [...state.baseCategories];
    restaurantDesc.textContent = state.baseDescription || "";
  } finally {
    state.isTranslating = false;
  }
}

function translateCategory(rawCategory) {
  const normalized = normalizeTextKey(rawCategory);
  const baseDict = CATEGORY_TRANSLATIONS[normalized] || {};
  const customMap = (state.restaurant && state.restaurant.categoryLabels) || {};
  const customDict = customMap[normalized] || {};
  const dict = { ...baseDict, ...customDict };
  if (Object.keys(dict).length === 0) {
    const translated = getCachedTranslation(state.language, rawCategory);
    return translated || rawCategory;
  }
  return dict[state.language] || dict["pt-BR"] || rawCategory;
}

function getRestaurantBranding() {
  const restaurant = state.restaurant || {};
  const contact = restaurant.contact || {};
  const name = (restaurant.name || "Cardapio").toString().trim() || "Cardapio";
  let subtitle = "";
  if (contact.website) {
    subtitle = contact.website.toString().trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  }
  if (!subtitle) {
    subtitle = "menu digital";
  }
  subtitle = subtitle.slice(0, 34);
  return {
    name,
    subtitle,
    logo: restaurant.logo || ""
  };
}

function applyRestaurantBranding() {
  const brand = getRestaurantBranding();
  if (brandTitle) brandTitle.textContent = brand.name;
  if (brandSub) brandSub.textContent = brand.subtitle;
  if (drawerBrandTitle) drawerBrandTitle.textContent = brand.name;
  if (drawerBrandSub) drawerBrandSub.textContent = brand.subtitle;
  if (brandLogo) {
    if (brand.logo) {
      brandLogo.src = brand.logo;
      brandLogo.classList.remove("hidden");
    } else {
      brandLogo.removeAttribute("src");
      brandLogo.classList.add("hidden");
    }
  }
  if (drawerBrandLogo) {
    if (brand.logo) {
      drawerBrandLogo.src = brand.logo;
      drawerBrandLogo.classList.remove("hidden");
    } else {
      drawerBrandLogo.removeAttribute("src");
      drawerBrandLogo.classList.add("hidden");
    }
  }
  const seoDescription =
    (state.restaurant && state.restaurant.description) ||
    "Cardapio digital integrado com pedido rapido e experiencia AR.";
  const seoImage = (state.heroImages && state.heroImages[0]) || HERO_FALLBACK_IMAGE;
  setSeoMeta({
    title: `${brand.name} | Cardapio digital`,
    description: seoDescription,
    image: seoImage
  });
  setCanonicalUrl();
  if (state.restaurant) {
    updateStructuredData(state.restaurant, seoImage);
  }
}

function getRestaurantContact() {
  const contact = (state.restaurant && state.restaurant.contact) || {};
  return {
    address: contact.address || "-",
    phone: contact.phone || "-",
    email: contact.email || "-",
    website: contact.website || "-"
  };
}

function applyLanguageTexts() {
  searchInput.placeholder = t("searchPlaceholder");
  emptyState.textContent = t("noItemsFound");
  langTitle.textContent = t("language");
  updateLanguageButton();
  cartClose.textContent = t("close");
  drawerClose.textContent = t("close");
  const brandLabel = document.querySelector(".cart-head .brand.small");
  if (brandLabel) brandLabel.textContent = t("orderOfTable");
  const summaryLabel = document.querySelector(".cart-head h2");
  if (summaryLabel) summaryLabel.textContent = t("orderSummary");
  if (cartClear) cartClear.textContent = t("clear");
  if (cartSubmit) {
    const isSending = cartSubmit.dataset.sending === "1";
    cartSubmit.textContent = isSending ? t("sending") : t("submit");
  }
  if (compactToggle) {
    compactToggle.textContent = document.body.classList.contains("density-compact") ? "Confortavel" : "Compacto";
  }
  if (favoritesToggle) {
    favoritesToggle.textContent = state.showFavoritesOnly ? "Todos" : "Favoritos";
    favoritesToggle.classList.toggle("active", state.showFavoritesOnly);
  }
  tableInput.placeholder = t("tablePlaceholder");
  if (reservationNameInput) reservationNameInput.placeholder = "Nome";
  if (reservationPhoneInput) reservationPhoneInput.placeholder = "Telefone";
  if (reservationGuestsInput) reservationGuestsInput.placeholder = "Pessoas";
  if (leadNameInput) leadNameInput.placeholder = "Nome";
  if (leadEmailInput) leadEmailInput.placeholder = "Email";
  if (leadPhoneInput) leadPhoneInput.placeholder = "Telefone";
  if (waitlistNameInput) waitlistNameInput.placeholder = "Nome";
  if (waitlistPhoneInput) waitlistPhoneInput.placeholder = "Telefone";
  if (waitlistGuestsInput) waitlistGuestsInput.placeholder = "Pessoas";
  if (waitlistEtaInput) waitlistEtaInput.placeholder = "Espera (min)";
  if (feedbackNameInput) feedbackNameInput.placeholder = "Nome";
  if (feedbackEmailInput) feedbackEmailInput.placeholder = "Email";
  if (feedbackCommentInput) feedbackCommentInput.placeholder = "Comentario curto";
  if (voiceSearchButton) voiceSearchButton.textContent = voiceSearchButton.classList.contains("active") ? "Ouvindo..." : "Voz";
  if (commandPaletteToggle) commandPaletteToggle.textContent = "Comandos";
  if (state.voiceRecognition) {
    state.voiceRecognition.lang = (state.language || "pt-BR").replace("_", "-");
  }
  document.documentElement.lang = (state.language || "pt-BR").toLowerCase();
}

function setTechMode(enabled, options = {}) {
  const config = {
    persist: options.persist !== false,
    track: options.track !== false
  };
  state.techModeEnabled = Boolean(enabled);
  document.body.classList.toggle("tech-mode", state.techModeEnabled);
  if (techModeToggle) {
    techModeToggle.classList.toggle("active", state.techModeEnabled);
    techModeToggle.textContent = state.techModeEnabled ? "Tech ON" : "Tech";
  }
  if (techClockPill) {
    techClockPill.classList.toggle("hidden", !state.techModeEnabled);
  }
  if (techLatencyPill) {
    techLatencyPill.classList.toggle("hidden", !state.techModeEnabled);
  }
  if (config.persist) {
    try {
      localStorage.setItem(techModeKey, state.techModeEnabled ? "1" : "0");
    } catch {
      // no-op
    }
  }
  if (config.track) {
    trackPublicEvent("feature_toggle", { meta: { feature: "tech_mode", enabled: state.techModeEnabled } });
  }
}

function initTechModeControls() {
  setTechMode(state.techModeEnabled, { persist: false, track: false });
  if (techModeToggle) {
    techModeToggle.addEventListener("click", () => {
      setTechMode(!state.techModeEnabled);
    });
  }
}

function updateTechClock() {
  if (!techClockPill) return;
  const text = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  techClockPill.textContent = text;
}

async function probeTechLatency() {
  if (!techLatencyPill) return;
  const started = performance.now();
  try {
    const response = await fetch(`/api/health?ts=${Date.now()}`, { cache: "no-store" });
    const elapsed = Math.round(performance.now() - started);
    const quality = response.ok ? (elapsed <= 120 ? "Excelente" : elapsed <= 320 ? "Boa" : "Alta") : "Instavel";
    techLatencyPill.textContent = `Latencia ${elapsed}ms · ${quality}`;
  } catch {
    techLatencyPill.textContent = "Latencia indisponivel";
  }
}

function initTechTelemetry() {
  if (!techClockPill || !techLatencyPill) return;
  updateTechClock();
  probeTechLatency();
  window.setInterval(updateTechClock, 1000);
  window.setInterval(probeTechLatency, 30000);
}

function getSmartRecommendationItems(limit = 6) {
  const source = Array.isArray(state.items) ? [...state.items] : [];
  if (!source.length) return [];
  const selected = (state.selectedCategory || "all").toLowerCase();
  const search = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();

  const scored = source.map((item, index) => {
    const category = inferCategory(item).toLowerCase();
    let score = 0;
    if (isFavorite(item.id)) score += 42;
    if (item.modelGlb || item.modelUsdz) score += 24;
    if (selected !== "all" && category === selected) score += 14;
    if (search && `${item.name || ""} ${item.description || ""}`.toLowerCase().includes(search)) score += 18;
    const price = Number(item.price || 0);
    if (price > 0 && price <= 55) score += 8;
    if ((item.description || "").length > 18) score += 6;
    const stableShuffle = (String(item.id || index).length * 13 + index * 7) % 9;
    score += stableShuffle;
    return { item, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function renderAiRail() {
  if (!aiRail) return;
  const items = getSmartRecommendationItems(6);
  if (!items.length) {
    aiRail.innerHTML = "";
    aiRail.classList.add("hidden");
    return;
  }
  aiRail.classList.remove("hidden");
  aiRail.innerHTML = items
    .map(
      (item) => `
        <article class="ai-card tech-reveal">
          <span class="status-pill tech">AI Suggest</span>
          <strong>${escapeHtml(item.name || "Item")}</strong>
          <p class="muted">R$ ${formatPrice(item.price || 0)}</p>
          <button type="button" data-ai-add="${escapeHtml(item.id)}">Adicionar rapido</button>
        </article>
      `
    )
    .join("");
  aiRail.querySelectorAll("[data-ai-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-ai-add");
      if (!itemId) return;
      addToCart(itemId);
      trackPublicEvent("ai_recommendation_add", { itemId });
    });
  });
  refreshRevealTargets();
}

let revealObserver = null;

function ensureRevealObserver() {
  if (revealObserver || !("IntersectionObserver" in window)) return;
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
}

function refreshRevealTargets() {
  ensureRevealObserver();
  if (!revealObserver) return;
  document.querySelectorAll(".menu-section, .mini-form, .quick-action, .ai-card").forEach((node) => {
    if (node.dataset.revealBound === "1") return;
    node.dataset.revealBound = "1";
    node.classList.add("tech-reveal");
    revealObserver.observe(node);
  });
}

function initHeroGestures() {
  if (!heroTrack) return;
  heroTrack.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      state.heroTouchStartX = touch ? touch.clientX : 0;
    },
    { passive: true }
  );
  heroTrack.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      const endX = touch ? touch.clientX : 0;
      const delta = endX - state.heroTouchStartX;
      if (Math.abs(delta) < 34) return;
      if (delta < 0) {
        setHeroSlide(state.heroIndex + 1);
      } else {
        setHeroSlide(state.heroIndex - 1);
      }
    },
    { passive: true }
  );
}

function focusSearchInput() {
  if (!searchWrap.classList.contains("hidden")) {
    searchInput.focus();
    return;
  }
  searchWrap.classList.remove("hidden");
  if (searchToggle) searchToggle.setAttribute("aria-expanded", "true");
  searchInput.focus();
}

function startVoiceSearch() {
  if (!state.voiceRecognition) return;
  focusSearchInput();
  if (voiceSearchButton) {
    voiceSearchButton.textContent = "Ouvindo...";
    voiceSearchButton.classList.add("active");
  }
  try {
    state.voiceRecognition.start();
  } catch {
    // no-op
  }
}

function initVoiceSearch() {
  if (!voiceSearchButton) return;
  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionApi) {
    voiceSearchButton.classList.add("hidden");
    return;
  }
  const recognition = new SpeechRecognitionApi();
  recognition.lang = (state.language || "pt-BR").replace("_", "-");
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const result = event.results && event.results[0] && event.results[0][0];
    const transcript = result ? String(result.transcript || "").trim() : "";
    if (!transcript) return;
    searchInput.value = transcript;
    saveSearchTerm(transcript);
    renderMenu();
    announce(`Busca por voz: ${transcript}`);
    trackPublicEvent("voice_search", { meta: { length: transcript.length } });
  };
  recognition.onend = () => {
    if (!voiceSearchButton) return;
    voiceSearchButton.textContent = "Voz";
    voiceSearchButton.classList.remove("active");
  };
  recognition.onerror = () => {
    if (!voiceSearchButton) return;
    voiceSearchButton.textContent = "Voz";
    voiceSearchButton.classList.remove("active");
  };
  state.voiceRecognition = recognition;
  voiceSearchButton.classList.remove("hidden");
  voiceSearchButton.addEventListener("click", startVoiceSearch);
}

function buildCommandShortcuts() {
  const commands = [
    {
      id: "search-focus",
      label: "Buscar pratos",
      hint: "Focar no campo de busca",
      run: () => focusSearchInput()
    },
    {
      id: "open-cart",
      label: "Abrir pedido",
      hint: "Abre o carrinho da mesa",
      run: () => {
        if (cartButton && !cartButton.classList.contains("hidden")) cartButton.click();
      }
    },
    {
      id: "toggle-tech",
      label: state.techModeEnabled ? "Desativar modo tech" : "Ativar modo tech",
      hint: "Visual super tecnologico",
      run: () => setTechMode(!state.techModeEnabled)
    },
    {
      id: "toggle-compact",
      label: "Alternar densidade",
      hint: "Troca entre compacto e confortavel",
      run: () => compactToggle && compactToggle.click()
    },
    {
      id: "toggle-favorites",
      label: "Mostrar favoritos",
      hint: "Filtra itens favoritos",
      run: () => favoritesToggle && favoritesToggle.click()
    },
    {
      id: "top",
      label: "Ir para topo",
      hint: "Volta para o inicio da pagina",
      run: () => window.scrollTo({ top: 0, behavior: "smooth" })
    },
    {
      id: "voice",
      label: "Busca por voz",
      hint: "Fala o nome do prato",
      run: () => startVoiceSearch()
    }
  ];

  if (reservationForm && !reservationForm.classList.contains("hidden")) {
    commands.push({
      id: "form-reservation",
      label: "Abrir reserva",
      hint: "Vai para formulario de reserva",
      run: () => reservationForm.scrollIntoView({ behavior: "smooth", block: "center" })
    });
  }
  if (waitlistForm && !waitlistForm.classList.contains("hidden")) {
    commands.push({
      id: "form-waitlist",
      label: "Abrir fila de espera",
      hint: "Vai para formulario de fila",
      run: () => waitlistForm.scrollIntoView({ behavior: "smooth", block: "center" })
    });
  }

  state.categories.forEach((category) => {
    commands.push({
      id: `category-${normalizeTextKey(category)}`,
      label: `Filtrar ${translateCategory(category)}`,
      hint: "Troca categoria do cardapio",
      run: () => {
        state.selectedCategory = category;
        saveSelectedCategory();
        renderModeStrip();
        renderTabs();
        renderMenu();
      }
    });
  });

  state.commandShortcuts = commands;
}

function renderCommandList() {
  if (!commandList) return;
  const query = (commandInput && commandInput.value ? commandInput.value : "").trim().toLowerCase();
  const base = state.commandShortcuts || [];
  const filtered = !query
    ? base
    : base.filter(
        (entry) =>
          entry.label.toLowerCase().includes(query) ||
          entry.hint.toLowerCase().includes(query) ||
          entry.id.toLowerCase().includes(query)
      );
  state.commandResults = filtered;
  if (!filtered.length) {
    state.commandIndex = 0;
    commandList.innerHTML = `<div class="command-item"><strong>Nenhum comando</strong><span>Tente outro termo.</span></div>`;
    return;
  }
  state.commandIndex = Math.max(0, Math.min(state.commandIndex, filtered.length - 1));
  commandList.innerHTML = filtered
    .map(
      (entry, index) => `
        <button class="command-item ${index === state.commandIndex ? "active" : ""}" type="button" data-command-id="${escapeHtml(
          entry.id
        )}">
          <strong>${escapeHtml(entry.label)}</strong>
          <span>${escapeHtml(entry.hint)}</span>
        </button>
      `
    )
    .join("");
  commandList.querySelectorAll("[data-command-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-command-id");
      const target = state.commandResults.find((entry) => entry.id === id);
      if (!target) return;
      closeCommandPalette();
      target.run();
    });
  });
}

function openCommandPalette() {
  if (!commandModal) return;
  lastFocusedElement = document.activeElement;
  buildCommandShortcuts();
  state.commandIndex = 0;
  commandModal.classList.remove("hidden");
  commandModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (commandInput) {
    commandInput.value = "";
    renderCommandList();
    setTimeout(() => commandInput.focus(), 20);
  }
}

function closeCommandPalette() {
  if (!commandModal) return;
  commandModal.classList.add("hidden");
  commandModal.setAttribute("aria-hidden", "true");
  if (langModal.classList.contains("hidden") && sideOverlay.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function initCommandPalette() {
  if (commandPaletteToggle) {
    commandPaletteToggle.addEventListener("click", () => {
      openCommandPalette();
    });
  }
  if (commandClose) {
    commandClose.addEventListener("click", () => closeCommandPalette());
  }
  if (commandModal) {
    commandModal.addEventListener("click", (event) => {
      if (event.target === commandModal) closeCommandPalette();
    });
  }
  if (commandInput) {
    commandInput.addEventListener("input", () => {
      state.commandIndex = 0;
      renderCommandList();
    });
  }
}

function inferCategory(item) {
  const raw = (item.category || item.section || "").toString().trim();
  return raw || "Menu";
}

function setTheme() {
  if (!state.restaurant) return;
  const accent =
    state.restaurant.theme && state.restaurant.theme.accent
      ? state.restaurant.theme.accent
      : "#e48a14";
  document.documentElement.style.setProperty("--accent", accent);
}

function renderDrawer() {
  const lang = getLanguageConfig();
  drawerLang.innerHTML = `<span class="lang-flag">${escapeHtml(lang.tag || "LG")}</span> ${escapeHtml(
    lang.label || ""
  )}`;

  const contact = getRestaurantContact();
  const safeWebsite = String(contact.website || "").trim();
  const websiteHref =
    safeWebsite && safeWebsite !== "-"
      ? safeWebsite.startsWith("http")
        ? safeWebsite
        : `https://${safeWebsite}`
      : "";
  const phone = String(contact.phone || "").trim();
  const email = String(contact.email || "").trim();
  drawerInfo.innerHTML = `
    <li><span>Endereco</span><span>${escapeHtml(contact.address || "-")}</span></li>
    <li><span>Telefone</span><span>${
      phone && phone !== "-" ? `<a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>` : "-"
    }</span></li>
    <li><span>Email</span><span>${
      email && email !== "-" ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "-"
    }</span></li>
    <li><span>Site</span><span>${
      websiteHref ? `<a href="${escapeHtml(websiteHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeWebsite)}</a>` : "-"
    }</span></li>
  `;
}

function openDrawer() {
  lastFocusedElement = document.activeElement;
  sideOverlay.classList.remove("hidden");
  sideOverlay.setAttribute("aria-hidden", "false");
  sideDrawer.classList.add("open");
  sideDrawer.setAttribute("aria-hidden", "false");
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    if (drawerLang) drawerLang.focus();
  }, 10);
}

function closeDrawer() {
  sideOverlay.classList.add("hidden");
  sideOverlay.setAttribute("aria-hidden", "true");
  sideDrawer.classList.remove("open");
  sideDrawer.setAttribute("aria-hidden", "true");
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
  if (langModal.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function renderLanguageList() {
  langList.innerHTML = "";
  getEnabledLanguages().forEach((lang) => {
    const isActive = lang.code === state.language;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lang-option ${isActive ? "active" : ""}`;
    button.innerHTML = `
      <div class="lang-copy">
        <strong><span class="lang-flag">${escapeHtml(lang.tag || "LG")}</span>${escapeHtml(
          lang.label
        )}</strong>
        <span>${escapeHtml(lang.subtitle)}</span>
      </div>
      <span class="lang-check"></span>
    `;
    button.addEventListener("click", async () => {
      if (state.language === lang.code) {
        closeLanguageModal();
        return;
      }
      state.language = lang.code;
      localStorage.setItem(languageKey, state.language);
      trackPublicEvent("language_change", { meta: { code: state.language } });
      await applyTranslatedContent();
      if (
        state.selectedCategory !== "all" &&
        !state.categories.some((category) => category.toLowerCase() === state.selectedCategory.toLowerCase())
      ) {
        state.selectedCategory = "all";
      }
      applyLanguageTexts();
      renderLanguageList();
      renderDrawer();
      renderModeStrip();
      renderTabs();
      renderMenu();
      renderCart();
      closeLanguageModal();
    });
    langList.appendChild(button);
  });
}

function openLanguageModal() {
  lastFocusedElement = document.activeElement;
  renderLanguageList();
  langModal.classList.remove("hidden");
  langModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    const firstOption = langList.querySelector(".lang-option");
    if (firstOption) firstOption.focus();
  }, 10);
}

function closeLanguageModal() {
  langModal.classList.add("hidden");
  langModal.setAttribute("aria-hidden", "true");
  if (sideOverlay.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function getTableValue() {
  const savedTable = (localStorage.getItem(tableKey) || "").trim();
  return tableFromUrl || savedTable || "";
}

function getSavedSearchTerm() {
  return (localStorage.getItem(searchTermKey) || "").trim();
}

function saveSearchTerm(value) {
  try {
    const nextValue = (value || "").toString().trim().slice(0, 80);
    if (!nextValue) {
      localStorage.removeItem(searchTermKey);
      return;
    }
    localStorage.setItem(searchTermKey, nextValue);
  } catch {
    // no-op
  }
}

function saveSelectedCategory() {
  try {
    localStorage.setItem(categoryKey, state.selectedCategory || "all");
  } catch {
    // no-op
  }
}

function loadGuestProfile() {
  try {
    const raw = localStorage.getItem(guestProfileKey);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { name: "", phone: "", email: "" };
    }
    return {
      name: String(parsed.name || "").trim().slice(0, 120),
      phone: String(parsed.phone || "").trim().slice(0, 40),
      email: String(parsed.email || "").trim().slice(0, 120)
    };
  } catch {
    return { name: "", phone: "", email: "" };
  }
}

function saveGuestProfile(nextValues = {}) {
  const current = loadGuestProfile();
  const merged = {
    name: String(nextValues.name || current.name || "").trim().slice(0, 120),
    phone: String(nextValues.phone || current.phone || "").trim().slice(0, 40),
    email: String(nextValues.email || current.email || "").trim().slice(0, 120)
  };
  try {
    localStorage.setItem(guestProfileKey, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

function applyGuestProfileToForms() {
  const profile = loadGuestProfile();
  if (reservationNameInput && !reservationNameInput.value) reservationNameInput.value = profile.name;
  if (reservationPhoneInput && !reservationPhoneInput.value) reservationPhoneInput.value = profile.phone;
  if (leadNameInput && !leadNameInput.value) leadNameInput.value = profile.name;
  if (leadPhoneInput && !leadPhoneInput.value) leadPhoneInput.value = profile.phone;
  if (leadEmailInput && !leadEmailInput.value) leadEmailInput.value = profile.email;
  if (waitlistNameInput && !waitlistNameInput.value) waitlistNameInput.value = profile.name;
  if (waitlistPhoneInput && !waitlistPhoneInput.value) waitlistPhoneInput.value = profile.phone;
  if (feedbackNameInput && !feedbackNameInput.value) feedbackNameInput.value = profile.name;
  if (feedbackEmailInput && !feedbackEmailInput.value) feedbackEmailInput.value = profile.email;
}

function setFormStatus(statusNode, message) {
  if (!statusNode) return;
  statusNode.textContent = message || "";
}

function setFormSubmitting(form, isSubmitting) {
  if (!form) return;
  form.querySelectorAll("button, input, select, textarea").forEach((field) => {
    if (field.tagName === "BUTTON" && field.type === "submit") return;
    field.disabled = Boolean(isSubmitting);
  });
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;
  if (isSubmitting) {
    submitButton.dataset.originalLabel = submitButton.textContent || "";
    submitButton.textContent = "Enviando...";
    submitButton.disabled = true;
    return;
  }
  submitButton.disabled = false;
  if (submitButton.dataset.originalLabel) {
    submitButton.textContent = submitButton.dataset.originalLabel;
  }
}

function getIntegrations() {
  const base = state.restaurant && state.restaurant.integrations ? state.restaurant.integrations : {};
  const quickLinks = base.quickLinks && typeof base.quickLinks === "object" ? base.quickLinks : {};
  const analytics = base.analytics && typeof base.analytics === "object" ? base.analytics : {};
  const payments = base.payments && typeof base.payments === "object" ? base.payments : {};
  const features = base.features && typeof base.features === "object" ? base.features : {};
  const visual = base.visual && typeof base.visual === "object" ? base.visual : {};
  return {
    quickLinks,
    analytics,
    payments,
    features,
    visual
  };
}

function saveFavorites() {
  try {
    localStorage.setItem(favoritesKey, JSON.stringify(state.favorites || []));
  } catch {
    // ignore
  }
}

function isFavorite(itemId) {
  return state.favorites.includes(itemId);
}

function toggleFavorite(itemId) {
  if (!itemId) return;
  if (isFavorite(itemId)) {
    state.favorites = state.favorites.filter((id) => id !== itemId);
    announce("Item removido dos favoritos.");
  } else {
    state.favorites = [...state.favorites, itemId];
    announce("Item adicionado aos favoritos.");
  }
  saveFavorites();
  renderMenu();
}

function applyVisualSettings() {
  const integrations = getIntegrations();
  const visual = integrations.visual || {};
  document.body.classList.remove(
    "preset-clean",
    "preset-editorial",
    "preset-bold",
    "preset-night",
    "preset-beach",
    "preset-bistro"
  );
  document.body.classList.add(`preset-${visual.preset || "clean"}`);

  let savedDensity = visual.density || "comfortable";
  try {
    savedDensity = localStorage.getItem(densityKey) || savedDensity;
  } catch {
    // ignore
  }
  document.body.classList.toggle("density-compact", savedDensity === "compact");
  if (compactToggle) {
    compactToggle.classList.toggle("active", savedDensity === "compact");
  }
}

function openExternalLink(url, eventType) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
  trackPublicEvent(eventType || "social_open", {
    meta: { url }
  });
}

function renderQuickActions() {
  if (!quickActions) return;
  const integrations = getIntegrations();
  const links = integrations.quickLinks || {};
  const payments = integrations.payments || {};
  const features = integrations.features || {};
  const actions = [
    { label: "WhatsApp", url: links.whatsapp, eventType: "social_open" },
    { label: "Reservar", url: links.reservation, eventType: "reservation_submit" },
    { label: "Delivery", url: links.delivery, eventType: "delivery_open" },
    { label: "Mapa", url: links.maps, eventType: "map_open" },
    { label: "Instagram", url: links.instagram, eventType: "social_open" },
    { label: "Review", url: links.review, eventType: "social_open" },
    { label: "Fidelidade", url: links.loyalty, eventType: "social_open" },
    { label: "Pix", url: payments.pixKey ? `copy:${payments.pixKey}` : "", eventType: "checkout_start" },
    { label: "Stripe", url: payments.stripeCheckoutUrl, eventType: "checkout_start" },
    { label: "PayPal", url: payments.paypalMeUrl, eventType: "checkout_start" }
  ].filter((action) => action.url);
  if (features.showReservationForm) {
    actions.push({ label: "Reserva rapida", targetId: "reservation-form", eventType: "reservation_submit" });
  }
  if (features.showWaitlistForm) {
    actions.push({ label: "Entrar na fila", targetId: "waitlist-form", eventType: "waitlist_join" });
  }
  if (features.showFeedbackForm) {
    actions.push({ label: "Avaliar", targetId: "feedback-form", eventType: "feedback_submit" });
  }

  quickActions.innerHTML = "";
  if (!actions.length || features.enableQuickActions === false) {
    quickActions.classList.add("hidden");
    return;
  }
  quickActions.classList.remove("hidden");

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-action";
    button.textContent = action.label;
    button.addEventListener("click", async () => {
      if (String(action.url).startsWith("copy:")) {
        const value = String(action.url).slice(5);
        try {
          await navigator.clipboard.writeText(value);
          announce("Chave copiada.");
        } catch {
          announce("Nao foi possivel copiar agora.");
        }
        return;
      }
      if (action.targetId) {
        const section = document.getElementById(action.targetId);
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "center" });
          const firstField = section.querySelector("input,select,textarea,button");
          if (firstField && typeof firstField.focus === "function") {
            setTimeout(() => firstField.focus(), 250);
          }
          trackPublicEvent(action.eventType || "menu_view");
        }
        return;
      }
      openExternalLink(action.url, action.eventType);
    });
    quickActions.appendChild(button);
  });
  refreshRevealTargets();
}

async function loadExternalScript(id, src, afterLoad) {
  if (!src || state.loadedIntegrationScripts.has(id)) return;
  const existing = document.querySelector(`script[data-int="${id}"]`);
  if (existing) {
    state.loadedIntegrationScripts.add(id);
    if (typeof afterLoad === "function") afterLoad();
    return;
  }
  await new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.int = id;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });
  state.loadedIntegrationScripts.add(id);
  if (typeof afterLoad === "function") afterLoad();
}

async function applyAnalyticsIntegrations() {
  const analytics = getIntegrations().analytics || {};
  if (analytics.gtmId) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "menuz_init" });
    await loadExternalScript(
      "gtm",
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(analytics.gtmId)}`
    );
  }

  if (analytics.ga4Id) {
    await loadExternalScript(
      "ga4",
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analytics.ga4Id)}`,
      () => {
        window.dataLayer = window.dataLayer || [];
        function gtag() {
          window.dataLayer.push(arguments);
        }
        window.gtag = window.gtag || gtag;
        window.gtag("js", new Date());
        window.gtag("config", analytics.ga4Id);
      }
    );
  }

  if (analytics.clarityId) {
    const clarityId = analytics.clarityId;
    window.clarity =
      window.clarity ||
      function clarity() {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
    await loadExternalScript("clarity", "https://www.clarity.ms/tag/" + encodeURIComponent(clarityId));
  }

  if (analytics.metaPixelId) {
    window.fbq =
      window.fbq ||
      function fbq() {
        if (window.fbq.callMethod) {
          window.fbq.callMethod.apply(window.fbq, arguments);
        } else {
          (window.fbq.queue = window.fbq.queue || []).push(arguments);
        }
      };
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    await loadExternalScript("meta-pixel", "https://connect.facebook.net/en_US/fbevents.js", () => {
      window.fbq("init", analytics.metaPixelId);
      window.fbq("track", "PageView");
    });
  }

  if (analytics.tiktokPixelId) {
    const ttq = (window.ttq = window.ttq || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function setAndDefer(target, method) {
      target[method] = function wrapped() {
        target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i += 1) {
      ttq.setAndDefer(ttq, ttq.methods[i]);
    }
    await loadExternalScript("tiktok", "https://analytics.tiktok.com/i18n/pixel/events.js", () => {
      if (window.ttq && window.ttq.load) {
        window.ttq.load(analytics.tiktokPixelId);
        window.ttq.page();
      }
    });
  }
}

function initNetworkPill() {
  if (!networkPill) return;
  const update = () => {
    const online = navigator.onLine;
    networkPill.textContent = online ? "Online" : "Offline";
    networkPill.classList.toggle("offline", !online);
  };
  update();
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
}

function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    const integrations = getIntegrations();
    if (installAppButton && integrations.features?.enableInstallPrompt !== false) {
      installAppButton.classList.remove("hidden");
    }
  });

  if (installAppButton) {
    installAppButton.addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      installAppButton.classList.add("hidden");
      trackPublicEvent("pwa_install");
    });
  }
}

function updateFormsVisibility() {
  const integrations = getIntegrations();
  const features = integrations.features || {};
  const showReservation = Boolean(features.showReservationForm);
  const showLead = Boolean(features.showLeadForm);
  const showWaitlist = Boolean(features.showWaitlistForm);
  const showFeedback = Boolean(features.showFeedbackForm);
  if (reservationForm) {
    reservationForm.classList.toggle("hidden", !showReservation);
  }
  if (leadForm) {
    leadForm.classList.toggle("hidden", !showLead);
  }
  if (waitlistForm) {
    waitlistForm.classList.toggle("hidden", !showWaitlist);
  }
  if (feedbackForm) {
    feedbackForm.classList.toggle("hidden", !showFeedback);
  }
  if (engagementForms) {
    const hasVisibleForm = showReservation || showLead || showWaitlist || showFeedback;
    engagementForms.classList.toggle("hidden", !hasVisibleForm);
  }
  if (favoritesToggle) {
    const favoritesEnabled = features.enableFavorites !== false;
    favoritesToggle.classList.toggle("hidden", !favoritesEnabled);
    if (!favoritesEnabled) {
      state.showFavoritesOnly = false;
    }
  }
  if (compactToggle) {
    const compactEnabled = features.enableCompactMode !== false;
    compactToggle.classList.toggle("hidden", !compactEnabled);
    if (!compactEnabled) {
      document.body.classList.remove("density-compact");
    }
  }
  refreshRevealTargets();
}

function loadCart() {
  try {
    const raw = localStorage.getItem(cartKey);
    state.cart = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(state.cart)) state.cart = [];
  } catch (err) {
    state.cart = [];
  }
}

function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(state.cart));
  updateCartButton();
}

function getDetailedCart() {
  return state.cart
    .map((entry) => {
      const item = state.items.find((menuItem) => menuItem.id === entry.id);
      if (!item) return null;
      return {
        ...item,
        qty: Math.max(1, Number(entry.qty) || 1)
      };
    })
    .filter(Boolean);
}

function updateCartButton() {
  const detailed = getDetailedCart();
  if (detailed.length === 0) {
    cartButton.classList.add("hidden");
    return;
  }

  const totalItems = detailed.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = detailed.reduce((acc, item) => acc + item.qty * Number(item.price || 0), 0);
  cartButton.textContent = t("orderFab")(totalItems, formatPrice(totalPrice));
  cartButton.classList.remove("hidden");
}

function addToCart(itemId) {
  const found = state.cart.find((entry) => entry.id === itemId);
  if (found) {
    found.qty += 1;
  } else {
    state.cart.push({ id: itemId, qty: 1 });
  }
  trackPublicEvent("add_to_cart", { itemId });
  saveCart();
  announce("Item adicionado ao pedido.");
}

function updateCartQty(itemId, delta) {
  const found = state.cart.find((entry) => entry.id === itemId);
  if (!found) return;
  found.qty += delta;
  if (found.qty <= 0) {
    state.cart = state.cart.filter((entry) => entry.id !== itemId);
  }
  saveCart();
  renderCart();
  announce("Pedido atualizado.");
}

function getFilteredItems() {
  const text = (searchInput.value || "").trim().toLowerCase();
  return state.items.filter((item) => {
    const category = inferCategory(item);
    const categoryMatch =
      state.selectedCategory === "all" ||
      category.toLowerCase() === state.selectedCategory.toLowerCase();

    if (!categoryMatch) return false;
    if (state.showFavoritesOnly && !isFavorite(item.id)) return false;

    if (!text) return true;
    const haystack = `${item.name || ""} ${item.description || ""} ${category}`.toLowerCase();
    return haystack.includes(text);
  });
}

function getCategoryCover(category) {
  const found = state.items.find(
    (item) => inferCategory(item).toLowerCase() === category.toLowerCase() && item.image
  );
  return found ? found.image : "";
}

function renderModeStrip() {
  modeStrip.innerHTML = "";
  const chips = ["all", ...state.categories];

  chips.forEach((chip) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mode-chip ${state.selectedCategory === chip ? "active" : ""}`;
    if (chip === "all") {
      button.innerHTML = `<span class="chip-label">${escapeHtml(t("modeMenu"))}</span>`;
    } else {
      const image = getCategoryCover(chip);
      const label = translateCategory(chip);
      if (image) {
        button.classList.add("with-image");
        button.style.backgroundImage = `url('${encodeURI(image)}')`;
      }
      button.innerHTML = `<span class="chip-label">${escapeHtml(label)}</span>`;
    }
    button.addEventListener("click", () => {
      state.selectedCategory = chip;
      saveSelectedCategory();
      renderModeStrip();
      renderTabs();
      renderMenu();
      if (chip !== "all") {
        announce(`Categoria ${translateCategory(chip)} selecionada.`);
      }
    });
    modeStrip.appendChild(button);
  });
}

function renderTabs() {
  categoryList.innerHTML = "";
  const tabs = ["all", ...state.categories];

  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-btn ${state.selectedCategory === tab ? "active" : ""}`;
    button.textContent = tab === "all" ? t("all") : translateCategory(tab);
    button.addEventListener("click", () => {
      state.selectedCategory = tab;
      saveSelectedCategory();
      renderModeStrip();
      renderTabs();
      renderMenu();
      if (tab !== "all") {
        announce(`Categoria ${translateCategory(tab)} selecionada.`);
      }
    });
    categoryList.appendChild(button);
  });
}

function buildSection(title, items) {
  const wrapper = document.createElement("section");
  wrapper.className = "menu-section";
  wrapper.setAttribute("aria-label", translateCategory(title));

  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = translateCategory(title);
  wrapper.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "item-grid";

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = `item-row ${isFavorite(item.id) ? "favorite" : ""}`.trim();
    row.setAttribute("aria-label", `${item.name} - R$ ${formatPrice(item.price)}`);
    const thumb = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />`
      : '<span class="thumb-placeholder">Imagem em breve</span>';

    const itemArParams = new URLSearchParams();
    itemArParams.set("id", item.id);
    itemArParams.set("openAr", "1");
    if (slug) {
      itemArParams.set("r", slug);
    }
    if (tableFromUrl) {
      itemArParams.set("mesa", tableFromUrl);
    }
    const itemArUrl = `/item.html?${itemArParams.toString()}`;

    row.innerHTML = `
      <div class="item-copy">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <div class="item-price">R$ ${formatPrice(item.price)}</div>
        <div class="item-links">
          <a data-ar-link href="${itemArUrl}">${escapeHtml(t("ar"))}</a>
          <button type="button" data-add>${escapeHtml(t("add"))}</button>
          <button type="button" class="favorite-btn ${isFavorite(item.id) ? "active" : ""}" data-favorite>
            ${isFavorite(item.id) ? "Favorito" : "Favoritar"}
          </button>
        </div>
      </div>
      <a class="item-thumb" data-ar-link href="${itemArUrl}" aria-label="Abrir ${escapeHtml(item.name)} em AR">
        ${thumb}
      </a>
    `;

    row.querySelector("[data-add]").addEventListener("click", () => addToCart(item.id));
    row.querySelector("[data-favorite]").addEventListener("click", () => toggleFavorite(item.id));
    const thumbImage = row.querySelector(".item-thumb img");
    if (thumbImage) {
      thumbImage.addEventListener("error", () => {
        const anchor = row.querySelector(".item-thumb");
        if (!anchor) return;
        anchor.classList.add("placeholder");
        anchor.innerHTML = '<span class="thumb-placeholder">Imagem indisponivel</span>';
      });
    } else {
      const anchor = row.querySelector(".item-thumb");
      if (anchor) anchor.classList.add("placeholder");
    }
    row.querySelectorAll("[data-ar-link]").forEach((link) => {
      link.addEventListener("click", () => {
        trackPublicEvent("item_view", { itemId: item.id, table: getTableValue() });
      });
    });
    grid.appendChild(row);
  });

  wrapper.appendChild(grid);
  return wrapper;
}

function renderMenu() {
  const filteredItems = getFilteredItems();
  menuList.innerHTML = "";
  emptyState.textContent = state.showFavoritesOnly ? "Nenhum favorito." : t("noItemsFound");
  emptyState.classList.toggle("hidden", filteredItems.length > 0);
  if (filteredItems.length === 0) {
    renderAiRail();
    return;
  }

  const sections = new Map();
  filteredItems.forEach((item) => {
    const category = inferCategory(item);
    if (!sections.has(category)) {
      sections.set(category, []);
    }
    sections.get(category).push(item);
  });

  if (state.selectedCategory === "all") {
    state.categories.forEach((category) => {
      const list = sections.get(category);
      if (list && list.length > 0) {
        menuList.appendChild(buildSection(category, list));
      }
    });
    return;
  }

  const selected = sections.get(state.selectedCategory) || [];
  if (selected.length > 0) {
    menuList.appendChild(buildSection(state.selectedCategory, selected));
  }
  refreshRevealTargets();
  renderAiRail();
}

function renderLoadingSkeleton() {
  menuList.innerHTML = "";
  emptyState.classList.add("hidden");
  const section = document.createElement("section");
  section.className = "menu-section";
  section.innerHTML = `
    <h2 class="section-title">Carregando...</h2>
    <div class="item-grid">
      <article class="item-row skeleton-row"></article>
      <article class="item-row skeleton-row"></article>
    </div>
  `;
  menuList.appendChild(section);
}

function renderCart() {
  const detailed = getDetailedCart();
  cartItems.innerHTML = "";
  tableInput.value = getTableValue();
  if (cartTotal) cartTotal.textContent = `${t("total")}: R$ 0,00`;
  if (cartClear) cartClear.disabled = detailed.length === 0;
  if (cartSubmit) cartSubmit.disabled = detailed.length === 0;

  if (detailed.length === 0) {
    cartItems.innerHTML = `<p>${escapeHtml(t("noItemsInCart"))}</p>`;
    return;
  }

  const totalValue = detailed.reduce((acc, item) => acc + item.qty * Number(item.price || 0), 0);
  if (cartTotal) {
    cartTotal.textContent = `${t("total")}: R$ ${formatPrice(totalValue)}`;
  }

  detailed.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <p>R$ ${formatPrice(item.price)}</p>
      </div>
      <div class="qty">
        <button type="button" data-minus>-</button>
        <span>${item.qty}</span>
        <button type="button" data-plus>+</button>
      </div>
    `;
    row.querySelector("[data-minus]").addEventListener("click", () => updateCartQty(item.id, -1));
    row.querySelector("[data-plus]").addEventListener("click", () => updateCartQty(item.id, 1));
    cartItems.appendChild(row);
  });
}

function buildHeroImages() {
  if (!state.restaurant) return [];
  if (Array.isArray(state.restaurant.heroImages) && state.restaurant.heroImages.length > 0) {
    return state.restaurant.heroImages.filter(Boolean).slice(0, 8);
  }

  const images = [];
  state.items.forEach((item) => {
    if (item.image && !images.includes(item.image)) {
      images.push(item.image);
    }
  });
  const unique = images.slice(0, 8);
  if (unique.length > 0) return unique;
  return [HERO_FALLBACK_IMAGE];
}

function renderHero() {
  heroTrack.innerHTML = "";
  heroDots.innerHTML = "";

  state.heroImages = buildHeroImages();
  if (state.heroImages.length === 0) {
    state.heroImages = [""];
  }

  state.heroImages.forEach((imageUrl, index) => {
    const slide = document.createElement("div");
    slide.className = `hero-slide ${index === state.heroIndex ? "active" : ""}`;

    if (imageUrl) {
      slide.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Banner ${index + 1}" />`;
      const img = slide.querySelector("img");
      if (img) {
        img.addEventListener("error", () => {
          slide.innerHTML = "";
          slide.classList.add("placeholder");
        });
      }
    } else {
      slide.classList.add("placeholder");
    }

    heroTrack.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `hero-dot ${index === state.heroIndex ? "active" : ""}`;
    dot.addEventListener("click", () => setHeroSlide(index));
    heroDots.appendChild(dot);
  });

  const showNav = state.heroImages.length > 1;
  heroPrev.classList.toggle("hidden", !showNav);
  heroNext.classList.toggle("hidden", !showNav);
}

function setHeroSlide(nextIndex) {
  const total = state.heroImages.length;
  if (total <= 1) return;

  state.heroIndex = (nextIndex + total) % total;
  const slides = heroTrack.querySelectorAll(".hero-slide");
  const dots = heroDots.querySelectorAll(".hero-dot");

  slides.forEach((slide, index) => {
    slide.classList.toggle("active", index === state.heroIndex);
  });
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === state.heroIndex);
  });
}

function startHeroAutoplay() {
  if (state.heroTimer) {
    clearInterval(state.heroTimer);
    state.heroTimer = null;
  }
  if (state.heroImages.length <= 1) return;

  state.heroTimer = setInterval(() => {
    setHeroSlide(state.heroIndex + 1);
  }, 5000);
}

async function sendOrder() {
  cartMessage.textContent = "";
  const tableValue = (tableInput.value || "").trim();
  if (!tableValue) {
    cartMessage.textContent = t("msgNeedTable");
    announce(t("msgNeedTable"));
    return;
  }
  if (!TABLE_PATTERN.test(tableValue)) {
    cartMessage.textContent = "Mesa invalida. Use apenas letras, numeros, -, _, . e #.";
    announce("Mesa invalida.");
    return;
  }
  if (state.cart.length === 0) {
    cartMessage.textContent = t("msgEmpty");
    announce(t("msgEmpty"));
    return;
  }

  const payload = {
    restaurantSlug: slug,
    table: tableValue,
    items: state.cart.map((item) => ({ id: item.id, qty: item.qty }))
  };

  try {
    cartSubmit.disabled = true;
    cartSubmit.dataset.sending = "1";
    cartSubmit.textContent = t("sending");
    const res = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      if (res.status === 429) {
        cartMessage.textContent = "Muitos pedidos em pouco tempo. Aguarde alguns segundos.";
        announce("Limite temporario de pedidos.");
        return;
      }
      cartMessage.textContent = t("msgFail");
      announce(t("msgFail"));
      return;
    }

    localStorage.setItem(tableKey, tableValue);
    trackPublicEvent("order_submit", { table: tableValue, meta: { items: state.cart.length } });
    state.cart = [];
    saveCart();
    renderCart();
    cartMessage.textContent = t("msgOk");
    announce(t("msgOk"));
    setTimeout(() => {
      cartModal.classList.add("hidden");
      document.body.style.overflow = "";
    }, 800);
  } catch (err) {
    cartMessage.textContent = t("msgConnection");
    announce(t("msgConnection"));
  } finally {
    cartSubmit.dataset.sending = "0";
    cartSubmit.textContent = t("submit");
    cartSubmit.disabled = state.cart.length === 0;
  }
}

async function loadRestaurant() {
  renderLoadingSkeleton();
  setCanonicalUrl();
  setSeoMeta({
    title: "Cardapio digital",
    description: "Carregando cardapio digital...",
    image: HERO_FALLBACK_IMAGE
  });

  if (!slug) {
    restaurantName.textContent = "Restaurante nao informado";
    restaurantDesc.textContent = "Abra por um link com parametro ?r=slug";
    applyRestaurantBranding();
    return;
  }

  try {
    const res = await fetch(`/api/public/restaurant/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      restaurantName.textContent = "Restaurante nao encontrado";
      restaurantDesc.textContent = "Confira o link do QR Code.";
      applyRestaurantBranding();
      menuList.innerHTML = "";
      return;
    }

    const data = await res.json();
    state.restaurant = data.restaurant;
    state.integrations = (state.restaurant && state.restaurant.integrations) || {};
    state.baseItems = Array.isArray(data.items) ? data.items.map((item) => ({ ...item })) : [];
    state.items = state.baseItems.map((item) => ({ ...item }));
    state.baseCategories = [...new Set(state.baseItems.map((item) => inferCategory(item)))];
    state.categories = [...state.baseCategories];
    state.baseDescription = (state.restaurant && state.restaurant.description) || "";
    state.heroIndex = 0;
    state.defaultLanguage = getDefaultLanguageCode();

    const storedLanguage = localStorage.getItem(languageKey) || "";
    const enabledLanguages = getEnabledLanguages();
    const defaultLanguageCode = state.defaultLanguage;
    if (enabledLanguages.some((lang) => lang.code === storedLanguage)) {
      state.language = storedLanguage;
    } else {
      state.language = defaultLanguageCode;
      localStorage.setItem(languageKey, state.language);
    }

    restaurantName.textContent = state.restaurant.name || "Cardapio";
    applyRestaurantBranding();
    trackPublicEvent("menu_view", {
      restaurantSlug: state.restaurant.slug || slug,
      table: getTableValue()
    });
    if (tableFromUrl) {
      trackPublicEvent("qr_scan", {
        restaurantSlug: state.restaurant.slug || slug,
        table: tableFromUrl
      });
    }

    await applyTranslatedContent();
    setTheme();
    applyVisualSettings();
    applyLanguageTexts();
    applyGuestProfileToForms();
    renderDrawer();
    renderQuickActions();
    updateFormsVisibility();
    renderHero();
    startHeroAutoplay();
    await applyAnalyticsIntegrations();
    const heroImage = state.heroImages[0] || HERO_FALLBACK_IMAGE;
    setSeoMeta({
      title: `${state.restaurant.name || "Cardapio"} | Cardapio digital`,
      description: (restaurantDesc.textContent || state.baseDescription || "").slice(0, 180),
      image: heroImage
    });
    updateStructuredData(state.restaurant, heroImage);

    if (searchInput) {
      searchInput.value = getSavedSearchTerm();
    }
    if (
      state.selectedCategory !== "all" &&
      !state.categories.some((category) => category.toLowerCase() === state.selectedCategory.toLowerCase())
    ) {
      state.selectedCategory = "all";
      saveSelectedCategory();
    }

    renderModeStrip();
    renderTabs();
    renderMenu();

    loadCart();
    updateCartButton();
    renderCart();
    if (reservationDateInput && !reservationDateInput.value) {
      reservationDateInput.value = new Date().toISOString().slice(0, 10);
    }
  } catch {
    restaurantName.textContent = "Falha de conexao";
    restaurantDesc.textContent = "Nao foi possivel carregar o cardapio agora.";
    menuList.innerHTML = "";
    applyRestaurantBranding();
  }
}

searchToggle.addEventListener("click", () => {
  searchWrap.classList.toggle("hidden");
  if (searchToggle) {
    searchToggle.setAttribute("aria-expanded", searchWrap.classList.contains("hidden") ? "false" : "true");
  }
  if (!searchWrap.classList.contains("hidden")) {
    searchInput.focus();
    return;
  }
  searchInput.value = "";
  saveSearchTerm("");
  renderMenu();
});

const onSearchInput = debounce(() => {
  const term = (searchInput.value || "").trim();
  saveSearchTerm(term);
  if (term.length >= 2) {
    trackPublicEvent("search_use", { meta: { termLength: term.length } });
  }
  renderMenu();
}, 150);
searchInput.addEventListener("input", onSearchInput);

menuToggle.addEventListener("click", () => {
  renderDrawer();
  closeLanguageModal();
  openDrawer();
});

drawerClose.addEventListener("click", closeDrawer);
sideOverlay.addEventListener("click", closeDrawer);

if (drawerLang) {
  drawerLang.addEventListener("click", () => {
    closeDrawer();
    openLanguageModal();
  });
}

langClose.addEventListener("click", closeLanguageModal);
langModal.addEventListener("click", (event) => {
  if (event.target === langModal) closeLanguageModal();
});

shareToggle.addEventListener("click", async () => {
  const shareUrl = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({
        title: state.restaurant ? state.restaurant.name : "Cardapio",
        url: shareUrl
      });
      trackPublicEvent("share_link", { meta: { mode: "native" } });
      announce("Link de compartilhamento aberto.");
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    trackPublicEvent("share_link", { meta: { mode: "clipboard" } });
    announce("Link copiado para a area de transferencia.");
  } catch {
    announce("Nao foi possivel compartilhar agora.");
  }
});

heroPrev.addEventListener("click", () => {
  setHeroSlide(state.heroIndex - 1);
});

heroNext.addEventListener("click", () => {
  setHeroSlide(state.heroIndex + 1);
});

cartButton.addEventListener("click", () => {
  lastFocusedElement = document.activeElement;
  renderCart();
  cartModal.classList.remove("hidden");
  cartModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    if (cartClose) cartClose.focus();
  }, 10);
});

cartClose.addEventListener("click", () => {
  cartModal.classList.add("hidden");
  cartModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
});

cartModal.addEventListener("click", (event) => {
  if (event.target === cartModal) {
    cartModal.classList.add("hidden");
    cartModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
});

tableInput.addEventListener("change", () => {
  const value = (tableInput.value || "").trim();
  if (!value) {
    localStorage.removeItem(tableKey);
    return;
  }
  if (!TABLE_PATTERN.test(value)) {
    tableInput.value = "";
    localStorage.removeItem(tableKey);
    cartMessage.textContent = "Mesa invalida.";
    announce("Mesa invalida.");
    return;
  }
  localStorage.setItem(tableKey, value);
});

if (cartClear) {
  cartClear.addEventListener("click", () => {
    if (!state.cart.length) return;
    const accepted = window.confirm("Deseja limpar todo o pedido?");
    if (!accepted) return;
    state.cart = [];
    saveCart();
    renderCart();
    cartMessage.textContent = t("msgCleared");
    announce(t("msgCleared"));
  });
}

if (backTopButton) {
  backTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

window.addEventListener("scroll", () => {
  if (!backTopButton) return;
  backTopButton.classList.toggle("hidden", window.scrollY < 420);
});
if (backTopButton) {
  backTopButton.classList.toggle("hidden", window.scrollY < 420);
}

document.addEventListener("keydown", (event) => {
  const tagName = (document.activeElement && document.activeElement.tagName) || "";
  const isTypingField = ["INPUT", "TEXTAREA", "SELECT"].includes(tagName);
  const key = (event.key || "").toLowerCase();
  const commandModalOpen = commandModal && !commandModal.classList.contains("hidden");

  if ((event.ctrlKey || event.metaKey) && key === "k") {
    event.preventDefault();
    if (commandModalOpen) {
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
    return;
  }

  if (commandModalOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.commandIndex = Math.min((state.commandResults.length || 1) - 1, state.commandIndex + 1);
      renderCommandList();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.commandIndex = Math.max(0, state.commandIndex - 1);
      renderCommandList();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = state.commandResults[state.commandIndex];
      if (!command) return;
      closeCommandPalette();
      command.run();
      return;
    }
  }

  if (!isTypingField && key === "c" && cartButton && !cartButton.classList.contains("hidden")) {
    event.preventDefault();
    cartButton.click();
    return;
  }
  if (!isTypingField && key === "g") {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (!isTypingField && key === "v" && voiceSearchButton && !voiceSearchButton.classList.contains("hidden")) {
    event.preventDefault();
    startVoiceSearch();
    return;
  }

  if (event.key === "/" && !isTypingField && document.activeElement !== searchInput) {
    event.preventDefault();
    if (searchWrap.classList.contains("hidden")) {
      searchWrap.classList.remove("hidden");
      if (searchToggle) searchToggle.setAttribute("aria-expanded", "true");
    }
    searchInput.focus();
    return;
  }
  if (event.key !== "Escape") return;
  if (!cartModal.classList.contains("hidden")) {
    cartModal.classList.add("hidden");
    cartModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    return;
  }
  if (!langModal.classList.contains("hidden")) {
    closeLanguageModal();
    return;
  }
  if (!sideOverlay.classList.contains("hidden")) {
    closeDrawer();
    return;
  }
  if (!searchWrap.classList.contains("hidden")) {
    searchWrap.classList.add("hidden");
    if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
  }
});

if (compactToggle) {
  compactToggle.addEventListener("click", () => {
    const currentlyCompact = document.body.classList.contains("density-compact");
    const nextCompact = !currentlyCompact;
    document.body.classList.toggle("density-compact", nextCompact);
    try {
      localStorage.setItem(densityKey, nextCompact ? "compact" : "comfortable");
    } catch {
      // ignore
    }
    applyLanguageTexts();
  });
}

if (favoritesToggle) {
  favoritesToggle.addEventListener("click", () => {
    state.showFavoritesOnly = !state.showFavoritesOnly;
    applyLanguageTexts();
    renderMenu();
  });
}

function getPublicSubmitError(response, fallback) {
  if (!response) return fallback;
  if (response.status === 429) return "Muitas tentativas. Aguarde e tente de novo.";
  if (response.status === 400) return "Dados invalidos. Revise os campos.";
  return fallback;
}

async function submitPublicForm({
  form,
  statusNode,
  endpoint,
  payload,
  successMessage,
  errorMessage,
  eventType,
  eventMeta
}) {
  if (!form || !state.restaurant || !state.restaurant.slug) return false;
  setFormStatus(statusNode, "");
  setFormSubmitting(form, true);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantSlug: state.restaurant.slug,
        source: "menu_public",
        ...payload
      })
    });
    if (!response.ok) {
      setFormStatus(statusNode, getPublicSubmitError(response, errorMessage));
      return false;
    }
    setFormStatus(statusNode, successMessage);
    if (eventType) {
      trackPublicEvent(eventType, { meta: eventMeta || {} });
    }
    announce(successMessage);
    setTimeout(() => {
      if (statusNode && statusNode.textContent === successMessage) {
        statusNode.textContent = "";
      }
    }, 5000);
    return true;
  } catch {
    setFormStatus(statusNode, errorMessage);
    return false;
  } finally {
    setFormSubmitting(form, false);
  }
}

if (reservationForm) {
  reservationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: (reservationNameInput && reservationNameInput.value ? reservationNameInput.value : "").trim(),
      phone: (reservationPhoneInput && reservationPhoneInput.value ? reservationPhoneInput.value : "").trim(),
      guests: Number(reservationGuestsInput && reservationGuestsInput.value ? reservationGuestsInput.value : 2) || 2,
      date: reservationDateInput && reservationDateInput.value ? reservationDateInput.value : "",
      time: reservationTimeInput && reservationTimeInput.value ? reservationTimeInput.value : ""
    };
    if (!payload.name || !payload.phone) {
      setFormStatus(reservationStatus, "Informe nome e telefone.");
      return;
    }
    saveGuestProfile({ name: payload.name, phone: payload.phone });
    const ok = await submitPublicForm({
      form: reservationForm,
      statusNode: reservationStatus,
      endpoint: "/api/public/reservations",
      payload,
      successMessage: "Reserva enviada.",
      errorMessage: "Falha ao enviar reserva.",
      eventType: "reservation_submit",
      eventMeta: { guests: payload.guests || 0 }
    });
    if (!ok) return;
    reservationForm.reset();
    if (reservationGuestsInput) reservationGuestsInput.value = "2";
    if (reservationDateInput) reservationDateInput.value = new Date().toISOString().slice(0, 10);
    applyGuestProfileToForms();
  });
}

if (leadForm) {
  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: (leadNameInput && leadNameInput.value ? leadNameInput.value : "").trim(),
      email: (leadEmailInput && leadEmailInput.value ? leadEmailInput.value : "").trim(),
      phone: (leadPhoneInput && leadPhoneInput.value ? leadPhoneInput.value : "").trim()
    };
    if (!payload.email && !payload.phone) {
      setFormStatus(leadStatus, "Informe email ou telefone.");
      return;
    }
    saveGuestProfile({ name: payload.name, phone: payload.phone, email: payload.email });
    const ok = await submitPublicForm({
      form: leadForm,
      statusNode: leadStatus,
      endpoint: "/api/public/leads",
      payload,
      successMessage: "Contato salvo.",
      errorMessage: "Falha ao salvar contato.",
      eventType: "lead_submit"
    });
    if (!ok) return;
    leadForm.reset();
    applyGuestProfileToForms();
  });
}

if (waitlistForm) {
  waitlistForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: (waitlistNameInput && waitlistNameInput.value ? waitlistNameInput.value : "").trim(),
      phone: (waitlistPhoneInput && waitlistPhoneInput.value ? waitlistPhoneInput.value : "").trim(),
      guests: Number(waitlistGuestsInput && waitlistGuestsInput.value ? waitlistGuestsInput.value : 2) || 2,
      etaMinutes: Number(waitlistEtaInput && waitlistEtaInput.value ? waitlistEtaInput.value : 0) || 0
    };
    if (!payload.name || !payload.phone) {
      setFormStatus(waitlistStatus, "Informe nome e telefone.");
      return;
    }
    saveGuestProfile({ name: payload.name, phone: payload.phone });
    const ok = await submitPublicForm({
      form: waitlistForm,
      statusNode: waitlistStatus,
      endpoint: "/api/public/waitlist",
      payload,
      successMessage: "Entrada na fila confirmada.",
      errorMessage: "Falha ao entrar na fila.",
      eventType: "waitlist_join",
      eventMeta: { guests: payload.guests || 0 }
    });
    if (!ok) return;
    waitlistForm.reset();
    if (waitlistGuestsInput) waitlistGuestsInput.value = "2";
    applyGuestProfileToForms();
  });
}

if (feedbackForm) {
  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: (feedbackNameInput && feedbackNameInput.value ? feedbackNameInput.value : "").trim(),
      email: (feedbackEmailInput && feedbackEmailInput.value ? feedbackEmailInput.value : "").trim(),
      rating: Number(feedbackRatingInput && feedbackRatingInput.value ? feedbackRatingInput.value : 5) || 5,
      comment: (feedbackCommentInput && feedbackCommentInput.value ? feedbackCommentInput.value : "").trim()
    };
    if (!payload.comment && !payload.email) {
      setFormStatus(feedbackStatus, "Informe comentario ou email.");
      return;
    }
    saveGuestProfile({ name: payload.name, email: payload.email });
    const ok = await submitPublicForm({
      form: feedbackForm,
      statusNode: feedbackStatus,
      endpoint: "/api/public/feedback",
      payload,
      successMessage: "Feedback enviado.",
      errorMessage: "Falha ao enviar feedback.",
      eventType: "feedback_submit",
      eventMeta: { rating: payload.rating || 0 }
    });
    if (!ok) return;
    feedbackForm.reset();
    if (feedbackRatingInput) feedbackRatingInput.value = "5";
    applyGuestProfileToForms();
  });
}

cartSubmit.addEventListener("click", sendOrder);

initTechModeControls();
initTechTelemetry();
initVoiceSearch();
initCommandPalette();
initHeroGestures();
initNetworkPill();
initInstallPrompt();
applyVisualSettings();
registerServiceWorker();
loadRestaurant();
