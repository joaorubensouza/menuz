const params = new URLSearchParams(window.location.search);
const itemId = params.get("id");
const autoOpenAr = params.get("openAr") === "1";
const THEME_KEY = "menuz_theme";

const modelViewer = document.getElementById("modelViewer");
const arButton = document.getElementById("arButton");
const iosQuickLookLink = document.getElementById("iosQuickLookLink");
const arHint = document.getElementById("arHint");
const arFallback = document.getElementById("arFallback");
const backLink = document.getElementById("back-link");
const scaleControls = document.getElementById("scaleControls");
const scaleRange = document.getElementById("scaleRange");
const scaleValue = document.getElementById("scaleValue");
const scaleDown = document.getElementById("scaleDown");
const scaleUp = document.getElementById("scaleUp");
const scaleReset = document.getElementById("scaleReset");

const itemName = document.getElementById("item-name");
const itemDesc = document.getElementById("item-desc");
const itemPrice = document.getElementById("item-price");
const itemRestaurant = document.getElementById("item-restaurant");

const slugParam = params.get("r");
const tableParam = params.get("mesa");
let arOpenTracked = false;
let activeItem = null;
const ua = navigator.userAgent || "";
const isIOS = /iPhone|iPad|iPod/i.test(ua);
const isAndroid = /Android/i.test(ua);
const GABS_ITEM_ID = "i-topo-gabs";
const SCALE_STORAGE_PREFIX = "menuz_item_scale_";
const SCALE_MIN = 50;
const SCALE_MAX = 200;
const SCALE_STEP = 5;
const SCALE_DEFAULT = 100;
const PRICE_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function trackPublicEvent(type, payload = {}) {
  const body = JSON.stringify({
    type,
    restaurantSlug: payload.restaurantSlug || slugParam || "",
    itemId: payload.itemId || itemId || "",
    table: payload.table || tableParam || "",
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

function applyTheme() {
  const allowed = ["amber", "ocean", "wine"];
  let savedTheme = "amber";
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "amber";
  } catch (_err) {
    savedTheme = "amber";
  }
  const nextTheme = allowed.includes(savedTheme) ? savedTheme : "amber";
  document.body.setAttribute("data-theme", nextTheme);
}

function supportsScaleControls(item) {
  if (!item) return false;
  if ((item.id || "") === GABS_ITEM_ID) return true;
  const glb = (item.modelGlb || "").toLowerCase();
  const usdz = (item.modelUsdz || "").toLowerCase();
  return glb.includes("/gabs.glb") || usdz.includes("/gabs.usdz");
}

function clampScalePercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SCALE_DEFAULT;
  const stepped = Math.round(n / SCALE_STEP) * SCALE_STEP;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, stepped));
}

function buildScaleStorageKey(item) {
  if (!item || !item.id) return "";
  return `${SCALE_STORAGE_PREFIX}${item.id}`;
}

function loadSavedScale(item) {
  const key = buildScaleStorageKey(item);
  if (!key) return SCALE_DEFAULT;
  try {
    return clampScalePercent(localStorage.getItem(key));
  } catch (_err) {
    return SCALE_DEFAULT;
  }
}

function saveScale(item, value) {
  const key = buildScaleStorageKey(item);
  if (!key) return;
  try {
    localStorage.setItem(key, String(clampScalePercent(value)));
  } catch (_err) {
    // ignore storage failures (private mode, quota)
  }
}

function applyViewerScale(value) {
  if (!modelViewer) return;
  const scalePercent = clampScalePercent(value);
  const scalar = (scalePercent / 100).toFixed(2);
  const vector = `${scalar} ${scalar} ${scalar}`;
  modelViewer.setAttribute("scale", vector);
  if ("scale" in modelViewer) {
    modelViewer.scale = vector;
  }
  if (scaleRange) scaleRange.value = String(scalePercent);
  if (scaleValue) scaleValue.textContent = `${scalePercent}%`;
  if (activeItem) saveScale(activeItem, scalePercent);
}

function updateScaleControls(item) {
  const canScale = supportsScaleControls(item);
  if (scaleControls) {
    scaleControls.classList.toggle("hidden", !canScale);
  }
  if (!canScale) {
    applyViewerScale(SCALE_DEFAULT);
    return;
  }
  applyViewerScale(loadSavedScale(item));
}

function buildQuickLookHref(usdzUrl, canScale) {
  if (!usdzUrl) return "";
  if (!canScale) return usdzUrl;
  const [base, fragment] = usdzUrl.split("#");
  if (!fragment) return `${base}#allowsContentScaling=1`;
  if (/allowsContentScaling=\d/i.test(fragment)) {
    return `${base}#${fragment.replace(/allowsContentScaling=\d/i, "allowsContentScaling=1")}`;
  }
  return `${base}#${fragment}&allowsContentScaling=1`;
}

function setFallback(message) {
  arFallback.textContent = message || "";
}

function tryOpenAr() {
  if (!modelViewer || typeof modelViewer.activateAR !== "function") {
    setFallback("AR nao suportado neste dispositivo.");
    return;
  }

  try {
    modelViewer.activateAR();
  } catch (err) {
    if (isIOS && iosQuickLookLink && !iosQuickLookLink.classList.contains("hidden")) {
      iosQuickLookLink.click();
      return;
    }
    setFallback("Toque em 'Ver em AR' novamente para abrir manualmente.");
  }
}

