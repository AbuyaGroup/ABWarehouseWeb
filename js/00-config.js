const SUPABASE_URL = "https://qoonjeimsrzztlfyembp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvb25qZWltc3J6enRsZnllbWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTg2MTgsImV4cCI6MjA5OTczNDYxOH0.vgqaUJbDOu0hN7gp3f9SozHsDymZR-0TKTijl8q_2ZI";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: window.sessionStorage }
});

const SKIP_LOGIN = false;

let state = {
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
  profilesById: {},
  activeSessionId: null,
  entries: {},
  searchQuery: '',
  realtimeChannel: null,
  mySessionToken: null,
  currentZona: null,
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
};

function formatTanggal(t){
  if(!t) return '-';
  const d = new Date(t.length <= 10 ? t + 'T00:00:00' : t);
  if(isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

const el = id => document.getElementById(id);

const show = id => {
  const target = el(id);
  target.classList.remove('hidden');
  if(target.classList.contains('modal-overlay')) document.body.classList.add('modal-open');
};
const hide = id => {
  const target = el(id);
  target.classList.add('hidden');
  if(target.classList.contains('modal-overlay')){

    const masihAdaModalKebuka = document.querySelectorAll('.modal-overlay:not(.hidden)').length > 0;
    if(!masihAdaModalKebuka) document.body.classList.remove('modal-open');
  }
};

const scrollContentToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

function renderPaginationBar({ prefix, page, totalPages, onGoTo }){
  const bar = el(`${prefix}Pagination`);
  bar.classList.toggle('hidden', totalPages <= 1);
  if(totalPages <= 1) return;

  el(`${prefix}PageNumbers`).innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(n => `<button class="pg-num ${n === page ? 'active' : ''}" data-page="${n}">${n}</button>`)
    .join('');
  el(`${prefix}PageNumbers`).querySelectorAll('[data-page]').forEach(btn => {
    btn.onclick = () => {
      onGoTo(Number(btn.getAttribute('data-page')));
      scrollContentToTop();
    };
  });

  el(`${prefix}PageFirst`).disabled = page <= 1;
  el(`${prefix}PagePrev`).disabled = page <= 1;
  el(`${prefix}PageNext`).disabled = page >= totalPages;
  el(`${prefix}PageLast`).disabled = page >= totalPages;

  el(`${prefix}PageFirst`).onclick = () => { onGoTo(1); scrollContentToTop(); };
  el(`${prefix}PageLast`).onclick = () => { onGoTo(totalPages); scrollContentToTop(); };

  el(`${prefix}PagePrev`).onclick = () => onGoTo(Math.max(1, page - 1));
  el(`${prefix}PageNext`).onclick = () => onGoTo(Math.min(totalPages, page + 1));
}