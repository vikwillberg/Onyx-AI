const API_BASE = "";
const THEME_KEY = "theme";

const LAST_PROJECT_KEY = "lastProjectId";
const SESSION_KEY = "onyxSession";

function saveSession() {
  try {
    const data = {
      step: state.step,
      projectId: state.currentProject?.id || null,
      datasetId: state.currentDataset?.id || null,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (_e) { /* ignore */ }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}

const state = {
  token: localStorage.getItem("token"),
  email: localStorage.getItem("email"),
  projects: [],
  projectSummaries: {},
  datasets: [],
  currentProject: null,
  currentDataset: null,
  datasetDetail: null,
  mergePlan: [],
  sampleVisuals: [],
  selectedVisualIds: new Set(),
  finalVisuals: [],
  dashboardFilters: [],
  datePreset: "all",
  customDateRange: { start: null, end: null },
  categoryFilters: [],
  grid: null,
  gridBound: false,
  step: "upload",
  pendingStep: null,
  pendingFiles: [],
  authPrompted: false,
  editingVisualId: null,
  theme: localStorage.getItem(THEME_KEY) || "light",
  businessCategory: null,
  businessContext: {},
  sidebarCollapsed: false,
  duelRounds: [],
  duelKpis: [],
  duelCurrentRound: 0,
  duelPicked: [],
  duelPoolSize: 0,
  duelBusy: false,
};

const CHART_COLORS = {
  primary: "#b45309",
  secondary: "#0d9488",
  accent: "#f59e0b",
  palette: ["#b45309", "#0d9488", "#6366f1", "#059669", "#e11d48", "#0ea5e9", "#d97706", "#8b5cf6", "#14b8a6", "#f43f5e", "#64748b", "#fbbf24"],
};

const PLOTLY_THEMES = {
  dark: {
    axisTitle: "#a8a29e",
    axisTick: "#d6d3d1",
    legend: "#d6d3d1",
    grid: "rgba(41, 37, 36, 0.6)",
    font: "#fafaf9",
    line: "rgba(41, 37, 36, 0.7)",
    paper: "#1c1917",
    plot: "#1c1917",
  },
  light: {
    axisTitle: "#78716c",
    axisTick: "#44403c",
    legend: "#44403c",
    grid: "rgba(231, 229, 228, 0.8)",
    font: "#1c1917",
    line: "rgba(231, 229, 228, 1)",
    paper: "#ffffff",
    plot: "#ffffff",
  },
};

const KPI_NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const KPI_CURRENCY_FORMAT = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const VISUAL_TYPES = [
  { value: "bar", label: "Bar chart" },
  { value: "line", label: "Line chart" },
  { value: "pie", label: "Pie chart" },
  { value: "scatter", label: "Scatter plot" },
  { value: "histogram", label: "Histogram" },
  { value: "table", label: "Table" },
  { value: "map", label: "Map" },
];

const AGGREGATIONS = [
  { value: "count", label: "Count" },
  { value: "mean", label: "Average" },
  { value: "sum", label: "Sum" },
  { value: "median", label: "Median" },
];

const elements = {
  authSection: document.getElementById("auth-section"),
  authModal: document.getElementById("auth-modal"),
  authClose: document.getElementById("auth-close"),
  projectsSection: document.getElementById("projects-section"),
  categorySection: document.getElementById("category-section"),
  setupSection: document.getElementById("setup-section"),
  datasetSection: document.getElementById("dataset-section"),
  mergeSection: document.getElementById("merge-section"),
  visualsSection: document.getElementById("visuals-section"),
  dashboardSection: document.getElementById("dashboard-section"),
  saveSection: document.getElementById("save-section"),
  sessionEmail: document.getElementById("session-email"),
  loginBtn: document.getElementById("login-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  projectList: document.getElementById("project-list"),
  projectListSkeleton: document.getElementById("project-list-skeleton"),
  projectsEmpty: document.getElementById("projects-empty"),
  datasetList: document.getElementById("dataset-list"),
  datasetsEmpty: document.getElementById("datasets-empty"),
  datasetProfile: document.getElementById("dataset-profile"),
  mergeSuggestions: document.getElementById("merge-suggestions"),
  mergePlan: document.getElementById("merge-plan"),
  manualMerge: document.getElementById("manual-merge"),
  sampleVisuals: document.getElementById("sample-visuals"),
  selectedVisuals: document.getElementById("selected-visuals"),
  dashboardGrid: document.getElementById("dashboard-grid"),
  toast: document.getElementById("toast"),
  uploadDropZone: document.getElementById("upload-drop-zone"),
  uploadFiles: document.getElementById("upload-files"),
  selectedFiles: document.getElementById("selected-files"),
  uploadContinueBtn: document.getElementById("upload-continue-btn"),
  projectSetupForm: document.getElementById("project-setup-form"),
  projectSetupCard: document.getElementById("project-setup-card"),
  dataPreviewCard: document.getElementById("data-preview-card"),
  dataPreviewTable: document.getElementById("data-preview-table"),
  datasetNameHint: document.getElementById("dataset-name-hint"),
  currentProjectName: document.getElementById("current-project-name"),
  headerProjectName: document.getElementById("header-project-name"),
  dashboardProjectTitle: document.getElementById("dashboard-project-title"),
  headerNav: document.getElementById("header-nav"),
  projectLoginHint: document.getElementById("project-login-hint"),
  themeToggle: document.getElementById("theme-toggle"),
  backToMenu: document.getElementById("back-to-menu"),
  addVisualModal: document.getElementById("add-visual-modal"),
  addVisualForm: document.getElementById("add-visual-form"),
  addVisualBtn: document.getElementById("add-visual"),
  closeAddVisual: document.getElementById("close-add-visual"),
  continueSave: document.getElementById("continue-save"),
  saveStatus: document.getElementById("save-status"),
  saveLoginCta: document.getElementById("save-login-cta"),
  saveStartOver: document.getElementById("save-start-over"),
  stepIndicator: document.getElementById("step-indicator"),
  categoryGrid: document.getElementById("category-grid"),
  categoryQuestions: document.getElementById("category-questions"),
  categoryContinue: document.getElementById("category-continue"),
  kpiStrip: document.getElementById("kpi-strip"),
  filterBar: document.getElementById("filter-bar"),
  filterBarDates: document.getElementById("filter-bar-dates"),
  customDateRange: document.getElementById("custom-date-range"),
  dateRangeStart: document.getElementById("date-range-start"),
  dateRangeEnd: document.getElementById("date-range-end"),
  filterCountBadge: document.getElementById("filter-count-badge"),
  clearAllFilters: document.getElementById("clear-all-filters"),
  dashboardEmpty: document.getElementById("dashboard-empty"),
  exportCsv: document.getElementById("export-csv"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmOk: document.getElementById("confirm-ok"),
  confirmCancel: document.getElementById("confirm-cancel"),
  duelSection: document.getElementById("duel-section"),
  duelArena: document.getElementById("duel-arena"),
  duelChartA: document.getElementById("duel-chart-a"),
  duelChartB: document.getElementById("duel-chart-b"),
  duelTitleA: document.getElementById("duel-title-a"),
  duelTitleB: document.getElementById("duel-title-b"),
  duelTypeA: document.getElementById("duel-type-a"),
  duelTypeB: document.getElementById("duel-type-b"),
  duelCardA: document.getElementById("duel-card-a"),
  duelCardB: document.getElementById("duel-card-b"),
  duelProgressFill: document.getElementById("duel-progress-fill"),
  duelRoundLabel: document.getElementById("duel-round-label"),
  duelPickedBadge: document.getElementById("duel-picked-badge"),
  duelSkip: document.getElementById("duel-skip"),
  duelDone: document.getElementById("duel-done"),
  duelDoneCount: document.getElementById("duel-done-count"),
};

const stepSections = {
  upload: [elements.projectsSection],
  category: [elements.categorySection],
  setup: [elements.setupSection],
  duel: [elements.duelSection],
  dataset: [elements.datasetSection],
  merge: [elements.mergeSection],
  dashboard: [elements.dashboardSection],
  save: [elements.saveSection],
};
const allStepSections = Object.values(stepSections).flat();

function showToast(message, timeout = 2200) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  setTimeout(() => elements.toast.classList.add("hidden"), timeout);
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  state.theme = nextTheme;
  document.body.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
}

function toggleTheme() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
  if (state.step === "dashboard") {
    renderDashboard();
  }
}

function updateCurrentProjectName() {
  const projectName = state.currentProject?.name || "";
  if (elements.currentProjectName) {
    elements.currentProjectName.textContent = projectName;
  }
  if (elements.dashboardProjectTitle) {
    const title = state.currentDataset?.name || projectName;
    elements.dashboardProjectTitle.textContent = title && title !== "—" ? title : "Dashboard";
  }
}

function formatProjectDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function updateProjectSummary(projectId, datasets = []) {
  if (!projectId) return;
  const project = state.projects.find((item) => item.id === projectId);
  const createdAt = project?.created_at;
  let latest = null;
  datasets.forEach((dataset) => {
    if (!latest) {
      latest = dataset;
      return;
    }
    const latestDate = new Date(latest.created_at || 0);
    const nextDate = new Date(dataset.created_at || 0);
    if (nextDate > latestDate) {
      latest = dataset;
    }
  });
  state.projectSummaries[projectId] = {
    createdAt,
    datasetName: latest?.name || "—",
    latestDatasetDate: latest?.created_at || createdAt,
  };
}

function setSectionVisibility(section, visible) {
  section.classList.toggle("hidden", !visible);
}

function openAuthModal() {
  if (!elements.authModal) return;
  elements.authModal.classList.remove("hidden");
}

function closeAuthModal() {
  if (!elements.authModal) return;
  elements.authModal.classList.add("hidden");
}

function setStep(step) {
  state.step = step;
  allStepSections.forEach((section) => {
    if (section) section.classList.toggle("hidden", !stepSections[step]?.includes(section));
  });
  if (step !== "dashboard" && elements.addVisualModal) {
    elements.addVisualModal.classList.add("hidden");
    state.editingVisualId = null;
  }
  if (step === "save") {
    updateSaveSection();
    if (!state.token && !state.authPrompted) {
      openAuthModal();
      state.authPrompted = true;
    }
  }
  if (step === "dashboard") {
    renderKpiStrip();
    updateFilterBar();
    requestAnimationFrame(() => {
      elements.dashboardGrid
        ?.querySelectorAll(".chart")
        .forEach((chart) => Plotly.Plots.resize(chart));
    });
  }
  const showFilterBar = step === "dashboard";
  elements.filterBar?.classList.toggle("hidden", !showFilterBar);
  elements.kpiStrip?.classList.toggle("hidden", !showFilterBar);
  /* Show nav pills only on dashboard step */
  elements.headerNav?.classList.toggle("hidden", step !== "dashboard");
  updateStepIndicator(step);
  saveSession();
}

const STEP_ORDER = ["upload", "category", "setup", "duel", "dashboard"];
const STEP_LABELS = { upload: "Upload", category: "Category", setup: "Details", duel: "Pick Visuals", dashboard: "Dashboard" };

function updateStepIndicator(step) {
  if (!elements.stepIndicator) return;
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0) {
    elements.stepIndicator.classList.add("hidden");
    return;
  }
  elements.stepIndicator.classList.remove("hidden");
  elements.stepIndicator.innerHTML = STEP_ORDER.map((s, i) => {
    const cls = i < idx ? "completed" : i === idx ? "active" : "";
    const connector = i < STEP_ORDER.length - 1 ? '<div class="step-connector"></div>' : "";
    return `<div class="step-item ${cls}"><div class="step-num">${i + 1}</div><div class="step-label">${STEP_LABELS[s]}</div></div>${connector}`;
  }).join("");
}

function updateSaveSection() {
  if (!elements.saveStatus) return;
  if (state.token) {
    elements.saveStatus.textContent = "Your dashboard is saved to this project and tied to your account.";
    elements.saveLoginCta.classList.add("hidden");
  } else {
    elements.saveStatus.textContent =
      "You are working as a guest. Log in to save this dashboard to your account for later.";
    elements.saveLoginCta.classList.remove("hidden");
  }
}

function resetUploadFlow() {
  state.pendingFiles = [];
  state.businessCategory = null;
  state.businessContext = {};
  if (elements.uploadFiles) elements.uploadFiles.value = "";
  if (elements.projectSetupForm) elements.projectSetupForm.reset();
  if (elements.selectedFiles) { elements.selectedFiles.innerHTML = ""; elements.selectedFiles.classList.add("hidden"); }
  if (elements.datasetNameHint) elements.datasetNameHint.textContent = "";
  if (elements.dataPreviewCard) elements.dataPreviewCard.classList.add("hidden");
}

/* ===== Confirmation Dialog ===== */
function showConfirm(title, message) {
  return new Promise((resolve) => {
    if (!elements.confirmModal) { resolve(true); return; }
    if (elements.confirmTitle) elements.confirmTitle.textContent = title;
    if (elements.confirmMessage) elements.confirmMessage.textContent = message;
    elements.confirmModal.classList.remove("hidden");
    const cleanup = () => {
      elements.confirmModal.classList.add("hidden");
      elements.confirmOk.removeEventListener("click", onOk);
      elements.confirmCancel.removeEventListener("click", onCancel);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    elements.confirmOk.addEventListener("click", onOk);
    elements.confirmCancel.addEventListener("click", onCancel);
  });
}

/* ===== Drag-Drop Upload Zone ===== */
function initDropZone() {
  const zone = elements.uploadDropZone;
  if (!zone) return;
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(csv|xlsx|xls|json)$/i.test(f.name)
    );
    if (!files.length) { showToast("Drop CSV, Excel, or JSON files"); return; }
    handleFilesSelected(files);
  });
}