function configureModelViewer(item) {
  if (!modelViewer) return;
  const hasGlb = Boolean(item.modelGlb);
  const hasUsdz = Boolean(item.modelUsdz);
  const canScale = supportsScaleControls(item);

  if (hasGlb) modelViewer.setAttribute("src", item.modelGlb);
  if (hasUsdz) modelViewer.setAttribute("ios-src", item.modelUsdz);
  if (item.image) modelViewer.setAttribute("poster", item.image);
  modelViewer.setAttribute("ar-scale", canScale ? "auto" : "fixed");

  if (isIOS && hasUsdz && iosQuickLookLink) {
    iosQuickLookLink.href = buildQuickLookHref(item.modelUsdz, canScale);
    iosQuickLookLink.classList.remove("hidden");
  } else if (iosQuickLookLink) {
    iosQuickLookLink.classList.add("hidden");
    iosQuickLookLink.removeAttribute("href");
  }

  if (isIOS && !hasUsdz) {
    arHint.textContent = "No iPhone, publique tambem o arquivo USDZ.";
    setFallback("Este item ainda nao tem USDZ para Quick Look.");
  } else if (isAndroid && !hasGlb) {
    arHint.textContent = "No Android, publique o arquivo GLB.";
    setFallback("Este item ainda nao tem GLB para Scene Viewer.");
  } else if (canScale) {
    arHint.textContent = "No prato GABS, ajuste a escala e tambem use pinca no AR para redimensionar.";
  }

  updateScaleControls(item);
}

function updateBackLink(restaurant) {
  if (!backLink) return;

  const slug = slugParam || (restaurant && restaurant.slug) || "";
  if (!slug) {
    backLink.href = "/";
    return;
  }

  const query = new URLSearchParams();
  if (tableParam) {
    query.set("mesa", tableParam);
  }
  const queryString = query.toString();
  backLink.href = `/r/${encodeURIComponent(slug)}${queryString ? `?${queryString}` : ""}`;
}

function buildPublicItemUrl() {
  const safeItemId = encodeURIComponent(itemId || "");
  const query = new URLSearchParams();
  if (slugParam) {
    query.set("r", slugParam);
  }
  const queryString = query.toString();
  return `/api/public/item/${safeItemId}${queryString ? `?${queryString}` : ""}`;
}

async function loadItem() {
  if (!itemId) {
    setFallback("Item nao encontrado.");
    return;
  }
  let res;
  try {
    res = await fetch(buildPublicItemUrl());
  } catch (_err) {
    setFallback("Falha de conexao ao carregar o item.");
    return;
  }
  if (!res.ok) {
    setFallback("Item nao encontrado.");
    return;
  }
  const data = await res.json().catch(() => ({}));
  const { item, restaurant } = data;
  if (!item) {
    setFallback("Item nao encontrado.");
    return;
  }
  activeItem = item;
  trackPublicEvent("item_view", {
    restaurantSlug: (restaurant && restaurant.slug) || slugParam || "",
    itemId: item.id,
    table: tableParam || ""
  });

  document.title = `${item.name} - Menuz AR`;
  itemName.textContent = item.name;
  itemDesc.textContent = item.description || "";
  const priceValue = Number(item.price);
  itemPrice.textContent = PRICE_FORMATTER.format(Number.isFinite(priceValue) ? priceValue : 0);
  if (restaurant) {
    itemRestaurant.textContent = restaurant.name;
  }
  updateBackLink(restaurant);

  const hasModel = Boolean(item.modelGlb || item.modelUsdz);
  configureModelViewer(item);

  if (!hasModel) {
    arButton.classList.add("hidden");
    if (scaleControls) scaleControls.classList.add("hidden");
    arHint.textContent = "Modelo 3D em breve.";
    setFallback("Esse prato ainda nao tem modelo 3D publicado.");
    return;
  }

  if (autoOpenAr) {
    arHint.textContent = "Abrindo AR...";
    // Some devices need a short delay after model load before launching AR.
    setTimeout(() => {
      if (!arOpenTracked) {
        arOpenTracked = true;
        trackPublicEvent("ar_open", {
          restaurantSlug: (restaurant && restaurant.slug) || slugParam || "",
          itemId: item.id,
          table: tableParam || "",
          meta: { mode: "auto" }
        });
      }
      tryOpenAr();
    }, 350);
  }
}

arButton.addEventListener("click", () => {
  if (!arOpenTracked) {
    arOpenTracked = true;
    trackPublicEvent("ar_open", {
      itemId,
      table: tableParam || "",
      meta: { mode: "button" }
    });
  }
  tryOpenAr();
});

if (iosQuickLookLink) {
  iosQuickLookLink.addEventListener("click", () => {
    if (!arOpenTracked) {
      arOpenTracked = true;
      trackPublicEvent("ar_open", {
        itemId,
        table: tableParam || "",
        meta: { mode: "ios_quick_look" }
      });
    }
  });
}

function nudgeScale(delta) {
  const current = scaleRange ? Number(scaleRange.value) : SCALE_DEFAULT;
  applyViewerScale(current + delta);
}

if (scaleRange) {
  scaleRange.addEventListener("input", () => {
    applyViewerScale(scaleRange.value);
  });
}

if (scaleDown) {
  scaleDown.addEventListener("click", () => nudgeScale(-SCALE_STEP));
}

if (scaleUp) {
  scaleUp.addEventListener("click", () => nudgeScale(SCALE_STEP));
}

if (scaleReset) {
  scaleReset.addEventListener("click", () => applyViewerScale(SCALE_DEFAULT));
}

if (modelViewer) {
  modelViewer.addEventListener("error", () => {
    setFallback("Falha ao carregar o modelo 3D. Verifique GLB/USDZ deste item.");
  });
  modelViewer.addEventListener("load", () => {
    if (!arFallback.textContent) {
      setFallback("");
    }
  });
}

applyTheme();
loadItem();
