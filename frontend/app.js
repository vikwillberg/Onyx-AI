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
  selectedModelKey: localStorage.getItem("onyx_model") || "gemini-2-0-flash",
  availableModels: [],
  focusedVisualId: null,
};

const CHART_COLORS = {
  primary: "#F97316",
  secondary: "#FB923C",
  accent: "#FDBA74",
  palette: ["#F97316", "#0EA5E9", "#6366F1", "#10B981", "#EC4899", "#8B5CF6", "#FDBA74", "#EF4444", "#14B8A6", "#84CC16", "#64748B", "#FB923C"],
};

const COLOR_PALETTES = {
  vibrant:       ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9", "#ef4444", "#14b8a6", "#f97316", "#3b82f6", "#84cc16", "#d946ef"],
  professional:  ["#1e3a8a", "#0f766e", "#3b82f6", "#0d9488", "#64748b", "#1e40af", "#115e59", "#2563eb", "#475569", "#0284c7", "#0e7490", "#334155"],
  dark:          ["#9333ea", "#db2777", "#f59e0b", "#7c3aed", "#ec4899", "#fbbf24", "#a855f7", "#f472b6", "#d97706", "#6d28d9", "#be185d", "#eab308"],
  monochrome:    ["#1c1917", "#44403c", "#78716c", "#a8a29e", "#57534e", "#292524", "#8a8580", "#6b7280", "#374151", "#4b5563", "#9ca3af", "#334155"],
  onyx_default:  ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9", "#ef4444", "#14b8a6"],
};

function getActivePalette() {
  const raw = (state.businessContext?.color_palette || "").toLowerCase().trim();
  if (raw && COLOR_PALETTES[raw]) return COLOR_PALETTES[raw];
  if (raw) {
    const fallback = Object.keys(COLOR_PALETTES).find((k) => raw.includes(k));
    if (fallback) return COLOR_PALETTES[fallback];
  }
  return COLOR_PALETTES.vibrant; /* Default to vibrant multi-color palette */
}

/* Color name → hex mapping for color-matched bar charts */
const COLOR_NAME_MAP = {
  red: "#EF4444", blue: "#3B82F6", green: "#22C55E", yellow: "#EAB308",
  orange: "#F97316", purple: "#A855F7", pink: "#EC4899", black: "#1F2937",
  white: "#E5E7EB", grey: "#6B7280", gray: "#6B7280", brown: "#92400E",
  silver: "#9CA3AF", gold: "#D97706", navy: "#1E3A8A", teal: "#14B8A6",
  cyan: "#06B6D4", magenta: "#D946EF", lime: "#84CC16", indigo: "#6366F1",
  violet: "#7C3AED", maroon: "#991B1B", beige: "#D4C5A9", tan: "#D2B48C",
  coral: "#F87171", salmon: "#FA8072", turquoise: "#2DD4BF", ivory: "#FFFFF0",
  burgundy: "#800020", charcoal: "#374151", cream: "#FFFDD0", khaki: "#BDB76B",
  bronze: "#CD7F32", copper: "#B87333", platinum: "#E5E4E2",
};

function getColorMatchedBarColors(categories, fallbackPalette) {
  const matched = categories.map((cat) => {
    const name = String(cat).toLowerCase().trim();
    return COLOR_NAME_MAP[name] || null;
  });
  if (matched.filter(Boolean).length >= categories.length * 0.5) {
    return matched.map((c, i) => c || fallbackPalette[i % fallbackPalette.length]);
  }
  return null;
}

const PLOTLY_THEMES = {
  dark: {
    axisTitle: "#d6d3d1",
    axisTick: "#fafaf9",
    legend: "#fafaf9",
    grid: "rgba(41, 37, 36, 0.6)",
    font: "#fafaf9",
    line: "rgba(41, 37, 36, 0.7)",
    paper: "#1c1917",
    plot: "#1c1917",
  },
  light: {
    axisTitle: "#44403c",
    axisTick: "#1c1917",
    legend: "#1c1917",
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
  uploadFiles: document.getElementById("upload-files"),
  selectedFiles: document.getElementById("selected-files"),
  homeInput: document.getElementById("home-input"),
  homeSendBtn: document.getElementById("home-send-btn"),
  homeSuggestions: document.getElementById("home-suggestions"),
  homeChatMessages: document.getElementById("home-chat-messages"),
  homeChatArea: document.getElementById("home-chat-area"),
  homeWelcome: document.getElementById("home-welcome"),
  homeDropZone: document.getElementById("home-drop-zone"),
  homeProjectsWrap: document.getElementById("home-projects-wrap"),
  uploadContinueBtn: null,
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
  saveToast: document.getElementById("save-toast"),
  saveToastSignin: document.getElementById("save-toast-signin"),
  saveToastDismiss: document.getElementById("save-toast-dismiss"),
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
  "ai-chat": [elements.projectsSection],
  duel: [elements.projectsSection],
  dataset: [elements.datasetSection],
  merge: [elements.mergeSection],
  dashboard: [elements.dashboardSection],
  save: [elements.saveSection],
};
const allStepSections = [...new Set(Object.values(stepSections).flat())];

/* ===== Hero collapse animation — triggers once on first message ===== */
let _heroCollapsed = false;

function collapseHomeWelcome() {
  /* Reveal chat area immediately so content starts flowing */
  if (elements.homeChatArea) elements.homeChatArea.classList.remove("hidden");

  if (_heroCollapsed) {
    /* Animation already played or element already hidden */
    if (elements.homeWelcome) elements.homeWelcome.classList.add("hidden");
    return;
  }
  _heroCollapsed = true;

  const heroWrap = document.querySelector(".copilot-hero-wrap");
  if (!heroWrap || !elements.homeWelcome) {
    if (elements.homeWelcome) elements.homeWelcome.classList.add("hidden");
    return;
  }

  /* Kick off the CSS animation */
  heroWrap.classList.add("hero-collapsing");

    /* Hide the whole welcome container once the animation finishes */
    const ANIM_MS = 1500;
    setTimeout(() => {
    if (elements.homeWelcome) elements.homeWelcome.classList.add("hidden");
    heroWrap.classList.remove("hero-collapsing");
  }, ANIM_MS);
}

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
  updateSidebarThemeIcon();
}

function updateSidebarThemeIcon() {
  const isDark = state.theme === "dark";
  const label = document.getElementById("sidebar-theme-label");
  if (label) label.textContent = isDark ? "Dark mode" : "Light mode";
  document.querySelectorAll(".sidebar-icon-sun").forEach((el) => { el.style.display = isDark ? "none" : ""; });
  document.querySelectorAll(".sidebar-icon-moon").forEach((el) => { el.style.display = isDark ? "" : "none"; });
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
    resizeDashCharts();
  }
  const showFilterBar = step === "dashboard";
  elements.filterBar?.classList.toggle("hidden", !showFilterBar);
  elements.kpiStrip?.classList.toggle("hidden", !showFilterBar);
  /* Persist session on every step change */
  saveSession();

  /* Home sub-phases: show/hide parts of home section */
  if (step === "upload") {
    if (elements.homeWelcome) elements.homeWelcome.classList.remove("hidden");
    if (elements.homeChatArea) elements.homeChatArea.classList.add("hidden");
    if (elements.homeSendBtn) elements.homeSendBtn.disabled = !state.pendingFiles.length && !elements.homeInput?.value.trim();
    updateMobilePageTitle("Onyx");
    updateMobileBottomNav("home");
  } else if (step === "ai-chat") {
    if (elements.homeWelcome) elements.homeWelcome.classList.add("hidden");
    if (elements.homeChatArea) elements.homeChatArea.classList.remove("hidden");
    updateMobilePageTitle("Onyx");
    updateMobileBottomNav("home");
  }
}

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
  showGenerateDashboardRow(false);
  if (elements.homeSendBtn) elements.homeSendBtn.disabled = true;
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
  state.pendingFiles = [...state.pendingFiles, ...files];
  showFileChips(state.pendingFiles);
  if (elements.homeSendBtn) elements.homeSendBtn.disabled = state.pendingFiles.length === 0;
}

const FILE_DOC_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
const DICT_PATTERNS_CHIP = ["dictionary", "data_dict", "codebook", "metadata", "column_desc", "field_desc", "schema", "lookup", "legend"];

function getFileTypeLabel(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = { csv: "CSV", tsv: "TSV", xlsx: "Excel", xls: "Excel", xlsb: "Excel", json: "JSON" };
  return map[ext] || (ext?.toUpperCase() || "FILE");
}

function truncateFilename(name, maxLen = 18) {
  const noExt = name.replace(/\.[^.]+$/, "");
  if (noExt.length <= maxLen) return noExt;
  const half = Math.floor(maxLen / 2) - 1;
  return noExt.slice(0, half) + "…" + noExt.slice(-half);
}

function buildAttachCardHTML(filename, isDict = false) {
  const typeLabel = getFileTypeLabel(filename);
  const shortName = truncateFilename(filename);
  return `<div class="chat-attach-card${isDict ? " file-chip-dict" : ""}">
    <span class="chat-attach-name">${shortName}</span>
    <div class="chat-attach-type-row">
      <span class="chat-attach-type-icon">${FILE_DOC_SVG}</span>
      <span class="chat-attach-type-label">${typeLabel}</span>
    </div>
  </div>`;
}

