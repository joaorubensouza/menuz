const params = new URLSearchParams(window.location.search);
const slug = params.get("r");
const tableParam = params.get("mesa") || "";
const THEME_KEY = "menuz_theme";
const PRICE_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const gateSection = document.getElementById("gate-section");
const codeInput = document.getElementById("code-input");
const codeButton = document.getElementById("code-button");
const codeError = document.getElementById("code-error");
const restaurantSelect = document.getElementById("restaurant-select");
const restaurantOpenButton = document.getElementById("restaurant-open-button");
const manageToggle = document.getElementById("manage-toggle");
const manageSection = document.getElementById("manage-section");
const quickLoginForm = document.getElementById("quick-login-form");
const quickLoginMsg = document.getElementById("quick-login-msg");
const themeSelect = document.getElementById("theme-select");

const menuSection = document.getElementById("menu-section");
const menuList = document.getElementById("menu-list");
const menuTitle = document.getElementById("menu-title");
const menuSubtitle = document.getElementById("menu-subtitle");

const ctaMenu = document.getElementById("cta-menu");
const ctaDemo = document.getElementById("cta-demo");

const orderBar = document.getElementById("order-bar");
const orderSummary = document.getElementById("order-summary");
const orderOpen = document.getElementById("order-open");
const orderModal = document.getElementById("order-modal");
const orderItems = document.getElementById("order-items");
const orderClose = document.getElementById("order-close");
const orderTable = document.getElementById("order-table");
const orderSubmit = document.getElementById("order-submit");
const orderMessage = document.getElementById("order-message");

let menuItems = [];
let cart = [];
let publicRestaurants = [];
const cartKey = slug ? `menuz_cart_${slug}` : "menuz_cart";
const tableKey = slug ? `menuz_table_${slug}` : "menuz_table";

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

function applyTheme(theme) {
  const allowed = ["amber", "ocean", "wine"];
  const nextTheme = allowed.includes(theme) ? theme : "amber";
  document.body.setAttribute("data-theme", nextTheme);
  if (themeSelect) {
    themeSelect.value = nextTheme;
  }
}

function initTheme() {
  const savedTheme = safeLocalStorageGet(THEME_KEY) || "amber";
  applyTheme(savedTheme);
  if (!themeSelect) return;
  themeSelect.addEventListener("change", () => {
    const nextTheme = themeSelect.value;
    safeLocalStorageSet(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

function isValidSlug(value) {
  return /^[a-z0-9][a-z0-9-]{1,63}$/i.test(value);
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_err) {
    return "";
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_err) {
    // Ignore storage limitations (private mode/quota).
  }
}

function setStatusMessage(element, message, type = "muted") {
  if (!element) return;
  element.textContent = message || "";
  element.classList.remove("status-success", "status-error", "muted");
  if (type === "success") {
    element.classList.add("status-success");
    return;
  }
  if (type === "error") {
    element.classList.add("status-error");
    return;
  }
  element.classList.add("muted");
}

function setCodeMessage(message, type = "muted") {
  setStatusMessage(codeError, message, type);
}

function setOrderMessage(message, type = "muted") {
  setStatusMessage(orderMessage, message, type);
}

function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (typeof textContent === "string") {
    el.textContent = textContent;
  }
  return el;
}

function formatPrice(value) {
  const priceValue = Number(value);
  if (!Number.isFinite(priceValue)) {
    return PRICE_FORMATTER.format(0);
  }
  return PRICE_FORMATTER.format(priceValue);
}

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "request_failed");
    error.status = res.status;
    throw error;
  }

  return data;
}

function navigateToRestaurantSlug(slugValue) {
  window.location.href = `/r/${encodeURIComponent(slugValue)}`;
}

if (ctaMenu) {
  ctaMenu.addEventListener("click", () => {
    if (!gateSection) return;
    gateSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (ctaDemo) {
  ctaDemo.addEventListener("click", () => {
    window.location.href = "/item.html?id=i-burger";
  });
}

if (codeButton) {
  codeButton.addEventListener("click", () => {
    const code = (codeInput && codeInput.value ? codeInput.value : "").trim();
    if (!code) {
      setCodeMessage("Digite o codigo do restaurante.", "error");
      return;
    }
    if (!isValidSlug(code)) {
      setCodeMessage("Codigo invalido. Use letras, numeros e hifen.", "error");
      return;
    }
    navigateToRestaurantSlug(code);
  });
}

if (codeInput && codeButton) {
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      codeButton.click();
    }
  });
}

