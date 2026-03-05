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
const languageToggle = document.getElementById("language-toggle");
const languageBadge = document.getElementById("language-badge");
const languageLabel = document.getElementById("language-label");
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

const LANGUAGES = [
  { code: "pt-BR", tag: "PT", label: "Portugues do Brasil", subtitle: "Padrao do restaurante" },
  { code: "en-US", tag: "EN", label: "English", subtitle: "For foreigners" },
  { code: "es-ES", tag: "ES", label: "Espanol", subtitle: "Para extranjeros" },
  { code: "fr-FR", tag: "FR", label: "Francais", subtitle: "Pour les etrangers" },
  { code: "it-IT", tag: "IT", label: "Italiano", subtitle: "Per gli stranieri" },
  { code: "de-DE", tag: "DE", label: "Deutsch", subtitle: "Fur Auslander" }
];

const MESSAGES = {
  "pt-BR": {
    searchPlaceholder: "Buscar no cardapio",
    modeMenu: "Menu",
    menuPersonality: "Menu Personnalite",
    all: "All",
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

const state = {
  restaurant: null,
  items: [],
  baseItems: [],
  baseDescription: "",
  baseCategories: [],
  cart: [],
  selectedCategory: "all",
  categories: [],
  modeItems: [],
  heroImages: [],
  heroIndex: 0,
  heroTimer: null,
  language: localStorage.getItem(languageKey) || "pt-BR",
  defaultLanguage: "pt-BR",
  translationCache: loadTranslationCache(),
  isTranslating: false
};
const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80";

if (!LANGUAGES.some((lang) => lang.code === state.language)) {
  state.language = "pt-BR";
}

const cartKey = slug ? `menuz_cart_${slug}` : "menuz_cart_template";
const tableKey = slug ? `menuz_table_${slug}` : "menuz_table_template";

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

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (languageToggle) {
    languageToggle.setAttribute("aria-label", `${t("language")}: ${lang.label || lang.code}`);
    languageToggle.setAttribute("title", `${t("language")}: ${lang.label || lang.code}`);
  }
  if (languageBadge) {
    languageBadge.textContent = lang.tag || lang.code.split("-")[0] || "LG";
  }
  if (languageLabel) {
    languageLabel.textContent = t("language");
  } else if (languageToggle) {
    languageToggle.textContent = t("language");
  }
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
  document.title = `${brand.name} | Cardapio digital`;
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
  tableInput.placeholder = t("tablePlaceholder");
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
  drawerInfo.innerHTML = `
    <li><span>Endereco</span><span>${escapeHtml(contact.address || "-")}</span></li>
    <li><span>Telefone</span><span>${escapeHtml(contact.phone || "-")}</span></li>
    <li><span>Email</span><span>${escapeHtml(contact.email || "-")}</span></li>
    <li><span>Site</span><span>${escapeHtml(contact.website || "-")}</span></li>
  `;
}

function openDrawer() {
  sideOverlay.classList.remove("hidden");
  sideDrawer.classList.add("open");
  sideDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  sideOverlay.classList.add("hidden");
  sideDrawer.classList.remove("open");
  sideDrawer.setAttribute("aria-hidden", "true");
  if (langModal.classList.contains("hidden")) {
    document.body.style.overflow = "";
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
  renderLanguageList();
  langModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLanguageModal() {
  langModal.classList.add("hidden");
  if (sideOverlay.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
}

function getTableValue() {
  const savedTable = (localStorage.getItem(tableKey) || "").trim();
  return tableFromUrl || savedTable || "";
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
}

function getFilteredItems() {
  const text = (searchInput.value || "").trim().toLowerCase();
  return state.items.filter((item) => {
    const category = inferCategory(item);
    const categoryMatch =
      state.selectedCategory === "all" ||
      category.toLowerCase() === state.selectedCategory.toLowerCase();

    if (!categoryMatch) return false;

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
      renderModeStrip();
      renderTabs();
      renderMenu();
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
      renderModeStrip();
      renderTabs();
      renderMenu();
    });
    categoryList.appendChild(button);
  });
}

function buildSection(title, items) {
  const wrapper = document.createElement("section");
  wrapper.className = "menu-section";

  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = translateCategory(title);
  wrapper.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "item-grid";

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "item-row";
    const thumb = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
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
        </div>
      </div>
      <a class="item-thumb" data-ar-link href="${itemArUrl}" aria-label="Abrir ${escapeHtml(item.name)} em AR">
        ${thumb}
      </a>
    `;

    row.querySelector("[data-add]").addEventListener("click", () => addToCart(item.id));
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
  emptyState.classList.toggle("hidden", filteredItems.length > 0);
  if (filteredItems.length === 0) return;

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
    return;
  }
  if (state.cart.length === 0) {
    cartMessage.textContent = t("msgEmpty");
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
      cartMessage.textContent = t("msgFail");
      return;
    }

    localStorage.setItem(tableKey, tableValue);
    trackPublicEvent("order_submit", { table: tableValue, meta: { items: state.cart.length } });
    state.cart = [];
    saveCart();
    renderCart();
    cartMessage.textContent = t("msgOk");
    setTimeout(() => {
      cartModal.classList.add("hidden");
    }, 800);
  } catch (err) {
    cartMessage.textContent = t("msgConnection");
  } finally {
    cartSubmit.dataset.sending = "0";
    cartSubmit.textContent = t("submit");
    cartSubmit.disabled = state.cart.length === 0;
  }
}

async function loadRestaurant() {
  if (!slug) {
    restaurantName.textContent = "Restaurante nao informado";
    restaurantDesc.textContent = "Abra por um link com parametro ?r=slug";
    applyRestaurantBranding();
    return;
  }

  const res = await fetch(`/api/public/restaurant/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    restaurantName.textContent = "Restaurante nao encontrado";
    restaurantDesc.textContent = "Confira o link do QR Code.";
    applyRestaurantBranding();
    return;
  }

  const data = await res.json();
  state.restaurant = data.restaurant;
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
  applyLanguageTexts();
  renderDrawer();
  renderHero();
  startHeroAutoplay();
  renderModeStrip();
  renderTabs();
  renderMenu();

  loadCart();
  updateCartButton();
  renderCart();
}

searchToggle.addEventListener("click", () => {
  searchWrap.classList.toggle("hidden");
  if (!searchWrap.classList.contains("hidden")) {
    searchInput.focus();
  }
});

searchInput.addEventListener("input", () => renderMenu());

menuToggle.addEventListener("click", () => {
  renderDrawer();
  closeLanguageModal();
  openDrawer();
});

drawerClose.addEventListener("click", closeDrawer);
sideOverlay.addEventListener("click", closeDrawer);

languageToggle.addEventListener("click", () => {
  closeDrawer();
  openLanguageModal();
});

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
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    alert("Link copiado.");
  } catch (err) {
    // no-op
  }
});

heroPrev.addEventListener("click", () => {
  setHeroSlide(state.heroIndex - 1);
});

heroNext.addEventListener("click", () => {
  setHeroSlide(state.heroIndex + 1);
});

cartButton.addEventListener("click", () => {
  renderCart();
  cartModal.classList.remove("hidden");
});

cartClose.addEventListener("click", () => {
  cartModal.classList.add("hidden");
});

cartModal.addEventListener("click", (event) => {
  if (event.target === cartModal) {
    cartModal.classList.add("hidden");
  }
});

tableInput.addEventListener("change", () => {
  const value = (tableInput.value || "").trim();
  if (!value) {
    localStorage.removeItem(tableKey);
    return;
  }
  localStorage.setItem(tableKey, value);
});

if (cartClear) {
  cartClear.addEventListener("click", () => {
    state.cart = [];
    saveCart();
    renderCart();
    cartMessage.textContent = t("msgCleared");
  });
}

cartSubmit.addEventListener("click", sendOrder);

loadRestaurant();