function showFileChips(files) {
  if (!elements.selectedFiles) return;
  if (!files.length) { elements.selectedFiles.innerHTML = ""; elements.selectedFiles.classList.add("hidden"); return; }
  elements.selectedFiles.classList.remove("hidden");
  elements.selectedFiles.innerHTML = files.map((f, i) => {
    const typeLabel = getFileTypeLabel(f.name);
    const shortName = truncateFilename(f.name);
    const stem = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[-\s]/g, "_");
    const isDict = DICT_PATTERNS_CHIP.some((p) => stem.includes(p));
    return `<div class="file-chip${isDict ? ' file-chip-dict' : ''}">
      <span class="file-chip-name">${shortName}</span>
      <div class="file-chip-type-row">
        <span class="file-chip-type-icon">${FILE_DOC_SVG}</span>
        <span class="file-chip-type-label">${typeLabel}</span>
      </div>
      <span class="file-chip-remove" data-idx="${i}">&times;</span>
    </div>`;
  }).join("");
  elements.selectedFiles.querySelectorAll(".file-chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.pendingFiles.splice(Number(btn.dataset.idx), 1);
      showFileChips(state.pendingFiles);
      if (!state.pendingFiles.length) {
        if (elements.homeSendBtn && !elements.homeInput?.value.trim()) elements.homeSendBtn.disabled = true;
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
  if (elements.kpiStrip) elements.kpiStrip.innerHTML = "";
}

/* ===== Narrative Story Insights ===== */
const STORY_CATEGORY_ICONS = {
  overview:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  winner:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  opportunity:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  pattern:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  anomaly:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  recommendation: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>`,
};

async function renderInsightsStrip() {
  if (!elements.insightsStrip) return;
  elements.insightsStrip.innerHTML = "";
  const wrap = document.getElementById("insights-strip-wrap");
  if (wrap) wrap.classList.remove("hidden");

  if (state.currentDataset) {
    /* Show loading skeleton for narrative story */
    elements.insightsStrip.innerHTML = `
      <div class="narrative-container narrative-skeleton">
        <div class="narrative-header">
          <div class="skeleton-block skeleton-title"></div>
          <div class="skeleton-block skeleton-intro"></div>
        </div>
        <div class="narrative-loading">
          <div class="narrative-spinner"></div>
          <span>Generating your data story...</span>
        </div>
        ${Array.from({ length: 3 }, (_, i) => `
          <div class="story-section" data-section="${i + 1}" data-category="overview">
            <div class="skeleton-block skeleton-text"></div>
            <div class="skeleton-block skeleton-chart"></div>
          </div>
        `).join("")}
      </div>`;
    
    try {
      const modelKey = state.selectedModelKey || "";
      const resp = await apiFetch(`/visuals/${state.currentDataset.id}/narrative${modelKey ? `?model_key=${encodeURIComponent(modelKey)}` : ""}`);
      elements.insightsStrip.innerHTML = "";
      
      if (resp.insights && resp.insights.length) {
        const container = document.createElement("div");
        container.className = "narrative-container";
        
        /* Story Header */
        container.innerHTML = `
          <div class="narrative-header">
            <h2 class="narrative-title">${resp.story_title || "Your Data Story"}</h2>
            <p class="narrative-intro">${resp.story_intro || "Insights to grow your business"}</p>
          </div>
        `;
        
        /* Story Sections */
        const MAX_INSIGHTS = 8;
        const sectionsGrid = document.createElement("div");
        sectionsGrid.className = "narrative-sections-grid";
        const chartQueue = [];
        resp.insights.slice(0, MAX_INSIGHTS).forEach((insight, index) => {
          const category = insight.category || "overview";
          const icon = STORY_CATEGORY_ICONS[category] || STORY_CATEGORY_ICONS.overview;
          const sectionTitle = insight.section_title || category.charAt(0).toUpperCase() + category.slice(1);
          const hasData = insight.visual_data && insight.visual && insight.visual.type;
          const chartId = `story-chart-${index}`;
          const section = document.createElement("div");
          section.className = "story-section";
          section.dataset.section = index + 1;
          section.dataset.category = category;
          section.innerHTML = `
            <div class="story-section-left">
              <div class="story-section-header">
                <div class="story-section-icon">${icon}</div>
                <div class="story-section-badge">${category.toUpperCase()}</div>
              </div>
              <div class="story-section-headline">${sectionTitle}</div>
              <div class="story-insight-text">${insight.text || ""}</div>
            </div>
            <div class="story-chart chart" id="${chartId}">${hasData ? "" : "<div class=\"story-chart-empty\">Chart loading…</div>"}</div>
          `;
          sectionsGrid.appendChild(section);
          if (hasData) chartQueue.push({ id: chartId, spec: insight.visual, data: insight.visual_data });
        });
        container.appendChild(sectionsGrid);
        elements.insightsStrip.appendChild(container);
        /* Render charts after DOM insertion */
        requestAnimationFrame(() => {
          chartQueue.forEach(({ id, spec, data }) => {
            const el = document.getElementById(id);
            if (el) renderStoryChartHighlighted(el, spec, data);
          });
        });
        return;
      }
    } catch (e) {
      console.warn("Narrative insights failed, trying fallback:", e);
      /* Fallback to simple insights */
      try {
        const fallback = await apiFetch(`/visuals/${state.currentDataset.id}/insights`);
        elements.insightsStrip.innerHTML = "";
        if (fallback.insights && fallback.insights.length) {
          const container = document.createElement("div");
          container.className = "narrative-container";
          container.innerHTML = `<div class="narrative-header"><h2 class="narrative-title">Key Insights</h2></div>`;
          const fallbackGrid = document.createElement("div");
          fallbackGrid.className = "narrative-sections-grid";
          const fallbackQueue = [];
          fallback.insights.slice(0, 8).forEach((item, i) => {
            const text = typeof item === "string" ? item : (item.text || "");
            const category = item.category || "overview";
            const icon = STORY_CATEGORY_ICONS[category] || STORY_CATEGORY_ICONS.overview;
            const headline = item.section_title || category.charAt(0).toUpperCase() + category.slice(1);
            const hasData = item.visual_data && item.visual && item.visual.type;
            const chartId = `story-chart-fb-${i}`;
            const section = document.createElement("div");
            section.className = "story-section";
            section.dataset.section = i + 1;
            section.dataset.category = category;
            section.innerHTML = `
              <div class="story-section-left">
                <div class="story-section-header">
                  <div class="story-section-icon">${icon}</div>
                  <div class="story-section-badge">${category.toUpperCase()}</div>
                </div>
                <div class="story-section-headline">${headline}</div>
                <div class="story-insight-text">${text}</div>
              </div>
              <div class="story-chart chart" id="${chartId}">${hasData ? "" : "<div class=\"story-chart-empty\">No chart data</div>"}</div>
            `;
            fallbackGrid.appendChild(section);
            if (hasData) fallbackQueue.push({ id: chartId, spec: item.visual, data: item.visual_data });
          });
          container.appendChild(fallbackGrid);
          elements.insightsStrip.appendChild(container);
          requestAnimationFrame(() => {
            fallbackQueue.forEach(({ id, spec, data }) => {
              const el = document.getElementById(id);
              if (el) renderStoryChartHighlighted(el, spec, data);
            });
          });
          return;
        }
      } catch (_) { /* fall through */ }
    }
  }

  /* Final fallback: generate stats-based insights from the profile data */
  const profile = getActiveProfile();
  if (profile && profile.columns && profile.columns.length) {
    elements.insightsStrip.innerHTML = "";
    const container = document.createElement("div");
    container.className = "narrative-container";
    container.innerHTML = `<div class="narrative-header"><h2 class="narrative-title">Data Overview</h2><p class="narrative-intro">Key statistics from your dataset</p></div>`;
    const grid = document.createElement("div");
    grid.className = "narrative-sections-grid";
    const cols = profile.columns;
    const numericCols = cols.filter((c) => ["integer", "float", "number", "numeric"].includes((c.inferred_type || "").toLowerCase()));
    const catCols = cols.filter((c) => ["string", "text", "categorical", "object"].includes((c.inferred_type || "").toLowerCase()));
    const statInsights = [];
    statInsights.push({ headline: "Dataset Size", text: `This dataset contains ${(profile.row_count || 0).toLocaleString()} rows and ${cols.length} columns.`, category: "overview" });
    numericCols.slice(0, 3).forEach((col) => {
      const parts = [];
      if (col.min_value != null) parts.push(`min: ${Number(col.min_value).toLocaleString()}`);
      if (col.max_value != null) parts.push(`max: ${Number(col.max_value).toLocaleString()}`);
      if (col.unique_count != null) parts.push(`${col.unique_count} unique values`);
      statInsights.push({ headline: col.name, text: `${col.name} ranges from ${parts.join(", ")}.${col.null_ratio > 0 ? ` ${(col.null_ratio * 100).toFixed(1)}% missing.` : ""}`, category: "pattern" });
    });
    catCols.slice(0, 2).forEach((col) => {
      const samples = (col.sample_values || []).slice(0, 4).join(", ");
      statInsights.push({ headline: col.name, text: `${col.name} has ${col.unique_count || "?"} unique categories${samples ? `: ${samples}...` : "."}`, category: "overview" });
    });
    statInsights.slice(0, 6).forEach((ins, i) => {
      const icon = STORY_CATEGORY_ICONS[ins.category] || STORY_CATEGORY_ICONS.overview;
      const section = document.createElement("div");
      section.className = "story-section";
      section.dataset.section = i + 1;
      section.dataset.category = ins.category;
      section.innerHTML = `
        <div class="story-section-left">
          <div class="story-section-header">
            <div class="story-section-icon">${icon}</div>
            <div class="story-section-badge">${(ins.category || "overview").toUpperCase()}</div>
          </div>
          <div class="story-section-headline">${ins.headline}</div>
          <div class="story-insight-text">${ins.text}</div>
        </div>
        <div class="story-chart"><div class="story-chart-empty">AI insights unavailable</div></div>
      `;
      grid.appendChild(section);
    });
    container.appendChild(grid);
    elements.insightsStrip.appendChild(container);
    return;
  }

  if (wrap) wrap.classList.add("hidden");
}

function renderStoryChart(container, spec, data) {
  if (!container || !data || !data.length) return;
  try {
    const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.dark;
    const palette = getActivePalette();
    let plotData = [];
    const chartType = spec.type || "bar";
    
    if (chartType === "bar") {
      const sorted = [...data].sort((a, b) => (Number(b[spec.y]) || 0) - (Number(a[spec.y]) || 0)).slice(0, 10);
      plotData = [{
        type: "bar",
        x: sorted.map((r) => r[spec.x]),
        y: sorted.map((r) => Number(r[spec.y]) || 0),
        marker: { color: sorted.map((_, i) => palette[i % palette.length]), cornerradius: 4 },
        hoverinfo: "x+y",
      }];
    } else if (chartType === "line") {
      plotData = [{
        type: "scatter", mode: "lines+markers",
        x: data.map((r) => r[spec.x]),
        y: data.map((r) => r[spec.y]),
        line: { color: palette[0], width: 2, shape: "spline" },
        marker: { color: palette[0], size: 5 },
        fill: "tozeroy", fillcolor: palette[0] + "20",
        hoverinfo: "x+y",
      }];
    } else if (chartType === "pie") {
      plotData = [{
        type: "pie",
        labels: data.map((r) => r[spec.x]),
        values: data.map((r) => r[spec.y] || r.count || r.value),
        textinfo: "label+percent",
        textposition: "inside", hole: 0.4,
        marker: { colors: palette },
        hoverinfo: "label+value+percent",
      }];
    } else if (chartType === "histogram") {
      plotData = [{
        type: "bar",
        x: data.map((r) => r.bin || r[spec.x]),
        y: data.map((r) => r.count || r[spec.y]),
        marker: { color: palette[2] || palette[0], cornerradius: 3 },
        hoverinfo: "x+y",
      }];
    } else if (chartType === "scatter") {
      plotData = [{
        type: "scatter", mode: "markers",
        x: data.map((r) => r[spec.x]),
        y: data.map((r) => r[spec.y]),
        marker: { color: palette[0], size: 8, opacity: 0.7 },
        hoverinfo: "x+y",
      }];
    }
    
    const layout = {
      margin: { t: 10, r: 20, b: 40, l: 50 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter", color: theme.font, size: 11 },
      autosize: true,
      showlegend: false,
      xaxis: { automargin: true, gridcolor: theme.grid, zeroline: false, tickfont: { size: 10 } },
      yaxis: { automargin: true, gridcolor: theme.grid, zeroline: false, tickfont: { size: 10 } },
      hovermode: "closest",
      bargap: 0.2,
    };
    
    Plotly.newPlot(container, plotData, layout, { responsive: true, displayModeBar: false });
  } catch (_e) { /* silent */ }
}

/* ===== renderStoryChartHighlighted — orange-highlight top entity ===== */
function renderStoryChartHighlighted(container, spec, data) {
  if (!container || !data || !data.length) return;
  try {
    const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.light;
    const palette = getActivePalette();
    const accent = "#F97316";
    const muted = "rgba(156,163,175,0.55)";
    const chartType = spec.type || "bar";
    let plotData = [];

    if (chartType === "bar") {
      const sorted = [...data].sort((a, b) => (Number(b[spec.y]) || 0) - (Number(a[spec.y]) || 0)).slice(0, 10);
      plotData = [{ type: "bar", orientation: "v",
        x: sorted.map((r) => r[spec.x]),
        y: sorted.map((r) => Number(r[spec.y]) || 0),
        marker: { color: sorted.map((_, i) => i === 0 ? accent : muted), cornerradius: 4 },
        hoverinfo: "x+y" }];
    } else if (chartType === "line") {
      plotData = [{ type: "scatter", mode: "lines+markers",
        x: data.map((r) => r[spec.x]), y: data.map((r) => r[spec.y]),
        line: { color: accent, width: 2, shape: "spline" },
        marker: { color: accent, size: 5 },
        fill: "tozeroy", fillcolor: accent + "25", hoverinfo: "x+y" }];
    } else if (chartType === "pie") {
      const sorted = [...data].sort((a, b) => (Number(b[spec.y]) || 0) - (Number(a[spec.y]) || 0));
      plotData = [{ type: "pie",
        labels: sorted.map((r) => r[spec.x]),
        values: sorted.map((r) => r[spec.y] || r.count || r.value),
        textinfo: "label+percent", textposition: "inside", hole: 0.38,
        marker: { colors: sorted.map((_, i) => i === 0 ? accent : palette[i % palette.length]) },
        hoverinfo: "label+value+percent" }];
    } else if (chartType === "histogram") {
      plotData = [{ type: "bar",
        x: data.map((r) => r.bin || r[spec.x]),
        y: data.map((r) => r.count || r[spec.y]),
        marker: { color: accent, cornerradius: 3 }, hoverinfo: "x+y" }];
    } else if (chartType === "scatter") {
      plotData = [{ type: "scatter", mode: "markers",
        x: data.map((r) => r[spec.x]), y: data.map((r) => r[spec.y]),
        marker: { color: accent, size: 7, opacity: 0.8 }, hoverinfo: "x+y" }];
    }

    Plotly.newPlot(container, plotData, {
      margin: { t: 6, r: 12, b: 36, l: 44 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter", color: theme.font, size: 10 },
      autosize: true, showlegend: chartType === "pie",
      xaxis: { automargin: true, gridcolor: theme.grid, zeroline: false, tickfont: { size: 9 } },
      yaxis: { automargin: true, gridcolor: theme.grid, zeroline: false, tickfont: { size: 9 } },
      hovermode: "closest", bargap: 0.2,
      legend: chartType === "pie" ? { orientation: "h", y: -0.2, font: { size: 9 } } : undefined,
    }, { responsive: true, displayModeBar: false });
  } catch (_e) { /* silent */ }
}

/* ===== Key Insights PNG snapshot ===== */
async function snapshotInsights() {
  const btn = document.getElementById("snapshot-insights-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Capturing…"; }
  try {
    const container = document.getElementById("insights-strip-wrap");
    if (!container || typeof html2canvas === "undefined") {
      showToast("Snapshot library not loaded"); return;
    }
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#ffffff" });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "key-insights.png";
    a.click();
  } catch (err) {
    showToast("Snapshot failed");
    console.error("Snapshot error:", err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Snapshot"; }
  }
}

/* ===== Inline Widget Rename ===== */
function startTitleEdit(span, visual) {
  if (span.querySelector("input")) return;
  const current = span.textContent.trim();
  const input = document.createElement("input");
  input.className = "tile-title-input";
  input.value = current;
  span.textContent = "";
  span.appendChild(input);
  input.focus();
  input.select();
  const commit = () => {
    const newTitle = input.value.trim() || current;
    span.textContent = newTitle;
    if (newTitle !== current) {
      visual.title = newTitle;
      scheduleAutoSave();
      if (state.currentDataset) {
        apiFetch(`/visuals/${state.currentDataset.id}/update/${visual.visual_id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: newTitle }),
        }).catch(() => {});
      }
    }
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { input.value = current; input.blur(); }
  });
}

