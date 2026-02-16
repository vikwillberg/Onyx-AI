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
  authModalContext: null,
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
  savedDashboard: false,
  aiChatHistory: [],
  aiChatDone: false,
  aiChatBusy: false,
};

const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#0d9488",
  accent: "#f59e0b",
  palette: ["#6366f1", "#0d9488", "#e11d48", "#0ea5e9", "#8b5cf6", "#059669", "#f97316", "#ec4899", "#14b8a6", "#3b82f6", "#64748b", "#eab308"],
};

function getActivePalette() {
  const cat = state.businessCategory;
  if (cat && CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return CHART_COLORS.palette;
}

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

function smartDecimals(value) {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  if (Number.isInteger(value)) return 0;
  if (abs >= 1000) return 0;
  if (abs >= 100) return 1;
  if (abs >= 1) return 2;
  return 2;
}

function smartNumberFormat(value) {
  const decimals = smartDecimals(value);
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value);
}

const KPI_NUMBER_FORMAT = { format: (v) => smartNumberFormat(v) };
const KPI_CURRENCY_FORMAT = { format: (v) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: smartDecimals(v) }).format(v) };

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
  appSidebar: document.getElementById("app-sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebarCollapse: document.getElementById("sidebar-collapse"),
  sidebarNewProject: document.getElementById("sidebar-new-project"),
  sidebarProjectList: document.getElementById("sidebar-project-list"),
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
  filterColumn: document.getElementById("filter-column"),
  filterValue: document.getElementById("filter-value"),
  filterAddBtn: document.getElementById("filter-add-btn"),
  activeFilters: document.getElementById("active-filters"),
  filtersEmpty: document.getElementById("filters-empty"),
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
  inlineCategoryWrap: document.getElementById("inline-category-wrap"),
  updateDataBtn: document.getElementById("update-data-btn"),
  aiChatSection: document.getElementById("ai-chat-section"),
  aiChatMessages: document.getElementById("ai-chat-messages"),
  aiChatInput: document.getElementById("ai-chat-input"),
  aiChatSend: document.getElementById("ai-chat-send"),
  aiChatGenerate: document.getElementById("ai-chat-generate"),
  aiChatDone: document.getElementById("ai-chat-done"),
  aiChatSuggestions: document.getElementById("ai-chat-suggestions"),
  aiChatPlan: document.getElementById("ai-chat-plan"),
  aiChatModelBadge: document.getElementById("ai-chat-model-badge"),
  dashChatPanel: document.getElementById("dash-chat-panel"),
  dashChatToggle: document.getElementById("dash-chat-toggle"),
  dashChatClose: document.getElementById("dash-chat-close"),
  dashChatMessages: document.getElementById("dash-chat-messages"),
  dashChatInput: document.getElementById("dash-chat-input"),
  dashChatSend: document.getElementById("dash-chat-send"),
  dashChatSuggestions: document.getElementById("dash-chat-suggestions"),
  duelRoundContext: document.getElementById("duel-round-context"),
  duelPickBoth: document.getElementById("duel-pick-both"),
  insightsStrip: document.getElementById("insights-strip"),
};

const stepSections = {
  upload: [elements.projectsSection],
  "ai-chat": [elements.aiChatSection],
  duel: [elements.duelSection],
  dataset: [elements.datasetSection],
  merge: [elements.mergeSection],
  dashboard: [elements.dashboardSection],
  save: [elements.saveSection],
};
const allStepSections = Object.values(stepSections).flat();

/* ===== Auto-save ===== */
let _autoSaveTimer = null;
let _autoSaving = false;
function scheduleAutoSave(delayMs = 3000) {
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => autoSaveDashboard(), delayMs);
}
async function autoSaveDashboard() {
  if (_autoSaving || !state.currentProject || !state.token || !state.finalVisuals.length) return;
  _autoSaving = true;
  const statusEl = document.getElementById("auto-save-status");
  if (statusEl) { statusEl.textContent = "Saving…"; statusEl.className = "auto-save-status visible saving"; }
  try {
    /* Capture thumbnail */
    let thumb = null;
    const target = document.getElementById("dashboard-section");
    if (target && typeof html2canvas === "function") {
      try {
        const canvas = await html2canvas(target, {
          scale: 0.35, useCORS: true, logging: false,
          backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg") || "#ffffff",
          width: target.scrollWidth, height: Math.min(target.scrollHeight, 900),
        });
        thumb = canvas.toDataURL("image/jpeg", 0.5);
      } catch (_) {}
    }
    const patch = {};
    if (thumb) patch.thumbnail_data_url = thumb;
    if (Object.keys(patch).length) {
      const updated = await apiFetch(`/projects/${state.currentProject.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (updated.thumbnail_data_url) state.currentProject.thumbnail_data_url = updated.thumbnail_data_url;
      const idx = state.projects.findIndex((p) => p.id === state.currentProject.id);
      if (idx >= 0) state.projects[idx] = { ...state.projects[idx], ...state.currentProject };
      renderProjectList();
    }
    if (statusEl) { statusEl.textContent = "✓ Saved"; statusEl.className = "auto-save-status visible saved"; }
    setTimeout(() => { if (statusEl) statusEl.className = "auto-save-status"; }, 2500);
  } catch (_e) {
    if (statusEl) { statusEl.textContent = ""; statusEl.className = "auto-save-status"; }
  }
  _autoSaving = false;
}

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
    /* Update Plotly charts in-place instead of full re-render for smooth transition */
    const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.dark;
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((chart) => {
      if (!chart._fullLayout) return;
      Plotly.relayout(chart, {
        "font.color": theme.font,
        "xaxis.gridcolor": theme.grid,
        "xaxis.linecolor": theme.line,
        "xaxis.tickcolor": theme.line,
        "xaxis.tickfont.color": theme.axisTick,
        "yaxis.gridcolor": theme.grid,
        "yaxis.linecolor": theme.line,
        "yaxis.tickcolor": theme.line,
        "yaxis.tickfont.color": theme.axisTick,
      });
    });
  }
}

function updateCurrentProjectName() {
  const projectName = state.currentProject?.name || "";
  if (elements.currentProjectName) {
    elements.currentProjectName.textContent = projectName;
  }
  if (elements.dashboardProjectTitle) {
    elements.dashboardProjectTitle.textContent = projectName || "Dashboard";
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

function openAuthModal(options = {}) {
  if (!elements.authModal) return;
  const {
    tab = "login",
    loginTitle = "Welcome back",
    subtitle = "Sign in to save dashboards and keep your projects across sessions.",
  } = options;
  const activeTab = tab === "register" ? "register" : "login";
  state.authModalContext = { loginTitle, subtitle };
  elements.authModal.classList.remove("hidden");
  /* Reset to login tab and clear errors */
  const authError = document.getElementById("auth-error");
  if (authError) authError.classList.add("hidden");
  document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === activeTab));
  document.getElementById("login-form")?.classList.toggle("hidden", activeTab !== "login");
  document.getElementById("register-form")?.classList.toggle("hidden", activeTab !== "register");
  const title = document.querySelector(".auth-title");
  if (title) title.textContent = activeTab === "login" ? loginTitle : "Create your account";
  const subtitleEl = document.querySelector(".auth-subtitle");
  if (subtitleEl) subtitleEl.textContent = subtitle;
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
    setTimeout(() => {
      elements.dashboardGrid
        ?.querySelectorAll(".chart")
        .forEach((chart) => Plotly.Plots.resize(chart));
    }, 300);
  }
  const showFilterBar = step === "dashboard";
  elements.filterBar?.classList.toggle("hidden", !showFilterBar);
  elements.kpiStrip?.classList.toggle("hidden", !showFilterBar);
  /* Reset to overview tab when entering dashboard, auto-open AI Assistant */
  if (step === "dashboard") {
    switchNavTab("overview");
    openDashChat();
  }
  updateStepIndicator(step);
  saveSession();
}

const STEP_ORDER = ["upload", "ai-chat", "duel", "dashboard"];
const STEP_LABELS = { upload: "Upload", "ai-chat": "AI Analysis", duel: "Pick Visuals", dashboard: "Dashboard" };

const CATEGORY_COLORS = {
  restaurant: ["#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a", "#0d9488", "#0284c7", "#7c3aed", "#db2777", "#f43f5e", "#fb923c"],
  coffee_shop: ["#78350f", "#92400e", "#a16207", "#854d0e", "#713f12", "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fde68a", "#ca8a04", "#eab308"],
  ecommerce: ["#7c3aed", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"],
  retail: ["#2563eb", "#3b82f6", "#60a5fa", "#0ea5e9", "#06b6d4", "#14b8a6", "#f97316", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"],
  saas: ["#6366f1", "#8b5cf6", "#a78bfa", "#3b82f6", "#0ea5e9", "#06b6d4", "#10b981", "#22c55e", "#f97316", "#ef4444", "#ec4899", "#64748b"],
  finance: ["#059669", "#10b981", "#34d399", "#0d9488", "#14b8a6", "#0284c7", "#2563eb", "#6366f1", "#dc2626", "#f97316", "#eab308", "#64748b"],
  healthcare: ["#0284c7", "#0ea5e9", "#38bdf8", "#06b6d4", "#14b8a6", "#10b981", "#22c55e", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#64748b"],
  education: ["#2563eb", "#3b82f6", "#6366f1", "#8b5cf6", "#a78bfa", "#f97316", "#eab308", "#22c55e", "#10b981", "#ef4444", "#ec4899", "#64748b"],
  marketing: ["#f97316", "#f59e0b", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#06b6d4", "#14b8a6", "#64748b", "#dc2626"],
  logistics: ["#0284c7", "#2563eb", "#0ea5e9", "#06b6d4", "#0d9488", "#f97316", "#d97706", "#dc2626", "#64748b", "#475569", "#22c55e", "#8b5cf6"],
  real_estate: ["#059669", "#10b981", "#0d9488", "#0284c7", "#2563eb", "#d97706", "#b45309", "#78350f", "#64748b", "#6366f1", "#ef4444", "#f59e0b"],
};

function updateStepIndicator(step) {
  if (!elements.stepIndicator) return;
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0 || (step === "dashboard" && state.savedDashboard)) {
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

function promptAuthToSaveDashboard() {
  if (state.token || state.authPrompted || !state.finalVisuals.length) return;
  state.pendingStep = "save";
  openAuthModal({
    loginTitle: "Save your dashboard",
    subtitle: "You're in guest mode. Sign in or create an account to save your dashboard progress and access it later.",
  });
  state.authPrompted = true;
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
  if (elements.inlineCategoryWrap) elements.inlineCategoryWrap.classList.add("hidden");
  if (elements.uploadContinueBtn) { elements.uploadContinueBtn.disabled = true; elements.uploadContinueBtn.classList.remove("btn-loading"); }
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
  const DICT_PATTERNS = ["dictionary", "data_dict", "codebook", "metadata", "column_desc", "field_desc", "schema", "lookup", "legend"];
  elements.selectedFiles.innerHTML = files.map((f, i) => {
    const size = f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`;
    const stem = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[-\s]/g, "_");
    const isDict = DICT_PATTERNS.some((p) => stem.includes(p));
    const badge = isDict ? '<span class="file-chip-badge">📖 Dictionary</span>' : '';
    return `<div class="file-chip${isDict ? ' file-chip-dict' : ''}">${badge}<span>${f.name}</span><span class="file-chip-size">${size}</span><span class="file-chip-remove" data-idx="${i}">&times;</span></div>`;
  }).join("");
  elements.selectedFiles.querySelectorAll(".file-chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.pendingFiles.splice(Number(btn.dataset.idx), 1);
      showFileChips(state.pendingFiles);
      if (!state.pendingFiles.length) {
        if (elements.uploadContinueBtn) elements.uploadContinueBtn.disabled = true;
        if (elements.inlineCategoryWrap) elements.inlineCategoryWrap.classList.add("hidden");
      }
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
    });
  });
}

