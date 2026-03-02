const state = {
  token: localStorage.getItem("menuz_token"),
  user: JSON.parse(localStorage.getItem("menuz_user") || "null"),
  restaurants: [],
  items: [],
  orders: [],
  modelJobs: [],
  aiProviders: [],
  activeRestaurant: null,
  scanStream: null,
  scanItemId: null
};

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout");

const restaurantsPanel = document.getElementById("restaurants-panel");
const restaurantsList = document.getElementById("restaurants-list");
const restaurantsCount = document.getElementById("restaurants-count");
const restaurantForm = document.getElementById("restaurant-form");

const managePanel = document.getElementById("manage-panel");
const manageTitle = document.getElementById("manage-title");
const backRestaurants = document.getElementById("back-restaurants");
const restaurantEditForm = document.getElementById("restaurant-edit-form");

const clientUserPanel = document.getElementById("client-user-panel");
const clientUserForm = document.getElementById("client-user-form");
const clientUserMsg = document.getElementById("client-user-msg");

const itemsList = document.getElementById("items-list");
const itemsCount = document.getElementById("items-count");
const itemForm = document.getElementById("item-form");
const modelJobForm = document.getElementById("model-job-form");
const modelJobItem = document.getElementById("model-job-item");
const modelJobSource = document.getElementById("model-job-source");
const modelJobProvider = document.getElementById("model-job-provider");
const modelJobAiModel = document.getElementById("model-job-ai-model");
const modelJobAuto = document.getElementById("model-job-auto");
const modelJobImages = document.getElementById("model-job-images");
const modelJobNotes = document.getElementById("model-job-notes");
const modelJobMsg = document.getElementById("model-job-msg");
const modelJobsList = document.getElementById("model-jobs-list");
const modelJobsCount = document.getElementById("model-jobs-count");
const modelJobsAuto = document.getElementById("model-jobs-auto");
const modelJobsAutoMsg = document.getElementById("model-jobs-auto-msg");
const aiConfigMsg = document.getElementById("ai-config-msg");

const ordersList = document.getElementById("orders-list");
const ordersCount = document.getElementById("orders-count");
const ordersRefresh = document.getElementById("orders-refresh");
const analyticsDays = document.getElementById("analytics-days");
const analyticsRefresh = document.getElementById("analytics-refresh");
const analyticsSummary = document.getElementById("analytics-summary");
const analyticsTopAr = document.getElementById("analytics-top-ar");
const analyticsTopOrders = document.getElementById("analytics-top-orders");
const analyticsAlerts = document.getElementById("analytics-alerts");

const scannerInfo = document.getElementById("scanner-info");
const scannerView = document.getElementById("scanner-view");
const scanVideo = document.getElementById("scan-video");
const scanCapture = document.getElementById("scan-capture");
const scanStop = document.getElementById("scan-stop");
const scanCount = document.getElementById("scan-count");
const scanThumbs = document.getElementById("scan-thumbs");

const qrModal = document.getElementById("qr-modal");
const qrImage = document.getElementById("qr-image");
const qrLink = document.getElementById("qr-link");
const qrClose = document.getElementById("qr-close");
const themeSelect = document.getElementById("theme-select");
const lizzWidget = document.getElementById("lizz-chatbot");
const lizzToggle = document.getElementById("lizz-toggle");
const lizzPanel = document.getElementById("lizz-panel");
const lizzClose = document.getElementById("lizz-close");
const lizzMessages = document.getElementById("lizz-messages");
const lizzForm = document.getElementById("lizz-form");
const lizzInput = document.getElementById("lizz-input");
const sectionItems = document.getElementById("item-form");
const sectionModelJobs = document.getElementById("model-job-form");
const sectionOrders = document.getElementById("orders-list");
const sectionRestaurant = document.getElementById("restaurant-edit-form");

const THEME_KEY = "menuz_theme";
const LANGUAGE_CODES = ["pt-BR", "en-US", "es-ES", "fr-FR", "it-IT", "de-DE"];
const DEFAULT_LANGUAGE_CODE = "pt-BR";

async function api(path, options = {}) {
  const config = { ...options };
  config.headers = config.headers || {};
  if (state.token) {
    config.headers.Authorization = `Bearer ${state.token}`;
  }
  if (config.body && !config.isForm) {
    config.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, config);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "request_failed");
  }
  return res.json();
}

function getSelectedLanguages(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return [...LANGUAGE_CODES];
  const selected = Array.from(select.selectedOptions || [])
    .map((option) => option.value)
    .filter((value, index, arr) => LANGUAGE_CODES.includes(value) && arr.indexOf(value) === index);
  return selected.length ? selected : [...LANGUAGE_CODES];
}

function setSelectedLanguages(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const allowed = Array.isArray(values) && values.length ? values : [DEFAULT_LANGUAGE_CODE];
  Array.from(select.options).forEach((option) => {
    option.selected = allowed.includes(option.value);
  });
}

function normalizeDefaultLanguage(value) {
  return LANGUAGE_CODES.includes(value) ? value : DEFAULT_LANGUAGE_CODE;
}

function syncLanguageControls(defaultSelectId, listSelectId) {
  const defaultSelect = document.getElementById(defaultSelectId);
  const listSelect = document.getElementById(listSelectId);
  if (!defaultSelect || !listSelect) return;
  const defaultLanguage = normalizeDefaultLanguage(defaultSelect.value);
  const selected = getSelectedLanguages(listSelectId);
  if (!selected.includes(defaultLanguage)) {
    setSelectedLanguages(listSelectId, [defaultLanguage, ...selected]);
  }
}

function getProviderLabel(providerId) {
  const provider = state.aiProviders.find((entry) => entry.id === providerId);
  if (!provider) return providerId || "manual";
  return provider.label || provider.id;
}