/* ===== Nav Pills removed for unified dashboard */
function generateAndShowInsights() {
  const btn = document.getElementById("snapshot-insights-btn");
  if (btn) btn.classList.remove("hidden");
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
    state._serverFilterApplied = false;
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
      state._serverFilterApplied = true;
      renderDashboard();
    }
  } catch (err) {
    console.error("Filter rebuild failed:", err);
    state._serverFilterApplied = false;
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
function appendChatBubble(role, text) {
  return appendHomeBubble(role, text);
}

/* Render Gemini-style file attachment cards as a right-aligned user bubble */
function appendFileAttachBubble(files) {
  const container = elements.homeChatMessages;
  if (!container || !files?.length) return;
  collapseHomeWelcome();
  const wrap = document.createElement("div");
  wrap.className = "home-chat-bubble user";
  const inner = document.createElement("div");
  inner.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:75%";
  files.forEach((f) => {
    const stem = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[-\s]/g, "_");
    const isDict = DICT_PATTERNS_CHIP.some((p) => stem.includes(p));
    inner.innerHTML += buildAttachCardHTML(f.name, isDict);
  });
  wrap.appendChild(inner);
  container.appendChild(wrap);
  elements.homeChatArea?.scrollTo({ top: elements.homeChatArea.scrollHeight, behavior: "smooth" });
}

/* Show/hide the Generate Dashboard button row */
function showGenerateDashboardRow(visible) {
  const row = document.getElementById("generate-dashboard-row");
  if (!row) return;
  row.classList.toggle("hidden", !visible);
}

/* ONYX spark icon SVG (accent colored) */
const AI_SPARK_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 2 13.5 7.5 16 10C18.5 12.5 22 12 22 12C22 12 18.5 11.5 16 14C13.5 16.5 12 22 12 22C12 22 10.5 16.5 8 14C5.5 11.5 2 12 2 12C2 12 5.5 12.5 8 10C10.5 7.5 12 2 12 2Z"/></svg>`;