if (restaurantOpenButton) {
  restaurantOpenButton.addEventListener("click", () => {
    const selectedSlug = (restaurantSelect && restaurantSelect.value) || "";
    if (!selectedSlug) {
      setCodeMessage("Selecione um restaurante.", "error");
      return;
    }
    navigateToRestaurantSlug(selectedSlug);
  });
}

if (restaurantSelect) {
  restaurantSelect.addEventListener("change", () => {
    setCodeMessage("", "muted");
  });
}

if (manageToggle && manageSection) {
  manageToggle.addEventListener("click", () => {
    manageSection.classList.remove("hidden");
    manageSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (quickLoginForm) {
  quickLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatusMessage(quickLoginMsg, "", "muted");
    const emailInput = document.getElementById("quick-login-email");
    const passwordInput = document.getElementById("quick-login-password");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";
    const submitButton = quickLoginForm.querySelector("button[type='submit']");

    if (!email || !password) {
      setStatusMessage(quickLoginMsg, "Informe email e senha.", "error");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      safeLocalStorageSet("menuz_token", data.token);
      safeLocalStorageSet("menuz_user", JSON.stringify(data.user));
      window.location.href = "/admin";
    } catch (_err) {
      setStatusMessage(quickLoginMsg, "Login invalido.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

function renderRestaurantSelector(restaurants) {
  if (!restaurantSelect) return;
  restaurantSelect.innerHTML = '<option value="">Selecione um restaurante</option>';

  restaurants.forEach((restaurant) => {
    const option = document.createElement("option");
    option.value = restaurant.slug;
    option.textContent = restaurant.name;
    restaurantSelect.appendChild(option);
  });

  if (restaurantOpenButton) {
    restaurantOpenButton.disabled = restaurants.length === 0;
  }
}

function renderRestaurantLinks(restaurants) {
  publicRestaurants = restaurants || [];
  renderRestaurantSelector(publicRestaurants);

  if (publicRestaurants.length === 0) {
    setCodeMessage("Nenhum restaurante cadastrado ainda.", "muted");
    return;
  }

  setCodeMessage("", "muted");
}

async function loadRestaurantLinks() {
  if (!restaurantSelect) return;

  setCodeMessage("Carregando restaurantes...", "muted");
  restaurantSelect.disabled = true;
  if (restaurantOpenButton) {
    restaurantOpenButton.disabled = true;
  }

  try {
    const res = await fetch("/api/public/restaurants");
    if (!res.ok) {
      throw new Error("load_failed");
    }
    const data = await res.json();
    renderRestaurantLinks(data.restaurants || []);
  } catch (_err) {
    renderRestaurantSelector([]);
    setCodeMessage("Nao foi possivel carregar os restaurantes.", "error");
  } finally {
    restaurantSelect.disabled = false;
  }
}

function parseCart(rawValue) {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : "",
        qty: Number(entry.qty) || 0
      }))
      .filter((entry) => entry.id && entry.qty > 0);
  } catch (_err) {
    return [];
  }
}

function loadCart() {
  cart = parseCart(safeLocalStorageGet(cartKey));
}

function saveCart() {
  safeLocalStorageSet(cartKey, JSON.stringify(cart));
  updateOrderBar();
}

function getCartDetailed() {
  return cart
    .map((entry) => {
      const menuItem = menuItems.find((item) => item.id === entry.id);
      if (!menuItem) return null;
      return {
        ...menuItem,
        qty: entry.qty,
        price: Number(menuItem.price) || 0
      };
    })
    .filter(Boolean);
}

function getOrderTotals(detailedItems) {
  const totalItems = detailedItems.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = detailedItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  return { totalItems, totalPrice };
}

function updateOrderBar() {
  if (!orderBar || !orderSummary) return;
  if (!slug) {
    orderBar.classList.add("hidden");
    return;
  }

  const detailed = getCartDetailed();
  if (detailed.length === 0) {
    orderBar.classList.add("hidden");
    return;
  }

  const totals = getOrderTotals(detailed);
  const label = totals.totalItems === 1 ? "item" : "itens";
  orderSummary.textContent = `${totals.totalItems} ${label} | ${formatPrice(totals.totalPrice)}`;
  orderBar.classList.remove("hidden");
}

function addToCart(itemId) {
  const existing = cart.find((entry) => entry.id === itemId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: itemId, qty: 1 });
  }
  saveCart();
  trackPublicEvent("add_to_cart", { itemId, table: tableParam || "" });
}

