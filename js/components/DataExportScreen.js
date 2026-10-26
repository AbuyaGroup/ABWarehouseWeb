const DataExportScreen = {
  components: { SearchableSelect },
  data() {
    return {
      store: Store,
      dcId: '',
      includeSessions: true,
      sessions: [],
      selectedSessionIds: [],
      loadingSessions: false,
      exporting: false,
      lastSummary: null,
    };
  },
  computed: {
    dcOptions() { return this.store.dcs.map(d => ({ value: d.id, label: d.sub ? `${d.nama} · ${d.sub}` : d.nama })); },
    dc() { return this.store.dcs.find(d => d.id === this.dcId) || null; },
    allSelected() { return this.sessions.length > 0 && this.selectedSessionIds.length === this.sessions.length; },
    canExport() { return !!this.dc && !this.exporting && (!this.includeSessions || !this.sessions.length || this.selectedSessionIds.length > 0); },
    sheetList() {
      const list = [{ icon: 'ti-sitemap', name: 'Struktur', desc: 'DC, Zona, Sector, dan produk di tiap sector. Format sama dengan template import.' }];
      if (this.includeSessions) {
        list.push(
          { icon: 'ti-calendar-event', name: 'Sesi', desc: 'Daftar sesi opname yang dipilih.' },
          { icon: 'ti-list-numbers', name: 'Hasil Opname', desc: 'Qty fisik per produk per sector, lengkap dengan penginput dan waktunya.' },
          { icon: 'ti-circle-check', name: 'Qty Final', desc: 'Qty final yang sudah dikonfirmasi per sesi.' },
        );
      }
      return list;
    },
  },
  watch: {
    dcId() { this.lastSummary = null; this.loadSessions(); },
  },
  async mounted() {
    if (!this.store.dcs.length) await loadDcs();
    this.dcId = this.store.currentDc?.id || this.store.dcs[0]?.id || '';
  },
  methods: {
    formatTanggal,
    async loadSessions() {
      this.sessions = [];
      this.selectedSessionIds = [];
      if (!this.dcId) return;
      this.loadingSessions = true;
      const { data } = await sb.from('opname_sessions').select('id, nama, tanggal, status').eq('dc_id', this.dcId).order('tanggal', { ascending: false });
      this.loadingSessions = false;
      this.sessions = data || [];
      this.selectedSessionIds = this.sessions.map(s => s.id);
    },
    toggleAll() { this.selectedSessionIds = this.allSelected ? [] : this.sessions.map(s => s.id); },
    toggleSession(id) {
      const i = this.selectedSessionIds.indexOf(id);
      if (i === -1) this.selectedSessionIds.push(id); else this.selectedSessionIds.splice(i, 1);
    },
    async runExport() {
      if (!this.canExport) return;
      this.exporting = true;
      try {
        this.lastSummary = await exportDcData(this.dc, {
          includeSessions: this.includeSessions,
          sessionIds: this.includeSessions ? [...this.selectedSessionIds] : null,
        });
        toast(`Export ${this.dc.nama} selesai.`, 'success');
      } catch (err) {
        console.error('Gagal export data DC:', err);
        toast('Gagal export: ' + (err.message || err));
      }
      this.exporting = false;
    },
  },
  template: `
    <div class="main-content">
      <div class="wrap data-wrap">
        <header class="data-head">
          <p class="data-eyebrow">Data</p>
          <h1>Export Data</h1>
          <p class="hint">Tarik semua data satu DC ke file Excel.</p>
        </header>

        <div class="data-layout">
          <section class="data-panel">
            <div class="data-step">
              <span class="data-step-no">1</span>
              <div class="data-step-body">
                <h3>Pilih DC</h3>
                <div class="field data-field">
                  <SearchableSelect v-model="dcId" :options="dcOptions" placeholder="Pilih DC..." />
                </div>
              </div>
            </div>

            <div class="data-step">
              <span class="data-step-no">2</span>
              <div class="data-step-body">
                <h3>Isi file</h3>
                <label class="data-check">
                  <input type="checkbox" checked disabled>
                  <span class="data-check-box"><i class="ti ti-check"></i></span>
                  <span>Struktur DC & produk</span>
                </label>
                <label class="data-check">
                  <input type="checkbox" v-model="includeSessions">
                  <span class="data-check-box"><i class="ti ti-check"></i></span>
                  <span>Sesi & hasil opname</span>
                </label>

                <div v-if="includeSessions" class="data-session-box">
                  <div class="data-session-head">
                    <span>{{ selectedSessionIds.length }} dari {{ sessions.length }} sesi dipilih</span>
                    <button v-if="sessions.length" type="button" class="data-link" @click="toggleAll">{{ allSelected ? 'Kosongkan' : 'Pilih semua' }}</button>
                  </div>
                  <p v-if="loadingSessions" class="data-muted">Memuat sesi...</p>
                  <p v-else-if="!sessions.length" class="data-muted">Belum ada sesi di DC ini. File cuma berisi struktur.</p>
                  <div v-else class="data-session-list">
                    <label v-for="s in sessions" :key="s.id" class="data-check data-check-row">
                      <input type="checkbox" :checked="selectedSessionIds.includes(s.id)" @change="toggleSession(s.id)">
                      <span class="data-check-box"><i class="ti ti-check"></i></span>
                      <span class="data-session-name">{{ s.nama }}</span>
                      <span class="data-session-meta">{{ formatTanggal(s.tanggal) }}</span>
                      <span :class="['status-badge', s.status]">{{ s.status }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="data-actions">
              <button class="btn-amber data-btn" :disabled="!canExport" @click="runExport">
                <i class="ti ti-file-spreadsheet"></i> {{ exporting ? 'Menyiapkan file...' : 'Export Excel' }}
              </button>
            </div>

            <div v-if="lastSummary" class="data-result">
              <i class="ti ti-circle-check"></i>
              <span>Terunduh: {{ lastSummary.zona }} zona, {{ lastSummary.sector }} sector, {{ lastSummary.produk }} produk ({{ lastSummary.penempatan }} penempatan)<template v-if="includeSessions">, {{ lastSummary.sesi }} sesi, {{ lastSummary.entri }} baris hasil opname</template>.</span>
            </div>
          </section>

          <aside class="data-panel data-aside">
            <h3>Sheet di dalam file</h3>
            <ul class="data-sheet-list">
              <li v-for="sh in sheetList" :key="sh.name">
                <span class="data-sheet-icon"><i class="ti" :class="sh.icon"></i></span>
                <div>
                  <b>{{ sh.name }}</b>
                  <p>{{ sh.desc }}</p>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  `,
};