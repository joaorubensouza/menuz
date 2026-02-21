const params = new URLSearchParams(window.location.search);
const slug = (params.get("r") || "").trim();
const tableFromUrl = (params.get("mesa") || "").trim();

const searchToggle = document.getElementById("search-toggle");
const searchWrap = document.getElementById("search-wrap");
const searchInput = document.getElementById("search-input");

const heroTrack = document.getElementById("hero-track");
const heroDots = document.getElementById("hero-dots");
const heroPrev = document.getElementById("hero-prev");
const heroNext = document.getElementById("hero-next");

const restaurantName = document.getElementById("restaurant-name");
const restaurantDesc = document.getElementById("restaurant-desc");
const categoryList = document.getElementById("category-list");
const menuList = document.getElementById("menu-list");
const emptyState = document.getElementById("empty-state");

const cartButton = document.getElementById("cart-button");
const cartModal = document.getElementById("cart-modal");
const cartClose = document.getElementById("cart-close");
const cartItems = document.getElementById("cart-items");
const tableInput = document.getElementById("table-input");
const cartSubmit = document.getElementById("cart-submit");
const cartMessage = document.getElementById("cart-message");

const state = {
  restaurant: null,
  items: [],
  cart: [],
  selectedCategory: "all",
  categories: [],
  heroImages: [],
  heroIndex: 0,
  heroTimer: null
};

const cartKey = slug ? `menuz_cart_${slug}` : "menuz_cart_template";
const tableKey = slug ? `menuz_table_${slug}` : "menuz_table_template";

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
  cartButton.textContent = `Pedido (${totalItems}) | R$ ${formatPrice(totalPrice)}`;
  cartButton.classList.remove("hidden");
}

function addToCart(itemId) {
  const found = state.cart.find((entry) => entry.id === itemId);
  if (found) {
    found.qty += 1;
  } else {
    state.cart.push({ id: itemId, qty: 1 });
  }
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

function renderTabs() {
  categoryList.innerHTML = "";
  const tabs = ["all", ...state.categories];

  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-btn ${state.selectedCategory === tab ? "active" : ""}`;
    button.textContent = tab === "all" ? "All" : tab;
    button.addEventListener("click", () => {
      state.selectedCategory = tab;
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
  heading.textContent = title;
  wrapper.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "item-grid";

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "item-row";
    const thumb = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
      : "";

    const itemArUrl = `/item.html?id=${encodeURIComponent(item.id)}&openAr=1`;

    row.innerHTML = `
      <div class="item-copy">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <div class="item-price">R$ ${formatPrice(item.price)}</div>
        <div class="item-links">
          <a href="${itemArUrl}">Realidade Aumentada</a>
          <button type="button" data-add>+ pedido</button>
        </div>
      </div>
      <a class="item-thumb" href="${itemArUrl}" aria-label="Abrir ${escapeHtml(item.name)} em AR">
        ${thumb}
      </a>
    `;

    row.querySelector("[data-add]").addEventListener("click", () => addToCart(item.id));
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

  if (detailed.length === 0) {
    cartItems.innerHTML = "<p>Nenhum item no pedido.</p>";
    return;
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
  return images.slice(0, 8);
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
    cartMessage.textContent = "Informe a mesa antes de enviar.";
    return;
  }
  if (state.cart.length === 0) {
    cartMessage.textContent = "Seu pedido esta vazio.";
    return;
  }

  const payload = {
    restaurantSlug: slug,
    table: tableValue,
    items: state.cart.map((item) => ({ id: item.id, qty: item.qty }))
  };

  try {
    const res = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      cartMessage.textContent = "Nao foi possivel enviar o pedido.";
      return;
    }

    localStorage.setItem(tableKey, tableValue);
    state.cart = [];
    saveCart();
    renderCart();
    cartMessage.textContent = "Pedido enviado com sucesso.";
    setTimeout(() => {
      cartModal.classList.add("hidden");
    }, 800);
  } catch (err) {
    cartMessage.textContent = "Erro de conexao ao enviar pedido.";
  }
}

async function loadRestaurant() {
  if (!slug) {
    restaurantName.textContent = "Restaurante nao informado";
    restaurantDesc.textContent = "Abra por um link com parametro ?r=slug";
    return;
  }

  const res = await fetch(`/api/public/restaurant/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    restaurantName.textContent = "Restaurante nao encontrado";
    restaurantDesc.textContent = "Confira o link do QR Code.";
    return;
  }

  const data = await res.json();
  state.restaurant = data.restaurant;
  state.items = Array.isArray(data.items) ? data.items : [];
  state.categories = [...new Set(state.items.map((item) => inferCategory(item)))];
  state.heroIndex = 0;

  restaurantName.textContent = state.restaurant.name || "Cardapio";
  restaurantDesc.textContent = state.restaurant.description || "";

  setTheme();
  renderHero();
  startHeroAutoplay();
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

cartSubmit.addEventListener("click", sendOrder);

loadRestaurant();