function renderAiProviders() {
  if (!modelJobProvider) return;
  modelJobProvider.innerHTML = "";

  if (!state.aiProviders.length) {
    const option = document.createElement("option");
    option.value = "manual";
    option.textContent = "Manual";
    modelJobProvider.appendChild(option);
    if (aiConfigMsg) {
      aiConfigMsg.textContent = "Sem dados de provedores de IA. Usando modo manual.";
    }
    return;
  }

  state.aiProviders.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider.id;
    const suffix = provider.enabled ? "" : " (indisponivel)";
    option.textContent = `${provider.label}${suffix}`;
    modelJobProvider.appendChild(option);
  });

  const firstEnabled = state.aiProviders.find((provider) => provider.enabled);
  modelJobProvider.value = firstEnabled ? firstEnabled.id : state.aiProviders[0].id;

  if (aiConfigMsg) {
    const selected = state.aiProviders.find(
      (provider) => provider.id === modelJobProvider.value
    );
    aiConfigMsg.textContent = selected
      ? selected.notes || ""
      : "Configure um provedor para iniciar testes.";
  }
  if (modelJobProvider.value === "meshy" && !modelJobAiModel.value) {
    modelJobAiModel.value = "meshy-6";
  }
}

function applyTheme(theme) {
  const allowed = ["amber", "ocean", "wine"];
  const nextTheme = allowed.includes(theme) ? theme : "amber";
  document.body.setAttribute("data-theme", nextTheme);
  if (themeSelect) {
    themeSelect.value = nextTheme;
  }
}

function initThemeSelector() {
  if (!themeSelect) return;
  const savedTheme = localStorage.getItem(THEME_KEY) || "amber";
  applyTheme(savedTheme);
  themeSelect.addEventListener("change", () => {
    const nextTheme = themeSelect.value;
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

function initRestaurantLanguageControls() {
  const map = [
    ["restaurant-default-language", "restaurant-languages"],
    ["edit-default-language", "edit-languages"]
  ];

  map.forEach(([defaultId, listId]) => {
    const defaultSelect = document.getElementById(defaultId);
    const listSelect = document.getElementById(listId);
    if (!defaultSelect || !listSelect) return;

    const preSelected = getSelectedLanguages(listId);
    if (preSelected.length <= 1) {
      setSelectedLanguages(listId, LANGUAGE_CODES);
    }
    defaultSelect.value = normalizeDefaultLanguage(defaultSelect.value);

    defaultSelect.addEventListener("change", () => {
      syncLanguageControls(defaultId, listId);
    });

    listSelect.addEventListener("change", () => {
      syncLanguageControls(defaultId, listId);
    });

    syncLanguageControls(defaultId, listId);
  });
}

async function loadAiProviders() {
  try {
    const data = await api("/api/ai/providers");
    state.aiProviders = data.providers && data.providers.length
      ? data.providers
      : [
          {
            id: "manual",
            label: "Manual",
            enabled: true,
            supportsAuto: false,
            notes: "Pipeline assistido por voce (scanner + blender)."
          }
        ];
    renderAiProviders();
  } catch (err) {
    state.aiProviders = [
      {
        id: "manual",
        label: "Manual",
        enabled: true,
        supportsAuto: false,
        notes: "Pipeline assistido por voce (scanner + blender)."
      }
    ];
    renderAiProviders();
  }
}

async function uploadModelJobReferenceImages(jobId, files) {
  if (!files || !files.length) return;
  const form = new FormData();
  Array.from(files).forEach((file) => {
    form.append("photos", file);
  });
  await api(`/api/model-jobs/${jobId}/images`, {
    method: "POST",
    body: form,
    isForm: true
  });
}

function showLogin() {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  if (lizzWidget) lizzWidget.classList.add("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  userEmail.textContent = state.user.email;
  if (lizzWidget) lizzWidget.classList.add("hidden");
}

async function init() {
  if (state.token) {
    try {
      const data = await api("/api/me");
      state.user = data.user;
      localStorage.setItem("menuz_user", JSON.stringify(state.user));
      showDashboard();
      await bootstrapDashboard();
      return;
    } catch (err) {
      state.token = null;
      localStorage.removeItem("menuz_token");
    }
  }
  showLogin();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("menuz_token", state.token);
    localStorage.setItem("menuz_user", JSON.stringify(state.user));
    showDashboard();
    await bootstrapDashboard();
  } catch (err) {
    loginError.textContent = "Login invalido.";
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (err) {
    // ignore
  }
  state.token = null;
  state.user = null;
  localStorage.removeItem("menuz_token");
  localStorage.removeItem("menuz_user");
  showLogin();
});

restaurantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const createDefaultLanguage = normalizeDefaultLanguage(
    document.getElementById("restaurant-default-language").value
  );
  const createLanguages = getSelectedLanguages("restaurant-languages");
  if (!createLanguages.includes(createDefaultLanguage)) {
    createLanguages.unshift(createDefaultLanguage);
  }
  const payload = {
    name: document.getElementById("restaurant-name").value.trim(),
    slug: document.getElementById("restaurant-slug").value.trim(),
    description: document.getElementById("restaurant-desc").value.trim(),
    logo: document.getElementById("restaurant-logo").value.trim(),
    accent: document.getElementById("restaurant-accent").value.trim(),
    template: document.getElementById("restaurant-template").value.trim(),
    contactAddress: document.getElementById("restaurant-contact-address").value.trim(),
    contactPhone: document.getElementById("restaurant-contact-phone").value.trim(),
    contactEmail: document.getElementById("restaurant-contact-email").value.trim(),
    contactWebsite: document.getElementById("restaurant-contact-website").value.trim(),
    defaultLanguage: createDefaultLanguage,
    languages: createLanguages
  };
  const data = await api("/api/restaurants", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.restaurants.push(data.restaurant);
  renderRestaurants();
  restaurantForm.reset();
  document.getElementById("restaurant-default-language").value = DEFAULT_LANGUAGE_CODE;
  setSelectedLanguages("restaurant-languages", LANGUAGE_CODES);
  syncLanguageControls("restaurant-default-language", "restaurant-languages");
});

restaurantEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.activeRestaurant) return;
  const editDefaultLanguage = normalizeDefaultLanguage(
    document.getElementById("edit-default-language").value
  );
  const editLanguages = getSelectedLanguages("edit-languages");
  if (!editLanguages.includes(editDefaultLanguage)) {
    editLanguages.unshift(editDefaultLanguage);
  }
  const payload = {
    name: document.getElementById("edit-name").value.trim(),
    slug: document.getElementById("edit-slug").value.trim(),
    description: document.getElementById("edit-desc").value.trim(),
    logo: document.getElementById("edit-logo").value.trim(),
    accent: document.getElementById("edit-accent").value.trim(),
    template: document.getElementById("edit-template").value.trim(),
    contactAddress: document.getElementById("edit-contact-address").value.trim(),
    contactPhone: document.getElementById("edit-contact-phone").value.trim(),
    contactEmail: document.getElementById("edit-contact-email").value.trim(),
    contactWebsite: document.getElementById("edit-contact-website").value.trim(),
    defaultLanguage: editDefaultLanguage,
    languages: editLanguages
  };
  const data = await api(`/api/restaurants/${state.activeRestaurant.id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  state.activeRestaurant = data.restaurant;
  manageTitle.textContent = `Gerenciar ${state.activeRestaurant.name}`;
  fillRestaurantForm(state.activeRestaurant);
});

clientUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.activeRestaurant) return;
  clientUserMsg.textContent = "";
  const payload = {
    email: document.getElementById("client-email").value.trim(),
    password: document.getElementById("client-password").value.trim()
  };
  try {
    const data = await api(`/api/restaurants/${state.activeRestaurant.id}/users`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    clientUserMsg.textContent = `Login criado: ${data.user.email}`;
    clientUserForm.reset();
  } catch (err) {
    clientUserMsg.textContent = "Erro ao criar login.";
  }
});

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.activeRestaurant) return;
  const itemId = document.getElementById("item-id").value;
  const payload = {
    name: document.getElementById("item-name").value.trim(),
    price: document.getElementById("item-price").value.trim(),
    description: document.getElementById("item-desc").value.trim(),
    image: document.getElementById("item-image-url").value.trim(),
    modelGlb: document.getElementById("item-model-glb").value.trim(),
    modelUsdz: document.getElementById("item-model-usdz").value.trim()
  };

  let item;
  if (itemId) {
    const data = await api(`/api/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    item = data.item;
  } else {
    const data = await api(`/api/restaurants/${state.activeRestaurant.id}/items`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    item = data.item;
  }

  await uploadItemAssets(item.id);
  await loadItems(state.activeRestaurant.id);
  itemForm.reset();
  document.getElementById("item-id").value = "";
});

modelJobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.activeRestaurant) return;
  modelJobMsg.textContent = "";
  const payload = {
    itemId: modelJobItem.value,
    sourceType: modelJobSource.value,
    provider: modelJobProvider.value,
    aiModel: modelJobAiModel.value.trim(),
    autoMode: modelJobAuto.checked,
    notes: modelJobNotes.value.trim()
  };
  if (!payload.itemId) {
    modelJobMsg.textContent = "Selecione o prato para criar o job.";
    return;
  }
  const selectedProvider = state.aiProviders.find(
    (provider) => provider.id === payload.provider
  );
  if (selectedProvider && !selectedProvider.enabled && selectedProvider.id !== "manual") {
    modelJobMsg.textContent = "Provedor IA selecionado nao esta habilitado no servidor.";
    return;
  }
  try {
    const created = await api(`/api/restaurants/${state.activeRestaurant.id}/model-jobs`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (modelJobImages && modelJobImages.files && modelJobImages.files.length > 0) {
      await uploadModelJobReferenceImages(created.job.id, modelJobImages.files);
      modelJobImages.value = "";
    }
    modelJobNotes.value = "";
    modelJobAuto.checked = false;
    modelJobMsg.textContent = "Job adicionado na fila 3D.";
    await loadModelJobs(state.activeRestaurant.id);
  } catch (err) {
    modelJobMsg.textContent = "Erro ao criar job da fila.";
  }
});

if (modelJobProvider) {
  modelJobProvider.addEventListener("change", () => {
    const provider = state.aiProviders.find((entry) => entry.id === modelJobProvider.value);
    if (!provider) return;
    if (aiConfigMsg) {
      aiConfigMsg.textContent = provider.notes || "";
    }
    if (provider.id === "meshy" && !modelJobAiModel.value) {
      modelJobAiModel.value = "meshy-6";
    }
    if (!provider.supportsAuto) {
      modelJobAuto.checked = false;
    }
  });
}

backRestaurants.addEventListener("click", () => {
  managePanel.classList.add("hidden");
  restaurantsPanel.classList.remove("hidden");
  stopScanner();
  if (lizzWidget) lizzWidget.classList.add("hidden");
});

qrClose.addEventListener("click", () => {
  qrModal.classList.add("hidden");
});

scanCapture.addEventListener("click", async () => {
  if (!state.scanItemId || !state.scanStream) return;
  const canvas = document.createElement("canvas");
  canvas.width = scanVideo.videoWidth;
  canvas.height = scanVideo.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(scanVideo, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const form = new FormData();
    form.append("photo", blob, `scan-${Date.now()}.jpg`);
    try {
      const data = await api(`/api/items/${state.scanItemId}/scan`, {
        method: "POST",
        body: form,
        isForm: true
      });
      scanCount.textContent = `${data.count} fotos capturadas`;
      const img = document.createElement("img");
      img.src = data.url;
      scanThumbs.prepend(img);
    } catch (err) {
      scanCount.textContent = "Erro ao enviar foto.";
    }
  }, "image/jpeg", 0.9);
});

scanStop.addEventListener("click", () => {
  stopScanner();
});

ordersRefresh.addEventListener("click", () => {
  if (state.activeRestaurant) {
    loadOrders(state.activeRestaurant.id);
    loadAnalytics(state.activeRestaurant.id);
  }
});

if (analyticsRefresh) {
  analyticsRefresh.addEventListener("click", () => {
    if (!state.activeRestaurant) return;
    loadAnalytics(state.activeRestaurant.id);
  });
}

if (analyticsDays) {
  analyticsDays.addEventListener("change", () => {
    if (!state.activeRestaurant) return;
    loadAnalytics(state.activeRestaurant.id);
  });
}