function appendHomeBubble(role, text) {
  const container = elements.homeChatMessages;
  if (!container) return null;
  collapseHomeWelcome();
  const bubble = document.createElement("div");
  bubble.className = `home-chat-bubble ${role}`;
  if (role === "typing") {
    /* Fluid loading circle, no star icon anymore */
    bubble.innerHTML = `<div class="typing-fluid-circle"></div>`;
  } else if (role === "assistant") {
    /* AI icon + body wrapper */
    const icon = document.createElement("div");
    icon.className = "home-chat-ai-icon";
    icon.innerHTML = AI_SPARK_SVG;
    const body = document.createElement("div");
    body.className = "home-chat-bubble-body";
    body.innerHTML = simpleMarkdown(text);
    bubble.appendChild(icon);
    bubble.appendChild(body);
  } else {
    /* User message: pill on the right */
    const pill = document.createElement("span");
    pill.innerHTML = highlightChatKeywords(text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"));
    bubble.appendChild(pill);
  }
  container.appendChild(bubble);
  const chatArea = elements.homeChatArea;
  if (chatArea) requestAnimationFrame(() => chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" }));
  return bubble;
}

/* ===== Step 6: keyword highlighter ===== */
const CHAT_HL_KEYWORDS = [
  "bar chart","line chart","pie chart","donut chart","scatter plot",
  "histogram","map","table","dashboard","trend","anomaly",
  "revenue","sales","profit","growth","insight","kpi","forecast",
];
function highlightChatKeywords(html) {
  CHAT_HL_KEYWORDS.forEach((kw) => {
    const re = new RegExp(`(${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");
    html = html.replace(re, '<span class="chat-highlight">$1</span>');
  });
  return html;
}

/* ===== Step 5: autocomplete suggestion dropdown ===== */
const CHAT_AUTOCOMPLETE = [
  { icon: "📊", text: "Add a bar chart showing" },
  { icon: "📈", text: "Add a line chart for" },
  { icon: "🥧", text: "Add a pie chart of" },
  { icon: "📋", text: "Add a summary table" },
  { icon: "🗺️", text: "Add a map visualization" },
  { icon: "🔢", text: "Add a KPI for" },
  { icon: "📉", text: "Show trends for" },
  { icon: "🔍", text: "Find anomalies in" },
];

function initSuggestionDropdown() {
  /* Autocomplete popup disabled */
}

function showSuggestionChips(chips) {
  const container = elements.homeSuggestions;
  if (!container) return;
  container.innerHTML = "";
  chips.forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "home-suggestion-chip";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      container.innerHTML = "";
      if (elements.homeInput) elements.homeInput.value = label;
      sendHomeChat();
    });
    container.appendChild(btn);
  });
}

function hideSuggestionChips() {
  if (elements.homeSuggestions) elements.homeSuggestions.innerHTML = "";
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

  /* Create an empty assistant bubble that we'll stream text into */
  const streamBubble = appendHomeBubble("assistant", "");
  const bodyEl = streamBubble?.querySelector(".home-chat-bubble-body");
  let fullReply = "";

  try {
    const resp = await fetch(`${API_BASE}/datasets/${state.currentDataset.id}/ai-chat-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
      body: JSON.stringify({
        message: msg,
        history: state.aiChatHistory.slice(0, -1),
        model_key: state.selectedModelKey || null,
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      /* Parse SSE lines from the buffer */
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; /* keep incomplete line in buffer */

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.t !== undefined) {
            /* Text token chunk */
            fullReply += payload.t;
            if (bodyEl) bodyEl.innerHTML = simpleMarkdown(fullReply);
            const chatArea = elements.homeChatArea;
            if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
          }
          if (payload.done !== undefined) {
            /* Final metadata event */
            if (payload.model_name) updateModelBadge(payload.model_name);
            if (payload.done) {
              if (payload.insights) {
                state.businessContext = payload.insights;
                state.businessCategory = payload.insights.business_category || null;
              }
              state.aiChatDone = true;
              showGenerateDashboardRow(true);
            } else if (payload.suggestions && payload.suggestions.length) {
              showSuggestionChips(payload.suggestions);
            } else {
              showSuggestionChips(buildDataAwareSuggestions());
            }
          }
        } catch (_e) { /* skip malformed SSE lines */ }
      }
    }

    /* Store the full reply in history */
    if (!fullReply) fullReply = "I couldn't process that. Could you try rephrasing?";
    state.aiChatHistory.push({ role: "assistant", content: fullReply });

  } catch (err) {
    if (!fullReply && bodyEl) bodyEl.innerHTML = simpleMarkdown("Something went wrong. Please try again.");
    console.error("AI chat stream error:", err);
  } finally {
    state.aiChatBusy = false;
    if (elements.homeSendBtn) elements.homeSendBtn.disabled = false;
  }
}

/* ===== HOME CHAT: Combined upload + AI chat handler ===== */
async function sendHomeChat() {
  if (state.aiChatBusy) return;
  const inputEl = elements.homeInput;
  const msg = inputEl?.value.trim();
  const hasFiles = state.pendingFiles.length > 0;
  const hasDataset = Boolean(state.currentDataset);

  if (!msg && !hasFiles) {
    showToast("Type a message or attach a file to get started");
    return;
  }

  hideSuggestionChips();
  if (inputEl) inputEl.value = "";
  if (elements.homeSendBtn) elements.homeSendBtn.disabled = true;
  autoResizeHomeInput();

  if (hasFiles && !hasDataset) {
    // Upload files first, then start chat
    if (msg) appendHomeBubble("user", msg);
    /* Render Gemini-style attachment cards in chat bubble */
    appendFileAttachBubble(state.pendingFiles);
    const typingBubble = appendHomeBubble("typing", "");
    try {
      const projectName = toSuggestedName(state.pendingFiles[0]?.name) || "New project";
      await createProjectWithUpload(projectName, "", state.pendingFiles, { skipDuel: true });
      typingBubble?.remove();
      showToast("Files uploaded — analyzing data…");
      if (elements.selectedFiles) { elements.selectedFiles.innerHTML = ""; elements.selectedFiles.classList.add("hidden"); }
      state.pendingFiles = [];
      /* Fix 3: refresh project sidebar immediately so the chat is saved before dashboard builds */
      loadProjects().catch(() => {});
      showGenerateDashboardRow(true);
      initAiChat();
    } catch (err) {
      typingBubble?.remove();
      appendHomeBubble("assistant", `Upload failed: ${err.message || "Please try again."}`);
      if (elements.homeSendBtn) elements.homeSendBtn.disabled = false;
    }
    return;
  }

  if (hasDataset && (msg || hasFiles)) {
    // Send message to existing AI chat
    if (hasFiles) {
      appendFileAttachBubble(state.pendingFiles);
      if (elements.selectedFiles) { elements.selectedFiles.innerHTML = ""; elements.selectedFiles.classList.add("hidden"); }
      try {
        await uploadDatasetFiles(state.currentDataset.id, state.pendingFiles, { skipDuel: true });
        state.pendingFiles = [];
        showToast("New files added to dataset");
      } catch (_e) { /* non-fatal */ }
    }
    if (msg) {
      if (elements.aiChatInput) elements.aiChatInput.value = msg;
      await sendAiChat();
    }
    return;
  }

  if (msg && !hasDataset) {
    appendHomeBubble("user", msg);
    appendHomeBubble("assistant", "Please attach a CSV or Excel file so I can analyze your data. Click the 📎 button to attach a file.");
    setTimeout(() => {
      showSuggestionChips(["Attach a file", "What file formats are supported?"]);
      if (elements.homeSendBtn) elements.homeSendBtn.disabled = false;
    }, 200);
  }
}

function autoResizeHomeInput() {
  const el = elements.homeInput;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}

function initAiChat() {
  state.aiChatHistory = [];
  state.aiChatDone = false;
  hideSuggestionChips();
  /* Do NOT clear homeChatMessages — the user's upload/message should stay visible */

  setStep("ai-chat");

  // Send an initial greeting automatically
  setTimeout(async () => {
    state.aiChatBusy = true;
    const typingBubble = appendChatBubble("typing", "");
    try {
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
        body: JSON.stringify({ message: greeting, history: [], model_key: state.selectedModelKey || null }),
      });
      typingBubble?.remove();
      const reply = response.reply || "Hi! I've analyzed your data. Tell me what you'd like to explore.";
      appendChatBubble("assistant", reply);
      state.aiChatHistory.push({ role: "user", content: greeting });
      state.aiChatHistory.push({ role: "assistant", content: reply });
      if (response.done) {
        state.aiChatDone = true;
        if (response.insights) {
          state.businessContext = response.insights;
          state.businessCategory = response.insights.business_category || null;
        }
        showGenerateDashboardRow(true);
      } else if (response.suggestions && response.suggestions.length) {
        showSuggestionChips(response.suggestions);
      } else {
        showSuggestionChips(buildDataAwareSuggestions(true));
      }
    } catch (err) {
      typingBubble?.remove();
      appendChatBubble("assistant", "Hi! I've analyzed your data. Tell me what you'd like to explore.");
      showSuggestionChips(buildDataAwareSuggestions(true));
      console.error("AI chat init error:", err);
    } finally {
      state.aiChatBusy = false;
      if (elements.homeSendBtn) elements.homeSendBtn.disabled = false;
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
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");

  // Re-allow the specific color spans used by the AI palette options
  html = html.replace(/&lt;span style="color:(#[0-9A-Fa-f]{3,6})"&gt;(.*?)&lt;\/span&gt;/gi, '<span style="color:$1">$2</span>');
  html = html.replace(/&lt;span style=&amp;quot;color:(#[0-9A-Fa-f]{3,6})&amp;quot;&gt;(.*?)&lt;\/span&gt;/gi, '<span style="color:$1">$2</span>');

  const lines = html.split("\n");
  let out = "";
  let inList = false;
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("- ")) {
      if (!inList) { out += "<ul>"; inList = true; }
      out += `<li>${line.substring(2)}</li>`;
    } else {
      if (inList) { out += "</ul>"; inList = false; }
      out += `<p>${line}</p>`;
    }
  }
  if (inList) out += "</ul>";
  return out;
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
  /* Render a compact chart directly with mini-friendly Plotly layout */
  try {
    container.classList.add("chart");
    container.innerHTML = "";

    const data = visual.data;
    const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.dark;
    const palette = getActivePalette();
    let plotData = [];

    const xCol = visual.x || "";
    const yCol = visual.y || visual.values || "count";

    /* Truncate long labels for the mini preview */
    const truncate = (s, max) => {
      if (!s) return s;
      const str = String(s);
      return str.length > max ? str.slice(0, max - 1) + "…" : str;
    };

    if (visual.type === "bar") {
      const sorted = [...data].sort((a, b) => (Number(b[yCol]) || 0) - (Number(a[yCol]) || 0)).slice(0, 8);
      plotData = [{
        type: "bar",
        x: sorted.map((r) => truncate(r[xCol], 12)),
        y: sorted.map((r) => Number(r[yCol]) || 0),
        marker: { color: sorted.map((_, i) => palette[i % palette.length]), cornerradius: 3 },
        hoverinfo: "x+y",
      }];
    } else if (visual.type === "line") {
      plotData = [{
        type: "scatter", mode: "lines+markers",
        x: data.map((r) => r[visual.x]),
        y: data.map((r) => r[visual.y]),
        line: { color: palette[0], width: 2, shape: "spline" },
        marker: { color: palette[0], size: 3 },
        fill: "tozeroy", fillcolor: palette[0] + "18",
        hoverinfo: "x+y",
      }];
    } else if (visual.type === "pie") {
      plotData = [{
        type: "pie",
        labels: data.map((r) => truncate(r[visual.x], 14)),
        values: data.map((r) => r[visual.values || "count"]),
        textinfo: data.length <= 4 ? "label+percent" : "percent",
        textposition: "inside", hole: 0.45,
        marker: { colors: palette, line: { color: theme.font, width: 0.5 } },
        hoverinfo: "label+value+percent",
      }];
    } else if (visual.type === "scatter") {
      plotData = [{
        type: "scatter", mode: "markers",
        x: data.map((r) => r[visual.x]),
        y: data.map((r) => Number(r[visual.y]) || 0),
        marker: { color: palette[0], size: 4, opacity: 0.7 },
        hoverinfo: "x+y",
      }];
    } else if (visual.type === "histogram") {
      plotData = [{
        type: "bar",
        x: data.map((r) => r.bin),
        y: data.map((r) => r.count),
        marker: { color: palette[2] || palette[0], cornerradius: 2 },
        hoverinfo: "x+y",
      }];
    } else {
      /* Fallback: use full renderVisual for unsupported types */
      renderVisual(visual, container);
      return;
    }

    const isPie = visual.type === "pie";
    const miniLayout = {
      margin: isPie ? { t: 4, r: 4, b: 4, l: 4 } : { t: 8, r: 10, b: 36, l: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter", color: theme.font, size: 9 },
      autosize: true,
      showlegend: false,
      xaxis: {
        automargin: true, gridcolor: theme.grid, zeroline: false,
        tickfont: { size: 9, color: theme.axisTick },
        title: "", tickangle: -30,
      },
      yaxis: {
        automargin: true, gridcolor: theme.grid, zeroline: false,
        tickfont: { size: 9, color: theme.axisTick },
        title: "",
      },
      hovermode: "closest",
      bargap: 0.25,
    };

    Plotly.newPlot(container, plotData, miniLayout, {
      responsive: true, displayModeBar: false, staticPlot: false,
    });
    requestAnimationFrame(() => Plotly.Plots.resize(container));
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
            body: JSON.stringify({ message, history: state.aiChatHistory, model_key: state.selectedModelKey || null }),
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
        body: JSON.stringify({ message, history: state.aiChatHistory, model_key: state.selectedModelKey || null }),
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
  /* In the new layout the left chat IS the AI assistant — append there */
  state.aiChatDone = false;
  hideSuggestionChips();
  /* Expand the chat sidebar if it was collapsed */
  elements.projectsSection?.classList.remove("chat-collapsed");
  document.getElementById("chat-reopen-btn")?.classList.remove("active");

  setTimeout(async () => {
    if (state.aiChatBusy) return;
    state.aiChatBusy = true;
    const typingBubble = appendChatBubble("typing", "");
    try {
      const refineMsg = "The user already has a dashboard and wants to refine it. Ask them what other insights would be helpful and suggest 2-3 new analysis angles.";
      const response = await apiFetch(`/datasets/${state.currentDataset.id}/ai-chat`, {
        method: "POST",
        body: JSON.stringify({ message: refineMsg, history: state.aiChatHistory, model_key: state.selectedModelKey || null }),
      });
      typingBubble?.remove();
      const reply = response.reply || "How is the dashboard working for you? What other insights would be helpful?";
      appendChatBubble("assistant", reply);
      state.aiChatHistory.push({ role: "user", content: refineMsg });
      state.aiChatHistory.push({ role: "assistant", content: reply });
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
        /* Only filter rows that actually contain a datetime column;
           if no datetime column exists in this row, keep it (can't filter). */
        const hasDateCol = dateColumns.some((col) => col in row && row[col]);
        if (!hasDateCol) return true;
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

const TILE_W = 4;
const TILE_H = 4;
const KPI_W  = 2;
const KPI_H  = 2;

function getDefaultTileLayout(visual) {
  if (visual.type === "kpi") return { w: KPI_W, h: KPI_H };
  if (visual.type === "text") return { w: TILE_W, h: TILE_H };
  return { w: TILE_W, h: TILE_H };
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
  const cols = 12;

  /* Only chart visuals — KPIs excluded */
  const charts = visuals.filter((v) => v.type !== "kpi");

  /* 3 charts per row, each TILE_W wide */
  let x = 0;
  let y = 0;
  charts.forEach((v) => {
    if (x + TILE_W > cols) { y += TILE_H; x = 0; }
    layoutMap.set(v.visual_id, { x, y, w: TILE_W, h: TILE_H });
    x += TILE_W;
  });

  return layoutMap;
}

function formatFieldLabel(label, labelMap) {
  if (!label) return "";
  if (labelMap && labelMap[label]) return labelMap[label];
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
  const lm = visual.config?.label_map || null;
  if (visual.type === "pie") {
    return { x: "", y: "" };
  }
  if (visual.type === "histogram") {
    return { x: formatFieldLabel(visual.values || "Value", lm), y: "Count" };
  }
  if (visual.type === "bar") {
    return {
      x: formatFieldLabel(visual.x, lm),
      y: formatFieldLabel(visual.y || visual.values || "Count", lm),
    };
  }
  if (visual.type === "line" || visual.type === "scatter") {
    return {
      x: formatFieldLabel(visual.x, lm),
      y: formatFieldLabel(visual.y || "", lm),
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

  /* type is set via the hidden input + chart-type-grid icon buttons */
  const hiddenType = document.getElementById("chart-type-hidden");
  if (hiddenType) hiddenType.value = defaultType;

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

/* ===== Feature 2 — Tile Focus / Fullscreen ===== */
function focusTile(visualId) {
  const grid = elements.dashboardGrid;
  if (!grid) return;
  grid.querySelectorAll(".grid-stack-item").forEach((w) => {
    const isFocused = w.dataset.visualId === visualId;
    w.classList.toggle("tile-focused", isFocused);
  });
  state.focusedVisualId = visualId;
}

function clearTileFocus() {
  elements.dashboardGrid?.querySelectorAll(".grid-stack-item").forEach((w) => {
    w.classList.remove("tile-focused");
  });
  state.focusedVisualId = null;
}

function openTileFullscreen(visualId) {
  const visual = state.finalVisuals.find((v) => v.visual_id === visualId);
  if (!visual) return;
  const modal = document.getElementById("tile-fullscreen-modal");
  const titleEl = document.getElementById("tile-fullscreen-title");
  const chartEl = document.getElementById("tile-fullscreen-chart");
  if (!modal || !chartEl) return;
  if (titleEl) titleEl.textContent = visual.title || "";
  chartEl.innerHTML = "";
  modal.classList.remove("hidden");
  /* Re-render the chart inside the fullscreen container */
  requestAnimationFrame(() => renderVisual(visual, chartEl));
}

function closeTileFullscreen() {
  const modal = document.getElementById("tile-fullscreen-modal");
  const chartEl = document.getElementById("tile-fullscreen-chart");
  if (chartEl) { try { Plotly.purge(chartEl); } catch (_) {} chartEl.innerHTML = ""; }
  modal?.classList.add("hidden");
}

/* ===== Feature 3 — Widget Config Slide Panel ===== */
const CHART_TYPE_DEFS = [
  { type: "bar",       label: "Bar",       svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="10" width="4" height="11"/><rect x="9.5" y="6" width="4" height="15"/><rect x="16" y="3" width="4" height="18"/></svg>` },
  { type: "line",      label: "Line",      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 8 11 13 14 21 5"/></svg>` },
  { type: "pie",       label: "Pie",       svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>` },
  { type: "scatter",   label: "Scatter",   svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="14" r="2"/><circle cx="15" cy="8" r="2"/><circle cx="18" cy="16" r="2"/><circle cx="10" cy="18" r="2"/></svg>` },
  { type: "histogram", label: "Volume",    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="12" width="4" height="9"/><rect x="7" y="8" width="4" height="13"/><rect x="12" y="4" width="4" height="17"/><rect x="17" y="9" width="4" height="12"/></svg>` },
  { type: "table",     label: "Table",     svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>` },
];

function initChartTypeGrid(selectedType = "bar") {
  const grid = document.getElementById("chart-type-grid");
  const hidden = document.getElementById("chart-type-hidden");
  if (!grid) return;
  grid.innerHTML = "";
  CHART_TYPE_DEFS.forEach(({ type, label, svg }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chart-type-btn${type === selectedType ? " active" : ""}`;
    btn.innerHTML = `${svg}<span>${label}</span>`;
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".chart-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (hidden) hidden.value = type;
      updateVisualFormFields(type);
    });
    grid.appendChild(btn);
  });
  if (hidden) hidden.value = selectedType;
}

function openAddVisualPanel(visual = null, triggerEl = null) {
  if (!state.currentDataset || !state.datasetDetail) {
    showToast("Upload data before adding a custom visual");
    return;
  }
  state.editingVisualId = visual?.visual_id || null;
  prepareVisualForm(visual);
  initChartTypeGrid(visual?.type || "bar");
  const panel = elements.addVisualModal;
  if (!panel) return;

  /* Update header label with visual title */
  const titleLabel = panel.querySelector(".widget-config-title span, .widget-config-title-text");
  if (titleLabel) titleLabel.textContent = visual?.title || "New Widget";

  panel.classList.remove("hidden");

  /* Position near the triggering widget */
  if (triggerEl) {
    const positionPanel = () => {
      const rect = triggerEl.getBoundingClientRect();
      const W = 340;
      const H = Math.max(panel.scrollHeight, 480);
      let left = rect.right + 14;
      let top  = Math.max(rect.top, 12);
      /* Flip to left side if no room on the right */
      if (left + W > window.innerWidth - 12) left = rect.left - W - 14;
      /* Clamp vertically so panel stays fully visible */
      if (top + H > window.innerHeight - 12) top = Math.max(12, window.innerHeight - H - 12);
      if (left < 12) left = 12;
      panel.style.setProperty("--pop-left", left + "px");
      panel.style.setProperty("--pop-top",  top  + "px");
      panel.classList.add("widget-popover-positioned");
    };
    /* Use rAF so the panel has been laid out and scrollHeight is accurate */
    requestAnimationFrame(positionPanel);
  } else {
    panel.classList.remove("widget-popover-positioned");
    panel.style.removeProperty("--pop-left");
    panel.style.removeProperty("--pop-top");
  }
}

function closeAddVisualPanel() {
  const panel = elements.addVisualModal;
  if (!panel) return;
  panel.classList.add("hidden");
  panel.classList.remove("widget-popover-positioned");
  panel.style.removeProperty("--pop-left");
  panel.style.removeProperty("--pop-top");
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

function maybePromptSaveLogin() {
  if (state.token) return;
  if (state.authPrompted) return;
  state.authPrompted = true;
  if (elements.saveToast) elements.saveToast.classList.remove("hidden");
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
  /* Remove widget directly so GridStack auto-compacts remaining tiles */
  if (state.grid) {
    const widgetEl = state.grid.el?.querySelector(`[data-visual-id="${visualId}"]`);
    if (widgetEl) {
      state.grid.removeWidget(widgetEl);
      updateLayoutFromGrid();
    } else {
      renderDashboard();
    }
  } else {
    renderDashboard();
  }
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
  /* Reverse dashboard-mode layout */
  exitDashboardMode();
  /* Reset home chat UI */
  _heroCollapsed = false;
  if (elements.homeChatMessages) elements.homeChatMessages.innerHTML = "";
  if (elements.homeChatArea) elements.homeChatArea.classList.add("hidden");
  if (elements.homeWelcome) elements.homeWelcome.classList.remove("hidden");
  if (elements.homeSuggestions) elements.homeSuggestions.innerHTML = "";
  if (elements.homeInput) elements.homeInput.value = "";
  if (elements.homeSendBtn) elements.homeSendBtn.disabled = true;
  updateCurrentProjectName();
  setStep("upload");
}

/* ===== Settings Modal ===== */
function openSettings() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  /* Update theme button states */
  document.querySelectorAll(".settings-theme-opt").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === state.theme);
  });
}

function closeSettings() {
  document.getElementById("settings-modal")?.classList.add("hidden");
}

function setAuthenticatedView() {
  const isAuthed = Boolean(state.token);
  /* Sidebar login/user row visibility */
  document.getElementById("sidebar-user")?.classList.toggle("hidden", !isAuthed);
  document.getElementById("sidebar-login-btn")?.classList.toggle("hidden", isAuthed);
  /* Delegate sidebar user content + settings modal update to updateSidebarUser */
  updateSidebarUser();
  if (!isAuthed) {
    state.projects = [];
    renderProjectList();
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
    /* Collapse sidebar and go to AI Chat pre-dashboard flow */
    toggleSidebar(false);
    setStep("ai-chat");
    if (!state.aiChatHistory.length) {
      appendHomeBubble("typing", "");
      try {
        const response = await apiFetch(`/datasets/${datasetId}/ai-chat`, {
          method: "POST",
          body: JSON.stringify({ message: "Hello, I just uploaded my data.", history: [], model_key: state.selectedModelKey || null }),
        });
        document.querySelector(".ai-typing-indicator")?.closest(".home-chat-bubble-wrap")?.remove();
        const reply = response.reply || "Hi! I've analyzed your data. Tell me what you'd like to explore.";
        appendHomeBubble("assistant", reply, { isHtml: true });
        if (response.suggestions?.length) renderHomeSuggestions(response.suggestions);
      } catch (err) {
        document.querySelector(".ai-typing-indicator")?.closest(".home-chat-bubble-wrap")?.remove();
      }
    }
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
        openDashChat();
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
  updateSidebarUser();
  /* Projects are only shown in the sidebar — home page is a clean chat screen */
  if (elements.homeProjectsWrap) elements.homeProjectsWrap.classList.add("hidden");
  if (elements.projectList) elements.projectList.innerHTML = "";
  elements.projectListSkeleton?.classList.add("hidden");
  elements.projectsEmpty?.classList.add("hidden");
  elements.projectLoginHint?.classList.add("hidden");
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

function closeMobileSidebar() {
  const sidebar = elements.appSidebar;
  const overlay = document.getElementById("sidebar-overlay");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (overlay) overlay.classList.add("hidden");
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
    const isActive = state.currentProject?.id === project.id;
    const category = project.business_category;
    const catLabel = category ? CATEGORIES.find((c) => c.key === category)?.label || category : "";

    const item = document.createElement("div");
    item.className = `sidebar-project-card${isActive ? " active" : ""}`;

    const thumbUrl = project.thumbnail_data_url || null;
    const thumbHtml = thumbUrl
      ? `<div class="sidebar-project-thumb"><img src="${thumbUrl}" alt="" loading="lazy" /></div>`
      : `<div class="sidebar-project-thumb sidebar-project-thumb-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>`;

    item.innerHTML = `
      ${thumbHtml}
      <div class="sidebar-project-body">
        <span class="sidebar-project-name">${project.name}</span>
        <div class="sidebar-project-meta">
          ${catLabel ? `<span class="sidebar-project-badge">${catLabel}</span>` : ""}
          <span class="sidebar-project-date">${createdAt}</span>
        </div>
      </div>
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

function updateSidebarUser() {
  const isAuthed = Boolean(state.token);
  const name = isAuthed ? (state.email?.split("@")[0] || "User") : "Guest";
  const nameEl = document.getElementById("sidebar-user-name-el");
  const planEl = document.getElementById("sidebar-user-plan-el");
  const avatarWrap = document.getElementById("sidebar-user-avatar-wrap");
  if (nameEl) nameEl.textContent = name;
  if (planEl) planEl.textContent = "Free";
  if (avatarWrap) {
    avatarWrap.innerHTML = isAuthed && state.email
      ? `<span style="font-size:0.8rem;font-weight:700;color:#fff">${state.email.charAt(0).toUpperCase()}</span>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }
  /* Settings modal account section */
  const settingsEmail = document.getElementById("settings-account-email");
  if (settingsEmail) settingsEmail.textContent = isAuthed ? (state.email || "Signed in") : "Not signed in";
  document.getElementById("settings-logout-btn")?.classList.toggle("hidden", !isAuthed);
  document.getElementById("settings-login-btn")?.classList.toggle("hidden", isAuthed);
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
    cellHeight: 75,
    margin: "8px",
    handle: ".grid-stack-item-content",
    animate: true,
    column: 12,
    resizable: { handles: "e,s,se" },
    draggable: { scroll: true },
    minRow: 1,
    oneColumnSize: 768,
  });
  state.grid.on("resizestop", (_event, element) => {
    const chart = element?.querySelector(".chart");
    if (chart) {
      Plotly.Plots.resize(chart);
      setTimeout(() => Plotly.Plots.resize(chart), 200);
    }
    state.grid.compact();
    updateLayoutFromGrid();
    maybePromptSaveLogin();
  });
  state.grid.on("dragstop", () => { state.grid.compact(); updateLayoutFromGrid(); scheduleAutoSave(); maybePromptSaveLogin(); });
  state.grid.on("change", () => { updateLayoutFromGrid(); scheduleAutoSave(); });
  state.grid.batchUpdate();

  /* KPIs removed from dashboard — only render chart widgets */
  const gridVisuals = state.finalVisuals.filter((v) => v.type !== "kpi");

  gridVisuals.forEach((visual, index) => {
    const isKpi = visual.type === "kpi";
    const defaults = isKpi ? { w: 2, h: 2 } : getDefaultTileLayout(visual);
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
          </div>
          <div class="tile-body" id="dash-${visual.visual_id}" class="gs-no-drag"></div>
        </div>
        <!-- Focus overlay (Feature 2) -->
        <div class="tile-focus-overlay">
          <button class="tile-focus-btn expand-tile" type="button" title="Expand">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
          ${canEdit ? `<button class="tile-focus-btn edit-tile" type="button" title="Edit widget">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>` : ""}
          <button class="tile-focus-btn danger remove-tile" type="button" title="Remove">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    }
    const options = {
      w: width,
      h: height,
      minW: 4,
      minH: 4,
      autoPosition: !hasLayout,
    };
    if (hasLayout) {
      options.x = layout.x;
      options.y = layout.y;
    }
    state.grid.addWidget(widget, options);

    /* Focus overlay handlers */
    widget.addEventListener("click", (event) => {
      if (event.target.closest(".tile-focus-btn")) return;
      event.stopPropagation();
      focusTile(visual.visual_id);
    });
    widget.querySelector(".expand-tile")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openTileFullscreen(visual.visual_id);
    });
    widget.querySelector(".edit-tile")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddVisualPanel(visual, widget);
    });
    /* Inline title rename */
    const titleSpan = widget.querySelector(".tile-meta span:first-child");
    if (titleSpan) {
      titleSpan.title = "Click to rename";
      titleSpan.style.cursor = "text";
      titleSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        startTitleEdit(titleSpan, visual);
      });
    }
    widget.querySelector(".remove-tile")?.addEventListener("click", (event) => {
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
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((c) => Plotly.Plots.resize(c));
  });
  /* One delayed pass to catch late GridStack layout shifts */
  setTimeout(() => {
    elements.dashboardGrid?.querySelectorAll(".chart").forEach((c) => Plotly.Plots.resize(c));
  }, 400);
}

function buildPlotlyLayout(visual, container, plotData) {
  const isPie = visual.type === "pie";
  const dataCount = visual.data?.length || 0;
  const width = container?.clientWidth || 280;
  const height = container?.clientHeight || 220;
  const isCompact = width < 360 || height < 240;
  const showPieLegend = isPie ? dataCount <= 8 : false;
  const axisTitles = getAxisTitles(visual);
  const theme = PLOTLY_THEMES[state.theme] || PLOTLY_THEMES.dark;

  /* Axis fonts and tick formatting */
  const axisTitleFont = { size: 11, color: theme.axisTitle, family: "Inter" };
  const axisTickFont = { size: 10, color: theme.axisTick, family: "Inter" };

  let yTickPrefix = "";
  let yTickSuffix = "";
  let yTickFormat = "";
  const backendYFormat = visual.config?.y_format;
  const yFmt = backendYFormat === "percentage" ? "percentage" : detectColumnFormat(visual.y || visual.values || "");
  if (yFmt === "currency") {
    yTickPrefix = "$";
    yTickFormat = ".2s";
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

  const pieLegend = {
    orientation: "h",
    y: -0.1,
    x: 0.5,
    xanchor: "center",
    yanchor: "top",
    font: { size: 10 },
    bgcolor: "rgba(0,0,0,0)",
  };

  return {
    title: { text: "", font: { family: "Inter", size: 14 } },
    margin: isPie
      ? {
          l: 12,
          r: showPieLegend && !isCompact ? 90 : 12,
          t: 10,
          b: showPieLegend && isCompact ? 70 : 28,
        }
      : { l: leftMargin, r: 20, t: 10, b: isHorizontalBar ? 30 : 52 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter", size: 12, color: theme.font },
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
      tickangle: (!isHorizontalBar && (visual.type === "histogram" || (visual.type === "bar" && dataCount > 8))) ? -35 : undefined,
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
    showlegend: (isPie && showPieLegend) || (visual.type === "scatter" && !!visual.config?.color_column),
    uniformtext: { minsize: 9, mode: "hide" },
    hovermode: "closest",
    bargap: 0.22,
    colorway: getActivePalette(),
    annotations: isPie ? (() => {
      const vals = plotData?.[0]?.values || [];
      const total = vals.reduce((s, v) => s + (Number(v) || 0), 0);
      const fmt = total >= 1e6 ? `${(total / 1e6).toFixed(1)}M`
        : total >= 1e3 ? `${(total / 1e3).toFixed(1)}K`
        : String(Math.round(total));
      return [{ text: `<b>${fmt}</b>`, x: 0.5, y: 0.5, showarrow: false,
        font: { size: 18, color: theme.font, family: "Space Grotesk, Inter" },
        xanchor: "center", yanchor: "middle" }];
    })() : [],
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
  /* Skip client-side filtering when the server already rebuilt visuals with filtered data */
  const filteredData = isDuel || state._serverFilterApplied ? rawData : applyDashboardFilters(rawData);
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

  if (visual.type === "text") {
    container.style.padding = "20px";
    container.style.fontSize = "1rem";
    container.style.lineHeight = "1.6";
    container.style.color = "var(--ink)";
    container.innerHTML = `<div class="insight-text">${visual.config?.insight || "Insight unavailable."}</div>`;
    return;
  }

  if (visual.type === "table") {
    container.classList.add("table-scroll");
    const columns = visual.config?.columns || Object.keys(rawData[0] || {});
    const table = document.createElement("table");
    table.classList.add("data-table");
    table.innerHTML = `
      <thead><tr>${columns.map((col) => `<th>${formatFieldLabel(col, visual.config?.label_map)}</th>`).join("")}</tr></thead>
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
      const categories = displayed.map((row) => row[xKey]);
      const colorMatched = getColorMatchedBarColors(categories, palette);
      const maxVal = Math.max(...vals, 1);
      const baseColor = palette[0];
      const barColors = colorMatched || vals.map((v) => {
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
          y: categories,
          x: vals,
          marker: { color: barColors, line: { color: theme.line, width: 0.5 } },
          hovertemplate: hHover,
        },
      ];
    } else {
      const categories = sorted.map((row) => row[xKey]);
      const colorMatched = getColorMatchedBarColors(categories, palette);
      const barColors = colorMatched || sorted.map((_, i) => palette[i % palette.length]);
      plotData = [
        {
          type: "bar",
          x: categories,
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
        line: { color: lineColor, width: 3, shape: "spline" },
        marker: { color: lineColor, size: 5 },
        hovertemplate: hoverTemplate,
        fill: "tozeroy",
        fillcolor: lineColor + "18",
      },
    ];
  } else if (visual.type === "scatter") {
    const palette = getActivePalette();
    const colorCol = visual.config?.color_column;
    if (colorCol && data.length && data[0][colorCol] !== undefined) {
      const groups = {};
      data.forEach((row) => {
        const key = String(row[colorCol] ?? "Unknown");
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      });
      const groupKeys = Object.keys(groups).sort();
      const colorMap = { "0": palette[0] || "#ef4444", "1": palette[1] || "#22c55e" };
      plotData = groupKeys.map((key, i) => ({
        type: "scatter",
        mode: "markers",
        name: key === "0" ? "No" : key === "1" ? "Yes" : key,
        x: groups[key].map((row) => row[visual.x]),
        y: groups[key].map((row) => Number(row[visual.y]) || 0),
        marker: {
          color: colorMap[key] || palette[i % palette.length],
          size: 7,
          opacity: 0.7,
          line: { color: theme.font, width: 0.5 },
        },
        hovertemplate: `${visual.x}: %{x}<br>${visual.y}: %{y}<br>${colorCol}: ${key}<extra></extra>`,
      }));
    } else {
      const scatterColor = palette[0] || "#b45309";
      const yVals = data.map((row) => Number(row[visual.y]) || 0);
      plotData = [
        {
          type: "scatter",
          mode: "markers",
          x: data.map((row) => row[visual.x]),
          y: yVals,
          marker: {
            color: scatterColor,
            size: 7,
            opacity: 0.7,
            line: { color: theme.font, width: 0.5 },
          },
          hovertemplate: hoverTemplate,
        },
      ];
    }
  } else if (visual.type === "histogram") {
    const counts = data.map((row) => row.count);
    const maxCount = Math.max(...counts, 1);
    const palette = getActivePalette();
    const baseColor = palette[2] || "#8b5cf6";
    const bins = data.map((row) => row.bin);
    const barColors = counts.map((c) => {
      const alpha = 0.4 + 0.6 * (c / maxCount);
      return baseColor + Math.round(alpha * 255).toString(16).padStart(2, "0");
    });
    plotData = [
      {
        type: "bar",
        x: bins,
        y: counts,
        marker: {
          color: barColors,
          line: { color: baseColor, width: 1 },
          cornerradius: 3,
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
    const labels = labelCol ? data.map((row) => row[labelCol]) : lats.map((_, i) => `Location ${i + 1}`);
    const values = valueCol ? data.map((row) => row[valueCol]) : null;
    
    const hoverText = values
      ? labels.map((label, i) => `<b>${label}</b><br>${valueCol}: ${isCurrency ? formatCurrency(values[i]) : formatSmartValue(values[i])}`)
      : labels.map(label => `<b>${label}</b>`);
      
    // Better auto-sizing for map markers based on data range
    let markerSizes = 8;
    if (values && values.length) {
      const maxVal = Math.max(...values.map(v => Number(v) || 0), 1);
      markerSizes = values.map(v => {
        const num = Number(v) || 0;
        return Math.max(5, Math.min(24, (num / maxVal) * 24));
      });
    }
    
    const palette = getActivePalette();
    
    plotData = [
      {
        type: "scattergeo",
        mode: "markers",
        lat: lats,
        lon: lons,
        text: hoverText,
        hoverinfo: "text",
        marker: {
          size: markerSizes,
          color: values || palette[0],
          colorscale: values ? [[0, palette[1] || "#60a5fa"], [1, palette[0] || "#3b82f6"]] : undefined,
          showscale: false, // Hide colorbar for cleaner look
          line: { color: "rgba(255,255,255,0.8)", width: 0.5 },
          opacity: 0.85
        },
      },
    ];
    
    const mapLayout = buildPlotlyLayout(visual, container, plotData);
    mapLayout.geo = {
      scope: "world",
      projection: { type: "natural earth" },
      showland: true,
      landcolor: state.theme === "dark" ? "#1e293b" : "#f1f5f9",
      showocean: true,
      oceancolor: "rgba(0,0,0,0)", // Transparent ocean blends with background
      showcoastlines: true,
      coastlinecolor: state.theme === "dark" ? "#334155" : "#cbd5e1",
      coastlinewidth: 0.5,
      showcountries: true,
      countrycolor: state.theme === "dark" ? "#475569" : "#cbd5e1",
      countrywidth: 0.5,
      bgcolor: "rgba(0,0,0,0)",
    };
    // Maps don't need axes
    mapLayout.xaxis = { visible: false };
    mapLayout.yaxis = { visible: false };
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

/* ===== Feature 1 — Agent Status Bar ===== */
function setAgentStatus(mode) {
  const bar = document.getElementById("agent-status-bar");
  const textEl = document.getElementById("agent-status-text");
  const stateEl = document.getElementById("agent-status-state");
  if (!bar) return;
  if (mode === "generating") {
    bar.classList.add("running");
    if (textEl) textEl.textContent = "Generating your dashboard…";
    if (stateEl) stateEl.textContent = "● Running";
  } else {
    bar.classList.remove("running");
    if (textEl) textEl.textContent = "Agent is waiting for your response";
    if (stateEl) stateEl.innerHTML = "&#x23F8; Paused";
  }
}

const SPINNER_SVG = `<svg class="agent-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
const CHECK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;

function createAgentStepLog(steps) {
  /* Create and insert a step-log bubble into home chat. Returns {el, rows[]} */
  if (elements.homeChatArea) elements.homeChatArea.classList.remove("hidden");
  if (elements.homeWelcome) elements.homeWelcome.classList.add("hidden");

  const wrap = document.createElement("div");
  wrap.className = "agent-log-wrap";

  const rows = steps.map((label) => {
    const row = document.createElement("div");
    row.className = "agent-step-row";
    row.innerHTML = `
      <div class="agent-step-icon">${SPINNER_SVG}</div>
      <span class="agent-step-label">${label}</span>
      <span class="agent-step-elapsed"></span>`;
    wrap.appendChild(row);
    return row;
  });

  /* Mark all as pending (grey spinner hidden) */
  rows.forEach((r, i) => {
    if (i > 0) r.querySelector(".agent-step-icon").innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.25"/></svg>`;
  });

  elements.homeChatMessages?.appendChild(wrap);
  elements.homeChatArea?.scrollTo({ top: elements.homeChatArea.scrollHeight, behavior: "smooth" });
  return { wrap, rows };
}

function markAgentStepDone(row, elapsed) {
  row.className = "agent-step-row done";
  row.querySelector(".agent-step-icon").innerHTML = CHECK_SVG;
  row.querySelector(".agent-step-elapsed").textContent = `${elapsed}s`;
}

function markAgentStepRunning(row) {
  row.className = "agent-step-row running";
  row.querySelector(".agent-step-icon").innerHTML = SPINNER_SVG;
  row.querySelector(".agent-step-elapsed").textContent = "Running…";
}

function addAgentSummary(wrap, widgetCount) {
  const summary = document.createElement("div");
  summary.className = "agent-log-summary";
  summary.innerHTML = `${AI_SPARK_SVG} Dashboard ready — <strong>${widgetCount} widget${widgetCount !== 1 ? "s" : ""}</strong> built`;
  wrap.appendChild(summary);
  elements.homeChatArea?.scrollTo({ top: elements.homeChatArea.scrollHeight, behavior: "smooth" });
}

/* ===== Auto Dashboard Build (replaces duel flow) ===== */
async function startDuel() {
  /* Legacy alias — just calls autoBuildDashboard */
  return autoBuildDashboard();
}

async function autoBuildDashboard() {
  if (!state.currentDataset) return;
  state.savedDashboard = false;
  state.dashboardFilters = [];
  state.datePreset = "all";
  state.customDateRange = { start: null, end: null };

  /* Feature 1: inline agentic step-log replaces full-screen overlay */
  setAgentStatus("generating");
  const stepLabels = [
    "Dataset profiled",
    "AI analysis complete",
    "Generating dashboard widgets…",
  ];
  const { wrap, rows } = createAgentStepLog(stepLabels);

  /* Step 0 — data already profiled, mark done immediately */
  markAgentStepRunning(rows[0]);
  await new Promise((r) => setTimeout(r, 350));
  markAgentStepDone(rows[0], 1);

  /* Step 1 — simulate analysis with a short delay */
  markAgentStepRunning(rows[1]);
  await new Promise((r) => setTimeout(r, 500));
  markAgentStepDone(rows[1], 2);

  /* Step 2 — actual API call, show live elapsed counter */
  markAgentStepRunning(rows[2]);
  const t0 = Date.now();
  /* Step 11: pulsing dot + live timer in the running step */
  const elapsedEl = rows[2].querySelector(".agent-step-elapsed");
  if (elapsedEl) {
    elapsedEl.innerHTML = `<span class="generating-status-row"><span class="agent-generating-dot"></span><span class="generating-timer" id="gen-timer-txt">0s</span></span>`;
  }
  let elapsedTimer = setInterval(() => {
    const s = Math.round((Date.now() - t0) / 1000);
    const timerEl = document.getElementById("gen-timer-txt");
    if (timerEl) timerEl.textContent = `${s}s`;
    else if (elapsedEl) elapsedEl.textContent = `Running ${s}s`;
  }, 1000);

  const modelKey = state.selectedModelKey || null;
  const modelName = state.availableModels.find((m) => m.key === modelKey)?.display_name || "Auto";

  try {
    const response = await apiFetch(`/visuals/${state.currentDataset.id}/dashboard`, {
      method: "POST",
      body: JSON.stringify({ max_visuals: 10, model_key: modelKey }),
    });
    clearInterval(elapsedTimer);
    const elapsed = Math.round((Date.now() - t0) / 1000);
    state.finalVisuals = response.visuals || [];
    markAgentStepDone(rows[2], elapsed);
    addAgentSummary(wrap, state.finalVisuals.length);
    setAgentStatus("idle");

    if (!state.finalVisuals.length) {
      appendHomeBubble("assistant", "I couldn't generate visuals for this dataset. Try uploading a different file or ask me to add a specific chart.");
      return;
    }
    enterDashboardMode();
  } catch (err) {
    clearInterval(elapsedTimer);
    markAgentStepDone(rows[2], Math.round((Date.now() - t0) / 1000));
    setAgentStatus("idle");
    console.error("Dashboard build failed:", err);

    /* Detect billing/payment/quota errors (backend returns 402) */
    const msg = err.message || "";
    if (msg.includes("API error") || msg.includes("payment") || msg.includes("billing") || msg.includes("quota") || msg.includes("invalid api key") || msg.includes("authentication")) {
      appendHomeBubble("assistant", msg);
    } else {
      appendHomeBubble("assistant", `Dashboard build failed: ${msg || "Please try again."}`);
    }
  }
}

/* ── Mobile helpers ──────────────────────────────────────── */
function updateMobilePageTitle(title) {
  const el = document.getElementById("mobile-page-title");
  if (el) el.textContent = title || "Onyx";
}

function updateMobileGreeting() {
  const nameEl = document.getElementById("mobile-greeting-name");
  if (!nameEl) return;
  if (state.email) {
    const first = state.email.split("@")[0].split(".")[0];
    nameEl.textContent = first.charAt(0).toUpperCase() + first.slice(1);
  } else {
    nameEl.textContent = "there";
  }
}

function showDashboardNavBadge(show) {
  const badge = document.getElementById("dashboard-nav-badge");
  if (badge) badge.classList.toggle("hidden", !show);
}

function updateMobileBottomNav(activeNav) {
  document.querySelectorAll(".mobile-nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === activeNav);
  });
}
/* ── End mobile helpers ──────────────────────────────────── */

function enterDashboardMode() {
  state.step = "dashboard";
  state.savedDashboard = false;

  const appMain = document.querySelector(".app-main");
  const homeSection = elements.projectsSection;

  /* Hide welcome, show chat area */
  if (elements.homeWelcome) elements.homeWelcome.classList.add("hidden");
  if (elements.homeChatArea) elements.homeChatArea.classList.remove("hidden");
  if (elements.homeSuggestions) elements.homeSuggestions.innerHTML = "";
  /* Clear file chips / hint from input area */
  if (elements.selectedFiles) { elements.selectedFiles.innerHTML = ""; elements.selectedFiles.classList.add("hidden"); }

  /* Update input placeholder for sidebar context */
  if (elements.homeInput) elements.homeInput.placeholder = "Ask the AI about your dashboard…";

  /* Show chat sidebar header */
  document.getElementById("chat-sidebar-header")?.classList.remove("hidden");

  /* Activate dashboard layout: chat slides left, dashboard fills right */
  homeSection?.classList.remove("hidden");
  appMain?.classList.add("dashboard-active");

  /* Show and animate dashboard section */
  allStepSections.forEach((s) => { if (s !== homeSection) s?.classList.add("hidden"); });
  elements.dashboardSection?.classList.remove("hidden");
  elements.filterBar?.classList.remove("hidden");
  elements.kpiStrip?.classList.remove("hidden");

  /* Render dashboard content */
  renderKpiStrip();
  updateFilterBar();
  renderDashboard();

  /* Mobile: update header title, bottom nav, and badge */
  const dashTitle = document.getElementById("dashboard-project-title")?.textContent || state.currentProject?.name || "Dashboard";
  updateMobilePageTitle(dashTitle);
  updateMobileBottomNav("dashboard");
  showDashboardNavBadge(true);

  /* Do NOT open the right dash-chat panel — left chat panel is the AI assistant here */

  saveSession();
}

function exitDashboardMode() {
  const appMain = document.querySelector(".app-main");
  appMain?.classList.remove("dashboard-active");
  elements.projectsSection?.classList.remove("chat-collapsed");
  document.getElementById("chat-sidebar-header")?.classList.add("hidden");
  clearTileFocus();
  closeTileFullscreen();
  closeAddVisualPanel();
  setAgentStatus("idle");
  showGenerateDashboardRow(false);
  /* Restore input placeholder */
  if (elements.homeInput) elements.homeInput.placeholder = "Ask a question about your data, or attach a file to get started…";
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

  /* Sidebar login / logout */
  document.getElementById("sidebar-login-btn")?.addEventListener("click", () => {
    state.pendingStep = state.step;
    openAuthModal();
  });
  document.getElementById("sidebar-logout-btn")?.addEventListener("click", () => {
    state.token = null; state.email = null;
    localStorage.removeItem("token"); localStorage.removeItem("email");
    state.projectSummaries = {};
    startNewAnalysis();
    setAuthenticatedView();
  });

  /* Sidebar theme toggle */
  document.getElementById("sidebar-theme-toggle")?.addEventListener("click", () => {
    toggleTheme();
    updateSidebarThemeIcon();
  });

  /* Settings modal */
  document.getElementById("sidebar-settings")?.addEventListener("click", openSettings);
  document.getElementById("settings-close")?.addEventListener("click", closeSettings);
  document.getElementById("settings-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("settings-modal")) closeSettings();
  });
  document.querySelectorAll(".settings-theme-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.theme);
      updateSidebarThemeIcon();
      document.querySelectorAll(".settings-theme-opt").forEach((b) => b.classList.toggle("active", b.dataset.theme === state.theme));
    });
  });
  document.getElementById("settings-clear-session")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    closeSettings();
    showToast("Session cleared");
  });
  document.getElementById("settings-login-btn")?.addEventListener("click", () => { closeSettings(); state.pendingStep = state.step; openAuthModal(); });
  document.getElementById("settings-logout-btn")?.addEventListener("click", () => {
    closeSettings();
    state.token = null; state.email = null;
    localStorage.removeItem("token"); localStorage.removeItem("email");
    state.projectSummaries = {};
    startNewAnalysis();
    setAuthenticatedView();
  });

  /* Home chat input */
  elements.homeInput?.addEventListener("input", () => {
    autoResizeHomeInput();
    const hasText = elements.homeInput.value.trim().length > 0;
    const hasFiles = state.pendingFiles.length > 0;
    if (elements.homeSendBtn) elements.homeSendBtn.disabled = !hasText && !hasFiles;
  });
  elements.homeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHomeChat(); }
  });
  elements.homeSendBtn?.addEventListener("click", sendHomeChat);

  /* Home drag-drop zone */
  const homeDropZone = elements.homeDropZone;
  if (homeDropZone) {
    homeDropZone.addEventListener("dragover", (e) => { e.preventDefault(); homeDropZone.classList.add("drag-over"); });
    homeDropZone.addEventListener("dragleave", () => homeDropZone.classList.remove("drag-over"));
    homeDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      homeDropZone.classList.remove("drag-over");
      const files = Array.from(e.dataTransfer?.files || []).filter((f) => /\.(csv|xlsx|xls|tsv|xlsb)$/i.test(f.name));
      if (files.length) handleFilesSelected(files);
    });
  }

  /* Upload file input change (home page) */
  elements.uploadFiles?.addEventListener("change", (event) => {
    const files = Array.from(event.target?.files || []);
    if (files.length) handleFilesSelected(files);
    event.target.value = "";
  });


  elements.authClose?.addEventListener("click", closeAuthModal);

  /* Sidebar */
  elements.sidebarToggle?.addEventListener("click", () => toggleSidebar());
  elements.sidebarCollapse?.addEventListener("click", () => toggleSidebar(false));
  elements.sidebarNewProject?.addEventListener("click", () => { closeMobileSidebar(); toggleSidebar(false); startNewAnalysis(); });
  /* Logo click → home */
  document.querySelector(".sidebar-brand")?.addEventListener("click", (e) => {
    if (e.target.closest(".sidebar-collapse-btn")) return;
    startNewAnalysis();
  });
  const savedSidebar = localStorage.getItem(SIDEBAR_PREF_KEY);
  if (savedSidebar === "expanded") toggleSidebar(true);

  /* Mobile hamburger menu */
  document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
    const sidebar = elements.appSidebar;
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;
    sidebar.classList.add("mobile-open");
    if (overlay) overlay.classList.remove("hidden");
  });
  document.getElementById("sidebar-overlay")?.addEventListener("click", closeMobileSidebar);

  /* Google OAuth login */
  document.getElementById("google-login-btn")?.addEventListener("click", () => {
    window.location.href = `${API_BASE}/auth/google/login`;
  });

  /* Mobile bottom navigation */
  document.querySelectorAll(".mobile-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      document.querySelectorAll(".mobile-nav-item").forEach((b) => b.classList.toggle("active", b === btn));
      if (nav === "home") { setStep("upload"); }
      else if (nav === "dashboard" && state.currentDataset) { setStep("dashboard"); }
      else if (nav === "insights" && state.currentDataset) { setStep("dashboard"); }
      else if (nav === "profile") {
        if (state.token) openSettings();
        else openAuthModal();
      }
    });
  });

  /* initDropZone() not called — legacy drop zone removed from HTML */

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

  /* Chat sidebar collapse / reopen */
  document.getElementById("chat-sidebar-close-btn")?.addEventListener("click", () => {
    elements.projectsSection?.classList.add("chat-collapsed");
    document.getElementById("chat-reopen-btn")?.classList.add("active");
  });
  document.getElementById("chat-reopen-btn")?.addEventListener("click", () => {
    const isCollapsed = elements.projectsSection?.classList.contains("chat-collapsed");
    elements.projectsSection?.classList.toggle("chat-collapsed", !isCollapsed);
    document.getElementById("chat-reopen-btn")?.classList.toggle("active", !isCollapsed);
    setTimeout(() => elements.dashboardGrid?.querySelectorAll(".chart").forEach((c) => Plotly.Plots.resize(c)), 400);
  });
  /* Legacy right dash-chat panel (kept for compat, hidden in new flow) */
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

  document.getElementById("snapshot-insights-btn")?.addEventListener("click", snapshotInsights);

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

  /* Dash sidebar model picker */
  document.getElementById("dash-model-picker-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleModelPicker(document.getElementById("dash-model-picker-btn"));
  });

  /* Generate Dashboard button */
  document.getElementById("generate-dashboard-btn")?.addEventListener("click", () => {
    if (!state.currentDataset) { showToast("Upload a file first"); return; }
    showGenerateDashboardRow(false);
    autoBuildDashboard();
  });

  elements.addVisualBtn?.addEventListener("click", () => openAddVisualPanel());
  elements.closeAddVisual?.addEventListener("click", () => closeAddVisualPanel());

  /* Step 7: Advanced toggle in widget config panel */
  document.getElementById("widget-advanced-toggle")?.addEventListener("click", function () {
    this.classList.toggle("open");
    const body = document.getElementById("widget-advanced-body");
    if (body) body.classList.toggle("open");
  });

  /* Tile fullscreen modal close */
  document.getElementById("tile-fullscreen-close")?.addEventListener("click", closeTileFullscreen);

  /* Widget config delete button — removes the currently-editing visual */
  document.getElementById("widget-config-delete")?.addEventListener("click", () => {
    if (state.editingVisualId) {
      removeVisual(state.editingVisualId);
      closeAddVisualPanel();
    }
  });

  /* Click outside dashboard tiles clears tile focus */
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".grid-stack-item") && !e.target.closest("#add-visual-modal") && !e.target.closest("#tile-fullscreen-modal")) {
      clearTileFocus();
    }
  });

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

  /* Welcome suggestion cards (desktop grid) */
  document.getElementById("welcome-cards")?.addEventListener("click", (e) => {
    const card = e.target.closest(".welcome-card");
    if (!card) return;
    const prompt = card.dataset.prompt;
    if (prompt && elements.homeInput) {
      elements.homeInput.value = prompt;
      if (elements.homeSendBtn) elements.homeSendBtn.disabled = false;
      elements.homeInput.focus();
      autoResizeHomeInput();
    }
  });

  /* Mobile quick-action pills — same behaviour as welcome cards */
  document.getElementById("mobile-quick-pills")?.addEventListener("click", (e) => {
    const pill = e.target.closest(".mobile-quick-pill");
    if (!pill) return;
    const prompt = pill.dataset.prompt;
    if (prompt && elements.homeInput) {
      elements.homeInput.value = prompt;
      if (elements.homeSendBtn) elements.homeSendBtn.disabled = false;
      elements.homeInput.focus();
      autoResizeHomeInput();
      sendHomeChat();
    }
  });

  /* Mobile hamburger — opens the sidebar drawer */
  document.getElementById("mobile-hamburger")?.addEventListener("click", () => {
    const sidebar = elements.appSidebar;
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;
    sidebar.classList.add("mobile-open");
    if (overlay) overlay.classList.remove("hidden");
  });

  /* Mobile avatar — opens settings (or auth modal if not logged in) */
  document.getElementById("mobile-avatar-btn")?.addEventListener("click", () => {
    if (state.token) openSettings();
    else openAuthModal();
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

  elements.saveToastSignin?.addEventListener("click", () => {
    elements.saveToast?.classList.add("hidden");
    state.pendingStep = "dashboard"; // Stay on dashboard after login
    openAuthModal();
  });
  
  elements.saveToastDismiss?.addEventListener("click", () => {
    elements.saveToast?.classList.add("hidden");
  });

  /* logoutBtn (header) removed — logout handled by sidebar-logout-btn above */

  /* Model picker */
  document.getElementById("model-picker-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleModelPicker();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#model-picker-dropdown") && !e.target.closest("#model-picker-btn")) {
      document.getElementById("model-picker-dropdown")?.classList.add("hidden");
    }
  });
}