function renderCategoryQuestions() {
  if (elements.categoryQuestions) elements.categoryQuestions.classList.add("hidden");
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

/* ===== Insights Strip ===== */
const INSIGHT_CATEGORY_META = {
  trend:          { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`, label: "Trend" },
  comparison:     { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`, label: "Comparison" },
  anomaly:        { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, label: "Anomaly" },
  recommendation: { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>`, label: "Recommendation" },
  distribution:   { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`, label: "Distribution" },
};
async function renderInsightsStrip() {
  if (!elements.insightsStrip) return;
  elements.insightsStrip.innerHTML = "";
  const wrap = document.getElementById("insights-strip-wrap");

  if (state.currentDataset) {
    /* Show loading skeleton while fetching */
    elements.insightsStrip.innerHTML = Array.from({ length: 4 }, () =>
      `<div class="insight-card insight-skeleton"><div class="skeleton-line skeleton-short"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-med"></div></div>`
    ).join("");
    try {
      const resp = await apiFetch(`/visuals/${state.currentDataset.id}/insights`);
      elements.insightsStrip.innerHTML = "";
      if (resp.insights && resp.insights.length) {
        resp.insights.slice(0, 8).forEach((item) => {
          const text = typeof item === "string" ? item : (item.text || JSON.stringify(item));
          const category = (typeof item === "object" && item.category) ? item.category : "trend";
          const meta = INSIGHT_CATEGORY_META[category] || INSIGHT_CATEGORY_META.trend;
          const card = document.createElement("div");
          card.className = `insight-card insight-cat-${category}`;
          card.innerHTML = `
            <div class="insight-visual">${meta.icon}</div>
            <div class="insight-body">
              <div class="insight-label">${meta.label}</div>
              <div class="insight-text">${text}</div>
            </div>`;
          elements.insightsStrip.appendChild(card);
        });
        return;
      }
    } catch (_e) { /* fall through */ }
  }

  if (wrap) wrap.classList.add("hidden");
}

/* ===== Nav Pills (Overview / Key Insights / Data) ===== */
function switchNavTab(tab) {
  const pills = document.querySelectorAll(".nav-pill");
  pills.forEach((pill) => pill.classList.toggle("active", pill.dataset.nav === tab));

  const kpiStrip = document.getElementById("kpi-strip");
  const insightsWrap = document.getElementById("insights-strip-wrap");
  const filterBar = elements.filterBar;
  const dashboardCanvas = document.querySelector(".dashboard-canvas");
  const analyticsView = document.getElementById("analytics-view");
  const dataView = document.getElementById("data-view");

  const isOverview = tab === "overview";
  const isAnalytics = tab === "analytics";
  const isData = tab === "data";

  /* Overview: show KPI strip, filter bar, dashboard grid */
  if (kpiStrip) kpiStrip.classList.toggle("hidden", !isOverview);
  if (filterBar) filterBar.classList.toggle("hidden", !isOverview);
  if (dashboardCanvas) dashboardCanvas.classList.toggle("hidden", !isOverview);

  /* Key Insights: show only insights strip */
  if (insightsWrap) insightsWrap.classList.toggle("hidden", !isAnalytics);

  /* Data: show analytics overview cards + data table */
  if (analyticsView) analyticsView.classList.toggle("hidden", !isData);
  if (dataView) dataView.classList.toggle("hidden", !isData);

  if (isAnalytics) renderInsightsStrip();
  if (isData) { renderAnalyticsView(); renderDataView(); }

  /* Resize charts when switching back to overview */
  if (isOverview) {
    setTimeout(() => {
      elements.dashboardGrid?.querySelectorAll(".chart").forEach((c) => Plotly.Plots.resize(c));
    }, 100);
  }
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

    /* --- Column profile cards --- */
    const profile = getActiveProfile();
    const profileCols = profile?.columns || [];
    const totalRows = profile?.row_count || rows.length;
    let profileHtml = "";

    if (profileCols.length) {
      const valueCounts = {};
      columns.forEach((colName) => {
        const counts = {};
        rows.forEach((row) => { const v = row[colName]; if (v != null && v !== "") counts[v] = (counts[v] || 0) + 1; });
        valueCounts[colName] = counts;
      });

      const cards = profileCols.map((col) => {
        const isNumeric = ["integer", "float", "number", "numeric"].includes((col.inferred_type || "").toLowerCase());
        const isDate = ["datetime", "date", "timestamp"].includes((col.inferred_type || "").toLowerCase());
        const nullPct = col.null_ratio != null ? (col.null_ratio * 100).toFixed(0) : 0;
        const completePct = col.null_ratio != null ? ((1 - col.null_ratio) * 100).toFixed(0) : 100;
        const barColor = completePct >= 95 ? "var(--accent-green)" : completePct >= 80 ? "var(--accent-2)" : "var(--accent-red)";

        let detailHtml = "";
        if (isNumeric) {
          const minV = col.min_value != null ? Number(col.min_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          const maxV = col.max_value != null ? Number(col.max_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          const meanV = col.mean_value != null ? Number(col.mean_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
          detailHtml = `<div class="dp-card-stats">
            <div class="dp-stat"><span class="dp-stat-label">Min</span><span class="dp-stat-value">${minV}</span></div>
            <div class="dp-stat"><span class="dp-stat-label">Max</span><span class="dp-stat-value">${maxV}</span></div>
            <div class="dp-stat"><span class="dp-stat-label">Mean</span><span class="dp-stat-value">${meanV}</span></div>
          </div>`;
        } else if (isDate) {
          const minD = col.min_value || "—";
          const maxD = col.max_value || "—";
          detailHtml = `<div class="dp-card-range"><span>${minD}</span><span style="color:var(--muted)">→</span><span>${maxD}</span></div>`;
        } else {
          const counts = valueCounts[col.name] || {};
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
          const totalNonNull = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
          if (sorted.length) {
            detailHtml = `<div class="dp-card-top-values">${sorted.map(([val, cnt]) => {
              const pct = ((cnt / totalNonNull) * 100).toFixed(0);
              return `<div class="dp-top-row">
                <span class="dp-top-label" title="${val}">${val}</span>
                <div class="dp-top-bar-wrap"><div class="dp-top-bar" style="width:${pct}%"></div></div>
                <span class="dp-top-pct">${pct}%</span>
              </div>`;
            }).join("")}</div>`;
          }
        }

        return `<div class="dp-card">
          <div class="dp-card-header">
            <span class="dp-card-name">${col.name}</span>
            <span class="dp-card-type">${col.inferred_type}</span>
          </div>
          <div class="dp-card-unique">${col.unique_count != null ? col.unique_count.toLocaleString() : "—"} unique <span class="dp-card-unique-pct">(${totalRows > 0 && col.unique_count != null ? ((col.unique_count / totalRows) * 100).toFixed(0) : 0}%)</span></div>
          <div class="dp-card-complete">
            <div class="dp-card-complete-bar"><div style="width:${completePct}%;background:${barColor}"></div></div>
            <span>${completePct}% complete</span>
          </div>
          ${detailHtml}
        </div>`;
      }).join("");

      profileHtml = `<div class="data-profile-section">
        <h4 style="margin:0 0 12px;font-size:0.95rem;font-weight:700;font-family:'Space Grotesk','Inter',sans-serif">Column Profiles</h4>
        <div class="data-profile-cards">${cards}</div>
      </div>`;
    }

    /* --- Data table --- */
    const headerHtml = columns.map((c) => `<th>${c}</th>`).join("");
    const bodyHtml = rows.map((row) => `<tr>${columns.map((c) => `<td>${row[c] ?? ""}</td>`).join("")}</tr>`).join("");

    container.innerHTML = `
      ${profileHtml}
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
        scheduleFilterRebuild();
      });
    });
  }
  if (elements.customDateRange) {
    elements.customDateRange.classList.toggle("hidden", state.datePreset !== "custom");
  }
  const count = (state.datePreset !== "all" ? 1 : 0) + state.dashboardFilters.length;
  if (elements.filterCountBadge) {
    elements.filterCountBadge.textContent = `${count} active`;
    elements.filterCountBadge.classList.toggle("hidden", count === 0);
  }
  populateFilterColumns();
}

function getDataMaxDate() {
  const profile = getActiveProfile();
  const cols = profile?.columns || [];
  let maxDate = null;
  for (const col of cols) {
    if (col.inferred_type === "datetime" && col.max_value) {
      const d = new Date(col.max_value);
      if (!isNaN(d.getTime()) && (!maxDate || d > maxDate)) maxDate = d;
    }
  }
  return maxDate;
}

function getDateFilterRange() {
  if (state.datePreset === "all") return null;
  const endDate = getDataMaxDate() || new Date();
  let start = null;
  if (state.datePreset === "7d") start = new Date(endDate - 7 * 86400000);
  else if (state.datePreset === "30d") start = new Date(endDate - 30 * 86400000);
  else if (state.datePreset === "90d") start = new Date(endDate - 90 * 86400000);
  else if (state.datePreset === "ytd") start = new Date(endDate.getFullYear(), 0, 1);
  else if (state.datePreset === "custom") {
    start = state.customDateRange.start ? new Date(state.customDateRange.start) : null;
    const end = state.customDateRange.end ? new Date(state.customDateRange.end) : null;
    return start || end ? { start, end } : null;
  }
  return start ? { start, end: endDate } : null;
}

/* ===== Server-Side Filter Rebuild ===== */
let _filterTimer = null;
let _filterBusy = false;
function scheduleFilterRebuild(delayMs = 400) {
  if (_filterTimer) clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => applyServerFilters(), delayMs);
}
async function applyServerFilters() {
  if (_filterBusy || !state.currentDataset || !state.finalVisuals.length) {
    renderDashboard();
    return;
  }
  const dateRange = getDateFilterRange();
  const hasFilters = dateRange || state.dashboardFilters.length;
  if (!hasFilters) {
    /* No filters — restore original visuals from saved data */
    if (state._unfilteredVisuals) {
      state.finalVisuals = state._unfilteredVisuals;
      state._unfilteredVisuals = null;
    }
    renderDashboard();
    return;
  }
  /* Save unfiltered visuals so we can restore later */
  if (!state._unfilteredVisuals) {
    state._unfilteredVisuals = state.finalVisuals;
  }
  _filterBusy = true;
  try {
    const payload = {};
    if (dateRange?.start) payload.date_start = dateRange.start.toISOString().slice(0, 10);
    if (dateRange?.end) payload.date_end = dateRange.end.toISOString().slice(0, 10);
    if (state.dashboardFilters.length) {
      payload.column_filters = state.dashboardFilters.map((f) => ({ column: f.column, value: f.value }));
    }
    const resp = await apiFetch(`/visuals/${state.currentDataset.id}/filter`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (resp.visuals) {
      /* Merge layout from current grid into filtered results */
      state.finalVisuals = mergeVisualLayouts(resp.visuals, state._unfilteredVisuals || state.finalVisuals);
      renderDashboard();
    }
  } catch (err) {
    console.error("Filter rebuild failed:", err);
    renderDashboard();
  }
  _filterBusy = false;
}

/* ===== Sidebar Toggle ===== */
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  const workspace = document.querySelector(".dashboard-workspace");
  if (workspace) workspace.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
}

/* ===== Dashboard Snapshot Export ===== */
async function exportDashboardSnapshot() {
  if (!elements.dashboardSection) { showToast("No dashboard to export"); return; }
  showToast("Capturing dashboard...");
  try {
    const target = elements.dashboardSection;
    const canvas = await html2canvas(target, {
      backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg") || "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.currentProject?.name || state.currentDataset?.name || "dashboard"}-snapshot.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Snapshot saved");
  } catch (err) {
    console.error("Snapshot failed:", err);
    showToast("Failed to capture dashboard");
  }
}

/* ===== AI Chat ===== */
function simpleMarkdown(text) {
  // Convert simple markdown patterns to HTML for AI messages
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Convert bullet/numbered lists into proper HTML lists
  const lines = html.split("\n");
  let inList = false;
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = /^[-•]\s/.test(trimmed);
    const isNumbered = /^\d+\.\s/.test(trimmed);
    if (isBullet || isNumbered) {
      if (!inList) { out.push("<ul style='margin:2px 0;padding-left:18px'>"); inList = true; }
      const content = trimmed.replace(/^[-•]\s*/, "").replace(/^\d+\.\s*/, "");
      out.push(`<li>${content}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      if (trimmed === "") {
        out.push("<br>");
      } else {
        out.push(`<span>${trimmed}</span>`);
      }
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

function appendChatBubble(role, text) {
  if (!elements.aiChatMessages) return;
  const bubble = document.createElement("div");
  bubble.className = `ai-chat-bubble ${role}`;
  if (role === "typing") {
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  } else if (role === "assistant") {
    bubble.innerHTML = simpleMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  elements.aiChatMessages.appendChild(bubble);
  elements.aiChatMessages.scrollTo({ top: elements.aiChatMessages.scrollHeight, behavior: "smooth" });
  return bubble;
}

function showSuggestionChips(chips) {
  if (!elements.aiChatSuggestions) return;
  elements.aiChatSuggestions.innerHTML = "";
  chips.forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "ai-chat-chip";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      elements.aiChatSuggestions.classList.add("hidden");
      if (elements.aiChatInput) elements.aiChatInput.value = label;
      sendAiChat();
    });
    elements.aiChatSuggestions.appendChild(btn);
  });
  elements.aiChatSuggestions.classList.remove("hidden");
}

function hideSuggestionChips() {
  if (elements.aiChatSuggestions) {
    elements.aiChatSuggestions.classList.add("hidden");
    elements.aiChatSuggestions.innerHTML = "";
  }
}

function isLikelyIdentifier(col, rowCount) {
  const name = (col.name || "").toLowerCase().trim();
  if (name === "id" || name.endsWith("_id") || name.endsWith(" id")) return true;
  if (/uuid|guid/.test(name)) return true;
  if (col.unique_count && rowCount > 0 && col.unique_count / rowCount >= 0.9) return true;
  return false;
}

function buildDataAwareSuggestions(isInitial = false) {
  const profile = getActiveProfile();
  const cols = profile?.columns || [];
  const rowCount = profile?.row_count || 0;
  const allNumeric = cols.filter((c) => ["integer", "float", "number", "numeric"].includes((c.inferred_type || "").toLowerCase()));
  const allCat = cols.filter((c) => ["string", "text", "categorical", "object"].includes((c.inferred_type || "").toLowerCase()));
  const dateCols = cols.filter((c) => ["datetime", "date", "timestamp"].includes((c.inferred_type || "").toLowerCase()));

  const numericCols = allNumeric.filter((c) => !isLikelyIdentifier(c, rowCount));
  const catCols = allCat.filter((c) => !isLikelyIdentifier(c, rowCount));

  const chips = ["Looks good, build it!"];
  const fmt = (n) => n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const ADDRESS_HINTS = ["city", "state", "country", "region", "address", "location", "zip", "postal"];
  const addressCat = catCols.find((c) => ADDRESS_HINTS.some((h) => c.name.toLowerCase().includes(h)));

  if (dateCols.length && numericCols.length) {
    chips.push(`Show me ${fmt(numericCols[0].name)} trends over time`);
  }

  if (catCols.length && numericCols.length) {
    chips.push(`Break down ${fmt(numericCols[0].name)} by ${fmt(catCols[0].name)}`);
  }

  if (numericCols.length >= 2) {
    chips.push(`Compare ${fmt(numericCols[0].name)} vs ${fmt(numericCols[1].name)}`);
  } else if (numericCols.length === 1 && !catCols.length) {
    chips.push(`Analyze the distribution of ${fmt(numericCols[0].name)}`);
  }

  if (addressCat) {
    chips.push(`Most popular ${fmt(addressCat.name)}`);
  } else if (dateCols.length) {
    chips.push("Which day or month is busiest?");
  }

  if (catCols.length > 1 && numericCols.length) {
    chips.push(`Top and bottom ${fmt(catCols[0].name)} by ${fmt(numericCols[0].name)}`);
  }

  if (isInitial && chips.length < 4) {
    chips.push("I have a specific question...");
  }

  return chips.slice(0, 4);
}

const PLAN_ICONS = ["📊", "📈", "🏆", "🔍", "💰", "📉", "🎯", "⚡"];
function showPlanPreview(insights) {
  if (!elements.aiChatPlan || !insights) return;
  elements.aiChatPlan.innerHTML = "";
  const title = document.createElement("div");
  title.className = "ai-chat-plan-title";
  title.textContent = "Your dashboard will include:";
  elements.aiChatPlan.appendChild(title);

  const areas = insights.analysis_areas || [];
  const goals = insights.goals || [];
  const items = areas.length > 0
    ? areas.map((a) => (typeof a === "object" ? a.area : a))
    : goals;
  items.slice(0, 8).forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "ai-chat-plan-card";
    card.innerHTML = `<span class="plan-icon">${PLAN_ICONS[i % PLAN_ICONS.length]}</span> ${item}`;
    elements.aiChatPlan.appendChild(card);
  });
  elements.aiChatPlan.classList.remove("hidden");
}