if (modelJobsAuto) {
  modelJobsAuto.addEventListener("click", async () => {
    if (!state.activeRestaurant) return;
    modelJobsAuto.disabled = true;
    if (modelJobsAutoMsg) modelJobsAutoMsg.textContent = "Executando automacao da fila 3D...";
    try {
      const data = await api(`/api/restaurants/${state.activeRestaurant.id}/model-jobs/auto-process`, {
        method: "POST"
      });
      const summary = data.summary || {};
      if (modelJobsAutoMsg) {
        modelJobsAutoMsg.textContent =
          `Automacao concluida: iniciados ${summary.started || 0}, ` +
          `sincronizados ${summary.synced || 0}, publicados ${summary.published || 0}, ` +
          `falhas ${summary.failed || 0}.`;
      }
      await loadItems(state.activeRestaurant.id);
      await loadModelJobs(state.activeRestaurant.id);
      await loadAnalytics(state.activeRestaurant.id);
    } catch (err) {
      if (modelJobsAutoMsg) modelJobsAutoMsg.textContent = "Falha na automacao da fila 3D.";
    } finally {
      modelJobsAuto.disabled = false;
    }
  });
}

function renderRestaurants() {
  restaurantsCount.textContent = `${state.restaurants.length} total`;
  restaurantsList.innerHTML = "";
  state.restaurants.forEach((restaurant) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="badge">${restaurant.slug}</div>
      <h3 style="margin: 10px 0 6px;">${restaurant.name}</h3>
      <p class="muted">Template: ${restaurant.template || "default"}</p>
      <p class="muted">${restaurant.description || ""}</p>
      <div class="row" style="margin-top: 12px;">
        <button class="btn" data-id="${restaurant.id}">Gerenciar</button>
        <a class="btn btn-outline" href="/r/${restaurant.slug}">Abrir link</a>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      selectRestaurant(restaurant.id);
    });
    restaurantsList.appendChild(card);
  });
}

function fillRestaurantForm(restaurant) {
  document.getElementById("edit-name").value = restaurant.name || "";
  document.getElementById("edit-slug").value = restaurant.slug || "";
  document.getElementById("edit-desc").value = restaurant.description || "";
  document.getElementById("edit-logo").value = restaurant.logo || "";
  document.getElementById("edit-accent").value =
    (restaurant.theme && restaurant.theme.accent) || "";
  document.getElementById("edit-template").value = restaurant.template || "default";
  const contact = restaurant.contact || {};
  const languageSettings = restaurant.languageSettings || {};
  document.getElementById("edit-contact-address").value = contact.address || "";
  document.getElementById("edit-contact-phone").value = contact.phone || "";
  document.getElementById("edit-contact-email").value = contact.email || "";
  document.getElementById("edit-contact-website").value = contact.website || "";
  document.getElementById("edit-default-language").value = normalizeDefaultLanguage(
    languageSettings.defaultLanguage
  );
  setSelectedLanguages("edit-languages", languageSettings.languages || LANGUAGE_CODES);
  syncLanguageControls("edit-default-language", "edit-languages");
}

function populateModelJobItems() {
  modelJobItem.innerHTML = '<option value="">Selecione o prato</option>';
  state.items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    modelJobItem.appendChild(option);
  });
}

