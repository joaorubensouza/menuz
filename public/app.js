const params = new URLSearchParams(window.location.search);
const slug = params.get("r");
const tableParam = params.get("mesa") || "";
const THEME_KEY = "menuz_theme";

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

function applyTheme(theme) {
  const allowed = ["amber", "ocean", "wine"];
  const nextTheme = allowed.includes(theme) ? theme : "amber";
  document.body.setAttribute("data-theme", nextTheme);
  if (themeSelect) {
    themeSelect.value = nextTheme;
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "amber";
  applyTheme(savedTheme);
  if (!themeSelect) return;
  themeSelect.addEventListener("change", () => {
    const nextTheme = themeSelect.value;
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

async function api(url, options = {}) {
  const config = {
    headers: { "Content-Type": "application/json" },
    ...options
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

if (ctaMenu) {
  ctaMenu.addEventListener("click", () => {
    gateSection.scrollIntoView({ behavior: "smooth" });
  });
}

if (ctaDemo) {
  ctaDemo.addEventListener("click", () => {
    window.location.href = "/item.html?id=i-burger";
  });
}

if (codeButton) {
  codeButton.addEventListener("click", () => {
    const code = (codeInput.value || "").trim();
    if (!code) {
      codeError.textContent = "Digite o codigo do restaurante.";
      return;
    }
    window.location.href = `/?r=${encodeURIComponent(code)}`;
  });
}

if (codeInput) {
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
      codeError.textContent = "Selecione um restaurante.";
      return;
    }
    window.location.href = `/r/${encodeURIComponent(selectedSlug)}`;
  });
}

if (restaurantSelect) {
  restaurantSelect.addEventListener("change", () => {
    codeError.textContent = "";
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
    quickLoginMsg.textContent = "";
    const email = document.getElementById("quick-login-email").value.trim();
    const password = document.getElementById("quick-login-password").value.trim();
    if (!email || !password) {
      quickLoginMsg.textContent = "Informe email e senha.";
      return;
    }
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem("menuz_token", data.token);
      localStorage.setItem("menuz_user", JSON.stringify(data.user));
      window.location.href = "/admin";
    } catch (err) {
      quickLoginMsg.textContent = "Login invalido.";
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

  if (!restaurants || restaurants.length === 0) {
    if (codeError) {
      codeError.textContent = "Nenhum restaurante cadastrado ainda.";
    }
    return;
  }

  if (codeError) {
    codeError.textContent = "";
  }
}

async function loadRestaurantLinks() {
  if (!restaurantSelect) return;

  if (codeError) {
    codeError.textContent = "Carregando restaurantes...";
  }

  try {
    const res = await fetch("/api/public/restaurants");
    if (!res.ok) {
      throw new Error("load_failed");
    }
    const data = await res.json();
    renderRestaurantLinks(data.restaurants || []);
  } catch (err) {
    renderRestaurantSelector([]);
    if (codeError) {
      codeError.textContent = "Nao foi possivel carregar os restaurantes.";
    }
  }
}

orderOpen.addEventListener("click", () => {
  renderOrderItems();
  orderModal.classList.remove("hidden");
});

orderClose.addEventListener("click", () => {
  orderModal.classList.add("hidden");
});

orderSubmit.addEventListener("click", async () => {
  if (!slug) return;
  orderMessage.textContent = "";
  const tableValue = (orderTable.value || tableParam).toString().trim();
  if (!tableValue) {
    orderMessage.textContent = "Informe a mesa.";
    return;
  }
  if (cart.length === 0) {
    orderMessage.textContent = "Seu pedido esta vazio.";
    return;
  }
  const payload = {
    restaurantSlug: slug,
    table: tableValue,
    items: cart.map((item) => ({ id: item.id, qty: item.qty }))
  };
  try {
    const res = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      orderMessage.textContent = "Erro ao enviar pedido.";
      return;
    }
    localStorage.setItem(tableKey, tableValue);
    cart = [];
    saveCart();
    renderOrderItems();
    orderMessage.textContent = "Pedido enviado. Aguarde atendimento.";
  } catch (err) {
    orderMessage.textContent = "Erro ao enviar pedido.";
  }
});

function formatPrice(value) {
  const priceValue = Number(value);
  return Number.isFinite(priceValue) ? priceValue.toFixed(2) : "0.00";
}

function loadCart() {
  const raw = localStorage.getItem(cartKey);
  cart = raw ? JSON.parse(raw) : [];
}

function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(cart));
  updateOrderBar();
}

function updateOrderBar() {
  if (!slug) {
    orderBar.classList.add("hidden");
    return;
  }
  const detailed = getCartDetailed();
  if (detailed.length === 0) {
    orderBar.classList.add("hidden");
    return;
  }
  const totalItems = detailed.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = detailed.reduce((acc, item) => acc + item.qty * item.price, 0);
  orderSummary.textContent = `${totalItems} itens | R$ ${formatPrice(totalPrice)}`;
  orderBar.classList.remove("hidden");
}

function getCartDetailed() {
  return cart
    .map((entry) => {
      const menuItem = menuItems.find((item) => item.id === entry.id);
      if (!menuItem) return null;
      return {
        ...menuItem,
        qty: entry.qty
      };
    })
    .filter(Boolean);
}

function addToCart(itemId) {
  const existing = cart.find((entry) => entry.id === itemId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: itemId, qty: 1 });
  }
  saveCart();
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
  const detailed = getCartDetailed();
  orderItems.innerHTML = "";

  if (tableParam) {
    orderTable.value = tableParam;
  } else {
    const savedTable = localStorage.getItem(tableKey) || "";
    orderTable.value = savedTable;
  }

  if (detailed.length === 0) {
    orderItems.innerHTML = "<div class=\"muted\">Seu pedido esta vazio.</div>";
    return;
  }

  detailed.forEach((item) => {
    const row = document.createElement("div");
    row.className = "order-row";
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="muted">R$ ${formatPrice(item.price)}</div>
      </div>
      <div class="order-qty">
        <button class="btn btn-outline" data-action="minus">-</button>
        <span>${item.qty}</span>
        <button class="btn btn-outline" data-action="plus">+</button>
      </div>
    `;
    row.querySelector("[data-action='minus']").addEventListener("click", () => {
      updateCartQty(item.id, -1);
    });
    row.querySelector("[data-action='plus']").addEventListener("click", () => {
      updateCartQty(item.id, 1);
    });
    orderItems.appendChild(row);
  });
}

async function loadMenu(slugValue) {
  const res = await fetch(`/api/public/restaurant/${slugValue}`);
  if (!res.ok) {
    gateSection.classList.remove("hidden");
    menuSection.classList.add("hidden");
    codeError.textContent = "Restaurante nao encontrado.";
    loadRestaurantLinks();
    return;
  }
  const data = await res.json();
  const { restaurant, items } = data;
  if (restaurant.template === "topo-do-mundo") {
    const templateParams = new URLSearchParams(window.location.search);
    templateParams.set("r", slugValue);
    if (tableParam) {
      templateParams.set("mesa", tableParam);
    }
    window.location.replace(`/templates/topo-do-mundo.html?${templateParams.toString()}`);
    return;
  }
  menuItems = items || [];

  gateSection.classList.add("hidden");
  menuSection.classList.remove("hidden");

  menuTitle.textContent = restaurant.name;
  menuSubtitle.textContent = `${menuItems.length} itens no cardapio`;

  menuList.innerHTML = "";
  menuItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const imageTag = item.image
      ? `<img src="${item.image}" alt="${item.name}" />`
      : `<div class="panel" style="height: 180px; display: grid; place-items: center;">Imagem em breve</div>`;
    card.innerHTML = `
      ${imageTag}
      <h3>${item.name}</h3>
      <p class="muted">${item.description || ""}</p>
      <div class="row" style="margin-top: 12px;">
        <div class="price">R$ ${formatPrice(item.price)}</div>
      </div>
      <div class="row" style="margin-top: 10px;">
        <button class="btn btn-outline" data-add>Adicionar</button>
        <a class="btn" href="/item.html?id=${item.id}">Ver em AR</a>
      </div>
    `;
    card.querySelector("[data-add]").addEventListener("click", () => {
      addToCart(item.id);
    });
    menuList.appendChild(card);
  });

  loadCart();
  updateOrderBar();
}

if (slug) {
  initTheme();
  loadMenu(slug);
} else {
  initTheme();
  gateSection.classList.remove("hidden");
  menuSection.classList.add("hidden");
  loadRestaurantLinks();
}