/* ===== Model Picker ===== */
const MODEL_KEY_STORAGE = "onyx_model";

async function loadModels() {
  try {
    const models = await apiFetch("/models/");
    state.availableModels = models;
    const available = models.filter((m) => m.available);
    /* Prefer gemini-2-0-flash (free) when available; fall back through preferred list */
    if (available.find((m) => m.key === "gemini-2-0-flash")) {
      state.selectedModelKey = "gemini-2-0-flash";
      localStorage.setItem(MODEL_KEY_STORAGE, "gemini-2-0-flash");
    } else if (!available.find((m) => m.key === state.selectedModelKey)) {
      const preferred = ["gemini-2-0-flash", "gemini-2-5-flash-lite", "llama-groq", "gpt-4o-mini", "claude-haiku-4-5"];
      const best = preferred.find((k) => available.find((m) => m.key === k))
        || available[0]?.key
        || "gemini-2-0-flash";
      state.selectedModelKey = best;
      localStorage.setItem(MODEL_KEY_STORAGE, best);
    }
    renderModelPickerBtn();
  } catch (_e) {
    /* Non-fatal: model picker just shows nothing */
  }
}

function renderModelPickerBtn() {
  const model = state.availableModels.find((m) => m.key === state.selectedModelKey);
  const labelEl = document.getElementById("model-picker-label");
  const dashLabelEl = document.getElementById("dash-model-picker-label");
  const tierEl = document.getElementById("model-picker-tier");
  const name = model ? model.display_name : "Auto";
  if (labelEl) labelEl.textContent = name;
  if (dashLabelEl) dashLabelEl.textContent = name;
  if (tierEl) {
    if (!model) { tierEl.textContent = ""; tierEl.className = "model-tier-badge"; return; }
    tierEl.textContent = model.tier === "free" ? "Free" : "Paid";
    tierEl.className = `model-tier-badge ${model.tier}`;
  }
}