function renderItems() {
  itemsCount.textContent = `${state.items.length} itens`;
  itemsList.innerHTML = "";
  state.items.forEach((item) => {
    const priceValue = Number(item.price);
    const priceText = Number.isFinite(priceValue) ? priceValue.toFixed(2) : "0.00";
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>
        <div><strong>${item.name}</strong></div>
        <div class="muted">R$ ${priceText}</div>
      </div>
      <div class="muted">${item.modelGlb || "Sem 3D"}</div>
      <div class="table-actions">
        <button class="btn btn-outline" data-action="edit">Editar</button>
        <button class="btn btn-outline" data-action="qr">QR</button>
        <button class="btn" data-action="scan">Scanner</button>
        <button class="btn btn-outline" data-action="delete">Excluir</button>
      </div>
    `;

    row.querySelector("[data-action='edit']").addEventListener("click", () => {
      loadItemIntoForm(item);
    });
    row.querySelector("[data-action='qr']").addEventListener("click", () => {
      openQr(item);
    });
    row.querySelector("[data-action='scan']").addEventListener("click", () => {
      openScanner(item);
    });
    row.querySelector("[data-action='delete']").addEventListener("click", () => {
      deleteItem(item);
    });

    itemsList.appendChild(row);
  });
  populateModelJobItems();
}

function renderModelJobs() {
  modelJobsCount.textContent = `${state.modelJobs.length} jobs`;
  modelJobsList.innerHTML = "";

  if (state.modelJobs.length === 0) {
    modelJobsList.innerHTML = "<div class=\"muted\">Nenhum job 3D para este restaurante.</div>";
    return;
  }

  state.modelJobs.forEach((job) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const item = state.items.find((entry) => entry.id === job.itemId);
    const itemName = item ? item.name : "Item removido";
    const sourceLabel = {
      scanner: "Scanner",
      upload: "Upload",
      api: "API IA"
    }[job.sourceType] || job.sourceType;
    const providerLabel = getProviderLabel(job.provider || "manual");
    const providerStatus = job.providerStatus || "-";
    const referenceCount = Array.isArray(job.referenceImages)
      ? job.referenceImages.length
      : 0;
    const qaScore = Number(job.qaScore) || 0;
    const qaBand = (job.qaBand || "fraca").toString();
    const qaChecklist = Array.isArray(job.qaChecklist) ? job.qaChecklist : [];
    const updatedAt = job.updatedAt
      ? new Date(job.updatedAt).toLocaleString("pt-BR")
      : "-";
    row.innerHTML = `
      <div>
        <div><strong>${itemName}</strong></div>
        <div class="muted">${sourceLabel} - ${job.autoMode ? "automatico" : "assistido"}</div>
        <div class="muted">Provedor: ${providerLabel} (${providerStatus})</div>
        <div class="muted">Fotos referencia: ${referenceCount}</div>
        <div class="muted">QA: ${qaScore}/100 (${qaBand})</div>
        <div class="muted">Checklist: ${qaChecklist.slice(0, 3).join(" | ") || "pendente"}</div>
        <div class="muted">Atualizado: ${updatedAt}</div>
      </div>
      <div>
        <select class="input" data-field="status">
          ${[
            "enviado",
            "triagem",
            "processando",
            "revisao",
            "publicado",
            "erro"
          ]
            .map(
              (status) =>
                `<option value="${status}" ${
                  status === job.status ? "selected" : ""
                }>${status}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="form-grid">
        <input class="input" data-field="glb" placeholder="GLB URL" value="${job.modelGlb || ""}" />
        <input class="input" data-field="usdz" placeholder="USDZ URL" value="${job.modelUsdz || ""}" />
        <input class="input" data-field="ai-model" placeholder="Modelo IA" value="${job.aiModel || ""}" />
        <textarea class="input" data-field="qa-notes" placeholder="Notas de QA">${job.qaNotes || ""}</textarea>
        <select class="input" data-field="provider">
          ${(state.aiProviders.length
            ? state.aiProviders
            : [{ id: "manual", label: "Manual" }])
            .map(
              (provider) =>
                `<option value="${provider.id}" ${
                  provider.id === (job.provider || "manual") ? "selected" : ""
                }>${provider.label}</option>`
            )
            .join("")}
        </select>
        <div class="table-actions">
          <button class="btn btn-outline" data-action="ai-start">Rodar IA</button>
          <button class="btn btn-outline" data-action="ai-sync">Sincronizar</button>
          <button class="btn btn-outline" data-action="qa-evaluate">Avaliar QA</button>
          <button class="btn" data-action="publish-job">Publicar</button>
          <button class="btn btn-outline" data-action="delete-job">Excluir job</button>
        </div>
        <input
          class="input"
          data-field="job-images"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
        />
        <button class="btn btn-outline" data-action="upload-images">Enviar fotos</button>
        <button class="btn btn-outline" data-action="save">Salvar job</button>
      </div>
    `;

    const saveButton = row.querySelector("[data-action='save']");
    const aiStartButton = row.querySelector("[data-action='ai-start']");
    const aiSyncButton = row.querySelector("[data-action='ai-sync']");
    const qaEvaluateButton = row.querySelector("[data-action='qa-evaluate']");
    const publishJobButton = row.querySelector("[data-action='publish-job']");
    const deleteJobButton = row.querySelector("[data-action='delete-job']");
    const uploadImagesButton = row.querySelector("[data-action='upload-images']");

    saveButton.addEventListener("click", async () => {
      const status = row.querySelector("[data-field='status']").value;
      const modelGlb = row.querySelector("[data-field='glb']").value.trim();
      const modelUsdz = row.querySelector("[data-field='usdz']").value.trim();
      const provider = row.querySelector("[data-field='provider']").value;
      const aiModel = row.querySelector("[data-field='ai-model']").value.trim();
      const qaNotes = row.querySelector("[data-field='qa-notes']").value.trim();
      saveButton.disabled = true;
      try {
        await api(`/api/model-jobs/${job.id}`, {
          method: "PUT",
          body: JSON.stringify({ status, modelGlb, modelUsdz, provider, aiModel, qaNotes })
        });
        if (status === "publicado") {
          await loadItems(state.activeRestaurant.id);
        }
        await loadModelJobs(state.activeRestaurant.id);
      } catch (err) {
        modelJobMsg.textContent = "Falha ao salvar job.";
      } finally {
        saveButton.disabled = false;
      }
    });

    aiStartButton.addEventListener("click", async () => {
      const provider = row.querySelector("[data-field='provider']").value;
      const aiModel = row.querySelector("[data-field='ai-model']").value.trim();
      aiStartButton.disabled = true;
      modelJobMsg.textContent = "";
      try {
        await api(`/api/model-jobs/${job.id}/ai/start`, {
          method: "POST",
          body: JSON.stringify({ provider, aiModel })
        });
        modelJobMsg.textContent = "Processamento IA iniciado.";
        await loadModelJobs(state.activeRestaurant.id);
      } catch (err) {
        modelJobMsg.textContent = "Falha ao iniciar geracao IA para este job.";
      } finally {
        aiStartButton.disabled = false;
      }
    });

    aiSyncButton.addEventListener("click", async () => {
      aiSyncButton.disabled = true;
      modelJobMsg.textContent = "";
      try {
        await api(`/api/model-jobs/${job.id}/ai/sync`, {
          method: "POST",
          body: JSON.stringify({ autoPublish: true })
        });
        modelJobMsg.textContent = "Status IA sincronizado.";
        await loadItems(state.activeRestaurant.id);
        await loadModelJobs(state.activeRestaurant.id);
      } catch (err) {
        modelJobMsg.textContent = "Falha ao sincronizar resultado IA deste job.";
      } finally {
        aiSyncButton.disabled = false;
      }
    });

    qaEvaluateButton.addEventListener("click", async () => {
      qaEvaluateButton.disabled = true;
      modelJobMsg.textContent = "";
      try {
        const qaNotes = row.querySelector("[data-field='qa-notes']").value.trim();
        const data = await api(`/api/model-jobs/${job.id}/qa/evaluate`, {
          method: "POST",
          body: JSON.stringify({ qaNotes })
        });
        modelJobMsg.textContent = `QA atualizado: ${data.evaluation.score}/100 (${data.evaluation.band}).`;
        await loadModelJobs(state.activeRestaurant.id);
      } catch (err) {
        modelJobMsg.textContent = "Falha ao avaliar QA deste job.";
      } finally {
        qaEvaluateButton.disabled = false;
      }
    });

    publishJobButton.addEventListener("click", async () => {
      publishJobButton.disabled = true;
      modelJobMsg.textContent = "";
      try {
        await api(`/api/model-jobs/${job.id}/publish`, { method: "POST" });
        modelJobMsg.textContent = "Job publicado e aplicado no item.";
        await loadItems(state.activeRestaurant.id);
        await loadModelJobs(state.activeRestaurant.id);
      } catch (err) {
        if (err.message === "publish_gate_failed") {
          modelJobMsg.textContent =
            "Publicacao bloqueada: faltam modelos GLB+USDZ ou score de QA abaixo do minimo.";
        } else {
          modelJobMsg.textContent = "Falha ao publicar job.";
        }
      } finally {
        publishJobButton.disabled = false;
      }
    });

    uploadImagesButton.addEventListener("click", async () => {
      const input = row.querySelector("[data-field='job-images']");
      if (!input || !input.files || input.files.length === 0) {
        modelJobMsg.textContent = "Selecione fotos antes de enviar.";
        return;
      }
      uploadImagesButton.disabled = true;
      modelJobMsg.textContent = "";
      try {
        await uploadModelJobReferenceImages(job.id, input.files);
        modelJobMsg.textContent = "Fotos enviadas para o job.";
        input.value = "";
        await loadModelJobs(state.activeRestaurant.id);
      } catch (err) {
        modelJobMsg.textContent = "Falha ao enviar fotos para o job.";
      } finally {
        uploadImagesButton.disabled = false;
      }
    });

    deleteJobButton.addEventListener("click", () => {
      deleteModelJob(job);
    });

    modelJobsList.appendChild(row);
  });
}

function renderOrders() {
  ordersCount.textContent = `${state.orders.length} pedidos`;
  ordersList.innerHTML = "";

  if (state.orders.length === 0) {
    ordersList.innerHTML = "<div class=\"muted\">Sem pedidos por enquanto.</div>";
    return;
  }

  state.orders.forEach((order) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const totalItems = order.items.reduce((acc, item) => acc + item.qty, 0);
    const itemsLabel = `${totalItems} itens`;
    const statusClass = `status-badge status-${order.status}`;
    row.innerHTML = `
      <div>
        <div><strong>Mesa ${order.table}</strong></div>
        <div class="muted">${itemsLabel} · R$ ${Number(order.total).toFixed(2)}</div>
      </div>
      <div class="${statusClass}">${order.status}</div>
      <div class="table-actions">
        ${renderOrderActions(order.status)}
      </div>
    `;

    row.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        updateOrderStatus(order.id, button.dataset.status);
      });
    });

    ordersList.appendChild(row);
  });
}

