const ZonaScreen = {
  data() {
    return { store: Store };
  },
  computed: {
    sessionNama() {
      const s = this.store.sessions.find(x => x.id === this.store.activeSessionId);
      return s ? s.nama : '';
    },
  },
  methods: {
    formatTanggal,
    openZona(zona) { enterZona(zona); },
    goAllDc() { switchToAllDcView(); },
  },
  template: `
    <div class="main-content">
      <div class="dash-content">
        <div class="produk-toolbar">
          <div class="produk-toolbar-heading">
            <h1>Pilih Zona</h1>
            <p class="hint">Pilih Zona untuk melihat produk di area itu · <span class="session-name-label">Sesi: <b>{{ sessionNama }}</b></span></p>
          </div>
          <div class="view-toggle-wrap">
            <button type="button" class="view-toggle" @click="goAllDc">
              <span class="view-toggle-thumb"></span>
            </button>
            <span class="view-toggle-caption">Semua Zona / Semua Produk</span>
          </div>
        </div>
        <div class="zona-picker-grid">
          <button v-for="z in store.zonesList" :key="z.id" class="zona-card" @click="openZona(z)">
            <span class="zona-name">{{ z.nama }}</span>
            <span class="zona-meta">
              <span><i class="ti ti-calendar"></i> {{ formatTanggal(z.created_at) }}</span>
            </span>
          </button>
        </div>
        <div v-if="!store.zonesList.length" class="empty-state"><p>Belum ada zona yang terdaftar buat DC ini.</p></div>
      </div>
    </div>
  `,
};