/* Provider groups — best + free models only */
const MODEL_GROUPS = [
  { label: "Google", keys: ["gemini-3-1-pro", "gemini-3-flash", "gemini-2-5-flash-lite", "gemini-2-0-flash"] },
  { label: "Anthropic", keys: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"] },
  { label: "OpenAI", keys: ["gpt-5-2", "gpt-4o-mini"] },
  { label: "Open Source · Groq", keys: ["gpt-oss-120b", "llama-4-scout", "llama-groq", "llama-3-1-8b"] },
];

function renderModelPickerList() {
  const panel = document.getElementById("model-list-panel");
  if (!panel || !state.availableModels.length) return;
  panel.innerHTML = "";

  const modelsByKey = {};
  state.availableModels.forEach((m) => { modelsByKey[m.key] = m; });

  MODEL_GROUPS.forEach((group, groupIdx) => {
    const groupModels = group.keys
      .map((k) => modelsByKey[k])
      .filter(Boolean);
    if (!groupModels.length) return;

    const header = document.createElement("div");
    header.className = groupIdx === 0 ? "model-picker-group-header" : "model-picker-group-header model-picker-group-separator";
    header.textContent = group.label;
    panel.appendChild(header);

    groupModels.forEach((m) => _appendModelRow(m, panel));
  });

  /* Append any models not covered by the groups */
  const groupedKeys = MODEL_GROUPS.flatMap((g) => g.keys);
  const ungrouped = state.availableModels.filter((m) => !groupedKeys.includes(m.key));
  ungrouped.forEach((m) => _appendModelRow(m, panel));
}

function _appendModelRow(m, panel) {
  const btn = document.createElement("button");
  btn.type = "button";
  const isSelected = m.key === state.selectedModelKey;
  btn.className = `model-picker-item${isSelected ? " active" : ""}${!m.available ? " unavailable" : ""}`;

  /* Credit cost badge (right side) */
  let creditHtml;
  if (!m.available) {
    creditHtml = `<span class="model-item-nokey">No key</span>`;
  } else {
    const credits = m.credits ?? (m.tier === "free" ? 0 : 5);
    const label = credits === 0 ? "Free" : `${credits}x`;
    const cls = credits === 0 ? "model-credit-badge free" : credits <= 2 ? "model-credit-badge low" : credits <= 5 ? "model-credit-badge mid" : "model-credit-badge high";
    const checkHtml = isSelected ? `<svg class="model-item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : "";
    creditHtml = `${checkHtml}<span class="${cls}">${label}</span>`;
  }

  btn.innerHTML = `
    <div class="model-item-name">${m.display_name}</div>
    <div class="model-item-right">${creditHtml}</div>`;

  if (m.available) btn.addEventListener("click", () => selectModel(m.key));
  panel.appendChild(btn);
}

function selectModel(key) {
  state.selectedModelKey = key;
  localStorage.setItem(MODEL_KEY_STORAGE, key);
  renderModelPickerBtn();
  renderModelPickerList();
  document.getElementById("model-picker-dropdown")?.classList.add("hidden");
}

function toggleModelPicker(btnEl) {
  const dropdown = document.getElementById("model-picker-dropdown");
  const btn = btnEl || document.getElementById("model-picker-btn");
  if (!dropdown) return;
  if (dropdown.classList.contains("hidden")) {
    renderModelPickerList();
    dropdown.classList.remove("hidden");
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const dropH = Math.min(480, window.innerHeight * 0.6);
      const top = rect.top - dropH - 8;
      dropdown.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 296))}px`;
      dropdown.style.top = `${Math.max(8, top)}px`;
      dropdown.style.maxHeight = `${dropH}px`;
    }
  } else {
    dropdown.classList.add("hidden");
  }
}