function renderOrderActions(status) {
  if (status === "entregue" || status === "cancelado") {
    return "<span class=\"muted\">Finalizado</span>";
  }
  if (status === "aceito") {
    return `
      <button class="btn btn-outline" data-status="entregue">Entregar</button>
      <button class="btn btn-outline" data-status="cancelado">Cancelar</button>
    `;
  }
  return `
    <button class="btn btn-outline" data-status="aceito">Aceitar</button>
    <button class="btn btn-outline" data-status="cancelado">Cancelar</button>
  `;
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function renderAnalyticsRowList(container, rows, valueLabel) {
  if (!container) return;
  container.innerHTML = "";
  if (!rows || rows.length === 0) {
    container.innerHTML = "<div class=\"muted\">Sem dados nesta janela.</div>";
    return;
  }
  rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "analytics-line";
    el.innerHTML = `
      <strong>${row.itemName || "Item"}</strong>
      <span class="muted">${valueLabel}: ${row.opens ?? row.qty ?? 0}</span>
    `;
    container.appendChild(el);
  });
}

function renderAnalyticsAlerts(summary, conversion) {
  if (!analyticsAlerts) return;
  const alerts = [];
  const menuViews = Number(summary.menuViews || 0);
  const arOpens = Number(summary.arOpens || 0);
  const orders = Number(summary.ordersTotal || 0);
  const menuToAr = Number(conversion.menuToAr || 0);
  const arToOrder = Number(conversion.arToOrder || 0);

  if (menuViews >= 80 && menuToAr < 10) {
    alerts.push(
      "Baixa conversao de menu para AR. Priorize foto melhor no cardapio e destaque do botao de AR nos pratos principais."
    );
  }
  if (arOpens >= 30 && arToOrder < 12) {
    alerts.push(
      "Baixa conversao de AR para pedido. Revise escala do modelo, realismo da textura e descricao do prato."
    );
  }
  if (menuViews >= 100 && orders === 0) {
    alerts.push(
      "Ha visualizacoes do menu sem pedidos. Verifique fluxo de mesa, botao de pedido e tempo de resposta do atendimento."
    );
  }
  if (alerts.length === 0) {
    alerts.push("Funil estavel nesta janela. Continue testando novos modelos 3D para aumentar conversao.");
  }

  analyticsAlerts.innerHTML = "";
  alerts.forEach((text) => {
    const row = document.createElement("div");
    row.className = "analytics-alert";
    row.textContent = text;
    analyticsAlerts.appendChild(row);
  });
}

function renderAnalytics(data) {
  if (!analyticsSummary || !analyticsTopAr || !analyticsTopOrders) return;
  if (!data) {
    analyticsSummary.innerHTML = "<div class=\"muted\">Sem analytics para exibir.</div>";
    analyticsTopAr.innerHTML = "<div class=\"muted\">Sem dados.</div>";
    analyticsTopOrders.innerHTML = "<div class=\"muted\">Sem dados.</div>";
    if (analyticsAlerts) analyticsAlerts.innerHTML = "";
    return;
  }

  const summary = data.summary || {};
  const conversion = data.conversion || {};
  const cards = [
    { label: "Pedidos", value: summary.ordersTotal || 0 },
    { label: "Receita", value: formatCurrency(summary.revenueTotal || 0) },
    { label: "Ticket medio", value: formatCurrency(summary.avgTicket || 0) },
    { label: "Views menu", value: summary.menuViews || 0 },
    { label: "Aberturas AR", value: summary.arOpens || 0 },
    { label: "Add no carrinho", value: summary.addToCart || 0 },
    { label: "Conv. menu -> AR", value: `${Number(conversion.menuToAr || 0).toFixed(1)}%` },
    { label: "Conv. AR -> pedido", value: `${Number(conversion.arToOrder || 0).toFixed(1)}%` }
  ];

  analyticsSummary.innerHTML = "";
  cards.forEach((card) => {
    const el = document.createElement("article");
    el.className = "analytics-card";
    el.innerHTML = `
      <div class="label">${card.label}</div>
      <div class="value">${card.value}</div>
    `;
    analyticsSummary.appendChild(el);
  });

  renderAnalyticsRowList(analyticsTopAr, data.topArItems || [], "AR");
  renderAnalyticsRowList(analyticsTopOrders, data.topOrderedItems || [], "Qtd");
  renderAnalyticsAlerts(summary, conversion);
}

function loadItemIntoForm(item) {
  document.getElementById("item-id").value = item.id;
  document.getElementById("item-name").value = item.name || "";
  document.getElementById("item-price").value = item.price || 0;
  document.getElementById("item-desc").value = item.description || "";
  document.getElementById("item-image-url").value = item.image || "";
  document.getElementById("item-model-glb").value = item.modelGlb || "";
  document.getElementById("item-model-usdz").value = item.modelUsdz || "";
}