function handleFilesSelected(files) {
  state.pendingFiles = files;
  showFileChips(files);
  if (elements.uploadContinueBtn) elements.uploadContinueBtn.disabled = false;
  showDataPreview(files[0]);
}

function showFileChips(files) {
  if (!elements.selectedFiles) return;
  if (!files.length) { elements.selectedFiles.innerHTML = ""; elements.selectedFiles.classList.add("hidden"); return; }
  elements.selectedFiles.classList.remove("hidden");
  elements.selectedFiles.innerHTML = files.map((f, i) => {
    const size = f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`;
    return `<div class="file-chip"><span>${f.name}</span><span class="file-chip-size">${size}</span><span class="file-chip-remove" data-idx="${i}">&times;</span></div>`;
  }).join("");
  elements.selectedFiles.querySelectorAll(".file-chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.pendingFiles.splice(Number(btn.dataset.idx), 1);
      showFileChips(state.pendingFiles);
      if (!state.pendingFiles.length && elements.uploadContinueBtn) elements.uploadContinueBtn.disabled = true;
    });
  });
}

async function showDataPreview(file) {
  if (!file || !elements.dataPreviewCard || !elements.dataPreviewTable) return;
  if (!file.name.endsWith(".csv")) { elements.dataPreviewCard.classList.add("hidden"); return; }
  try {
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean).slice(0, 6);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    elements.dataPreviewTable.innerHTML = `
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    elements.dataPreviewCard.classList.remove("hidden");
  } catch (_e) { elements.dataPreviewCard.classList.add("hidden"); }
}

/* ===== Category Wizard ===== */
const CATEGORIES = [
  { key: "restaurant", icon: "🍽️", label: "Restaurant" },
  { key: "coffee_shop", icon: "☕", label: "Coffee Shop" },
  { key: "ecommerce", icon: "🛒", label: "E-Commerce" },
  { key: "retail", icon: "🏪", label: "Retail" },
  { key: "saas", icon: "☁️", label: "SaaS" },
  { key: "finance", icon: "💰", label: "Finance" },
  { key: "healthcare", icon: "🏥", label: "Healthcare" },
  { key: "education", icon: "🎓", label: "Education" },
  { key: "marketing", icon: "📢", label: "Marketing" },
  { key: "logistics", icon: "🚚", label: "Logistics" },
  { key: "real_estate", icon: "🏠", label: "Real Estate" },
  { key: "general", icon: "📊", label: "General" },
];

const CATEGORY_QUESTIONS = {
  restaurant: [
    { id: "focus_area", label: "What insight matters most?", options: ["Best sellers", "Revenue trends", "Peak hours", "Category mix"] },
    { id: "comparison_dimension", label: "Compare performance by?", options: ["Menu item", "Category", "Day of week", "Server"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  coffee_shop: [
    { id: "focus_area", label: "What insight matters most?", options: ["Peak hours", "Best sellers", "Product mix", "Revenue trends"] },
    { id: "comparison_dimension", label: "Compare performance by?", options: ["Drink", "Category", "Size", "Time of day"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  ecommerce: [
    { id: "focus_area", label: "What insight matters most?", options: ["Top products", "Revenue trends", "Customer segments", "Channel performance"] },
    { id: "metric_focus", label: "Primary metric?", options: ["Revenue", "Orders", "AOV", "Conversion"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  retail: [
    { id: "focus_area", label: "What insight matters most?", options: ["Top products", "Store comparison", "Revenue trends", "Inventory"] },
    { id: "comparison_dimension", label: "Compare across?", options: ["Store", "Region", "Product", "Category"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  saas: [
    { id: "focus_area", label: "What insight matters most?", options: ["MRR growth", "Churn analysis", "Plan distribution", "User activity"] },
    { id: "metric_focus", label: "Primary metric?", options: ["MRR", "ARR", "Churn rate", "LTV"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Weekly", "Monthly", "Quarterly"] },
  ],
  finance: [
    { id: "focus_area", label: "What insight matters most?", options: ["P&L overview", "Expense breakdown", "Revenue trends", "Cash flow"] },
    { id: "metric_focus", label: "Primary metric?", options: ["Revenue", "Profit", "Expenses", "Cash flow"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Weekly", "Monthly", "Quarterly"] },
  ],
  healthcare: [
    { id: "focus_area", label: "What insight matters most?", options: ["Patient volume", "Wait times", "Department load", "Diagnosis patterns"] },
    { id: "comparison_dimension", label: "Compare across?", options: ["Department", "Doctor", "Diagnosis", "Time period"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  education: [
    { id: "focus_area", label: "What insight matters most?", options: ["Student performance", "Enrollment trends", "Attendance", "Grade distribution"] },
    { id: "comparison_dimension", label: "Compare across?", options: ["Subject", "Class", "Teacher", "Term"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Weekly", "Monthly", "Per semester"] },
  ],
  marketing: [
    { id: "focus_area", label: "What insight matters most?", options: ["Channel ROI", "Campaign performance", "Spend trends", "Conversion funnel"] },
    { id: "metric_focus", label: "Primary metric?", options: ["Conversions", "ROAS", "CTR", "Spend"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  logistics: [
    { id: "focus_area", label: "What insight matters most?", options: ["Delivery times", "Shipment volume", "Carrier performance", "Route analysis"] },
    { id: "comparison_dimension", label: "Compare across?", options: ["Carrier", "Region", "Route", "Warehouse"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Daily", "Weekly", "Monthly"] },
  ],
  real_estate: [
    { id: "focus_area", label: "What insight matters most?", options: ["Sales trends", "Agent performance", "Price analysis", "Property types"] },
    { id: "metric_focus", label: "Primary metric?", options: ["Commission", "Sale price", "Transactions", "Days on market"] },
    { id: "review_frequency", label: "How often do you review?", options: ["Weekly", "Monthly", "Quarterly"] },
  ],
};

function renderCategoryGrid() {
  if (!elements.categoryGrid) return;
  elements.categoryGrid.innerHTML = CATEGORIES.map((cat) =>
    `<button type="button" class="category-card${state.businessCategory === cat.key ? " selected" : ""}" data-cat="${cat.key}">
      <span class="category-icon">${cat.icon}</span>
      <span class="category-label">${cat.label}</span>
    </button>`
  ).join("");
  elements.categoryGrid.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.businessCategory = card.dataset.cat;
      state.businessContext = {};
      renderCategoryGrid();
      renderCategoryQuestions();
    });
  });
}

function renderCategoryQuestions() {
  if (!elements.categoryQuestions) return;
  const questions = CATEGORY_QUESTIONS[state.businessCategory];
  if (!questions || !questions.length) {
    elements.categoryQuestions.classList.add("hidden");
    return;
  }
  elements.categoryQuestions.classList.remove("hidden");
  elements.categoryQuestions.innerHTML = questions.map((q) =>
    `<div class="question-group"><div class="question-label">${q.label}</div>
    <div class="question-options">${q.options.map((o) =>
      `<button type="button" class="pill-option${state.businessContext[q.id] === o ? " selected" : ""}" data-qid="${q.id}" data-val="${o}">${o}</button>`
    ).join("")}</div></div>`
  ).join("");
  elements.categoryQuestions.querySelectorAll(".pill-option").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.businessContext[pill.dataset.qid] = pill.dataset.val;
      renderCategoryQuestions();
    });
  });
}

/* ===== KPI Strip ===== */
function renderKpiStrip() {
  if (!elements.kpiStrip) return;
  const kpis = state.finalVisuals.filter((v) => v.type === "kpi");
  if (!kpis.length) { elements.kpiStrip.innerHTML = ""; return; }
  elements.kpiStrip.innerHTML = kpis.map((kpi) => {
    const val = kpi.data?.[0]?.value;
    const isCurrency = kpi.config?.is_currency === true
      || isCurrencyColumn(kpi.title || "")
      || isCurrencyColumn(kpi.config?.subtitle || "")
      || isCurrencyColumn(kpi.y || kpi.values || "");
    const trend = kpi.config?.trend;
    let trendHtml = "";
    if (trend && trend.direction) {
      const cls = trend.direction === "up" ? "up" : trend.direction === "down" ? "down" : "flat";
      const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
      const pct = trend.percent != null ? `${Math.abs(trend.percent).toFixed(1)}%` : "";
      trendHtml = `<div class="kpi-strip-trend ${cls}">${arrow} ${pct}</div>`;
    }
    return `<div class="kpi-strip-card">
      <div class="kpi-strip-value">${formatKpiValue(val, isCurrency)}</div>
      <div class="kpi-strip-label">${kpi.title}</div>
      ${trendHtml}
    </div>`;
  }).join("");
}

/* ===== Nav Pills (Overview / Analytics / Data) ===== */
function switchNavTab(tab) {
  const pills = document.querySelectorAll(".nav-pill");
  pills.forEach((pill) => pill.classList.toggle("active", pill.dataset.nav === tab));

  const overviewEls = [elements.kpiStrip, elements.filterBar, document.querySelector(".dashboard-canvas")];
  const analyticsView = document.getElementById("analytics-view");
  const dataView = document.getElementById("data-view");

  const isOverview = tab === "overview";
  const isAnalytics = tab === "analytics";
  const isData = tab === "data";

  overviewEls.forEach((el) => { if (el) el.classList.toggle("hidden", !isOverview); });
  if (analyticsView) analyticsView.classList.toggle("hidden", !isAnalytics);
  if (dataView) dataView.classList.toggle("hidden", !isData);

  if (isOverview && state.step === "dashboard") {
    elements.filterBar?.classList.remove("hidden");
    elements.kpiStrip?.classList.remove("hidden");
  }
  if (isAnalytics) renderAnalyticsView();
  if (isData) renderDataView();
}

function renderAnalyticsView() {
  const container = document.getElementById("analytics-grid");
  if (!container) return;

  /* Try merged profile first, then dataset profile, then single-file profile */
  const detail = state.datasetDetail;
  const mergedProfile = detail?.merged_profile;
  const datasetProfile = detail?.profile;
  const files = datasetProfile?.files || [];
  const activeProfile = mergedProfile || (files.length ? files[0] : null);

  if (!activeProfile && !files.length) {
    container.innerHTML = '<div class="empty-state"><p>No profile data available</p><span class="empty-state-hint">Upload and process a dataset first</span></div>';
    return;
  }

  const totalRows = mergedProfile ? (mergedProfile.row_count || 0) : files.reduce((s, f) => s + (f.row_count || 0), 0);
  const allColumns = activeProfile?.columns || files.flatMap((f) => f.columns || []);
  const totalCols = allColumns.length;

  const typeCount = {};
  allColumns.forEach((col) => { typeCount[col.inferred_type] = (typeCount[col.inferred_type] || 0) + 1; });

  const totalNulls = allColumns.reduce((s, c) => s + (c.null_count || 0), 0);
  const totalCells = totalRows * totalCols;
  const completeness = totalCells > 0 ? ((1 - totalNulls / totalCells) * 100).toFixed(1) : 100;
  const nullCols = allColumns.filter((c) => c.null_count > 0);
  const numericCols = allColumns.filter((c) => ["integer", "float", "number", "numeric"].includes((c.inferred_type || "").toLowerCase()));
  const categoricalCols = allColumns.filter((c) => ["string", "text", "categorical", "object"].includes((c.inferred_type || "").toLowerCase()));
  const dateCols = allColumns.filter((c) => ["datetime", "date", "timestamp"].includes((c.inferred_type || "").toLowerCase()));

  const completenessColor = completeness >= 95 ? "var(--accent-green)" : completeness >= 80 ? "var(--accent-2)" : "var(--accent-red)";

  /* Type distribution for mini chart */
  const typeEntries = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
  const typeColors = { integer: "#b45309", float: "#d97706", number: "#f59e0b", numeric: "#f59e0b", string: "#059669", text: "#059669", object: "#059669", categorical: "#059669", datetime: "#0ea5e9", date: "#0ea5e9", timestamp: "#0ea5e9", boolean: "#78716c" };

  let html = "";

  /* Row 1: Overview cards */
  html += `
    <div class="analytics-card">
      <h4>Dataset Overview</h4>
      <div class="analytics-stat">${totalRows.toLocaleString()}</div>
      <div class="analytics-detail">Total rows · ${totalCols} columns · ${files.length} file(s)</div>
      <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">
        <span class="analytics-detail"><strong>${numericCols.length}</strong> numeric</span>
        <span class="analytics-detail"><strong>${categoricalCols.length}</strong> categorical</span>
        <span class="analytics-detail"><strong>${dateCols.length}</strong> date/time</span>
      </div>
    </div>
    <div class="analytics-card">
      <h4>Data Completeness</h4>
      <div class="analytics-stat" style="color:${completenessColor}">${completeness}%</div>
      <div style="height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden;margin:8px 0">
        <div style="height:100%;width:${completeness}%;background:${completenessColor};border-radius:3px;transition:width 0.4s ease"></div>
      </div>
      <div class="analytics-detail">${nullCols.length} column(s) with missing values · ${totalNulls.toLocaleString()} total nulls</div>
    </div>
    <div class="analytics-card">
      <h4>Column Types</h4>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
        ${typeEntries.map(([t, n]) => {
          const pct = totalCols > 0 ? (n / totalCols * 100).toFixed(0) : 0;
          const color = typeColors[t.toLowerCase()] || "var(--muted)";
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:3px">
              <span style="font-weight:500">${t}</span><span style="color:var(--muted)">${n} (${pct}%)</span>
            </div>
            <div style="height:4px;background:var(--bg-secondary);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  /* Row 2: Column details with quality bars */
  html += `<div class="analytics-card" style="grid-column:1/-1">
    <h4>Column Details</h4>
    <div style="overflow-x:auto;margin-top:8px">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
        <thead>
          <tr style="border-bottom:2px solid var(--outline)">
            <th style="text-align:left;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Column</th>
            <th style="text-align:left;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Type</th>
            <th style="text-align:right;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Unique</th>
            <th style="text-align:right;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Nulls</th>
            <th style="text-align:left;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;min-width:120px">Completeness</th>
            ${numericCols.length ? '<th style="text-align:right;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Min</th><th style="text-align:right;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Max</th><th style="text-align:right;padding:8px 12px;font-weight:600;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em">Mean</th>' : ""}
          </tr>
        </thead>
        <tbody>
          ${allColumns.map((col) => {
            const nulls = col.null_count || 0;
            const colCompleteness = totalRows > 0 ? ((1 - nulls / totalRows) * 100).toFixed(0) : 100;
            const barColor = colCompleteness >= 95 ? "var(--accent-green)" : colCompleteness >= 80 ? "var(--accent-2)" : "var(--accent-red)";
            const isNumeric = ["integer", "float", "number", "numeric"].includes((col.inferred_type || "").toLowerCase());
            const minVal = col.min != null ? Number(col.min).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
            const maxVal = col.max != null ? Number(col.max).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
            const meanVal = col.mean != null ? Number(col.mean).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
            return `<tr style="border-bottom:1px solid var(--table-divider)">
              <td style="padding:8px 12px;font-weight:600">${col.name}</td>
              <td style="padding:8px 12px"><span class="col-type">${col.inferred_type}</span></td>
              <td style="padding:8px 12px;text-align:right;color:var(--muted)">${col.unique_count != null ? col.unique_count.toLocaleString() : "—"}</td>
              <td style="padding:8px 12px;text-align:right;color:${nulls > 0 ? "var(--accent-red)" : "var(--muted)"}">${nulls.toLocaleString()}</td>
              <td style="padding:8px 12px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="flex:1;height:4px;background:var(--bg-secondary);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${colCompleteness}%;background:${barColor};border-radius:2px"></div>
                  </div>
                  <span style="font-size:0.72rem;color:var(--muted);min-width:32px;text-align:right">${colCompleteness}%</span>
                </div>
              </td>
              ${numericCols.length ? `<td style="padding:8px 12px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums">${isNumeric ? minVal : "—"}</td><td style="padding:8px 12px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums">${isNumeric ? maxVal : "—"}</td><td style="padding:8px 12px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums">${isNumeric ? meanVal : "—"}</td>` : ""}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`;

  /* Row 3: Numeric column summaries if any */
  if (numericCols.length) {
    html += `<div class="analytics-card" style="grid-column:1/-1">
      <h4>Numeric Columns Summary</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:8px">
        ${numericCols.map((col) => {
          const minV = col.min != null ? Number(col.min).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          const maxV = col.max != null ? Number(col.max).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          const meanV = col.mean != null ? Number(col.mean).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          const stdV = col.std != null ? Number(col.std).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          return `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:14px">
            <div style="font-weight:600;font-size:0.85rem;margin-bottom:8px">${col.name}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:0.78rem">
              <span style="color:var(--muted)">Min</span><span style="text-align:right;font-variant-numeric:tabular-nums">${minV}</span>
              <span style="color:var(--muted)">Max</span><span style="text-align:right;font-variant-numeric:tabular-nums">${maxV}</span>
              <span style="color:var(--muted)">Mean</span><span style="text-align:right;font-variant-numeric:tabular-nums">${meanV}</span>
              <span style="color:var(--muted)">Std Dev</span><span style="text-align:right;font-variant-numeric:tabular-nums">${stdV}</span>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

async function renderDataView() {
  const container = document.getElementById("data-view-table");
  if (!container) return;

  const dataset = state.currentDataset;
  if (!dataset) {
    container.innerHTML = '<div class="empty-state"><p>No dataset loaded</p></div>';
    return;
  }

  try {
    const preview = await apiFetch(`/datasets/${dataset.id}/preview?limit=100&use_merged=true`);
    const rows = preview.rows || [];
    const columns = preview.columns || [];
    if (!rows.length || !columns.length) {
      container.innerHTML = '<div class="empty-state"><p>No data to display</p></div>';
      return;
    }

    const headerHtml = columns.map((c) => `<th>${c}</th>`).join("");
    const bodyHtml = rows.map((row) => `<tr>${columns.map((c) => `<td>${row[c] ?? ""}</td>`).join("")}</tr>`).join("");

    container.innerHTML = `
      <div class="data-view-info">Showing ${rows.length} of ${preview.total_rows || rows.length} rows</div>
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;
  } catch (_err) {
    container.innerHTML = '<div class="empty-state"><p>Unable to load data preview</p></div>';
  }
}

/* ===== Global Filter Bar ===== */
const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

function updateFilterBar() {
  if (!elements.filterBar) return;
  if (elements.filterBarDates) {
    elements.filterBarDates.innerHTML = DATE_PRESETS.map((p) =>
      `<button type="button" class="filter-pill${state.datePreset === p.key ? " active" : ""}" data-preset="${p.key}">${p.label}</button>`
    ).join("");
    elements.filterBarDates.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.datePreset = btn.dataset.preset;
        updateFilterBar();
        renderDashboard();
      });
    });
  }
  if (elements.customDateRange) {
    elements.customDateRange.classList.toggle("hidden", state.datePreset !== "custom");
  }
  const count = (state.datePreset !== "all" ? 1 : 0);
  if (elements.filterCountBadge) {
    elements.filterCountBadge.textContent = `${count} active`;
    elements.filterCountBadge.classList.toggle("hidden", count === 0);
  }
}

function getDateFilterRange() {
  if (state.datePreset === "all") return null;
  const now = new Date();
  let start = null;
  if (state.datePreset === "7d") start = new Date(now - 7 * 86400000);
  else if (state.datePreset === "30d") start = new Date(now - 30 * 86400000);
  else if (state.datePreset === "90d") start = new Date(now - 90 * 86400000);
  else if (state.datePreset === "ytd") start = new Date(now.getFullYear(), 0, 1);
  else if (state.datePreset === "custom") {
    start = state.customDateRange.start ? new Date(state.customDateRange.start) : null;
    const end = state.customDateRange.end ? new Date(state.customDateRange.end) : null;
    return start || end ? { start, end } : null;
  }
  return start ? { start, end: now } : null;
}

/* ===== Sidebar Toggle ===== */
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  const workspace = document.querySelector(".dashboard-workspace");
  if (workspace) workspace.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
}

/* ===== CSV Export ===== */
async function exportDatasetCsv() {
  if (!state.currentDataset) { showToast("No dataset to export"); return; }
  try {
    const response = await fetch(`${API_BASE}/datasets/${state.currentDataset.id}/export`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.currentDataset.name || "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  } catch (err) {
    showToast(err.message || "Export failed");
  }
}

/* ===== Last-Opened Project Memory ===== */
function saveLastProject(projectId) {
  if (projectId) localStorage.setItem(LAST_PROJECT_KEY, projectId);
}

function getLastProjectId() {
  return localStorage.getItem(LAST_PROJECT_KEY);
}

/* ===== Delete Project ===== */
async function deleteProject(projectId) {
  const confirmed = await showConfirm("Delete project?", "This will permanently delete the project and all its data.");
  if (!confirmed) return;
  try {
    await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
    state.projects = state.projects.filter((p) => p.id !== projectId);
    delete state.projectSummaries[projectId];
    if (state.currentProject?.id === projectId) {
      state.currentProject = null;
      state.currentDataset = null;
      state.datasetDetail = null;
      state.finalVisuals = [];
    }
    renderProjectList();
    showToast("Project deleted");
  } catch (err) {
    showToast(err.message || "Failed to delete project");
  }
}

function toSuggestedName(fileName) {
  if (!fileName) return "";
  const trimmed = fileName.replace(/\.[^/.]+$/, "");
  return trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function updateDatasetNameHint(name) {
  if (!elements.datasetNameHint) return;
  if (!name) {
    elements.datasetNameHint.textContent = "";
    return;
  }
  elements.datasetNameHint.textContent = `Dataset will be created as "${name}".`;
}

function filterSampleVisuals(visuals = []) {
  return visuals.filter(
    (visual) => !(visual.type === "table" && visual.title === "Sample Data Table")
  );
}

function getActiveProfile() {
  const detail = state.datasetDetail;
  return detail?.merged_profile || detail?.profile?.files?.[0] || null;
}

function getActiveProfileColumns() {
  const profile = getActiveProfile();
  const columns = profile?.columns || [];
  const all = columns.map((col) => ({ name: col.name, type: col.inferred_type }));
  const numeric = all.filter((col) => col.type === "numeric").map((col) => col.name);
  const datetime = all.filter((col) => col.type === "datetime").map((col) => col.name);
  const categorical = all
    .filter((col) => ["categorical", "boolean", "text"].includes(col.type))
    .map((col) => col.name);
  return {
    all: all.map((col) => col.name),
    numeric,
    datetime,
    categorical,
  };
}

function getFilterableColumns() {
  const profile = getActiveProfile();
  if (!profile?.columns) return [];
  return profile.columns.filter((col) =>
    ["categorical", "boolean", "text"].includes(col.inferred_type)
  );
}

function populateFilterColumns() {
  if (!elements.filterColumn) return;
  const columns = getFilterableColumns();
  populateSelect(elements.filterColumn, columns.map((col) => col.name), "Select field");
  if (elements.filterValue) {
    elements.filterValue.innerHTML = "";
    elements.filterValue.disabled = true;
  }
}

function populateFilterValues(columnName) {
  if (!elements.filterValue) return;
  const profile = getActiveProfile();
  const column = profile?.columns?.find((col) => col.name === columnName);
  const values = Array.from(
    new Set([...(column?.top_values || []), ...(column?.sample_values || [])])
  )
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  populateSelect(elements.filterValue, values, "Select value");
  elements.filterValue.disabled = values.length === 0;
}

function renderActiveFilters() {
  if (!elements.activeFilters || !elements.filtersEmpty) return;
  elements.activeFilters.innerHTML = "";
  if (!state.dashboardFilters.length) {
    elements.filtersEmpty.classList.remove("hidden");
    return;
  }
  elements.filtersEmpty.classList.add("hidden");
  state.dashboardFilters.forEach((filter, index) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.type = "button";
    chip.innerHTML = `
      <span>${filter.column}: ${filter.value}</span>
      <span class="filter-chip-close">×</span>
    `;
    chip.addEventListener("click", () => {
      state.dashboardFilters.splice(index, 1);
      renderActiveFilters();
      renderDashboard();
    });
    elements.activeFilters.appendChild(chip);
  });
}

function applyDashboardFilters(rows = []) {
  let filtered = rows;
  /* Apply column-value equality filters */
  if (state.dashboardFilters.length) {
    filtered = filtered.filter((row) =>
      state.dashboardFilters.every((filter) => {
        if (!(filter.column in row)) return true;
        const value = row[filter.column];
        return String(value ?? "") === filter.value;
      })
    );
  }
  /* Apply date range filter */
  const dateRange = getDateFilterRange();
  if (dateRange) {
    const dateColumns = getActiveProfileColumns().datetime;
    if (dateColumns.length) {
      filtered = filtered.filter((row) => {
        return dateColumns.some((col) => {
          const val = row[col];
          if (!val) return false;
          const d = new Date(val);
          if (isNaN(d.getTime())) return false;
          if (dateRange.start && d < dateRange.start) return false;
          if (dateRange.end && d > dateRange.end) return false;
          return true;
        });
      });
    }
  }
  return filtered;
}

function syncDashboardFilters() {
  const available = new Set(getActiveProfileColumns().all);
  if (!available.size) {
    state.dashboardFilters = [];
    return;
  }
  state.dashboardFilters = state.dashboardFilters.filter((filter) => available.has(filter.column));
}

function applyFieldToVisualForm(fieldName, fieldType) {
  if (!elements.addVisualForm) return;
  const form = elements.addVisualForm;
  const typeField = form.elements.namedItem("type");
  const xField = form.elements.namedItem("x");
  const yField = form.elements.namedItem("y");
  const valuesField = form.elements.namedItem("values");
  const columns = getActiveProfileColumns();
  const numericOptions = columns.numeric.length ? columns.numeric : columns.all;

  if (fieldType === "datetime") {
    typeField.value = "line";
    updateVisualFormFields("line");
    if (xField) xField.value = fieldName;
    if (yField && !yField.value && numericOptions.length) {
      yField.value = numericOptions[0];
    }
    return;
  }

  if (["categorical", "boolean", "text"].includes(fieldType)) {
    if (xField) xField.value = fieldName;
    return;
  }

  if (fieldType === "numeric") {
    const currentType = typeField.value || "bar";
    if (["pie", "histogram"].includes(currentType)) {
      if (valuesField) valuesField.value = fieldName;
    } else if (yField) {
      yField.value = fieldName;
    }
  }
}

function renderDashboardFields() {
  if (!elements.dashboardFields) return;
  const profile = getActiveProfile();
  elements.dashboardFields.innerHTML = "";
  if (!profile?.columns?.length) {
    elements.dashboardFields.innerHTML = "<p class=\"sidebar-meta\">No fields available yet.</p>";
    return;
  }

  const groups = [
    {
      title: "Measures",
      columns: profile.columns.filter((col) => col.inferred_type === "numeric"),
    },
    {
      title: "Dimensions",
      columns: profile.columns.filter((col) =>
        ["categorical", "boolean", "text"].includes(col.inferred_type)
      ),
    },
    {
      title: "Time",
      columns: profile.columns.filter((col) => col.inferred_type === "datetime"),
    },
  ];

  groups.forEach((group) => {
    if (!group.columns.length) return;
    const section = document.createElement("div");
    section.className = "field-group";
    const heading = document.createElement("div");
    heading.className = "field-group-title";
    heading.textContent = group.title;
    section.appendChild(heading);

    const pillRow = document.createElement("div");
    pillRow.className = "field-pill-row";
    group.columns.forEach((column) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "field-pill";
      pill.textContent = column.name;
      pill.addEventListener("click", () => {
        openAddVisualPanel();
        applyFieldToVisualForm(column.name, column.inferred_type);
      });
      pillRow.appendChild(pill);
    });

    section.appendChild(pillRow);
    elements.dashboardFields.appendChild(section);
  });
}

function updateDashboardSidebar() {
  syncDashboardFilters();
  renderDashboardFields();
  populateFilterColumns();
  renderActiveFilters();
}

function populateSelect(select, options, placeholder) {
  if (!select) return;
  select.innerHTML = "";
  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
  }
  options.forEach((option) => {
    const element = document.createElement("option");
    if (typeof option === "string") {
      element.value = option;
      element.textContent = option;
    } else {
      element.value = option.value;
      element.textContent = option.label;
    }
    select.appendChild(element);
  });
}

function getDefaultTileLayout(visual) {
  const dataCount = visual.data?.length || 0;
  const isSummaryTable = visual.type === "table" && visual.config?.table_type === "summary";
  const columns = visual.config?.columns?.length || 0;

  if (visual.type === "kpi") {
    return { w: 3, h: 2 };
  }

  if (visual.type === "table") {
    if (isSummaryTable) {
      return { w: 4, h: 3 };
    }
    if (columns >= 6) {
      return { w: 8, h: 5 };
    }
    return { w: 6, h: 4 };
  }

  /* Line charts are hero visuals — give them prominent sizing */
  if (visual.type === "line") {
    return { w: 8, h: 4 };
  }

  if (visual.type === "scatter") {
    return { w: 6, h: 4 };
  }

  if (visual.type === "bar") {
    if (dataCount > 10) return { w: 6, h: 5 };
    if (dataCount > 6) return { w: 6, h: 4 };
    return { w: 4, h: 4 };
  }

  if (visual.type === "pie") {
    return { w: 4, h: 4 };
  }

  if (visual.type === "histogram") {
    return { w: 5, h: 4 };
  }

  if (visual.type === "map") {
    return { w: 8, h: 5 };
  }

  return { w: 4, h: 4 };
}

function pickPrimaryVisual(visuals = []) {
  const priority = ["line", "bar", "scatter", "histogram", "pie", "table"];
  for (const type of priority) {
    const match = visuals.find((visual) => visual.type === type);
    if (match) return match;
  }
  return visuals[0];
}

function seedDashboardLayout(visuals = []) {
  const layoutMap = new Map();
  const totalColumns = 12;
  const kpis = visuals.filter((visual) => visual.type === "kpi");
  const summaryTables = visuals.filter(
    (visual) => visual.type === "table" && visual.config?.table_type === "summary"
  );
  const topTiles = [...kpis, ...summaryTables];
  let yOffset = 0;

  if (topTiles.length) {
    const perRow = Math.min(4, topTiles.length);
    const w = Math.floor(totalColumns / perRow);
    const rowHeight = topTiles.reduce((maxHeight, visual) => {
      const { h } = getDefaultTileLayout(visual);
      return Math.max(maxHeight, h);
    }, 2);
    topTiles.forEach((visual, index) => {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const tileHeight = getDefaultTileLayout(visual).h;
      layoutMap.set(visual.visual_id, {
        x: col * w,
        y: yOffset + row * rowHeight,
        w,
        h: tileHeight,
      });
    });
    yOffset += Math.ceil(topTiles.length / perRow) * rowHeight;
  }

  const charts = visuals.filter((visual) => !layoutMap.has(visual.visual_id));
  if (!charts.length) {
    return layoutMap;
  }

  const remaining = [...charts];
  const primary = pickPrimaryVisual(remaining);
  if (primary) {
    const primaryIndex = remaining.findIndex((visual) => visual.visual_id === primary.visual_id);
    if (primaryIndex >= 0) {
      remaining.splice(primaryIndex, 1);
    }
    const primaryDefaults = getDefaultTileLayout(primary);
    const primaryWidth = 6;
    const sideWidth = Math.floor((totalColumns - primaryWidth) / 2);
    const primaryHeight = Math.max(primaryDefaults.h, 5);
    const topHeight = Math.ceil(primaryHeight / 2);
    const bottomHeight = Math.max(primaryHeight - topHeight, 2);

    layoutMap.set(primary.visual_id, {
      x: sideWidth,
      y: yOffset,
      w: primaryWidth,
      h: primaryHeight,
    });

    const sideSlots = [
      { x: 0, y: yOffset, w: sideWidth, h: topHeight },
      { x: 0, y: yOffset + topHeight, w: sideWidth, h: bottomHeight },
      { x: sideWidth + primaryWidth, y: yOffset, w: sideWidth, h: topHeight },
      { x: sideWidth + primaryWidth, y: yOffset + topHeight, w: sideWidth, h: bottomHeight },
    ];

    const sideCharts = remaining.splice(0, sideSlots.length);
    sideCharts.forEach((visual, index) => {
      layoutMap.set(visual.visual_id, sideSlots[index]);
    });

    let gridY = yOffset + primaryHeight;
    let rowHeight = 0;
    let x = 0;
    remaining.forEach((visual) => {
      const defaults = getDefaultTileLayout(visual);
      const w = Math.min(defaults.w, 6);
      const h = defaults.h;
      if (x + w > totalColumns) {
        gridY += rowHeight || h;
        x = 0;
        rowHeight = 0;
      }
      layoutMap.set(visual.visual_id, { x, y: gridY, w, h });
      x += w;
      rowHeight = Math.max(rowHeight, h);
    });
  }

  return layoutMap;
}

function formatFieldLabel(label) {
  if (!label) return "";
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ===== Smart Column Type Detection ===== */
const CURRENCY_PATTERNS = /\b(price|cost|revenue|sales|amount|fee|income|profit|margin|salary|wage|payment|balance|budget|expense|discount|tax|charge|spend|earning|gross|net|msrp|retail|wholesale|fare|rent|rate_amount|subtotal|tip|commission|bonus|refund|credit|debit)\b/i;
const PERCENTAGE_PATTERNS = /\b(pct|percent|percentage|ratio|share|rate|conversion|churn|retention|growth|margin_pct|yield|efficiency|accuracy|coverage|utilization|occupancy|completion)\b/i;
const COUNT_PATTERNS = /\b(count|quantity|qty|num|number|total_items|units|volume|frequency|occurrences|visits|sessions|clicks|impressions|orders|transactions|headcount|population)\b/i;
/* Words that disqualify a string from being detected as currency */
const NOT_CURRENCY_PATTERNS = /\b(records|rows|categories|columns|items|count|unique|entries|total records|category)\b/i;

function isCurrencyColumn(colName) {
  if (!colName) return false;
  const clean = colName.replace(/[_-]+/g, " ").toLowerCase();
  if (NOT_CURRENCY_PATTERNS.test(clean)) return false;
  return CURRENCY_PATTERNS.test(clean);
}

function isPercentageColumn(colName) {
  if (!colName) return false;
  const clean = colName.replace(/[_-]+/g, " ").toLowerCase();
  if (isCurrencyColumn(colName)) return false;
  return PERCENTAGE_PATTERNS.test(clean);
}

function isCountColumn(colName) {
  if (!colName) return false;
  const clean = colName.replace(/[_-]+/g, " ").toLowerCase();
  return COUNT_PATTERNS.test(clean);
}

function detectColumnFormat(colName) {
  if (isCurrencyColumn(colName)) return "currency";
  if (isPercentageColumn(colName)) return "percentage";
  if (isCountColumn(colName)) return "count";
  return "number";
}

function formatSmartValue(value, colName) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  const fmt = detectColumnFormat(colName);
  if (fmt === "currency") return formatCurrency(num);
  if (fmt === "percentage") {
    const pct = Math.abs(num) <= 1 ? num * 100 : num;
    return `${KPI_NUMBER_FORMAT.format(pct)}%`;
  }
  if (fmt === "count") {
    return Number.isInteger(num) ? num.toLocaleString() : KPI_NUMBER_FORMAT.format(num);
  }
  return KPI_NUMBER_FORMAT.format(num);
}

/* Compute whether bar chart y-values are tightly clustered and need zoom */
function computeBarYRange(yValues) {
  if (!yValues || yValues.length < 2) return null;
  const nums = yValues.filter((v) => typeof v === "number" && isFinite(v));
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  if (range === 0) return null;
  /* If all values are > 0 and the range is < 30% of max, zoom in */
  if (min > 0 && range / max < 0.3) {
    const padding = range * 0.3;
    return [Math.max(0, min - padding), max + padding];
  }
  return null;
}

function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${KPI_NUMBER_FORMAT.format(value / 1e9)}B`;
  if (abs >= 1e6) return `$${KPI_NUMBER_FORMAT.format(value / 1e6)}M`;
  if (abs >= 1e3) return `$${KPI_NUMBER_FORMAT.format(value / 1e3)}K`;
  return KPI_CURRENCY_FORMAT.format(value);
}

function formatKpiValue(value, isCurrency = false) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    if (isCurrency) return formatCurrency(value);
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${KPI_NUMBER_FORMAT.format(value / 1e9)}B`;
    if (abs >= 1e6) return `${KPI_NUMBER_FORMAT.format(value / 1e6)}M`;
    if (abs >= 1e3) return `${KPI_NUMBER_FORMAT.format(value / 1e3)}K`;
    return KPI_NUMBER_FORMAT.format(value);
  }
  return String(value);
}

function getAxisTitles(visual) {
  if (visual.type === "pie") {
    return { x: "", y: "" };
  }
  if (visual.type === "histogram") {
    return { x: formatFieldLabel(visual.values || "Value"), y: "Count" };
  }
  if (visual.type === "bar") {
    return {
      x: formatFieldLabel(visual.x),
      y: formatFieldLabel(visual.y || visual.values || "Count"),
    };
  }
  if (visual.type === "line" || visual.type === "scatter") {
    return {
      x: formatFieldLabel(visual.x),
      y: formatFieldLabel(visual.y || ""),
    };
  }
  return { x: "", y: "" };
}

function buildXYHoverTemplate(xLabel, yLabel, xCol, yCol) {
  if (!xLabel && !yLabel) return undefined;
  const yFmt = detectColumnFormat(yCol);
  const xPart = xLabel ? `${xLabel}: %{x}` : "%{x}";
  let yPart;
  if (yFmt === "currency") {
    yPart = yLabel ? `${yLabel}: $%{y:,.2f}` : "$%{y:,.2f}";
  } else if (yFmt === "percentage") {
    yPart = yLabel ? `${yLabel}: %{y:.1f}%` : "%{y:.1f}%";
  } else {
    yPart = yLabel ? `${yLabel}: %{y:,.2f}` : "%{y:,.2f}";
  }
  return `${xPart}<br>${yPart}<extra></extra>`;
}

function getSelectValues(select) {
  if (!select) return [];
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function setFormFieldVisibility(field, visible) {
  const element = elements.addVisualForm?.querySelector(`[data-field="${field}"]`);
  if (!element) return;
  element.classList.toggle("hidden", !visible);
}

function updateVisualFormFields(type) {
  const visibility = {
    bar: { x: true, y: true, values: false, aggregation: true, columns: false },
    line: { x: true, y: true, values: false, aggregation: true, columns: false },
    pie: { x: true, y: false, values: true, aggregation: true, columns: false },
    scatter: { x: true, y: true, values: false, aggregation: false, columns: false },
    histogram: { x: false, y: false, values: true, aggregation: false, columns: false },
    table: { x: false, y: false, values: false, aggregation: false, columns: true },
  };
  const config = visibility[type] || visibility.bar;
  setFormFieldVisibility("x", config.x);
  setFormFieldVisibility("y", config.y);
  setFormFieldVisibility("values", config.values);
  setFormFieldVisibility("aggregation", config.aggregation);
  setFormFieldVisibility("columns", config.columns);
}

function prepareVisualForm(visual) {
  if (!elements.addVisualForm) return;
  const columns = getActiveProfileColumns();
  const form = elements.addVisualForm;
  const numericOptions = columns.numeric.length ? columns.numeric : columns.all;
  const metricOptions = columns.all;

  populateSelect(form.type, VISUAL_TYPES);
  populateSelect(form.x, columns.all, "Select column");
  populateSelect(form.y, metricOptions, "Select metric");
  populateSelect(form.values, metricOptions, "Select metric");
  populateSelect(form.aggregation, AGGREGATIONS, "Auto");
  populateSelect(form.columns, columns.all);

  const defaultType = visual?.type || "bar";
  const defaultX =
    visual?.x || columns.categorical[0] || columns.datetime[0] || columns.all[0] || "";
  const defaultY = visual?.y || numericOptions[0] || metricOptions[0] || "";
  const defaultValues = visual?.values || numericOptions[0] || metricOptions[0] || "";
  const defaultAggregation = visual?.aggregation || "count";

  form.type.value = defaultType;
  form.title.value = visual?.title || "Custom visual";
  form.x.value = defaultX;
  form.y.value = defaultY;
  form.values.value = defaultValues;
  form.aggregation.value = defaultAggregation;

  const selectedColumns = visual?.config?.columns || columns.all;
  Array.from(form.columns.options).forEach((option) => {
    option.selected = selectedColumns.includes(option.value);
  });

  updateVisualFormFields(defaultType);
}

function openAddVisualPanel(visual = null) {
  if (!state.currentDataset || !state.datasetDetail) {
    showToast("Upload data before adding a custom visual");
    return;
  }
  state.editingVisualId = visual?.visual_id || null;
  prepareVisualForm(visual);
  elements.addVisualModal?.classList.remove("hidden");
}

function closeAddVisualPanel() {
  elements.addVisualModal?.classList.add("hidden");
  state.editingVisualId = null;
}

function mergeVisualLayouts(nextVisuals, previousVisuals = []) {
  const layoutMap = new Map();
  previousVisuals.forEach((visual) => {
    if (visual.config?.layout) {
      layoutMap.set(visual.visual_id, visual.config.layout);
    }
  });
  return nextVisuals.map((visual) => {
    const layout = layoutMap.get(visual.visual_id);
    if (!layout) {
      return visual;
    }
    return {
      ...visual,
      config: { ...(visual.config || {}), layout },
    };
  });
}

function updateLayoutFromGrid() {
  if (!state.grid) return;
  const nodes = state.grid.engine?.nodes || [];
  nodes.forEach((node) => {
    const visualId = node.el?.dataset?.visualId;
    if (!visualId) return;
    const visual = state.finalVisuals.find((item) => item.visual_id === visualId);
    if (!visual) return;
    visual.config = {
      ...(visual.config || {}),
      layout: { x: node.x, y: node.y, w: node.w, h: node.h },
    };
  });
}

async function removeVisual(visualId) {
  if (!visualId) return;
  updateLayoutFromGrid();
  const previousVisuals = state.finalVisuals;
  const nextVisuals = previousVisuals.filter((visual) => visual.visual_id !== visualId);
  if (nextVisuals.length === previousVisuals.length) {
    return;
  }
  state.finalVisuals = nextVisuals;
  if (state.datasetDetail) {
    state.datasetDetail.final_visuals = nextVisuals;
  }
  renderDashboard();

  if (!state.currentDataset) return;
  try {
    await apiFetch(`/visuals/${state.currentDataset.id}/remove/${visualId}`, {
      method: "DELETE",
    });
  } catch (error) {
    state.finalVisuals = previousVisuals;
    if (state.datasetDetail) {
      state.datasetDetail.final_visuals = previousVisuals;
    }
    renderDashboard();
    showToast(error.message || "Unable to remove visual");
  }
}

async function createCustomVisual(payload) {
  if (!state.currentDataset) return;
  updateLayoutFromGrid();
  const response = await apiFetch(`/visuals/${state.currentDataset.id}/custom`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.finalVisuals = mergeVisualLayouts(response.visuals, state.finalVisuals);
  renderDashboard();
}

function showSelectedFiles(files) {
  showFileChips(files);
}

async function createProjectWithUpload(projectName, description, files) {
  const payload = { name: projectName, description };
  if (state.businessCategory) payload.business_category = state.businessCategory;
  if (Object.keys(state.businessContext).length) payload.business_context = state.businessContext;
  const project = await createProject(
    payload,
    { resetUpload: false, keepStep: true, silent: true }
  );
  saveLastProject(project.id);
  const datasetName = projectName || "Untitled dataset";
  const dataset = await createDataset(project.id, datasetName, { keepStep: true });
  await uploadDatasetFiles(dataset.id, files);
  resetUploadFlow();
}

function startNewAnalysis() {
  state.currentProject = null;
  state.currentDataset = null;
  state.datasetDetail = null;
  state.mergePlan = [];
  state.sampleVisuals = [];
  state.selectedVisualIds = new Set();
  state.finalVisuals = [];
  state.dashboardFilters = [];
  state.datePreset = "all";
  state.customDateRange = { start: null, end: null };
  state.categoryFilters = [];
  if (elements.datasetProfile) elements.datasetProfile.classList.add("hidden");
  if (elements.mergeSuggestions) elements.mergeSuggestions.innerHTML = "";
  if (elements.mergePlan) elements.mergePlan.innerHTML = "";
  if (elements.manualMerge) elements.manualMerge.innerHTML = "";
  if (elements.sampleVisuals) elements.sampleVisuals.innerHTML = "";
  if (elements.selectedVisuals) elements.selectedVisuals.innerHTML = "";
  if (elements.dashboardGrid) elements.dashboardGrid.innerHTML = "";
  if (elements.kpiStrip) elements.kpiStrip.innerHTML = "";
  if (state.grid) {
    state.grid.removeAll();
  }
  resetUploadFlow();
  state.authPrompted = false;
  updateCurrentProjectName();
  setStep("upload");
}

function setAuthenticatedView() {
  const isAuthed = Boolean(state.token);
  elements.logoutBtn?.classList.toggle("hidden", !isAuthed);
  elements.loginBtn?.classList.toggle("hidden", isAuthed);
  if (elements.sessionEmail) elements.sessionEmail.textContent = isAuthed ? state.email || "" : "Guest session";
  if (!isAuthed) {
    state.projects = [];
    renderProjectList();
  }
  if (isAuthed) {
    closeAuthModal();
    if (state.pendingStep) {
      const nextStep = state.pendingStep;
      state.pendingStep = null;
      setStep(nextStep);
      return;
    }
  }
  const nextStep = stepSections[state.step] ? state.step : "upload";
  setStep(nextStep);
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function login(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!response.ok) {
    throw new Error("Invalid credentials");
  }
  const payload = await response.json();
  state.token = payload.access_token;
  state.email = email;
  localStorage.setItem("token", state.token);
  localStorage.setItem("email", email);
  showToast("Logged in");
  setAuthenticatedView();
  try { await apiFetch("/projects/claim", { method: "POST" }); } catch (_e) { /* ignore */ }
  await loadProjects();
  closeAuthModal();
}

async function register(email, password) {
  await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  showToast("Account created. Please log in.");
}

async function loadProjects() {
  if (!state.token) {
    state.projects = [];
    state.projectSummaries = {};
    renderProjectList();
    return;
  }
  elements.projectListSkeleton?.classList.remove("hidden");
  try {
    const projects = await apiFetch("/projects/");
    state.projects = projects;
    state.projectSummaries = {};
    await Promise.all(
      projects.map(async (project) => {
        try {
          const datasets = await apiFetch(`/projects/${project.id}/datasets`);
          updateProjectSummary(project.id, datasets);
        } catch (_error) {
          updateProjectSummary(project.id, []);
        }
      })
    );
  } finally {
    elements.projectListSkeleton?.classList.add("hidden");
  }
  renderProjectList();
}

async function createProject(payload, options = {}) {
  const project = await apiFetch("/projects/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.projects.unshift(project);
  updateProjectSummary(project.id, []);
  renderProjectList();
  await selectProject(project, options);
  return project;
}

async function loadDatasets(projectId) {
  const datasets = await apiFetch(`/projects/${projectId}/datasets`);
  state.datasets = datasets;
  updateProjectSummary(projectId, datasets);
  renderDatasetList();
  renderProjectList();
}

async function createDataset(projectId, name, options = {}) {
  const dataset = await apiFetch(`/projects/${projectId}/datasets`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  state.datasets.unshift(dataset);
  updateProjectSummary(projectId, state.datasets);
  renderDatasetList();
  renderProjectList();
  await selectDataset(dataset, options);
  return dataset;
}

async function uploadDatasetFiles(datasetId, files) {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append("files", file));
  const response = await fetch(`${API_BASE}/datasets/${datasetId}/upload`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: form,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Upload failed");
  }
  const payload = await response.json();
  state.datasetDetail = payload;
  state.mergePlan = [];
  state.sampleVisuals = [];
  state.selectedVisualIds = new Set();
  state.finalVisuals = [];
  renderDatasetProfile();
  updateCurrentProjectName();
  const fileCount = payload.profile?.files?.length || payload.files?.length || 0;
  if (fileCount > 1) {
    await autoMergeFiles();
  }
  await startDuel();
}

async function fetchDatasetDetail(datasetId) {
  const detail = await apiFetch(`/datasets/${datasetId}`);
  state.datasetDetail = detail;
  return detail;
}

async function selectProject(project, options = {}) {
  const { resetUpload = true, keepStep = false, silent = false } = options;
  state.currentProject = project;
  state.currentDataset = null;
  state.datasetDetail = null;
  state.sampleVisuals = [];
  state.selectedVisualIds = new Set();
  state.finalVisuals = [];
  if (resetUpload) {
    resetUploadFlow();
  }
  saveLastProject(project.id);
  updateCurrentProjectName();
  await loadDatasets(project.id);
  if (!silent) {
    showToast(`Project loaded: ${project.name}`);
  }
  if (!keepStep) {
    setStep("dataset");
  }
}

async function selectDataset(dataset, options = {}) {
  const { keepStep = false } = options;
  state.currentDataset = dataset;
  await fetchDatasetDetail(dataset.id);
  state.sampleVisuals = [];
  state.selectedVisualIds = new Set();
  state.finalVisuals = state.datasetDetail.final_visuals || [];
  updateCurrentProjectName();
  renderDatasetProfile();
  if (state.finalVisuals.length) {
    renderDashboard();
  }
  const fileCount = state.datasetDetail?.profile?.files?.length || state.datasetDetail?.files?.length || 0;
  const hasMerged = Boolean(state.datasetDetail?.merged_profile);
  if (!keepStep) {
    if (fileCount > 1 && !hasMerged) {
      await autoMergeFiles();
    }
    if (!state.finalVisuals.length && fileCount > 0) {
      await startDuel();
      saveSession();
      return;
    }
    if (state.finalVisuals.length) {
      renderDashboard();
      setStep("dashboard");
    } else {
      setStep("upload");
    }
  }
  saveSession();
}

function renderProjectList() {
  if (!elements.projectList) return;
  elements.projectList.innerHTML = "";
  elements.projectListSkeleton?.classList.add("hidden");
  elements.projectsEmpty?.classList.add("hidden");
  elements.projectLoginHint?.classList.add("hidden");

  if (!state.token) {
    elements.projectLoginHint?.classList.remove("hidden");
    return;
  }
  if (!state.projects.length) {
    elements.projectsEmpty?.classList.remove("hidden");
    return;
  }
  state.projects.forEach((project) => {
    const summary = state.projectSummaries[project.id] || {};
    const createdAt = formatProjectDate(summary.createdAt || project.created_at);
    const category = project.business_category;
    const catLabel = category ? CATEGORIES.find((c) => c.key === category)?.label || category : "";

    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <h4 class="project-card-title">${project.name}</h4>
      ${project.description ? `<p class="project-card-desc">${project.description}</p>` : ""}
      <div class="project-card-meta">
        ${catLabel ? `<span class="project-card-badge">${catLabel}</span>` : ""}
        <span class="project-card-date">${createdAt}</span>
      </div>
      <button class="project-card-delete" type="button" title="Delete project">&times;</button>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-delete")) return;
      selectProject(project);
    });
    card.querySelector(".project-card-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteProject(project.id);
    });
    elements.projectList.appendChild(card);
  });
}

function renderDatasetList() {
  elements.datasetList.innerHTML = "";
  if (!state.datasets.length) {
    elements.datasetList.innerHTML = "<p>No datasets yet for this project.</p>";
    return;
  }
  state.datasets.forEach((dataset) => {
    const button = document.createElement("button");
    button.className = "btn btn-outline";
    button.textContent = dataset.name;
    button.addEventListener("click", () => selectDataset(dataset));
    elements.datasetList.appendChild(button);
  });
}

function renderDatasetProfile() {
  const detail = state.datasetDetail;
  if (!detail || !detail.profile) {
    elements.datasetProfile.classList.add("hidden");
    return;
  }
  const fileCards = detail.profile.files
    .map((file) => {
      const columns = file.columns.map((col) => `<li>${col.name} (${col.inferred_type})</li>`).join("");
      return `
        <div class="merge-item">
          <strong>${file.name}</strong>
          <div>${file.row_count} rows · ${file.column_count} columns</div>
          <ul>${columns}</ul>
        </div>
      `;
    })
    .join("");
  elements.datasetProfile.innerHTML = `
    <h3>Dataset profile</h3>
    <div class="stacked">${fileCards}</div>
  `;
  elements.datasetProfile.classList.remove("hidden");
}

function buildFileMap() {
  const profile = state.datasetDetail?.profile;
  if (!profile) return {};
  const map = {};
  profile.files.forEach((file) => {
    map[file.file_id] = file;
  });
  return map;
}

function renderMergeSuggestions() {
  const detail = state.datasetDetail;
  elements.mergeSuggestions.innerHTML = "";
  elements.mergePlan.innerHTML = "";
  elements.manualMerge.innerHTML = "";

  if (!detail || !detail.merge_suggestions) {
    elements.mergeSuggestions.innerHTML = "<p>No merge suggestions available yet.</p>";
    buildManualMergeForm();
    return;
  }

  const fileMap = buildFileMap();
  const suggestions = detail.merge_suggestions.suggestions || [];
  if (!suggestions.length) {
    elements.mergeSuggestions.innerHTML = "<p>No automated matches found. Try manual merge.</p>";
    buildManualMergeForm();
    return;
  }

  suggestions.forEach((suggestion) => {
    const leftFile = fileMap[suggestion.left_file_id];
    const rightFile = fileMap[suggestion.right_file_id];
    const card = document.createElement("div");
    card.className = "merge-item";
    card.innerHTML = `
      <div class="card-header">
        <strong>${leftFile ? leftFile.name : "File"} : ${suggestion.left_column}</strong>
        <span class="badge">${suggestion.reason}</span>
      </div>
      <div><strong>${rightFile ? rightFile.name : "File"} : ${suggestion.right_column}</strong></div>
      <div class="samples">
        <div>
          <h5>Sample left</h5>
          <ul>${(suggestion.sample_left || []).map((val) => `<li>${val ?? "-"}</li>`).join("")}</ul>
        </div>
        <div>
          <h5>Sample right</h5>
          <ul>${(suggestion.sample_right || []).map((val) => `<li>${val ?? "-"}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="panel-actions">
        <select class="join-select">
          <option value="inner">Inner join</option>
          <option value="left">Left join</option>
        </select>
        <button class="btn btn-secondary" type="button">Add to merge plan</button>
      </div>
    `;
    const addButton = card.querySelector("button");
    const joinSelect = card.querySelector(".join-select");
    addButton.addEventListener("click", () => {
      state.mergePlan.push({
        left_file_id: suggestion.left_file_id,
        right_file_id: suggestion.right_file_id,
        left_on: suggestion.left_column,
        right_on: suggestion.right_column,
        how: joinSelect.value,
      });
      renderMergePlan();
      showToast("Added to merge plan");
    });
    elements.mergeSuggestions.appendChild(card);
  });

  buildManualMergeForm();
  renderMergePlan();
}

function buildManualMergeForm() {
  const profile = state.datasetDetail?.profile;
  if (!profile) return;
  const files = profile.files;
  const fileOptions = files
    .map((file) => `<option value="${file.file_id}">${file.name}</option>`)
    .join("");
  const form = document.createElement("div");
  form.innerHTML = `
    <label>
      Left file
      <select id="manual-left-file">${fileOptions}</select>
    </label>
    <label>
      Left column
      <select id="manual-left-column"></select>
    </label>
    <label>
      Right file
      <select id="manual-right-file">${fileOptions}</select>
    </label>
    <label>
      Right column
      <select id="manual-right-column"></select>
    </label>
    <label>
      Join type
      <select id="manual-join-type">
        <option value="inner">Inner join</option>
        <option value="left">Left join</option>
      </select>
    </label>
    <button id="manual-add" class="btn btn-outline" type="button">Add manual merge</button>
  `;
  elements.manualMerge.innerHTML = "";
  elements.manualMerge.appendChild(form);

  const leftFileSelect = form.querySelector("#manual-left-file");
  const rightFileSelect = form.querySelector("#manual-right-file");
  const leftColumnSelect = form.querySelector("#manual-left-column");
  const rightColumnSelect = form.querySelector("#manual-right-column");

  const updateColumns = (fileId, targetSelect) => {
    const file = files.find((item) => item.file_id === fileId);
    if (!file) return;
    targetSelect.innerHTML = file.columns
      .map((col) => `<option value="${col.name}">${col.name} (${col.inferred_type})</option>`)
      .join("");
  };

  updateColumns(leftFileSelect.value, leftColumnSelect);
  updateColumns(rightFileSelect.value, rightColumnSelect);

  leftFileSelect.addEventListener("change", (event) => {
    updateColumns(event.target.value, leftColumnSelect);
  });
  rightFileSelect.addEventListener("change", (event) => {
    updateColumns(event.target.value, rightColumnSelect);
  });

  form.querySelector("#manual-add").addEventListener("click", () => {
    state.mergePlan.push({
      left_file_id: leftFileSelect.value,
      right_file_id: rightFileSelect.value,
      left_on: leftColumnSelect.value,
      right_on: rightColumnSelect.value,
      how: form.querySelector("#manual-join-type").value,
    });
    renderMergePlan();
    showToast("Manual merge added");
  });
}

function renderMergePlan() {
  elements.mergePlan.innerHTML = "";
  if (!state.mergePlan.length) {
    elements.mergePlan.innerHTML = "<p>No merge instructions added yet.</p>";
    return;
  }
  state.mergePlan.forEach((plan, index) => {
    const item = document.createElement("div");
    item.className = "merge-item";
    item.innerHTML = `
      <div><strong>${plan.left_on}</strong> -> <strong>${plan.right_on}</strong> (${plan.how})</div>
      <button class="btn btn-outline" type="button">Remove</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.mergePlan.splice(index, 1);
      renderMergePlan();
    });
    elements.mergePlan.appendChild(item);
  });
}

async function autoMergeFiles() {
  if (!state.currentDataset || !state.datasetDetail) return;
  const suggestions = state.datasetDetail.merge_suggestions?.suggestions || [];

  if (suggestions.length) {
    /* Key-based merge when matching columns are found */
    const plan = suggestions.map((s) => ({
      left_file_id: s.left_file_id,
      right_file_id: s.right_file_id,
      left_on: s.left_column,
      right_on: s.right_column,
      how: "left",
    }));
    try {
      const response = await apiFetch(`/datasets/${state.currentDataset.id}/merge`, {
        method: "POST",
        body: JSON.stringify({ instructions: plan }),
      });
      state.datasetDetail.merged_profile = response.merged_profile;
      await fetchDatasetDetail(state.currentDataset.id);
      showToast("Files merged automatically");
      return;
    } catch (_err) {
      /* Fall through to concat */
    }
  }

  /* Fallback: concat (stack) all files vertically */
  try {
    const response = await apiFetch(`/datasets/${state.currentDataset.id}/concat`, {
      method: "POST",
    });
    state.datasetDetail.merged_profile = response.merged_profile;
    await fetchDatasetDetail(state.currentDataset.id);
    showToast("Files combined (stacked) automatically");
  } catch (_err) {
    showToast("Auto-combine failed, using first file only.");
  }
}

async function executeMerge() {
  if (!state.currentDataset) return;
  if (!state.mergePlan.length) {
    showToast("Add at least one merge instruction");
    return;
  }
  const response = await apiFetch(`/datasets/${state.currentDataset.id}/merge`, {
    method: "POST",
    body: JSON.stringify({ instructions: state.mergePlan }),
  });
  state.datasetDetail.merged_profile = response.merged_profile;
  state.mergePlan = [];
  showToast("Merge completed");
  await fetchDatasetDetail(state.currentDataset.id);
  try {
    await generateDashboardVisuals({ silent: true });
  } catch (_error) {
    showToast("Unable to refresh dashboard yet. Try again.");
  }
  setStep("dashboard");
}

function renderSampleVisuals() {
  if (!elements.sampleVisuals) return;
  elements.sampleVisuals.innerHTML = "";
  if (!state.sampleVisuals.length) {
    elements.sampleVisuals.innerHTML = "<p>No sample visuals yet.</p>";
    return;
  }
  state.sampleVisuals.forEach((visual) => {
    const card = document.createElement("div");
    card.className = "visual-card";
    card.dataset.visualType = visual.type;
    const isSelected = state.selectedVisualIds.has(visual.visual_id);
    if (isSelected) {
      card.classList.add("selected");
    }
    card.innerHTML = `
      <div class="card-header">
        <h4>${visual.title}</h4>
        <button class="btn btn-outline" type="button">
          ${isSelected ? "Selected" : "Select"}
        </button>
      </div>
      <div class="visual-canvas" id="preview-${visual.visual_id}"></div>
    `;
    const button = card.querySelector("button");
    button.addEventListener("click", () => toggleVisualSelection(visual));
    elements.sampleVisuals.appendChild(card);
    renderVisual(visual, card.querySelector(`#preview-${visual.visual_id}`));
  });
  renderSelectedVisuals();
}

function toggleVisualSelection(visual) {
  if (state.selectedVisualIds.has(visual.visual_id)) {
    state.selectedVisualIds.delete(visual.visual_id);
  } else {
    state.selectedVisualIds.add(visual.visual_id);
  }
  renderSampleVisuals();
}

function renderSelectedVisuals() {
  if (!elements.selectedVisuals) return;
  const selected = state.sampleVisuals.filter((visual) =>
    state.selectedVisualIds.has(visual.visual_id)
  );
  elements.selectedVisuals.innerHTML = selected.length
    ? selected.map((visual) => `<div>${visual.title}</div>`).join("")
    : "<p>No visuals selected yet.</p>";
}

async function generateSampleVisuals(options = {}) {
  if (!state.currentDataset) return;
  const { silent = false } = options;
  const response = await apiFetch(`/visuals/${state.currentDataset.id}/sample`, {
    method: "POST",
  });
  state.sampleVisuals = filterSampleVisuals(response.visuals);
  state.selectedVisualIds = new Set();
  renderSampleVisuals();
  if (!silent) {
    showToast("Sample visuals generated");
  }
}

async function generateDashboardVisuals(options = {}) {
  if (!state.currentDataset) return;
  const { silent = false } = options;
  let response;
  try {
    response = await apiFetch(`/visuals/${state.currentDataset.id}/dashboard`, {
      method: "POST",
    });
  } catch (err) {
    console.error("Dashboard generation failed:", err);
    throw err;
  }
  state.finalVisuals = response.visuals;
  state.sampleVisuals = [];
  state.selectedVisualIds = new Set();
  state.datasetDetail.final_visuals = response.visuals;
  renderDashboard();
  if (!silent) {
    showToast("Dashboard ready");
  }
}

async function finalizeVisuals() {
  if (!state.currentDataset) return;
  const selectedIds = Array.from(state.selectedVisualIds);
  if (!selectedIds.length) {
    showToast("Select visuals to continue");
    return;
  }
  const response = await apiFetch(`/visuals/${state.currentDataset.id}/final`, {
    method: "POST",
    body: JSON.stringify({ selected_visual_ids: selectedIds }),
  });
  state.finalVisuals = response.visuals;
  renderDashboard();
  setStep("dashboard");
}

async function generateMoreVisuals() {
  if (!state.currentDataset) return;
  updateLayoutFromGrid();
  const response = await apiFetch(`/visuals/${state.currentDataset.id}/more`, {
    method: "POST",
    body: JSON.stringify({ selected_visual_ids: Array.from(state.selectedVisualIds) }),
  });
  state.finalVisuals = mergeVisualLayouts(response.visuals, state.finalVisuals);
  renderDashboard();
}

function renderDashboard() {
  if (!state.finalVisuals.length) {
    if (elements.dashboardGrid) elements.dashboardGrid.innerHTML = "";
    if (elements.dashboardEmpty) elements.dashboardEmpty.classList.remove("hidden");
    return;
  }
  if (elements.dashboardEmpty) elements.dashboardEmpty.classList.add("hidden");
  const hasLayout = state.finalVisuals.some((visual) => visual.config?.layout);
  if (!hasLayout) {
    const seededLayouts = seedDashboardLayout(state.finalVisuals);
    state.finalVisuals = state.finalVisuals.map((visual) => {
      const layout = seededLayouts.get(visual.visual_id);
      if (!layout) return visual;
      return {
        ...visual,
        config: { ...(visual.config || {}), layout },
      };
    });
  }
  if (!state.grid) {
    state.grid = GridStack.init({
      float: false,
      cellHeight: 100,
      marginTop: 14, marginBottom: 14, marginLeft: 14, marginRight: 14,
      handle: ".grid-stack-item-content",
      animate: true,
      column: 12,
      resizable: { handles: "e,s,se" },
      draggable: { scroll: true },
      minRow: 1,
    });
    if (!state.gridBound) {
      state.grid.on("resizestop", (_event, element) => {
        const chart = element?.querySelector(".chart");
        if (chart) {
          Plotly.Plots.resize(chart);
        }
        updateLayoutFromGrid();
      });
      state.grid.on("dragstop", updateLayoutFromGrid);
      state.grid.on("change", updateLayoutFromGrid);
      state.gridBound = true;
    }
  }
  updateLayoutFromGrid();
  state.grid.removeAll();

  const gridVisuals = state.finalVisuals.filter((v) => v.type !== "kpi");
  renderKpiStrip();

  gridVisuals.forEach((visual, index) => {
    const defaults = getDefaultTileLayout(visual);
    const layout = visual.config?.layout;
    const width = typeof layout?.w === "number" ? layout.w : defaults.w;
    const height = typeof layout?.h === "number" ? layout.h : defaults.h;
    const hasLayout = layout && typeof layout.x === "number" && typeof layout.y === "number";
    const widget = document.createElement("div");
    const canEdit = visual.type !== "kpi";
    widget.dataset.visualId = visual.visual_id;
    widget.innerHTML = `
      <div class="grid-stack-item-content" data-visual-type="${visual.type}">
        <div class="tile-header">
          <div class="tile-meta">
            <span>${visual.title}</span>
            <span class="tile-type">${visual.type}</span>
          </div>
          <div class="tile-actions">
            ${canEdit ? "<button class=\"btn btn-outline btn-sm edit-visual\" type=\"button\">Edit</button>" : ""}
            <button class="btn btn-outline btn-sm delete-visual" type="button" aria-label="Remove visual">×</button>
          </div>
        </div>
        <div class="tile-body" id="dash-${visual.visual_id}"></div>
      </div>
    `;
    const options = {
      w: width,
      h: height,
      autoPosition: !hasLayout,
    };
    if (hasLayout) {
      options.x = layout.x;
      options.y = layout.y;
    }
    state.grid.addWidget(widget, options);
    widget.querySelector(".edit-visual")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddVisualPanel(visual);
    });
    widget.querySelector(".delete-visual")?.addEventListener("click", (event) => {
      event.stopPropagation();
      removeVisual(visual.visual_id);
    });
    renderVisual(visual, widget.querySelector(`#dash-${visual.visual_id}`));
  });
  requestAnimationFrame(updateLayoutFromGrid);
  /* Delayed resize pass to ensure charts fill their containers */
  setTimeout(() => {
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((chart) => Plotly.Plots.resize(chart));
  }, 150);
}

function buildPlotlyLayout(visual, container, plotData) {
  const isPie = visual.type === "pie";
  const dataCount = visual.data?.length || 0;
  const width = container?.clientWidth || 280;
  const height = container?.clientHeight || 220;
  const isCompact = width < 360 || height < 240;
  const showPieLegend = dataCount > 4;
  const axisTitles = getAxisTitles(visual);
  const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.dark;
  const axisTitleFont = { size: 11, color: theme.axisTitle, family: "Inter" };
  const axisTickFont = { size: 11, color: theme.axisTick, family: "Inter" };
  const pieLegend = {
    orientation: isCompact ? "h" : "v",
    y: isCompact ? -0.08 : 0.5,
    x: isCompact ? 0.5 : 1.02,
    xanchor: isCompact ? "center" : "left",
    yanchor: isCompact ? "top" : "middle",
    font: { size: 10, color: theme.legend },
  };

  /* Detect y-axis column format for smart tick formatting */
  const yCol = visual.y || visual.values || "";
  const backendIsCurrency = visual.config?.is_currency === true;
  const yFmt = backendIsCurrency ? "currency" : detectColumnFormat(yCol);
  let yTickPrefix = "";
  let yTickSuffix = "";
  let yTickFormat = "";
  if (yFmt === "currency") {
    yTickPrefix = "$";
    yTickFormat = ",.2s";
  } else if (yFmt === "percentage") {
    yTickSuffix = "%";
    yTickFormat = ".1f";
  }

  /* Auto-zoom y-axis for bar charts with tightly clustered values */
  let yRange = undefined;
  if (visual.type === "bar" && plotData?.[0]?.y) {
    yRange = computeBarYRange(plotData[0].y);
  }

  /* Currency columns need wider left margin for $ prefix */
  const leftMargin = yFmt === "currency" ? 60 : 48;

  return {
    title: { text: "", font: { family: "Space Grotesk", size: 14 } },
    margin: isPie
      ? {
          l: 12,
          r: showPieLegend && !isCompact ? 90 : 12,
          t: 10,
          b: showPieLegend && isCompact ? 70 : 28,
        }
      : { l: leftMargin, r: 20, t: 10, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter", color: theme.font },
    autosize: true,
    xaxis: {
      automargin: true,
      gridcolor: theme.grid,
      zeroline: false,
      linecolor: theme.line,
      tickcolor: theme.line,
      tickfont: axisTickFont,
      title: { text: axisTitles.x, standoff: 8, font: axisTitleFont },
      tickangle: (visual.type === "histogram" || (visual.type === "bar" && dataCount > 6)) ? -35 : undefined,
    },
    yaxis: {
      automargin: true,
      gridcolor: theme.grid,
      zeroline: false,
      linecolor: theme.line,
      tickcolor: theme.line,
      tickfont: axisTickFont,
      tickprefix: yTickPrefix,
      ticksuffix: yTickSuffix,
      tickformat: yTickFormat || undefined,
      title: { text: axisTitles.y, standoff: 8, font: axisTitleFont },
      range: yRange || undefined,
    },
    legend: isPie
      ? pieLegend
      : { orientation: "h", y: -0.2, x: 0, xanchor: "left", font: { size: 10 } },
    showlegend: isPie && showPieLegend,
    uniformtext: { minsize: 9, mode: "hide" },
    hovermode: "closest",
    bargap: 0.28,
    colorway: CHART_COLORS.palette,
  };
}

function renderVisual(visual, container) {
  if (!container) return;
  container.innerHTML = "";
  const rawData = visual.data || [];
  if (!rawData.length) {
    container.innerHTML = "<p>No data available for this visual.</p>";
    return;
  }
  container.style.height = "100%";
  const filteredData = applyDashboardFilters(rawData);

  if (visual.type === "kpi") {
    const value = visual.data?.[0]?.value;
    const subtitle = visual.config?.subtitle || "Current";
    const isCurrency = visual.config?.is_currency === true
      || isCurrencyColumn(visual.title || "")
      || isCurrencyColumn(subtitle)
      || isCurrencyColumn(visual.y || visual.values || "");
    container.classList.add("kpi-card");
    container.innerHTML = `
      <div class="kpi-value">${formatKpiValue(value, isCurrency)}</div>
      <div class="kpi-subtitle">${subtitle}</div>
    `;
    return;
  }

  if (visual.type === "table") {
    container.classList.add("table-scroll");
    const columns = visual.config?.columns || Object.keys(rawData[0] || {});
    const table = document.createElement("table");
    table.classList.add("data-table");
    table.innerHTML = `
      <thead><tr>${columns.map((col) => `<th>${formatFieldLabel(col)}</th>`).join("")}</tr></thead>
      <tbody>
        ${(filteredData || [])
          .map(
            (row) =>
              `<tr>${columns.map((col) => {
                const val = row[col];
                if (val === null || val === undefined) return "<td></td>";
                if (typeof val === "number") return `<td>${formatSmartValue(val, col)}</td>`;
                return `<td>${val}</td>`;
              }).join("")}</tr>`
          )
          .join("")}
      </tbody>
    `;
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.querySelectorAll("th, td").forEach((cell) => {
      cell.style.borderBottom = "1px solid var(--table-divider)";
      cell.style.padding = "6px";
    });
    container.appendChild(table);
    return;
  }

  const data = filteredData;
  const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.dark;
  let plotData = [];
  const axisTitles = getAxisTitles(visual);
  const xCol = visual.x || "";
  const yCol = visual.y || visual.values || "";
  /* Use backend is_currency config flag as override for column detection */
  const backendCurrency = visual.config?.is_currency === true;
  const hoverTemplate = backendCurrency
    ? buildXYHoverTemplate(axisTitles.x, axisTitles.y, "price", yCol)
    : buildXYHoverTemplate(axisTitles.x, axisTitles.y, xCol, yCol);
  const dataCount = data.length;

  if (visual.type === "bar") {
    const xKey = visual.x;
    const yKey = visual.y || visual.values || "count";
    /* Sort bar data descending by value for better readability */
    const sorted = [...data].sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0));
    const barColors = sorted.map((_, i) => CHART_COLORS.palette[i % CHART_COLORS.palette.length]);
    plotData = [
      {
        type: "bar",
        x: sorted.map((row) => row[xKey]),
        y: sorted.map((row) => row[yKey]),
        marker: {
          color: barColors,
          line: { color: theme.line, width: 1 },
        },
        hovertemplate: hoverTemplate,
      },
    ];
  } else if (visual.type === "pie") {
    const labelKey = visual.x;
    const valueKey = visual.values || "count";
    const pieTextInfo = dataCount <= 4 ? "label+percent" : dataCount <= 8 ? "percent" : "none";
    const pieFmt = detectColumnFormat(valueKey);
    const pieHover = pieFmt === "currency"
      ? "%{label}: $%{value:,.2f} (%{percent})<extra></extra>"
      : "%{label}: %{value:,.2f} (%{percent})<extra></extra>";
    plotData = [
      {
        type: "pie",
        labels: data.map((row) => row[labelKey]),
        values: data.map((row) => row[valueKey]),
        textinfo: pieTextInfo,
        textposition: "inside",
        insidetextorientation: "radial",
        hovertemplate: pieHover,
        marker: { colors: CHART_COLORS.palette },
        hole: 0.42,
      },
    ];
  } else if (visual.type === "line") {
    plotData = [
      {
        type: "scatter",
        mode: "lines+markers",
        x: data.map((row) => row[visual.x]),
        y: data.map((row) => row[visual.y]),
        line: { color: "#6366f1", width: 3 },
        marker: { color: "#6366f1", size: 5 },
        hovertemplate: hoverTemplate,
      },
    ];
  } else if (visual.type === "scatter") {
    plotData = [
      {
        type: "scatter",
        mode: "markers",
        x: data.map((row) => row[visual.x]),
        y: data.map((row) => row[visual.y]),
        marker: { color: "#0d9488", size: 6, opacity: 0.7 },
        hovertemplate: hoverTemplate,
      },
    ];
  } else if (visual.type === "histogram") {
    plotData = [
      {
        type: "bar",
        x: data.map((row) => row.bin),
        y: data.map((row) => row.count),
        marker: {
          color: "#8b5cf6",
          line: { color: theme.line, width: 1 },
        },
        hovertemplate: hoverTemplate,
      },
    ];
  } else if (visual.type === "map") {
    const latCol = visual.config?.lat_column || visual.y;
    const lonCol = visual.config?.lon_column || visual.x;
    const labelCol = visual.config?.label_column;
    const valueCol = visual.config?.value_column || visual.values;
    const isCurrency = visual.config?.is_currency === true;
    
    const lats = data.map((row) => row[latCol]);
    const lons = data.map((row) => row[lonCol]);
    const labels = labelCol ? data.map((row) => row[labelCol]) : lats.map((_, i) => `Point ${i + 1}`);
    const values = valueCol ? data.map((row) => row[valueCol]) : null;
    
    const hoverText = values
      ? labels.map((label, i) => `${label}<br>${valueCol}: ${isCurrency ? formatCurrency(values[i]) : values[i]}`)
      : labels;
    
    plotData = [
      {
        type: "scattergeo",
        mode: "markers",
        lat: lats,
        lon: lons,
        text: hoverText,
        hoverinfo: "text",
        marker: {
          size: values ? values.map((v) => Math.max(6, Math.min(20, Math.sqrt(v) / 10))) : 8,
          color: values || CHART_COLORS.primary,
          colorscale: values ? "Blues" : undefined,
          showscale: !!values,
          line: { color: theme.line, width: 1 },
        },
      },
    ];
    
    const mapLayout = buildPlotlyLayout(visual, container, plotData);
    mapLayout.geo = {
      scope: "world",
      projection: { type: "natural earth" },
      showland: true,
      landcolor: state.theme === "dark" ? "#1e293b" : "#e2e8f0",
      showocean: true,
      oceancolor: state.theme === "dark" ? "#0f172a" : "#f1f5f9",
      showcoastlines: true,
      coastlinecolor: state.theme === "dark" ? "#334155" : "#94a3b8",
      showcountries: true,
      countrycolor: state.theme === "dark" ? "#334155" : "#cbd5e1",
      bgcolor: "rgba(0,0,0,0)",
    };
    mapLayout.margin = { t: 10, b: 10, l: 10, r: 10 };
    
    container.classList.add("chart");
    Plotly.newPlot(container, plotData, mapLayout, {
      responsive: true,
      displayModeBar: false,
    });
    requestAnimationFrame(() => Plotly.Plots.resize(container));
    return;
  }

  container.classList.add("chart");
  Plotly.newPlot(container, plotData, buildPlotlyLayout(visual, container, plotData), {
    responsive: true,
    displayModeBar: false,
  });
  requestAnimationFrame(() => Plotly.Plots.resize(container));
}

/* ===== Duel Mode ===== */
async function startDuel() {
  if (!state.currentDataset) return;
  showToast("Generating visual options...");
  try {
    const response = await apiFetch(`/visuals/${state.currentDataset.id}/duel-pool`, {
      method: "POST",
    });
    state.duelRounds = response.rounds || [];
    state.duelKpis = response.kpis || [];
    state.duelCurrentRound = 0;
    state.duelPicked = [];
    state.duelPoolSize = response.pool_size || 0;

    if (state.duelRounds.length < 2) {
      // Not enough candidates for duel — fall back to auto-generate
      showToast("Not enough chart options for duel mode, auto-generating...");
      await generateDashboardVisuals({ silent: true });
      setStep("dashboard");
      return;
    }

    setStep("duel");
    renderDuelRound();
  } catch (err) {
    console.error("Duel pool failed:", err);
    showToast("Could not generate visual options. Falling back to auto-generate.");
    try {
      await generateDashboardVisuals({ silent: true });
    } catch (_e) { /* ignore */ }
    setStep("dashboard");
  }
}

function renderDuelRound() {
  const round = state.duelRounds[state.duelCurrentRound];
  if (!round) return;

  const totalRounds = state.duelRounds.length;
  const current = state.duelCurrentRound + 1;

  // Update progress
  if (elements.duelProgressFill) {
    elements.duelProgressFill.style.width = `${(current / totalRounds) * 100}%`;
  }
  if (elements.duelRoundLabel) {
    elements.duelRoundLabel.textContent = `Round ${current} of ${totalRounds}`;
  }
  updateDuelUI();

  // Clear previous charts
  if (elements.duelChartA) elements.duelChartA.innerHTML = "";
  if (elements.duelChartB) elements.duelChartB.innerHTML = "";

  // Reset card styles
  elements.duelCardA?.classList.remove("picked");
  elements.duelCardB?.classList.remove("picked");

  // Render option A
  const optA = round.option_a;
  if (elements.duelTitleA) elements.duelTitleA.textContent = optA.title;
  if (elements.duelTypeA) elements.duelTypeA.textContent = optA.type;
  if (elements.duelChartA) {
    elements.duelChartA.style.height = "260px";
    renderVisual(optA, elements.duelChartA);
  }

  // Render option B
  const optB = round.option_b;
  if (elements.duelTitleB) elements.duelTitleB.textContent = optB.title;
  if (elements.duelTypeB) elements.duelTypeB.textContent = optB.type;
  if (elements.duelChartB) {
    elements.duelChartB.style.height = "260px";
    renderVisual(optB, elements.duelChartB);
  }

  // Animate in
  elements.duelArena?.classList.remove("fade-out");
  elements.duelArena?.classList.add("fade-in");
}

function handleDuelChoice(choice) {
  if (state.duelBusy) return;
  const round = state.duelRounds[state.duelCurrentRound];
  if (!round) return;
  state.duelBusy = true;

  const optA = round.option_a;
  const optB = round.option_b;
  const isSame = optA.visual_id === optB.visual_id;

  if (choice === "a") {
    state.duelPicked.push(optA);
    elements.duelCardA?.classList.add("picked");
  } else if (choice === "b") {
    state.duelPicked.push(optB);
    elements.duelCardB?.classList.add("picked");
  } else if (choice === "both") {
    state.duelPicked.push(optA);
    if (!isSame) state.duelPicked.push(optB);
    elements.duelCardA?.classList.add("picked");
    elements.duelCardB?.classList.add("picked");
  }
  // "skip" — don't add anything

  updateDuelUI();

  // Animate out, then advance
  elements.duelArena?.classList.remove("fade-in");
  elements.duelArena?.classList.add("fade-out");

  setTimeout(() => {
    state.duelBusy = false;
    state.duelCurrentRound++;
    if (state.duelCurrentRound < state.duelRounds.length) {
      renderDuelRound();
    } else {
      // All rounds done — auto-finish
      finishDuel();
    }
  }, 280);
}

function updateDuelUI() {
  const count = state.duelPicked.length;
  if (elements.duelPickedBadge) {
    elements.duelPickedBadge.textContent = `${count} picked`;
  }
  if (elements.duelDone) {
    elements.duelDone.disabled = count === 0;
  }
  if (elements.duelDoneCount) {
    elements.duelDoneCount.textContent = count > 0 ? `(${count})` : "";
  }
}

async function finishDuel() {
  if (!state.currentDataset) return;

  if (!state.duelPicked.length) {
    showToast("Pick at least one visual first");
    return;
  }

  showToast("Building your dashboard...");
  try {
    const response = await apiFetch(`/visuals/${state.currentDataset.id}/duel-pick`, {
      method: "POST",
      body: JSON.stringify({ picked_visuals: state.duelPicked }),
    });
    state.finalVisuals = response.visuals;
    state.datasetDetail.final_visuals = response.visuals;
    setStep("dashboard");
    renderDashboard();
    showToast("Dashboard ready!");
  } catch (err) {
    console.error("Duel pick failed:", err);
    showToast("Failed to build dashboard. Try again.");
  }
}

function bindEvents() {
  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      await login(form.email.value, form.password.value);
      form.reset();
    } catch (error) {
      showToast(error.message || "Login failed");
    }
  });

  document.getElementById("register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      await register(form.email.value, form.password.value);
      form.reset();
    } catch (error) {
      showToast(error.message || "Register failed");
    }
  });

  elements.loginBtn?.addEventListener("click", () => {
    state.pendingStep = state.step;
    openAuthModal();
  });

  elements.authClose?.addEventListener("click", closeAuthModal);
  elements.themeToggle?.addEventListener("click", toggleTheme);
  elements.backToMenu?.addEventListener("click", () => setStep("upload"));

  /* Drag-drop zone */
  initDropZone();

  /* File input change */
  elements.uploadFiles?.addEventListener("change", (event) => {
    const files = Array.from(event.target?.files || []);
    if (files.length) handleFilesSelected(files);
  });

  /* Upload continue -> category step */
  elements.uploadContinueBtn?.addEventListener("click", () => {
    if (!state.pendingFiles.length) { showToast("Select files to upload"); return; }
    renderCategoryGrid();
    renderCategoryQuestions();
    setStep("category");
  });

  /* Category continue -> setup step */
  elements.categoryContinue?.addEventListener("click", () => {
    const suggested = toSuggestedName(state.pendingFiles[0]?.name) || "New project";
    if (elements.projectSetupForm) {
      const nameInput = elements.projectSetupForm.projectName;
      if (nameInput && !nameInput.value) nameInput.value = suggested;
      updateDatasetNameHint(nameInput?.value || suggested);
      nameInput?.focus();
    }
    elements.projectSetupCard?.classList.remove("hidden");
    setStep("setup");
  });

  /* Project setup form */
  elements.projectSetupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.pendingFiles.length) { showToast("Upload files first"); return; }
    const form = event.target;
    const fallbackName = toSuggestedName(state.pendingFiles[0]?.name) || "New project";
    const projectName = form.projectName.value.trim() || fallbackName;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.classList.add("btn-loading");
    try {
      await createProjectWithUpload(projectName, form.description.value, state.pendingFiles);
      showToast("Files uploaded and analyzed");
    } catch (error) {
      showToast(error.message || "Project setup failed");
    } finally {
      if (submitBtn) submitBtn.classList.remove("btn-loading");
    }
  });

  elements.projectSetupForm?.projectName?.addEventListener("input", (event) => {
    updateDatasetNameHint(event.target.value.trim());
  });

  document.querySelectorAll(".nav-pill").forEach((pill) => {
    pill.addEventListener("click", () => switchNavTab(pill.dataset.nav));
  });

  document.getElementById("refresh-projects")?.addEventListener("click", loadProjects);
  document.getElementById("refresh-datasets")?.addEventListener("click", () => {
    if (state.currentProject) loadDatasets(state.currentProject.id);
  });

  document.getElementById("execute-merge")?.addEventListener("click", async () => {
    try { await executeMerge(); } catch (error) { showToast(error.message || "Merge failed"); }
  });

  document.getElementById("skip-merge")?.addEventListener("click", async () => {
    showToast("Merge skipped");
    try { await generateDashboardVisuals({ silent: true }); setStep("dashboard"); }
    catch (error) { showToast(error.message || "Unable to generate dashboard"); }
  });

  document.getElementById("generate-samples")?.addEventListener("click", async () => {
    try { await generateSampleVisuals(); } catch (error) { showToast(error.message || "Failed to generate visuals"); }
  });

  document.getElementById("finalize-visuals")?.addEventListener("click", async () => {
    try { await finalizeVisuals(); } catch (error) { showToast(error.message || "Failed to build dashboard"); }
  });

  document.getElementById("generate-more")?.addEventListener("click", async () => {
    try { await generateMoreVisuals(); } catch (error) { showToast(error.message || "Failed to generate more visuals"); }
  });

  elements.addVisualBtn?.addEventListener("click", () => openAddVisualPanel());
  elements.closeAddVisual?.addEventListener("click", () => closeAddVisualPanel());

  elements.addVisualForm?.elements
    ?.namedItem("type")
    ?.addEventListener("change", (event) => updateVisualFormFields(event.target.value));

  elements.addVisualForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const fields = form.elements;
    const type = fields.namedItem("type")?.value;
    if (!type) { showToast("Select a chart type"); return; }
    const titleInput = fields.namedItem("title")?.value?.trim();
    const editingVisual = state.finalVisuals.find((v) => v.visual_id === state.editingVisualId);
    const payload = {
      type,
      title: titleInput || editingVisual?.title || "Custom visual",
      visual_id: state.editingVisualId || undefined,
      x: fields.namedItem("x")?.value || undefined,
      y: fields.namedItem("y")?.value || undefined,
      values: fields.namedItem("values")?.value || undefined,
      aggregation: fields.namedItem("aggregation")?.value || undefined,
      columns: getSelectValues(fields.namedItem("columns")),
    };
    if (type === "table" && !payload.columns.length) { showToast("Select at least one column for the table"); return; }
    if (["line", "scatter"].includes(type) && (!payload.x || !payload.y)) { showToast("Select both X and Y columns"); return; }
    if (["bar", "pie"].includes(type) && !payload.x) { showToast("Select a category column"); return; }
    if (type === "histogram" && !payload.values) { showToast("Select a value column"); return; }
    if (["bar", "pie"].includes(type) && !payload.values && payload.aggregation && payload.aggregation !== "count") { showToast("Select a value column for this aggregation"); return; }
    try {
      await createCustomVisual(payload);
      closeAddVisualPanel();
      showToast("Visual updated on dashboard");
    } catch (error) { showToast(error.message || "Unable to add visual"); }
  });

  document.getElementById("refresh-dashboard")?.addEventListener("click", () => {
    renderDashboard();
  });

  /* CSV export */
  elements.exportCsv?.addEventListener("click", exportDatasetCsv);

  /* Custom date range */
  elements.dateRangeStart?.addEventListener("change", (e) => {
    state.customDateRange.start = e.target.value || null;
    renderDashboard();
  });
  elements.dateRangeEnd?.addEventListener("change", (e) => {
    state.customDateRange.end = e.target.value || null;
    renderDashboard();
  });

  /* Clear all filters */
  elements.clearAllFilters?.addEventListener("click", () => {
    state.datePreset = "all";
    state.customDateRange = { start: null, end: null };
    updateFilterBar();
    renderDashboard();
  });

  /* Duel mode — click card to pick, skip button to skip */
  elements.duelCardA?.addEventListener("click", () => handleDuelChoice("a"));
  elements.duelCardB?.addEventListener("click", () => handleDuelChoice("b"));
  elements.duelSkip?.addEventListener("click", () => handleDuelChoice("skip"));
  elements.duelDone?.addEventListener("click", () => finishDuel());

  elements.continueSave?.addEventListener("click", () => setStep("save"));
  elements.saveStartOver?.addEventListener("click", () => startNewAnalysis());
  elements.saveLoginCta?.addEventListener("click", () => { state.pendingStep = "save"; openAuthModal(); });

  elements.logoutBtn?.addEventListener("click", () => {
    state.token = null;
    state.email = null;
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    state.projectSummaries = {};
    startNewAnalysis();
    setAuthenticatedView();
  });
}

async function init() {
  applyTheme(state.theme);
  setStep("upload");
  setAuthenticatedView();
  bindEvents();
  elements.projectListSkeleton?.classList.remove("hidden");
  /* Always start on the main upload page */
  sessionStorage.removeItem(SESSION_KEY);
  try {
    await loadProjects();
    setStep("upload");
  } catch (_error) {
    showToast("Unable to load projects yet. Please try again.");
    if (state.token) {
      state.token = null;
      localStorage.removeItem("token");
      setAuthenticatedView();
    }
  } finally {
    elements.projectListSkeleton?.classList.add("hidden");
  }
}

init();