function updateModelBadge(modelName) {
  if (elements.aiChatModelBadge && modelName) {
    elements.aiChatModelBadge.innerHTML = `Powered by <span>${modelName}</span>`;
  }
}

async function sendAiChat() {
  if (state.aiChatBusy) return;
  const input = elements.aiChatInput;
  const msg = input?.value.trim();
  if (!msg || !state.currentDataset) return;

  input.value = "";
  hideSuggestionChips();
  appendChatBubble("user", msg);
  state.aiChatHistory.push({ role: "user", content: msg });

  state.aiChatBusy = true;
  const typingBubble = appendChatBubble("typing", "");

  try {
    const response = await apiFetch(`/datasets/${state.currentDataset.id}/ai-chat`, {
      method: "POST",
      body: JSON.stringify({
        message: msg,
        history: state.aiChatHistory.slice(0, -1),
      }),
    });

    typingBubble?.remove();
    if (response.model_name) updateModelBadge(response.model_name);
    const reply = response.reply || "I couldn't process that. Could you try rephrasing?";
    appendChatBubble("assistant", reply);
    state.aiChatHistory.push({ role: "assistant", content: reply });

    if (response.done) {
      if (response.insights) {
        state.businessContext = response.insights;
        state.businessCategory = response.insights.business_category || null;
      }
      // Show the Start Generating button but keep chat open for more input
      if (elements.aiChatGenerate) elements.aiChatGenerate.classList.remove("hidden");
    } else if (!state.aiChatDone) {
      const userMsgCount = state.aiChatHistory.filter((m) => m.role === "user").length;
      if (userMsgCount <= 2) {
        showSuggestionChips(buildDataAwareSuggestions(false));
      }
    }
  } catch (err) {
    typingBubble?.remove();
    appendChatBubble("assistant", "Something went wrong. Please try again.");
    console.error("AI chat error:", err);
  } finally {
    state.aiChatBusy = false;
  }
}