async function init() {
  /* Handle Google OAuth redirect — pick up token from URL */
  const urlParams = new URLSearchParams(window.location.search);
  const oauthToken = urlParams.get("token");
  if (oauthToken) {
    state.token = oauthToken;
    localStorage.setItem("token", oauthToken);
    window.history.replaceState({}, "", "/");
  }

  applyTheme(state.theme);
  updateSidebarThemeIcon();
  setAuthenticatedView();
  bindEvents();
  initSuggestionDropdown();
  setAgentStatus("idle");
  elements.projectListSkeleton?.classList.remove("hidden");

  /* Load models in parallel with projects — non-blocking */
  loadModels();

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

  // Restore previous session if available (works for both auth and non-auth users)
  const saved = loadSession();
  if (saved && saved.projectId && saved.datasetId) {
    try {
      // For authenticated users, find project in loaded list
      let project = state.projects.find((p) => p.id === saved.projectId);
      
      // For non-authenticated users or if project not in list, try to fetch directly
      if (!project && saved.projectId) {
        try {
          project = await apiFetch(`/projects/${saved.projectId}`);
        } catch (_e) {
          project = null;
        }
      }
      
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
          updateCurrentProjectName();
          
          // Restore to the saved step if it's valid
          if (saved.step === "dashboard" && state.finalVisuals.length) {
            enterDashboardMode();
            return;
          } else if (saved.step === "ai-chat") {
            setStep("ai-chat");
            return;
          } else if (saved.step === "duel") {
            if (state.finalVisuals.length) {
              enterDashboardMode();
            } else {
              setStep("upload");
            }
            return;
          }
        }
      }
    } catch (_e) {
      console.warn("Session restore failed, starting fresh");
    }
  }
  updateMobileGreeting();
  setStep("upload");
}

init();