function updateCartQty(itemId, delta) {
  const entry = cart.find((item) => item.id === itemId);
  if (!entry) return;
  entry.qty += delta;
  if (entry.qty <= 0) {
    cart = cart.filter((item) => item.id !== itemId);
  }
  saveCart();
  renderOrderItems();
}

function renderOrderItems() {
  if (!orderItems || !orderTable) return;
  const detailed = getCartDetailed();
  orderItems.replaceChildren();

  if (tableParam) {
    orderTable.value = tableParam;
  } else {
    orderTable.value = safeLocalStorageGet(tableKey) || "";
  }

  if (detailed.length === 0) {
    orderItems.appendChild(createEl("div", "muted", "Seu pedido esta vazio."));
    return;
  }

  detailed.forEach((item) => {
    const row = createEl("div", "order-row");
    const info = createEl("div");
    const title = createEl("strong", "", item.name);
    const price = createEl("div", "muted", formatPrice(item.price));
    info.appendChild(title);
    info.appendChild(price);

    const controls = createEl("div", "order-qty");
    const minusButton = createEl("button", "btn btn-outline", "-");
    minusButton.type = "button";
    const qty = createEl("span", "", String(item.qty));
    const plusButton = createEl("button", "btn btn-outline", "+");
    plusButton.type = "button";

    minusButton.addEventListener("click", () => updateCartQty(item.id, -1));
    plusButton.addEventListener("click", () => updateCartQty(item.id, 1));

    controls.appendChild(minusButton);
    controls.appendChild(qty);
    controls.appendChild(plusButton);

    row.appendChild(info);
    row.appendChild(controls);
    orderItems.appendChild(row);
  });

  const totals = getOrderTotals(detailed);
  const totalRow = createEl("div", "row");
  totalRow.style.justifyContent = "space-between";
  totalRow.style.marginTop = "12px";
  totalRow.appendChild(createEl("strong", "", "Total"));
  totalRow.appendChild(createEl("strong", "", formatPrice(totals.totalPrice)));
  orderItems.appendChild(totalRow);
}

function openOrderModal() {
  if (!orderModal) return;
  renderOrderItems();
  orderModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeOrderModal() {
  if (!orderModal) return;
  orderModal.classList.add("hidden");
  document.body.style.overflow = "";
}

if (orderOpen) {
  orderOpen.addEventListener("click", openOrderModal);
}

if (orderClose) {
  orderClose.addEventListener("click", closeOrderModal);
}

if (orderModal) {
  orderModal.addEventListener("click", (event) => {
    if (event.target === orderModal) {
      closeOrderModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !orderModal) return;
  if (orderModal.classList.contains("hidden")) return;
  closeOrderModal();
});

if (orderSubmit) {
  orderSubmit.addEventListener("click", async () => {
    if (!slug || !orderTable) return;
    setOrderMessage("", "muted");
    const tableValue = (orderTable.value || tableParam).toString().trim();
    if (!tableValue) {
      setOrderMessage("Informe a mesa.", "error");
      return;
    }
    if (cart.length === 0) {
      setOrderMessage("Seu pedido esta vazio.", "error");
      return;
    }

    const payload = {
      restaurantSlug: slug,
      table: tableValue,
      items: cart.map((item) => ({ id: item.id, qty: item.qty }))
    };

    trackPublicEvent("order_submit", {
      restaurantSlug: slug,
      table: tableValue,
      meta: { itemsCount: payload.items.length }
    });

    const originalLabel = orderSubmit.textContent;
    orderSubmit.disabled = true;
    orderSubmit.textContent = "Enviando...";

    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 429) {
          setOrderMessage("Muitos pedidos em pouco tempo. Aguarde alguns segundos.", "error");
        } else {
          setOrderMessage("Erro ao enviar pedido.", "error");
        }
        return;
      }

      safeLocalStorageSet(tableKey, tableValue);
      cart = [];
      saveCart();
      renderOrderItems();
      setOrderMessage("Pedido enviado. Aguarde atendimento.", "success");
      trackPublicEvent("order_success", {
        restaurantSlug: slug,
        table: tableValue
      });
    } catch (_err) {
      setOrderMessage("Erro ao enviar pedido.", "error");
    } finally {
      orderSubmit.disabled = false;
      orderSubmit.textContent = originalLabel || "Enviar pedido";
    }
  });
}

function buildItemUrl(itemId) {
  const itemParams = new URLSearchParams();
  itemParams.set("id", itemId);
  if (slug) {
    itemParams.set("r", slug);
  }
  if (tableParam) {
    itemParams.set("mesa", tableParam);
  }
  return `/item.html?${itemParams.toString()}`;
}