function initAiChat() {
  state.aiChatHistory = [];
  state.aiChatDone = false;
  if (elements.aiChatMessages) elements.aiChatMessages.innerHTML = "";
  if (elements.aiChatDone) elements.aiChatDone.classList.add("hidden");
  if (elements.aiChatGenerate) elements.aiChatGenerate.classList.add("hidden");
  if (elements.aiChatPlan) { elements.aiChatPlan.classList.add("hidden"); elements.aiChatPlan.innerHTML = ""; }
  if (elements.aiChatModelBadge) elements.aiChatModelBadge.innerHTML = "";
  hideSuggestionChips();

  setStep("ai-chat");

  // Send an initial greeting automatically
  setTimeout(async () => {
    state.aiChatBusy = true;
    const typingBubble = appendChatBubble("typing", "");
    try {
      // Check if any uploaded file looks like a dictionary
      const DICT_PATS = ["dictionary", "data_dict", "codebook", "metadata", "column_desc", "field_desc", "schema", "lookup", "legend"];
      const hasDictFile = (state.pendingFiles || []).some((f) => {
        const stem = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[-\s]/g, "_");
        return DICT_PATS.some((p) => stem.includes(p));
      });
      const greeting = hasDictFile
        ? "Hello, I just uploaded my data along with a data dictionary file. Please use the dictionary to understand what each column means."
        : "Hello, I just uploaded my data.";
      const response = await apiFetch(`/datasets/${state.currentDataset.id}/ai-chat`, {
        method: "POST",
        body: JSON.stringify({ message: greeting, history: [] }),
      });
      typingBubble?.remove();
      if (response.model_name) updateModelBadge(response.model_name);
      const reply = response.reply || "Hi! I've analyzed your data. Tell me what you'd like to explore.";
      appendChatBubble("assistant", reply);
      state.aiChatHistory.push({ role: "user", content: greeting });
      state.aiChatHistory.push({ role: "assistant", content: reply });

      if (response.done && elements.aiChatGenerate) {
        elements.aiChatGenerate.classList.remove("hidden");
      }

      showSuggestionChips(buildDataAwareSuggestions(true));
    } catch (err) {
      typingBubble?.remove();
      appendChatBubble("assistant", "Hi! I've analyzed your data. Tell me what you'd like to explore.");
      console.error("AI chat init error:", err);
    } finally {
      state.aiChatBusy = false;
    }
  }, 300);
}

function showTransition(message, sub) {
  const overlay = document.getElementById("transition-overlay");
  const msgEl = document.getElementById("transition-message");
  if (!overlay) return;
  if (msgEl) msgEl.textContent = message || "Loading...";
  // Add or update sub-text
  let subEl = overlay.querySelector(".transition-sub");
  if (sub) {
    if (!subEl) {
      subEl = document.createElement("p");
      subEl.className = "transition-sub";
      overlay.querySelector(".transition-content")?.appendChild(subEl);
    }
    subEl.textContent = sub;
  } else if (subEl) {
    subEl.remove();
  }
  overlay.classList.remove("hidden");
}

function hideTransition() {
  const overlay = document.getElementById("transition-overlay");
  if (overlay) overlay.classList.add("hidden");
}

async function finishAiChat() {
  showTransition("Generating your visual options...", "Our AI is crafting the best charts for your data");
  try {
    await startDuel();
  } catch (err) {
    showToast(err.message || "Failed to generate visuals");
  } finally {
    hideTransition();
  }
}

