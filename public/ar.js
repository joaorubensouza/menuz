const params = new URLSearchParams(window.location.search);
const itemId = params.get("id");
const autoOpenAr = params.get("openAr") === "1";
const THEME_KEY = "menuz_theme";

const modelViewer = document.getElementById("modelViewer");
const arButton = document.getElementById("arButton");
const arHint = document.getElementById("arHint");
const arFallback = document.getElementById("arFallback");
const backLink = document.getElementById("back-link");

const itemName = document.getElementById("item-name");
const itemDesc = document.getElementById("item-desc");
const itemPrice = document.getElementById("item-price");
const itemRestaurant = document.getElementById("item-restaurant");

const slugParam = params.get("r");
const tableParam = params.get("mesa");

function applyTheme() {
  const allowed = ["amber", "ocean", "wine"];
  const savedTheme = localStorage.getItem(THEME_KEY) || "amber";
  const nextTheme = allowed.includes(savedTheme) ? savedTheme : "amber";
  document.body.setAttribute("data-theme", nextTheme);
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
    setFallback("Toque em 'Ver em AR' para abrir manualmente.");
  }
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

async function loadItem() {
  if (!itemId) {
    setFallback("Item nao encontrado.");
    return;
  }
  const res = await fetch(`/api/public/item/${itemId}`);
  if (!res.ok) {
    setFallback("Item nao encontrado.");
    return;
  }
  const data = await res.json();
  const { item, restaurant } = data;

  document.title = `${item.name} - Menuz AR`;
  itemName.textContent = item.name;
  itemDesc.textContent = item.description || "";
  const priceValue = Number(item.price);
  const priceText = Number.isFinite(priceValue) ? priceValue.toFixed(2) : "0.00";
  itemPrice.textContent = `R$ ${priceText}`;
  if (restaurant) {
    itemRestaurant.textContent = restaurant.name;
  }
  updateBackLink(restaurant);

  const hasModel = Boolean(item.modelGlb || item.modelUsdz);
  if (item.modelGlb) modelViewer.setAttribute("src", item.modelGlb);
  if (item.modelUsdz) modelViewer.setAttribute("ios-src", item.modelUsdz);
  if (item.image) modelViewer.setAttribute("poster", item.image);

  if (!hasModel) {
    arButton.classList.add("hidden");
    arHint.textContent = "Modelo 3D em breve.";
    setFallback("Esse prato ainda nao tem modelo 3D publicado.");
    return;
  }

  if (autoOpenAr) {
    arHint.textContent = "Abrindo AR...";
    // Some devices need a short delay after model load before launching AR.
    setTimeout(() => {
      tryOpenAr();
    }, 350);
  }
}

arButton.addEventListener("click", () => {
  tryOpenAr();
});

applyTheme();
loadItem();