function openQr(item) {
  const url = `${window.location.origin}/i/${item.id}`;
  qrLink.textContent = url;
  QRCode.toDataURL(url, { width: 240 }, (err, dataUrl) => {
    if (!err) {
      qrImage.src = dataUrl;
      qrModal.classList.remove("hidden");
    }
  });
}

async function uploadItemAssets(itemId) {
  const imageFile = document.getElementById("item-image-file").files[0];
  const glbFile = document.getElementById("item-model-glb-file").files[0];
  const usdzFile = document.getElementById("item-model-usdz-file").files[0];

  if (!imageFile && !glbFile && !usdzFile) return;

  const form = new FormData();
  if (imageFile) form.append("image", imageFile);
  if (glbFile) form.append("modelGlb", glbFile);
  if (usdzFile) form.append("modelUsdz", usdzFile);

  await api(`/api/items/${itemId}/assets`, {
    method: "POST",
    body: form,
    isForm: true
  });

  document.getElementById("item-image-file").value = "";
  document.getElementById("item-model-glb-file").value = "";
  document.getElementById("item-model-usdz-file").value = "";
}

async function selectRestaurant(id) {
  const restaurant = state.restaurants.find((r) => r.id === id);
  if (!restaurant) return;
  state.activeRestaurant = restaurant;
  managePanel.classList.remove("hidden");
  restaurantsPanel.classList.add("hidden");
  manageTitle.textContent = `Gerenciar ${restaurant.name}`;
  fillRestaurantForm(restaurant);
  if (modelJobsAutoMsg) modelJobsAutoMsg.textContent = "";
  if (state.user.role === "master") {
    clientUserPanel.classList.remove("hidden");
  } else {
    clientUserPanel.classList.add("hidden");
  }
  await loadItems(id);
  await loadOrders(id);
  await loadModelJobs(id);
  await loadAnalytics(id);
  if (lizzWidget) lizzWidget.classList.remove("hidden");
}

function appendLizzMessage(text, from = "bot") {
  if (!lizzMessages) return;
  const bubble = document.createElement("div");
  bubble.className = `lizz-msg ${from}`;
  bubble.textContent = text;
  lizzMessages.appendChild(bubble);
  lizzMessages.scrollTop = lizzMessages.scrollHeight;
}

function scrollToPanel(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getLizzResponse(message) {
  const text = (message || "").toLowerCase();
  if (!text.trim()) {
    return {
      reply: "Escreva sua duvida e eu te ajudo com o painel."
    };
  }

  if (
    text.includes("abrir criacao de item") ||
    text.includes("novo item") ||
    text.includes("cadastrar item")
  ) {
    return {
      reply: "Abrindo a secao de criacao de item para voce.",
      action: () => scrollToPanel(sectionItems)
    };
  }

  if (text.includes("abrir fila 3d") || text.includes("fila 3d")) {
    return {
      reply: "Te levei para a fila 3D. Aqui voce cria e acompanha jobs.",
      action: () => scrollToPanel(sectionModelJobs)
    };
  }

  if (text.includes("abrir pedido") || text.includes("pedidos")) {
    return {
      reply: "Aqui estao os pedidos. Voce pode aceitar, entregar ou cancelar.",
      action: () => scrollToPanel(sectionOrders)
    };
  }

  if (text.includes("restaurante") || text.includes("editar restaurante")) {
    return {
      reply: "Abrindo os dados do restaurante para edicao.",
      action: () => scrollToPanel(sectionRestaurant)
    };
  }

  if (text.includes("item") || text.includes("prato")) {
    return {
      reply:
        "Para criar item: use 'Criar ou editar item', preencha nome/preco e clique em 'Salvar item'. Depois adicione GLB/USDZ ou envie arquivos."
    };
  }
  if (text.includes("3d") || text.includes("ia") || text.includes("meshy")) {
    return {
      reply:
        "Para gerar 3D: crie um job em 'Fila 3D', escolha prato, fonte e provedor. Em seguida clique 'Rodar IA' e depois 'Sincronizar'."
    };
  }
  if (text.includes("qa") || text.includes("qualidade")) {
    return {
      reply:
        "No job 3D, use 'Avaliar QA'. O sistema calcula score (0-100). Para publicar, precisa GLB+USDZ e score minimo."
    };
  }
  if (text.includes("public") || text.includes("cardapio")) {
    return {
      reply:
        "Para publicar no cardapio: no job 3D preencha GLB/USDZ, mude status para 'publicado' e salve. O item passa a abrir AR."
    };
  }
  if (text.includes("qr")) {
    return {
      reply:
        "No bloco 'Itens do menu', clique em 'QR' do prato para gerar o link direto da mesa."
    };
  }
  if (text.includes("pedido")) {
    return {
      reply: "Acompanhe em 'Pedidos'. Use os botoes para aceitar, entregar ou cancelar."
    };
  }
  if (text.includes("analytics") || text.includes("metrica") || text.includes("conversao")) {
    return {
      reply:
        "Abra a secao Analytics para ver funil menu->AR->pedido, receita e top itens. Ajuste a janela em dias para comparar performance."
    };
  }
  if (text.includes("delet") || text.includes("excluir")) {
    return {
      reply:
        "Use o botao 'Excluir' no item ou no job da fila. O sistema remove os dados relacionados automaticamente."
    };
  }
  if (text.includes("automacao") || text.includes("auto processar") || text.includes("rodar fila")) {
    return {
      reply:
        "Use o botao 'Rodar automacao' na Fila 3D. Ele inicia jobs automaticos, sincroniza IA e publica quando passar no QA."
    };
  }
  return {
    reply:
      "Posso te ajudar com: criar item, gerar 3D, publicar no cardapio, QR e pedidos."
  };
}

function runLizzInteraction(text) {
  if (!text) return;
  appendLizzMessage(text, "user");
  const result = getLizzResponse(text);
  window.setTimeout(() => {
    appendLizzMessage(result.reply, "bot");
    if (typeof result.action === "function") {
      result.action();
    }
  }, 180);
}

function initLizzChatbot() {
  if (!lizzWidget || !lizzToggle || !lizzPanel || !lizzMessages || !lizzForm || !lizzInput) {
    return;
  }

  if (lizzMessages.childElementCount === 0) {
    appendLizzMessage(
      "Oi, eu sou a Lizz. Posso te ajudar a cadastrar pratos, gerar 3D e publicar no cardapio."
    );
  }

  lizzToggle.addEventListener("click", () => {
    lizzPanel.classList.toggle("hidden");
  });

  if (lizzClose) {
    lizzClose.addEventListener("click", () => {
      lizzPanel.classList.add("hidden");
    });
  }

  lizzForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = lizzInput.value.trim();
    if (!text) return;
    runLizzInteraction(text);
    lizzInput.value = "";
  });

  document.querySelectorAll("[data-lizz-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.getAttribute("data-lizz-quick") || "";
      runLizzInteraction(question);
    });
  });
}

