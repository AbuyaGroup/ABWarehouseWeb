const Store = Vue.reactive({
  session: null,
  profile: null,
  dcs: [],
  currentDc: null,
  produkList: [],
  sessions: [],
  zonesList: [],
  sectorsList: [],
  sectorFilter: '',
  viewAllDc: false,
  currentZonaId: null,
  currentZona: null,
  profilesById: {},
  activeSessionId: null,
  entries: {},
  searchQuery: '',
  realtimeChannel: null,
  mySessionToken: null,
  sessionCheckChannel: null,

  sessionModalMode: null,
  sessionModalEditingId: null,
  deletingSessionId: null,
  reviewSessionId: null,
  reviewRows: [],
  exportingSession: null,
  zoneModalMode: null,
  zoneModalEditingId: null,
  dcModalMode: null,
  dcModalEditingId: null,
  sectorModalMode: null,
  sectorModalEditingId: null,
  produkModalMode: null,
  produkModalEditingPsId: null,
  assignProdukSelected: null,
  allMasterProduk: [],
  produkMasterModalMode: null,
  produkMasterModalEditingBarcode: null,
  produkMasterSearchQuery: '',

  dashboardPage: 1,
  produkMasterPage: 1,

  sidebarOpen: false,
  sidebarCollapsed: (() => {
    try { return localStorage.getItem('abw_sidebar_collapsed') === '1'; } catch (e) { return false; }
  })(),
  booting: true,
  currentScreen: 'login',
  dashLoading: false,

  syncOk: false,
  syncText: '',

  toasts: [],
  toastSeq: 1,

  confirm: {
    open: false,
    title: '',
    message: '',
    confirmText: 'Ya',
    cancelText: 'Batal',
    danger: false,
    resolver: null,
  },
});

const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing APP_CONFIG. Create js/config.js with window.APP_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }.');
}
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: window.sessionStorage },
});

const SKIP_LOGIN = false;

function formatTanggal(t) {
  if (!t) return '-';
  const d = new Date(t.length <= 10 ? t + 'T00:00:00' : t);
  if (isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toast(message, type = 'error', timeout = 3200) {
  const id = Store.toastSeq++;
  Store.toasts.push({ id, message, type });
  if (timeout) setTimeout(() => removeToast(id), timeout);
}

function removeToast(id) {
  const idx = Store.toasts.findIndex(t => t.id === id);
  if (idx !== -1) Store.toasts.splice(idx, 1);
}

function confirmDialog({ title = 'Konfirmasi', message = '', confirmText = 'Ya', cancelText = 'Batal', danger = false } = {}) {
  return new Promise(resolve => {
    Store.confirm.title = title;
    Store.confirm.message = message;
    Store.confirm.confirmText = confirmText;
    Store.confirm.cancelText = cancelText;
    Store.confirm.danger = danger;
    Store.confirm.resolver = resolve;
    Store.confirm.open = true;
  });
}

function resolveConfirm(result) {
  const resolver = Store.confirm.resolver;
  Store.confirm.open = false;
  Store.confirm.resolver = null;
  if (resolver) resolver(result);
}

let openModalCount = 0;
function lockScroll() {
  openModalCount++;
  document.body.classList.add('modal-open');
}
function unlockScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) document.body.classList.remove('modal-open');
}

function setSync(ok, text) {
  Store.syncOk = ok;
  Store.syncText = text;
}

const SCREEN_ADMIN_ONLY = ['manageDc', 'manageZona', 'manageProduk', 'produkMaster'];

function goToScreen(name) {
  if (SCREEN_ADMIN_ONLY.includes(name) && Store.profile?.role !== 'admin') return;
  if (Store.realtimeChannel) { sb.removeChannel(Store.realtimeChannel); Store.realtimeChannel = null; }
  Store.currentScreen = name;
  Store.sidebarOpen = false;
}

function goToStockOpname() { goToScreen('selector'); }

function toggleSidebarCollapse() {
  Store.sidebarCollapsed = !Store.sidebarCollapsed;
  try { localStorage.setItem('abw_sidebar_collapsed', Store.sidebarCollapsed ? '1' : '0'); } catch (e) {}
}

// Shared by SelectorScreen's DC grid and AppSidebar's Stock Opname dropdown:
// jump straight into a DC's session list, skipping the intermediate selector screen.
async function openDcSessions(dc) {
  if (Store.realtimeChannel) { sb.removeChannel(Store.realtimeChannel); Store.realtimeChannel = null; }
  Store.currentDc = dc;
  Store.currentZona = null;
  Store.activeSessionId = null;
  Store.entries = {};
  Store.searchQuery = '';
  await loadSessions(dc.id);
  Store.currentScreen = 'sessionList';
  Store.sidebarOpen = false;
}