/* ===== Dashboard AI Chat Panel ===== */
let dashChatBusy = false;
let _chatSaveTimer = null;
function scheduleChatHistorySave() {
  if (_chatSaveTimer) clearTimeout(_chatSaveTimer);
  _chatSaveTimer = setTimeout(() => {
    if (state.currentProject && state.token && state.aiChatHistory.length) {
      apiFetch(`/projects/${state.currentProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({ chat_history_json: state.aiChatHistory }),
      }).catch(() => {});
    }
  }, 2000);
}

function openDashChat() {
  if (!elements.dashChatPanel) return;
  elements.dashChatPanel.classList.remove("hidden");
  if (!elements.dashChatMessages?.childElementCount) {
    /* Restore saved chat history if available */
    const saved = state.currentProject?.chat_history_json;
    if (saved && saved.length) {
      state.aiChatHistory = saved;
      saved.forEach((msg) => appendDashChatBubble(msg.role, msg.content));
      appendDashChatBubble("assistant", "Welcome back! I remember our previous conversation. How can I help?");
    } else {
      appendDashChatBubble("assistant", "Hi! Ask me anything about your data, request a chart, or generate more visuals.");
      showDashChatSuggestions([
        "Generate more visuals",
        "What are the key trends?",
        "Add a chart comparing top categories",
        "What insights am I missing?",
      ]);
    }
  }
  elements.dashChatInput?.focus();
  resizeDashCharts();
}

function closeDashChat() {
  if (!elements.dashChatPanel) return;
  elements.dashChatPanel.classList.add("hidden");
  resizeDashCharts();
}

function toggleDashChat() {
  if (!elements.dashChatPanel) return;
  const isHidden = elements.dashChatPanel.classList.contains("hidden");
  if (isHidden) openDashChat(); else closeDashChat();
}

function resizeDashCharts() {
  setTimeout(() => {
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((c) => Plotly.Plots.resize(c));
  }, 350);
}

function simpleMarkdown(text) {
  if (!text) return text;
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
  /* Convert lines starting with - or * or numbered lists into <ul>/<ol> */
  const lines = html.split("\n");
  let result = [];
  let inUl = false;
  let inOl = false;
  for (const line of lines) {
    const ulMatch = line.match(/^\s*[-*]\s+(.+)/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (ulMatch) {
      if (!inUl) { result.push("<ul>"); inUl = true; }
      if (inOl) { result.push("</ol>"); inOl = false; }
      result.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inOl) { result.push("<ol>"); inOl = true; }
      if (inUl) { result.push("</ul>"); inUl = false; }
      result.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) { result.push("</ul>"); inUl = false; }
      if (inOl) { result.push("</ol>"); inOl = false; }
      if (line.trim()) result.push(`<p>${line}</p>`);
      else result.push("");
    }
  }
  if (inUl) result.push("</ul>");
  if (inOl) result.push("</ol>");
  return result.join("\n");
}

function appendDashChatBubble(role, html) {
  if (!elements.dashChatMessages) return null;
  const bubble = document.createElement("div");
  bubble.className = `dash-chat-bubble ${role}`;
  if (role === "typing") {
    bubble.textContent = "Thinking...";
  } else if (role === "assistant") {
    bubble.innerHTML = simpleMarkdown(html);
  } else {
    bubble.innerHTML = html;
  }
  elements.dashChatMessages.appendChild(bubble);
  elements.dashChatMessages.scrollTop = elements.dashChatMessages.scrollHeight;
  return bubble;
}

function renderMiniPreview(container, visual) {
  if (!container || !visual.data?.length) return;
  /* Reuse the full renderVisual to get an accurate preview, then compact it */
  try {
    container.classList.add("chart");
    renderVisual(visual, container);
    /* After rendering, override Plotly layout for compact size */
    const plotEl = container.querySelector(".js-plotly-plot") || container;
    if (plotEl && plotEl.layout) {
      Plotly.relayout(plotEl, {
        margin: { t: 6, r: 6, b: 22, l: 28 },
        showlegend: false,
      });
    }
  } catch (_e) { /* silent */ }
}

function showDashChatSuggestions(chips) {
  if (!elements.dashChatSuggestions) return;
  elements.dashChatSuggestions.innerHTML = "";
  chips.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "dash-chat-chip";
    chip.type = "button";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      if (elements.dashChatInput) elements.dashChatInput.value = text;
      sendDashChat();
    });
    elements.dashChatSuggestions.appendChild(chip);
  });
}

function isVisualRequest(text) {
  const lower = text.toLowerCase();
  const vizWords = ["chart", "graph", "visual", "plot", "show me", "create a", "generate a",
    "draw a", "make a", "build a", "display", "bar chart", "line chart", "pie chart",
    "scatter", "histogram", "over time", "trend of", "compare", "breakdown"];
  return vizWords.some((w) => lower.includes(w));
}

function renderDashChatVisualCard(visual) {
  const typeIcons = { kpi: "📊", bar: "📊", line: "📈", pie: "🥧", scatter: "🔵", table: "📋", histogram: "📉", map: "🗺️" };
  const icon = typeIcons[visual.type] || "📊";
  const card = document.createElement("div");
  card.className = "dash-chat-visual-preview";
  card.innerHTML = `
    <div class="dash-chat-preview-header">
      <span class="dash-chat-preview-icon">${icon}</span>
      <div class="dash-chat-preview-info">
        <strong>${visual.title || "Untitled"}</strong>
        <span class="dash-chat-preview-type">${visual.type}</span>
      </div>
    </div>
    <div class="dash-chat-preview-chart" id="preview-${visual.visual_id}"></div>
    <button class="btn btn-primary btn-sm dash-chat-add-btn" type="button">+ Add to Dashboard</button>
  `;
  card.querySelector(".dash-chat-add-btn").addEventListener("click", () => {
    if (!state.finalVisuals.some((v) => v.visual_id === visual.visual_id)) {
      state.finalVisuals.push(visual);
      if (state.datasetDetail) state.datasetDetail.final_visuals = state.finalVisuals;
    }
    renderDashboard();
    scheduleAutoSave();
    card.querySelector(".dash-chat-add-btn").textContent = "✓ Added";
    card.querySelector(".dash-chat-add-btn").disabled = true;
    card.querySelector(".dash-chat-add-btn").classList.add("added");
  });
  elements.dashChatMessages.appendChild(card);
  try {
    const previewEl = card.querySelector(`#preview-${visual.visual_id}`);
    if (previewEl && visual.type !== "kpi" && visual.type !== "table") {
      renderMiniPreview(previewEl, visual);
    }
  } catch (_e) { /* preview rendering is optional */ }
}

async function sendDashChat() {
  if (dashChatBusy || !elements.dashChatInput) return;
  const message = elements.dashChatInput.value.trim();
  if (!message) return;
  elements.dashChatInput.value = "";
  elements.dashChatInput.style.height = "auto";
  if (elements.dashChatSuggestions) elements.dashChatSuggestions.innerHTML = "";

  appendDashChatBubble("user", message);
  dashChatBusy = true;
  const typingBubble = appendDashChatBubble("typing", "");

  try {
    /* Detect if user is asking for a specific visual */
    const wantsVisual = isVisualRequest(message);

    if (wantsVisual) {
      /* --- Direct visual generation path --- */
      try {
        const vizResp = await apiFetch(`/visuals/${state.currentDataset.id}/ai-generate`, {
          method: "POST",
          body: JSON.stringify({ prompt: message, history: state.aiChatHistory }),
        });
        typingBubble?.remove();
        const newVisuals = vizResp.visuals || [];
        if (newVisuals.length) {
          const visual = newVisuals[0];
          appendDashChatBubble("assistant", `Here's your **${visual.title}** (${visual.type} chart). Click **Add** to put it on your dashboard:`);
          state.aiChatHistory.push({ role: "user", content: message });
          state.aiChatHistory.push({ role: "assistant", content: `Created a ${visual.type} chart: ${visual.title}` });
          scheduleChatHistorySave();
          renderDashChatVisualCard(visual);
          elements.dashChatMessages.scrollTop = elements.dashChatMessages.scrollHeight;
        } else {
          throw new Error("No visual returned");
        }
      } catch (vizErr) {
        /* Fallback: if AI generation fails, fall through to normal chat */
        console.warn("AI visual generation failed, falling back to chat:", vizErr);
        typingBubble?.remove();
        const fallbackTyping = appendDashChatBubble("typing", "");
        try {
          const response = await apiFetch(`/datasets/${state.currentDataset.id}/ai-chat`, {
            method: "POST",
            body: JSON.stringify({ message, history: state.aiChatHistory }),
          });
          fallbackTyping?.remove();
          const reply = response.reply || "I couldn't generate that visual. Try being more specific about which columns to use.";
          appendDashChatBubble("assistant", reply);
          state.aiChatHistory.push({ role: "user", content: message });
          state.aiChatHistory.push({ role: "assistant", content: reply });
          scheduleChatHistorySave();
        } catch (_e) {
          fallbackTyping?.remove();
          appendDashChatBubble("assistant", "I couldn't generate that visual right now. Please try again.");
        }
      }
    } else {
      /* --- Normal conversational path --- */
      const response = await apiFetch(`/datasets/${state.currentDataset.id}/ai-chat`, {
        method: "POST",
        body: JSON.stringify({ message, history: state.aiChatHistory }),
      });
      typingBubble?.remove();
      const reply = response.reply || "I'm not sure how to help with that. Try asking differently.";
      appendDashChatBubble("assistant", reply);
      state.aiChatHistory.push({ role: "user", content: message });
      state.aiChatHistory.push({ role: "assistant", content: reply });
      scheduleChatHistorySave();

      // If the AI decided it's "done" and has insights, generate visuals as previews
      if (response.done && response.insights) {
        state.businessContext = response.insights;
        appendDashChatBubble("assistant", "Generating visual suggestions...");
        try {
          const vizResp = await apiFetch(`/visuals/${state.currentDataset.id}/dashboard?max_visuals=5`, { method: "POST" });
          const newVisuals = vizResp.visuals || [];
          if (newVisuals.length) {
            appendDashChatBubble("assistant", "Here are some visuals I created. Click **Add** to add any to your dashboard:");
            newVisuals.forEach((visual) => renderDashChatVisualCard(visual));
            elements.dashChatMessages.scrollTop = elements.dashChatMessages.scrollHeight;
          } else {
            appendDashChatBubble("assistant", "I couldn't generate any new visuals for this request.");
          }
        } catch (_e) {
          appendDashChatBubble("assistant", "I couldn't generate visuals, but your conversation is saved.");
        }
      }
    }
  } catch (err) {
    typingBubble?.remove();
    appendDashChatBubble("assistant", "Something went wrong. Please try again.");
    console.error("Dashboard chat error:", err);
  } finally {
    dashChatBusy = false;
  }
}

function initAiChatRefine() {
  state.aiChatDone = false;
  if (elements.aiChatMessages) elements.aiChatMessages.innerHTML = "";
  if (elements.aiChatDone) elements.aiChatDone.classList.add("hidden");
  if (elements.aiChatGenerate) elements.aiChatGenerate.classList.add("hidden");
  if (elements.aiChatPlan) { elements.aiChatPlan.classList.add("hidden"); elements.aiChatPlan.innerHTML = ""; }
  hideSuggestionChips();

  setStep("ai-chat");

  setTimeout(async () => {
    state.aiChatBusy = true;
    const typingBubble = appendChatBubble("typing", "");
    try {
      const refineMsg = "The user already has a dashboard and clicked 'Generate More'. They want additional or different insights. Ask them: are they satisfied with the current dashboard? What other insights would help them? Suggest 2-3 new analysis angles based on the data.";
      const response = await apiFetch(`/datasets/${state.currentDataset.id}/ai-chat`, {
        method: "POST",
        body: JSON.stringify({ message: refineMsg, history: state.aiChatHistory }),
      });
      typingBubble?.remove();
      const reply = response.reply || "How is the dashboard working for you? What other insights would be helpful?";
      appendChatBubble("assistant", reply);
      state.aiChatHistory.push({ role: "user", content: refineMsg });
      state.aiChatHistory.push({ role: "assistant", content: reply });

      showSuggestionChips([
        "Add more variety to the charts",
        "I want deeper trend analysis",
        "Show me segment comparisons",
      ]);
    } catch (err) {
      typingBubble?.remove();
      appendChatBubble("assistant", "How is the dashboard working for you? What other insights would be helpful?");
      console.error("AI chat refine error:", err);
    } finally {
      state.aiChatBusy = false;
    }
  }, 300);
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
      scheduleFilterRebuild();
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
    return { w: 3, h: 1 };
  }

  if (visual.type === "table") {
    if (isSummaryTable) {
      return { w: 6, h: 4 };
    }
    if (columns >= 6) {
      return { w: 12, h: 5 };
    }
    return { w: 6, h: 4 };
  }

  /* Line charts are hero visuals — give them prominent sizing */
  if (visual.type === "line") {
    return { w: 8, h: 3 };
  }

  if (visual.type === "scatter") {
    return { w: 6, h: 3 };
  }

  if (visual.type === "bar") {
    if (dataCount > 10) return { w: 6, h: 4 };
    if (dataCount > 6) return { w: 6, h: 3 };
    return { w: 6, h: 3 };
  }

  if (visual.type === "pie") {
    return { w: 4, h: 3 };
  }

  if (visual.type === "histogram") {
    return { w: 6, h: 3 };
  }

  if (visual.type === "map") {
    return { w: 8, h: 5 };
  }

  return { w: 6, h: 3 };
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
    const primaryHeight = Math.max(primaryDefaults.h, 4);
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
  if (abs >= 1e9) return `$${smartNumberFormat(value / 1e9)}B`;
  if (abs >= 1e6) return `$${smartNumberFormat(value / 1e6)}M`;
  if (abs >= 1e3) return `$${smartNumberFormat(value / 1e3)}K`;
  return KPI_CURRENCY_FORMAT.format(value);
}

function formatKpiValue(value, isCurrency = false) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    if (isCurrency) return formatCurrency(value);
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${smartNumberFormat(value / 1e9)}B`;
    if (abs >= 1e6) return `${smartNumberFormat(value / 1e6)}M`;
    if (abs >= 1e3) return `${smartNumberFormat(value / 1e3)}K`;
    return smartNumberFormat(value);
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
  scheduleAutoSave();

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

async function createProjectWithUpload(projectName, description, files, { skipDuel = false } = {}) {
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
  await uploadDatasetFiles(dataset.id, files, { skipDuel });
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
  if (elements.insightsStrip) elements.insightsStrip.innerHTML = "";
  const insightsWrap = document.getElementById("insights-strip-wrap");
  if (insightsWrap) insightsWrap.classList.add("hidden");
  if (elements.dashChatPanel) elements.dashChatPanel.classList.add("hidden");
  if (elements.dashChatMessages) elements.dashChatMessages.innerHTML = "";
  if (elements.dashChatSuggestions) elements.dashChatSuggestions.innerHTML = "";
  if (state.grid) {
    state.grid.removeAll();
  }
  renderSidebarProjects();
  resetUploadFlow();
  state.authPrompted = false;
  state.savedDashboard = false;
  updateCurrentProjectName();
  setStep("upload");
}

function setAuthenticatedView() {
  const isAuthed = Boolean(state.token);
  const userMenu = document.getElementById("user-menu");
  elements.loginBtn?.classList.toggle("hidden", isAuthed);
  userMenu?.classList.toggle("hidden", !isAuthed);
  if (isAuthed && state.email) {
    const initial = state.email.charAt(0).toUpperCase();
    document.querySelectorAll(".user-avatar").forEach((el) => { el.textContent = initial; });
    const emailDisplay = document.getElementById("user-email-display");
    const dropdownEmail = document.getElementById("user-dropdown-email");
    if (emailDisplay) emailDisplay.textContent = state.email;
    if (dropdownEmail) dropdownEmail.textContent = state.email;
  }
  if (!isAuthed) {
    state.projects = [];
    renderProjectList();
    const dropdown = document.getElementById("user-dropdown");
    if (dropdown) dropdown.classList.add("hidden");
  }
  if (isAuthed) {
    closeAuthModal();
    if (state.pendingStep) {
      const nextStep = state.pendingStep;
      state.pendingStep = null;
      if (nextStep === "save") {
        /* Stay on dashboard and open save modal instead of navigating away */
        if (window._openSaveModal) window._openSaveModal();
        return;
      }
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
  if (response.status === 401 && state.token) {
    state.token = null;
    state.email = null;
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    setAuthenticatedView();
  }
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

async function uploadDatasetFiles(datasetId, files, { skipDuel = false } = {}) {
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
  if (!skipDuel) {
    await startDuel();
  }
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
  state.aiChatHistory = [];
  if (elements.dashChatMessages) elements.dashChatMessages.innerHTML = "";
  if (resetUpload) {
    resetUploadFlow();
  }
  state.businessCategory = project.business_category || null;
  state.businessContext = project.business_context || {};
  saveLastProject(project.id);
  updateCurrentProjectName();
  await loadDatasets(project.id);
  if (!silent) {
    showToast(`Project loaded: ${project.name}`);
  }
  if (!keepStep) {
    // Auto-open dashboard if the latest dataset has saved visuals
    const latest = state.datasets[0];
    if (latest) {
      await selectDataset(latest, { keepStep: true });
      if (state.finalVisuals.length) {
        renderDashboard();
        state.savedDashboard = true;
        setStep("dashboard");
        return;
      }
    }
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
      state.savedDashboard = true;
      setStep("dashboard");
    } else {
      setStep("upload");
    }
  }
  saveSession();
}

function renderProjectList() {
  renderSidebarProjects();
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
    const thumbUrl = project.thumbnail_data_url || null;
    const thumbHtml = thumbUrl
      ? `<div class="project-card-thumb"><img src="${thumbUrl}" alt="Dashboard preview" loading="lazy" /></div>`
      : `<div class="project-card-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--muted-light)"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>`;
    const fileCount = summary.fileCount || "";
    card.innerHTML = `
      ${thumbHtml}
      <h4 class="project-card-title">${project.name}</h4>
      ${project.description ? `<p class="project-card-desc">${project.description}</p>` : ""}
      <div class="project-card-meta">
        ${catLabel ? `<span class="project-card-badge">${catLabel}</span>` : ""}
        ${fileCount ? `<span class="project-card-badge" style="background:var(--bg-secondary);color:var(--muted)">${fileCount} file${fileCount > 1 ? "s" : ""}</span>` : ""}
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

/* ===== Sidebar Projects ===== */
const SIDEBAR_PREF_KEY = "onyx_sidebar";

function toggleSidebar(forceState) {
  if (!elements.appSidebar) return;
  const isExpanded = forceState != null ? forceState : elements.appSidebar.classList.contains("collapsed");
  elements.appSidebar.classList.toggle("collapsed", !isExpanded);
  elements.appSidebar.classList.toggle("expanded", isExpanded);
  localStorage.setItem(SIDEBAR_PREF_KEY, isExpanded ? "expanded" : "collapsed");
}

function renderSidebarProjects() {
  if (!elements.sidebarProjectList) return;
  elements.sidebarProjectList.innerHTML = "";

  if (!state.token || !state.projects.length) {
    elements.sidebarProjectList.innerHTML = `<div class="sidebar-empty">${!state.token ? "Log in to see projects" : "No projects yet"}</div>`;
    return;
  }

  state.projects.forEach((project) => {
    const summary = state.projectSummaries[project.id] || {};
    const createdAt = formatProjectDate(summary.createdAt || project.created_at);
    const category = project.business_category;
    const catLabel = category ? CATEGORIES.find((c) => c.key === category)?.label || category : "";
    const isActive = state.currentProject?.id === project.id;

    const item = document.createElement("button");
    item.className = `sidebar-project-item${isActive ? " active" : ""}`;
    item.type = "button";

    const thumbUrl = project.thumbnail_data_url || null;
    const thumbHtml = thumbUrl
      ? `<div class="sidebar-project-thumb"><img src="${thumbUrl}" alt="" loading="lazy" /></div>`
      : `<div class="sidebar-project-thumb"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>`;

    item.innerHTML = `
      <div class="sidebar-project-info">
        <span class="sidebar-project-name">${project.name}</span>
        <div class="sidebar-project-meta">
          ${catLabel ? `<span class="sidebar-project-badge">${catLabel}</span>` : ""}
          <span class="sidebar-project-date">${createdAt}</span>
        </div>
      </div>
      ${thumbHtml}
      <span class="sidebar-project-delete" title="Delete project">&times;</span>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".sidebar-project-delete")) return;
      selectProject(project);
    });
    item.querySelector(".sidebar-project-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteProject(project.id);
    });
    elements.sidebarProjectList.appendChild(item);
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
  promptAuthToSaveDashboard();
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
  promptAuthToSaveDashboard();
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
  if (state.grid) {
    state.grid.removeAll();
    state.grid.destroy(false);
    state.grid = null;
  }
  state.grid = GridStack.init({
    float: false,
    cellHeight: 120,
    margin: 12,
    handle: ".grid-stack-item-content",
    animate: true,
    column: 12,
    resizable: { handles: "e,s,se" },
    draggable: { scroll: true },
    minRow: 1,
  });
  state.grid.on("resizestop", (_event, element) => {
    const chart = element?.querySelector(".chart");
    if (chart) {
      Plotly.Plots.resize(chart);
      setTimeout(() => Plotly.Plots.resize(chart), 200);
    }
    updateLayoutFromGrid();
  });
  state.grid.on("dragstop", () => { updateLayoutFromGrid(); scheduleAutoSave(); });
  state.grid.on("change", () => { updateLayoutFromGrid(); scheduleAutoSave(); });
  state.grid.batchUpdate();

  /* KPIs go into the grid; insights are in the Key Insights tab now */
  if (elements.kpiStrip) elements.kpiStrip.innerHTML = "";

  /* Render KPIs first, then charts */
  const kpiVisuals = state.finalVisuals.filter((v) => v.type === "kpi");
  const chartVisuals = state.finalVisuals.filter((v) => v.type !== "kpi");
  const gridVisuals = [...kpiVisuals, ...chartVisuals];

  gridVisuals.forEach((visual, index) => {
    const isKpi = visual.type === "kpi";
    const defaults = isKpi ? { w: 3, h: 1 } : getDefaultTileLayout(visual);
    const layout = visual.config?.layout;
    const width = typeof layout?.w === "number" ? layout.w : defaults.w;
    const height = typeof layout?.h === "number" ? layout.h : defaults.h;
    const hasLayout = layout && typeof layout.x === "number" && typeof layout.y === "number";
    const widget = document.createElement("div");
    const canEdit = !isKpi;
    widget.dataset.visualId = visual.visual_id;

    if (isKpi) {
      const val = visual.data?.[0]?.value;
      const isCurrency = visual.config?.is_currency === true
        || isCurrencyColumn(visual.title || "")
        || isCurrencyColumn(visual.config?.subtitle || "")
        || isCurrencyColumn(visual.y || visual.values || "");
      const trend = visual.config?.trend_direction ? visual.config : null;
      let trendHtml = "";
      if (trend && trend.trend_direction && trend.trend_direction !== "flat") {
        const cls = trend.trend_direction === "up" ? "up" : "down";
        const arrow = trend.trend_direction === "up" ? "↑" : "↓";
        const pct = trend.trend_percent != null ? `${Math.abs(trend.trend_percent).toFixed(1)}%` : "";
        trendHtml = `<span class="kpi-grid-trend ${cls}">${arrow} ${pct}</span>`;
      }
      widget.innerHTML = `
        <div class="grid-stack-item-content kpi-grid-tile" data-visual-type="kpi">
          <div class="kpi-grid-value">${formatKpiValue(val, isCurrency)}</div>
          <div class="kpi-grid-label">${visual.title}${trendHtml}</div>
        </div>
      `;
    } else {
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
    }
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
    if (!isKpi) {
      renderVisual(visual, widget.querySelector(`#dash-${visual.visual_id}`));
    }
  });
  state.grid.commit();
  requestAnimationFrame(() => {
    updateLayoutFromGrid();
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((chart) => Plotly.Plots.resize(chart));
  });
  /* Multiple delayed resize passes to handle late layout shifts */
  setTimeout(() => {
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((chart) => Plotly.Plots.resize(chart));
  }, 200);
  setTimeout(() => {
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((chart) => Plotly.Plots.resize(chart));
  }, 600);
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
  /* Skip auto-zoom for currency columns — the narrow range causes repeated tick labels */
  let yRange = undefined;
  const isHorizontalBar = visual.type === "bar" && plotData?.[0]?.orientation === "h";
  if (visual.type === "bar" && !isHorizontalBar && plotData?.[0]?.y && yFmt !== "currency") {
    yRange = computeBarYRange(plotData[0].y);
  }

  /* Currency columns need wider left margin for $ prefix; horizontal bars need room for labels */
  const leftMargin = isHorizontalBar ? 110 : yFmt === "currency" ? 60 : 48;

  return {
    title: { text: "", font: { family: "Space Grotesk", size: 14 } },
    margin: isPie
      ? {
          l: 12,
          r: showPieLegend && !isCompact ? 90 : 12,
          t: 10,
          b: showPieLegend && isCompact ? 70 : 28,
        }
      : { l: leftMargin, r: 20, t: 10, b: isHorizontalBar ? 30 : 44 },
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
      title: isHorizontalBar
        ? { text: axisTitles.y, standoff: 8, font: axisTitleFont }
        : { text: axisTitles.x, standoff: 8, font: axisTitleFont },
      tickprefix: isHorizontalBar ? yTickPrefix : "",
      tickformat: isHorizontalBar ? (yTickFormat || undefined) : undefined,
      tickangle: (!isHorizontalBar && (visual.type === "histogram" || (visual.type === "bar" && dataCount > 6))) ? -35 : undefined,
    },
    yaxis: {
      automargin: true,
      gridcolor: isHorizontalBar ? "rgba(0,0,0,0)" : theme.grid,
      zeroline: false,
      linecolor: theme.line,
      tickcolor: theme.line,
      tickfont: axisTickFont,
      tickprefix: isHorizontalBar ? "" : yTickPrefix,
      ticksuffix: isHorizontalBar ? "" : yTickSuffix,
      tickformat: isHorizontalBar ? undefined : (yTickFormat || undefined),
      title: isHorizontalBar
        ? { text: "", standoff: 8, font: axisTitleFont }
        : { text: axisTitles.y, standoff: 8, font: axisTitleFont },
      range: yRange || undefined,
    },
    legend: isPie
      ? pieLegend
      : { orientation: "h", y: -0.2, x: 0, xanchor: "left", font: { size: 10 } },
    showlegend: isPie && showPieLegend,
    uniformtext: { minsize: 9, mode: "hide" },
    hovermode: "closest",
    bargap: 0.28,
    colorway: getActivePalette(),
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
  const isDuel = state.step === "duel";
  if (!isDuel) container.style.height = "100%";
  const filteredData = isDuel ? rawData : applyDashboardFilters(rawData);
  if (!filteredData.length) {
    container.innerHTML = "<p>No data available for this visual.</p>";
    return;
  }

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
    const sorted = [...data].sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0));
    const palette = getActivePalette();
    const useHorizontal = dataCount > 6;
    if (useHorizontal) {
      const displayed = sorted.slice(0, 20).reverse();
      const vals = displayed.map((row) => Number(row[yKey]) || 0);
      const maxVal = Math.max(...vals, 1);
      const baseColor = palette[0];
      const barColors = vals.map((v) => {
        const alpha = 0.35 + 0.65 * (v / maxVal);
        return baseColor + Math.round(alpha * 255).toString(16).padStart(2, "0");
      });
      const hHover = backendCurrency
        ? buildXYHoverTemplate(axisTitles.y, axisTitles.x, "price", xCol)
        : buildXYHoverTemplate(axisTitles.y, axisTitles.x, yCol, xCol);
      plotData = [
        {
          type: "bar",
          orientation: "h",
          y: displayed.map((row) => row[xKey]),
          x: vals,
          marker: { color: barColors, line: { color: theme.line, width: 0.5 } },
          hovertemplate: hHover,
        },
      ];
    } else {
      const barColors = sorted.map((_, i) => palette[i % palette.length]);
      plotData = [
        {
          type: "bar",
          x: sorted.map((row) => row[xKey]),
          y: sorted.map((row) => row[yKey]),
          marker: {
            color: barColors,
            line: { color: theme.line, width: 1 },
            cornerradius: 4,
          },
          hovertemplate: hoverTemplate,
        },
      ];
    }
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
        marker: { colors: getActivePalette(), line: { color: theme.font, width: 1 } },
        hole: 0.45,
        pull: dataCount <= 5 ? 0.03 : 0,
        rotation: 45,
      },
    ];
  } else if (visual.type === "line") {
    const palette = getActivePalette();
    const lineColor = palette[0];
    plotData = [
      {
        type: "scatter",
        mode: "lines+markers",
        x: data.map((row) => row[visual.x]),
        y: data.map((row) => row[visual.y]),
        line: { color: lineColor, width: 2.5, shape: "spline" },
        marker: { color: lineColor, size: 4 },
        hovertemplate: hoverTemplate,
        fill: "tozeroy",
        fillcolor: lineColor + "18",
      },
    ];
  } else if (visual.type === "scatter") {
    const palette = getActivePalette();
    const yVals = data.map((row) => Number(row[visual.y]) || 0);
    plotData = [
      {
        type: "scatter",
        mode: "markers",
        x: data.map((row) => row[visual.x]),
        y: yVals,
        marker: {
          color: yVals,
          colorscale: [[0, palette[1] || "#0d9488"], [1, palette[0] || "#b45309"]],
          size: 8,
          opacity: 0.75,
          line: { color: theme.line, width: 0.5 },
        },
        hovertemplate: hoverTemplate,
      },
    ];
  } else if (visual.type === "histogram") {
    const counts = data.map((row) => row.count);
    const maxCount = Math.max(...counts, 1);
    const palette = getActivePalette();
    const baseColor = palette[2] || "#8b5cf6";
    const bins = data.map((row) => row.bin);
    // Bubble chart: x = bin label, y = count, size = count
    const sizeRef = 2 * maxCount / (40 ** 2);
    plotData = [
      {
        type: "scatter",
        mode: "markers",
        x: bins,
        y: counts,
        marker: {
          size: counts.map((c) => Math.max(c, maxCount * 0.04)),
          sizemode: "area",
          sizeref: sizeRef || 0.1,
          sizemin: 6,
          color: counts,
          colorscale: [[0, baseColor + "44"], [1, baseColor]],
          showscale: false,
          line: { color: baseColor, width: 1 },
        },
        text: counts.map((c, i) => `${bins[i]}: ${c.toLocaleString()}`),
        hovertemplate: "%{text}<extra></extra>",
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
  state.savedDashboard = false;
  state.dashboardFilters = [];
  state.datePreset = "all";
  state.customDateRange = { start: null, end: null };
  showToast("Generating visual options...");
  try {
    const excludeSigs = state.finalVisuals
      .filter((v) => v.type !== "kpi")
      .map((v) => [v.type, v.x || null, v.y || null, v.values || null, v.aggregation || null]);
    const response = await apiFetch(`/visuals/${state.currentDataset.id}/duel-pool`, {
      method: "POST",
      body: JSON.stringify({ exclude_signatures: excludeSigs.length ? excludeSigs : null }),
    });
    state.duelRounds = response.rounds || [];
    state.duelKpis = response.kpis || [];
    state.duelCurrentRound = 0;
    state.duelPicked = [];
    state.duelPoolSize = response.pool_size || 0;

    if (state.duelRounds.length < 1) {
      // No candidates at all — fall back to auto-generate
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
  // Show round context label if available
  if (elements.duelRoundContext) {
    elements.duelRoundContext.textContent = round.round_label || "";
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
      // All rounds done — show full-screen overlay then auto-finish
      showTransition("Building your dashboard...", "Rendering charts and insights");
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
    hideTransition();
    return;
  }

  try {
    const response = await apiFetch(`/visuals/${state.currentDataset.id}/duel-pick`, {
      method: "POST",
      body: JSON.stringify({ picked_visuals: state.duelPicked }),
    });
    // Merge new visuals with existing ones (for "Generate more" flow)
    const existingNonKpi = state.finalVisuals.filter((v) => v.type !== "kpi");
    const newKpis = response.visuals.filter((v) => v.type === "kpi");
    const newNonKpi = response.visuals.filter((v) => v.type !== "kpi");
    state.finalVisuals = [...newKpis, ...existingNonKpi, ...newNonKpi];
    state.datasetDetail.final_visuals = state.finalVisuals;
    setStep("dashboard");
    renderDashboard();
    promptAuthToSaveDashboard();
    showToast("Dashboard ready!");
  } catch (err) {
    console.error("Duel pick failed:", err);
    showToast("Failed to build dashboard. Try again.");
  } finally {
    hideTransition();
  }
}

function bindEvents() {
  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const authError = document.getElementById("auth-error");
    if (authError) authError.classList.add("hidden");
    try {
      await login(form.email.value, form.password.value);
      form.reset();
    } catch (error) {
      if (authError) { authError.textContent = error.message || "Login failed"; authError.classList.remove("hidden"); }
    }
  });

  document.getElementById("register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const authError = document.getElementById("auth-error");
    if (authError) authError.classList.add("hidden");
    try {
      await register(form.email.value, form.password.value);
      form.reset();
    } catch (error) {
      if (authError) { authError.textContent = error.message || "Registration failed"; authError.classList.remove("hidden"); }
    }
  });

  /* Auth tab switching */
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === target));
      document.getElementById("login-form")?.classList.toggle("hidden", target !== "login");
      document.getElementById("register-form")?.classList.toggle("hidden", target !== "register");
      const authError = document.getElementById("auth-error");
      if (authError) authError.classList.add("hidden");
      const modalContext = state.authModalContext || {};
      const title = document.querySelector(".auth-title");
      if (title) title.textContent = target === "login" ? (modalContext.loginTitle || "Welcome back") : "Create your account";
      const subtitle = document.querySelector(".auth-subtitle");
      if (subtitle) {
        subtitle.textContent =
          modalContext.subtitle || "Sign in to save dashboards and keep your projects across sessions.";
      }
    });
  });

  elements.loginBtn?.addEventListener("click", () => {
    state.pendingStep = state.step;
    openAuthModal();
  });

  /* User menu dropdown toggle */
  document.getElementById("user-menu-trigger")?.addEventListener("click", () => {
    const dropdown = document.getElementById("user-dropdown");
    if (dropdown) dropdown.classList.toggle("hidden");
  });
  /* Close dropdown when clicking outside */
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("user-menu");
    const dropdown = document.getElementById("user-dropdown");
    if (menu && dropdown && !menu.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  elements.authClose?.addEventListener("click", closeAuthModal);
  elements.themeToggle?.addEventListener("click", toggleTheme);

  /* Sidebar */
  elements.sidebarToggle?.addEventListener("click", () => toggleSidebar());
  elements.sidebarCollapse?.addEventListener("click", () => toggleSidebar(false));
  elements.sidebarNewProject?.addEventListener("click", () => { toggleSidebar(false); startNewAnalysis(); });
  const savedSidebar = localStorage.getItem(SIDEBAR_PREF_KEY);
  if (savedSidebar === "expanded") toggleSidebar(true);

  /* Drag-drop zone */
  initDropZone();

  /* File input change */
  elements.uploadFiles?.addEventListener("change", (event) => {
    const files = Array.from(event.target?.files || []);
    if (files.length) handleFilesSelected(files);
  });

  /* Upload continue -> auto-create project, upload files, then open AI chat */
  elements.uploadContinueBtn?.addEventListener("click", async () => {
    if (!state.pendingFiles.length) { showToast("Select files to upload"); return; }
    elements.uploadContinueBtn.disabled = true;
    elements.uploadContinueBtn.classList.add("btn-loading");
    try {
      const projectName = toSuggestedName(state.pendingFiles[0]?.name) || "New project";
      await createProjectWithUpload(projectName, "", state.pendingFiles, { skipDuel: true });
      showToast("Files uploaded — let's analyze your data");
      initAiChat();
    } catch (error) {
      showToast(error.message || "Project setup failed");
      elements.uploadContinueBtn.disabled = false;
    } finally {
      elements.uploadContinueBtn.classList.remove("btn-loading");
    }
  });

  /* AI Chat */
  elements.aiChatSend?.addEventListener("click", sendAiChat);
  elements.aiChatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiChat(); }
  });
  elements.aiChatGenerate?.addEventListener("click", async () => {
    showTransition("Generating your visual options...", "Building visuals from your conversation");
    try { await startDuel(); } catch (err) { showToast(err.message || "Failed to generate visuals"); }
    finally { hideTransition(); }
  });
  elements.aiChatDone?.addEventListener("click", finishAiChat);

  /* Dashboard AI Chat */
  elements.dashChatToggle?.addEventListener("click", toggleDashChat);
  elements.dashChatClose?.addEventListener("click", closeDashChat);
  elements.dashChatSend?.addEventListener("click", sendDashChat);
  elements.dashChatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDashChat(); }
  });
  elements.dashChatInput?.addEventListener("input", () => {
    const el = elements.dashChatInput;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
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

  document.getElementById("generate-more")?.addEventListener("click", () => {
    initAiChatRefine();
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

  /* Update Data — upload new files to current dataset */
  elements.updateDataBtn?.addEventListener("click", async () => {
    if (!state.currentDataset) { showToast("No dataset loaded"); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".csv,.tsv,.xlsx,.xls,.xlsb";
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      showToast("Uploading new data...");
      try {
        /* uploadDatasetFiles resets visuals and triggers startDuel internally */
        await uploadDatasetFiles(state.currentDataset.id, files);
      } catch (err) {
        console.error("Update data failed:", err);
        showToast(err.message || "Failed to update data");
      }
    });
    input.click();
  });

  /* Dashboard snapshot export */
  elements.exportCsv?.addEventListener("click", exportDashboardSnapshot);

  /* Custom date range */
  elements.dateRangeStart?.addEventListener("change", (e) => {
    state.customDateRange.start = e.target.value || null;
    scheduleFilterRebuild();
  });
  elements.dateRangeEnd?.addEventListener("change", (e) => {
    state.customDateRange.end = e.target.value || null;
    scheduleFilterRebuild();
  });

  /* Column-value filter controls */
  elements.filterColumn?.addEventListener("change", () => {
    const col = elements.filterColumn.value;
    if (col) populateFilterValues(col);
    else if (elements.filterValue) { elements.filterValue.innerHTML = "<option value=''>Select value…</option>"; elements.filterValue.disabled = true; }
  });
  elements.filterAddBtn?.addEventListener("click", () => {
    const col = elements.filterColumn?.value;
    const val = elements.filterValue?.value;
    if (!col || !val) { showToast("Select a field and value to filter"); return; }
    const exists = state.dashboardFilters.some((f) => f.column === col && f.value === val);
    if (exists) { showToast("Filter already active"); return; }
    state.dashboardFilters.push({ column: col, value: val });
    renderActiveFilters();
    updateFilterBar();
    scheduleFilterRebuild();
    if (elements.filterColumn) elements.filterColumn.value = "";
    if (elements.filterValue) { elements.filterValue.innerHTML = "<option value=''>Select value…</option>"; elements.filterValue.disabled = true; }
  });

  /* Clear all filters */
  elements.clearAllFilters?.addEventListener("click", () => {
    state.datePreset = "all";
    state.customDateRange = { start: null, end: null };
    state.dashboardFilters = [];
    renderActiveFilters();
    updateFilterBar();
    scheduleFilterRebuild();
  });

  /* Duel mode — click card to pick, skip button to skip, pick both */
  elements.duelCardA?.addEventListener("click", () => handleDuelChoice("a"));
  elements.duelCardB?.addEventListener("click", () => handleDuelChoice("b"));
  elements.duelPickBoth?.addEventListener("click", () => handleDuelChoice("both"));
  elements.duelSkip?.addEventListener("click", () => handleDuelChoice("skip"));
  elements.duelDone?.addEventListener("click", () => {
    showTransition("Building your dashboard...", "Rendering charts and insights");
    finishDuel();
  });

  /* Editable dashboard title */
  document.getElementById("dashboard-title-wrap")?.addEventListener("click", () => {
    const titleEl = document.getElementById("dashboard-project-title");
    if (!titleEl || titleEl.querySelector("input")) return;
    const current = titleEl.textContent || "Dashboard";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "dashboard-title-input";
    input.value = current;
    titleEl.textContent = "";
    titleEl.appendChild(input);
    input.focus();
    input.select();
    const commitRename = async () => {
      const newName = input.value.trim() || current;
      titleEl.textContent = newName;
      if (newName !== current && state.currentProject) {
        try {
          await apiFetch(`/projects/${state.currentProject.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: newName }),
          });
          state.currentProject.name = newName;
          updateCurrentProjectName();
          renderProjectList();
        } catch (_e) { /* silent */ }
      }
    };
    input.addEventListener("blur", commitRename, { once: true });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = current; input.blur(); }
    });
  });

  /* Save dashboard — open modal with optional rename + description */
  const saveModal = document.getElementById("save-modal");
  const saveModalForm = document.getElementById("save-modal-form");
  const saveModalName = document.getElementById("save-modal-name");
  const saveModalDesc = document.getElementById("save-modal-desc");

  window._openSaveModal = function openSaveModal() {
    if (!saveModal) return;
    saveModalName.value = state.currentProject?.name || "";
    saveModalDesc.value = state.currentProject?.description || "";
    saveModal.classList.remove("hidden");
  };
  function openSaveModal() { window._openSaveModal(); }
  function closeSaveModal() {
    if (saveModal) saveModal.classList.add("hidden");
  }

  elements.continueSave?.addEventListener("click", () => {
    if (!state.token) {
      showToast("Please log in to save your dashboard");
      state.pendingStep = "save";
      openAuthModal();
      return;
    }
    openSaveModal();
  });

  document.getElementById("save-modal-close")?.addEventListener("click", closeSaveModal);
  document.getElementById("save-modal-cancel")?.addEventListener("click", closeSaveModal);
  saveModal?.addEventListener("click", (e) => { if (e.target === saveModal) closeSaveModal(); });

  async function captureDashboardThumbnail() {
    const target = document.getElementById("dashboard-section");
    if (!target || typeof html2canvas !== "function") return null;
    try {
      const canvas = await html2canvas(target, {
        scale: 0.35,
        useCORS: true,
        logging: false,
        backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg") || "#ffffff",
        width: target.scrollWidth,
        height: Math.min(target.scrollHeight, 900),
      });
      return canvas.toDataURL("image/jpeg", 0.5);
    } catch (_e) {
      return null;
    }
  }

  saveModalForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = saveModalName?.value?.trim();
    const newDesc = saveModalDesc?.value?.trim();

    const patch = {};
    if (newName) patch.name = newName;
    if (newDesc !== undefined) patch.description = newDesc;

    const thumb = await captureDashboardThumbnail();
    if (thumb) patch.thumbnail_data_url = thumb;

    if (state.currentProject && Object.keys(patch).length) {
      try {
        const updated = await apiFetch(`/projects/${state.currentProject.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        if (newName) {
          state.currentProject.name = newName;
          const titleEl = document.getElementById("dashboard-project-title");
          if (titleEl) titleEl.textContent = newName;
          updateCurrentProjectName();
        }
        if (newDesc !== undefined) state.currentProject.description = newDesc;
        if (updated.thumbnail_data_url) state.currentProject.thumbnail_data_url = updated.thumbnail_data_url;
        const idx = state.projects.findIndex((p) => p.id === state.currentProject.id);
        if (idx >= 0) state.projects[idx] = { ...state.projects[idx], ...state.currentProject };
        renderProjectList();
      } catch (_e) { /* silent */ }
    }
    saveSession();
    closeSaveModal();
    showToast("Dashboard saved");
  });

  elements.saveStartOver?.addEventListener("click", () => startNewAnalysis());
  elements.saveLoginCta?.addEventListener("click", () => { state.pendingStep = "save"; openAuthModal(); });

  elements.logoutBtn?.addEventListener("click", () => {
    const dropdown = document.getElementById("user-dropdown");
    if (dropdown) dropdown.classList.add("hidden");
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

  try {
    await loadProjects();
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

  // Restore previous session if available
  const saved = loadSession();
  if (saved && saved.projectId && saved.datasetId && state.token) {
    try {
      const project = state.projects.find((p) => p.id === saved.projectId);
      if (project) {
        state.currentProject = project;
        const datasets = await apiFetch(`/projects/${project.id}/datasets`);
        state.datasets = datasets;
        const ds = datasets.find((d) => d.id === saved.datasetId);
        if (ds) {
          state.currentDataset = ds;
          const detail = await apiFetch(`/datasets/${ds.id}`);
          state.datasetDetail = detail;
          state.finalVisuals = detail.final_visuals || [];
          state.businessContext = project.business_context || {};
          state.businessCategory = project.business_category || null;
          if (saved.step === "dashboard" && state.finalVisuals.length) {
            setStep("dashboard");
            renderDashboard();
          } else {
            setStep("upload");
          }
          return;
        }
      }
    } catch (_e) {
      console.warn("Session restore failed, starting fresh");
    }
  }
  setStep("upload");
}

init();