async function loadItems(restaurantId) {
  const data = await api(`/api/restaurants/${restaurantId}/items`);
  state.items = data.items || [];
  renderItems();
}

async function loadModelJobs(restaurantId) {
  try {
    const data = await api(`/api/restaurants/${restaurantId}/model-jobs`);
    state.modelJobs = (data.jobs || []).map((job) => ({
      provider: "manual",
      aiModel: "",
      providerTaskId: "",
      providerStatus: "",
      referenceImages: [],
      ...job
    }));
    renderModelJobs();
  } catch (err) {
    state.modelJobs = [];
    modelJobsCount.textContent = "0 jobs";
    modelJobsList.innerHTML = "<div class=\"muted\">Erro ao carregar fila 3D.</div>";
  }
}

async function loadOrders(restaurantId) {
  try {
    const data = await api(`/api/restaurants/${restaurantId}/orders`);
    state.orders = data.orders || [];
    renderOrders();
  } catch (err) {
    ordersList.innerHTML = "<div class=\"muted\">Erro ao carregar pedidos.</div>";
  }
}

async function loadAnalytics(restaurantId) {
  if (!analyticsSummary || !analyticsTopAr || !analyticsTopOrders) return;
  const days = Number((analyticsDays && analyticsDays.value) || 30) || 30;
  try {
    const data = await api(`/api/restaurants/${restaurantId}/analytics?days=${days}`);
    renderAnalytics(data.analytics || null);
  } catch (err) {
    analyticsSummary.innerHTML = "<div class=\"muted\">Erro ao carregar analytics.</div>";
    analyticsTopAr.innerHTML = "<div class=\"muted\">Erro ao carregar dados.</div>";
    analyticsTopOrders.innerHTML = "<div class=\"muted\">Erro ao carregar dados.</div>";
  }
}

async function loadRestaurants() {
  const data = await api("/api/restaurants");
  state.restaurants = data.restaurants || [];
  renderRestaurants();
}

async function bootstrapDashboard() {
  await loadAiProviders();
  if (state.user.role === "master") {
    restaurantsPanel.classList.remove("hidden");
    backRestaurants.classList.remove("hidden");
    clientUserPanel.classList.remove("hidden");
    await loadRestaurants();
  } else {
    restaurantsPanel.classList.add("hidden");
    backRestaurants.classList.add("hidden");
    clientUserPanel.classList.add("hidden");
    await loadRestaurantsForClient();
  }
}

async function loadRestaurantsForClient() {
  const data = await api("/api/my-restaurant");
  if (data.restaurant) {
    state.restaurants = [data.restaurant];
    await selectRestaurant(data.restaurant.id);
  }
}

async function updateOrderStatus(orderId, status) {
  if (!state.activeRestaurant) return;
  try {
    await api(`/api/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    await loadOrders(state.activeRestaurant.id);
    await loadAnalytics(state.activeRestaurant.id);
  } catch (err) {
    // ignore
  }
}

async function deleteItem(item) {
  if (!state.activeRestaurant) return;
  const confirmed = window.confirm(
    `Excluir o item "${item.name}"? Essa acao remove os scans e jobs 3D vinculados.`
  );
  if (!confirmed) return;

  try {
    await api(`/api/items/${item.id}`, { method: "DELETE" });
    if (state.scanItemId === item.id) {
      stopScanner();
      state.scanItemId = null;
      scannerView.classList.add("hidden");
      scannerInfo.textContent =
        "Selecione um item para capturar fotos. Essas fotos podem ser usadas depois para gerar o modelo 3D.";
      scanCount.textContent = "";
      scanThumbs.innerHTML = "";
    }
    if (document.getElementById("item-id").value === item.id) {
      itemForm.reset();
      document.getElementById("item-id").value = "";
    }
    await loadItems(state.activeRestaurant.id);
    await loadModelJobs(state.activeRestaurant.id);
  } catch (err) {
    alert("Nao foi possivel excluir o item agora.");
  }
}

async function deleteModelJob(job) {
  if (!state.activeRestaurant) return;
  const item = state.items.find((entry) => entry.id === job.itemId);
  const itemLabel = item ? item.name : job.itemId;
  const confirmed = window.confirm(
    `Excluir o job 3D do item "${itemLabel}"?`
  );
  if (!confirmed) return;

  try {
    await api(`/api/model-jobs/${job.id}`, { method: "DELETE" });
    await loadModelJobs(state.activeRestaurant.id);
  } catch (err) {
    alert("Nao foi possivel excluir o job agora.");
  }
}

async function openScanner(item) {
  stopScanner();
  state.scanItemId = item.id;
  scannerInfo.textContent = `Capturando fotos para ${item.name}.`;
  scannerView.classList.remove("hidden");
  scanThumbs.innerHTML = "";
  const currentCount = (item.scans || []).length;
  scanCount.textContent = currentCount ? `${currentCount} fotos capturadas` : "";
  (item.scans || []).slice(-6).reverse().forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    scanThumbs.appendChild(img);
  });
  await startScanner();
}

async function startScanner() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    state.scanStream = stream;
    scanVideo.srcObject = stream;
  } catch (err) {
    scanCount.textContent = "Permissao de camera negada.";
  }
}

function stopScanner() {
  if (state.scanStream) {
    state.scanStream.getTracks().forEach((track) => track.stop());
    state.scanStream = null;
  }
  scanVideo.srcObject = null;
}

initThemeSelector();
initRestaurantLanguageControls();
initLizzChatbot();
init();