function renderMenuLoading() {
  if (!menuList) return;
  menuList.replaceChildren();
  const loadingPanel = createEl("div", "panel");
  loadingPanel.appendChild(createEl("div", "tag", "Carregando"));
  loadingPanel.appendChild(createEl("p", "muted", "Buscando itens do cardapio..."));
  menuList.appendChild(loadingPanel);
}

function renderMenuCards(items) {
  if (!menuList) return;
  menuList.replaceChildren();

  if (!items.length) {
    const emptyPanel = createEl("div", "panel");
    emptyPanel.appendChild(createEl("div", "tag", "Cardapio vazio"));
    emptyPanel.appendChild(createEl("p", "muted", "Este restaurante ainda nao publicou itens."));
    menuList.appendChild(emptyPanel);
    return;
  }

  items.forEach((item) => {
    const card = createEl("article", "card");

    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name || "Prato";
      image.loading = "lazy";
      card.appendChild(image);
    } else {
      const imagePlaceholder = createEl("div", "panel", "Imagem em breve");
      imagePlaceholder.style.height = "180px";
      imagePlaceholder.style.display = "grid";
      imagePlaceholder.style.placeItems = "center";
      card.appendChild(imagePlaceholder);
    }

    if (item.category) {
      card.appendChild(createEl("span", "tag", item.category));
    }

    card.appendChild(createEl("h3", "", item.name || "Item sem nome"));
    card.appendChild(createEl("p", "muted", item.description || ""));

    const priceRow = createEl("div", "row");
    priceRow.style.marginTop = "12px";
    priceRow.appendChild(createEl("div", "price", formatPrice(item.price)));
    card.appendChild(priceRow);

    const actions = createEl("div", "row");
    actions.style.marginTop = "10px";

    const addButton = createEl("button", "btn btn-outline", "Adicionar");
    addButton.type = "button";
    addButton.addEventListener("click", () => addToCart(item.id));

    const arLink = createEl("a", "btn", "Ver em AR");
    arLink.href = buildItemUrl(item.id);
    arLink.addEventListener("click", () => {
      trackPublicEvent("item_view", { itemId: item.id, table: tableParam || "" });
    });

    actions.appendChild(addButton);
    actions.appendChild(arLink);
    card.appendChild(actions);
    menuList.appendChild(card);
  });
}

async function loadMenu(slugValue) {
  if (!menuSection || !gateSection) return;
  renderMenuLoading();

  try {
    const res = await fetch(`/api/public/restaurant/${encodeURIComponent(slugValue)}`);
    if (!res.ok) {
      gateSection.classList.remove("hidden");
      menuSection.classList.add("hidden");
      setCodeMessage("Restaurante nao encontrado.", "error");
      loadRestaurantLinks();
      return;
    }

    const data = await res.json();
    const restaurant = data.restaurant || {};
    const items = Array.isArray(data.items) ? data.items : [];
    if (restaurant.template === "topo-do-mundo") {
      const templateParams = new URLSearchParams(window.location.search);
      templateParams.set("r", slugValue);
      if (tableParam) {
        templateParams.set("mesa", tableParam);
      }
      window.location.replace(`/templates/topo-do-mundo.html?${templateParams.toString()}`);
      return;
    }

    menuItems = items;
    gateSection.classList.add("hidden");
    menuSection.classList.remove("hidden");

    if (menuTitle) {
      menuTitle.textContent = restaurant.name || "Cardapio";
    }
    if (menuSubtitle) {
      menuSubtitle.textContent = `${menuItems.length} itens no cardapio`;
    }

    trackPublicEvent("menu_view", {
      restaurantSlug: restaurant.slug || slugValue,
      table: tableParam || ""
    });
    if (tableParam) {
      trackPublicEvent("qr_scan", {
        restaurantSlug: restaurant.slug || slugValue,
        table: tableParam || ""
      });
    }

    renderMenuCards(menuItems);
    loadCart();
    updateOrderBar();
  } catch (_err) {
    gateSection.classList.remove("hidden");
    menuSection.classList.add("hidden");
    setCodeMessage("Falha de rede ao carregar o cardapio.", "error");
    loadRestaurantLinks();
  }
}

initTheme();

if (slug) {
  loadMenu(slug);
} else {
  if (gateSection) {
    gateSection.classList.remove("hidden");
  }
  if (menuSection) {
    menuSection.classList.add("hidden");
  }
  loadRestaurantLinks();
}
