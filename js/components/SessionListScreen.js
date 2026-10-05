const SessionListScreen = {
  components: { SearchableSelect, DatePicker },
  data() {
    return {
      store: Store,
      sessionNama: '',
      sessionTanggal: '',
      saving: false,
      deletingSessionNama: '',
      deleting: false,
      exportStep: 'options',
      exportZonaId: '',
      exportSectorId: '',
      exportZonas: [],
      exportSectors: [],
      exportingPdf: false,
    };
  },
  watch: {
    'store.sessionModalMode'(v) { v ? lockScroll() : unlockScroll(); },
    'store.deletingSessionId'(v) { v ? lockScroll() : unlockScroll(); },
    'store.exportingSession'(v) { v ? lockScroll() : unlockScroll(); },
    exportZonaId() { this.loadExportSectors(); },
  },
  computed: {
    isSelesai() { return this.store.exportingSession?.status === 'selesai'; },
    exportZonaOptions() { return this.exportZonas.map(z => ({ value: z.id, label: z.nama })); },
    exportSectorOptions() { return this.exportSectors.map(s => ({ value: s.id, label: s.nama })); },
  },
  methods: {
    formatTanggal,
    statusLabel(s) { return s === 'aktif' ? 'Tandai selesai' : 'Aktifkan lagi'; },

    openNewSessionModal() { this.openSessionModal('create'); },
    openEditSessionModal(s) { this.openSessionModal('edit', s); },
    openSessionModal(mode, session) {
      Store.sessionModalMode = mode;
      Store.sessionModalEditingId = session ? session.id : null;
      const todayIso = new Date().toISOString().slice(0, 10);
      if (mode === 'create') {
        const namaUser = Store.profile?.nama || Store.session?.user?.email || 'Admin';
        this.sessionNama = `${namaUser} · ${formatTanggal(todayIso)}`;
        this.sessionTanggal = todayIso;
      } else {
        this.sessionNama = session.nama;
        this.sessionTanggal = (session.tanggal || todayIso).slice(0, 10);
      }
    },
    closeSessionModal() { Store.sessionModalMode = null; },
    async saveSessionModal() {
      const nama = this.sessionNama.trim();
      const tanggal = this.sessionTanggal;
      if (!nama) { toast('Nama sesi wajib diisi.', 'warn'); return; }
      if (!tanggal) { toast('Tanggal stock opname wajib dipilih.', 'warn'); return; }
      this.saving = true;
      if (Store.sessionModalMode === 'create') {
        const { data, error } = await createSession({ nama, tanggal, dcId: Store.currentDc.id });
        this.saving = false;
        if (error) { toast(error); return; }
        this.closeSessionModal();
        if (data) this.openSession(data.id);
      } else {
        const id = Store.sessionModalEditingId;
        const { error } = await updateSession(id, { nama, tanggal });
        this.saving = false;
        if (error) { toast(error); return; }
        this.closeSessionModal();
      }
    },

    openDeleteModal(s) { Store.deletingSessionId = s.id; this.deletingSessionNama = s.nama; },
    closeDeleteModal() { Store.deletingSessionId = null; },
    async confirmDelete() {
      const id = Store.deletingSessionId;
      if (!id) return;
      this.deleting = true;
      const { error } = await deleteSessionFull(id);
      this.deleting = false;
      if (error) { toast(error, 'error', 6000); return; }
      this.closeDeleteModal();
    },

    async openSession(id) {
      Store.activeSessionId = id;
      await loadEntries();
      const session = Store.sessions.find(x => x.id === id);
      const dcId = session ? session.dc_id : Store.currentDc.id;
      await loadZones(dcId);
      Store.currentScreen = 'zona';
    },
    async toggleStatus(s) {
      if (s.status === 'aktif') this.openReview(s.id);
      else await toggleSessionStatus(s.id);
    },
    openReview(id) { Store.reviewSessionId = id; Store.currentScreen = 'sessionReview'; },

    openExport(s) { Store.exportingSession = s; this.exportStep = 'options'; },
    closeExportModal() { Store.exportingSession = null; },
    async chooseExportPdf() {
      if (!Store.exportingSession) return;
      this.exportStep = 'pdf';
      this.exportSectorId = '';
      this.exportZonas = [];
      this.exportSectors = [];
      const dcId = Store.exportingSession.dc_id;
      const { data, error, warn } = await loadZonaOptionsForExport(dcId);
      if (error) { toast(error, warn ? 'warn' : 'error'); this.exportStep = 'options'; return; }
      this.exportZonas = data;
      this.exportZonaId = data[0].id;
    },
    async loadExportSectors() {
      this.exportSectors = await loadSectorOptionsForExport(this.exportZonaId);
      this.exportSectorId = this.exportSectors[0]?.id || '';
    },
    backToExportOptions() { this.exportStep = 'options'; },
    async confirmExportPdf() {
      if (!Store.exportingSession) return;
      if (!this.exportSectorId) { toast('Pilih sector dulu.', 'warn'); return; }
      this.exportingPdf = true;
      await printSessionPdf(Store.exportingSession.id, this.exportSectorId);
      this.exportingPdf = false;
      this.closeExportModal();
    },
    chooseExportXlsx() {
      if (!Store.exportingSession || !this.isSelesai) return;
      const session = Store.exportingSession;
      this.closeExportModal();
      exportSoTemplateXlsx(session);
    },
  },
  template: `
    <div class="main-content">
      <div class="wrap">
        <div class="session-list-head">
          <div>
            <h1>Sesi Stock Opname</h1>
            <p class="hint">{{ store.currentDc?.nama }}<span v-if="store.currentDc?.sub"> · {{ store.currentDc.sub }}</span> — pilih sesi buat lanjut, atau bikin sesi baru</p>
          </div>
          <button class="btn-amber" @click="openNewSessionModal"><i class="ti ti-plus"></i> Sesi Baru</button>
        </div>
        <div class="session-list">
          <div v-for="s in store.sessions" :key="s.id" class="session-card">
            <div class="info">
              <div class="nama">{{ s.nama }}</div>
              <div class="meta"><span>{{ formatTanggal(s.tanggal) }}</span><span :class="['status-badge', s.status]">{{ s.status }}</span></div>
            </div>
            <div class="actions">
              <button class="btn-icon" title="Export" @click="openExport(s)"><i class="ti ti-download"></i></button>
              <button class="btn-icon" title="Edit sesi" @click="openEditSessionModal(s)"><i class="ti ti-edit"></i></button>
              <button class="btn-icon" :title="statusLabel(s.status)" @click="toggleStatus(s)"><i class="ti" :class="s.status === 'aktif' ? 'ti-check' : 'ti-refresh'"></i></button>
              <button class="btn-icon danger" title="Hapus sesi" @click="openDeleteModal(s)"><i class="ti ti-trash"></i></button>
              <button class="btn-amber" @click="openSession(s.id)">Buka</button>
            </div>
          </div>
        </div>
        <div v-if="!store.sessions.length" class="empty-state"><p>Belum ada sesi opname buat DC ini.<br>Klik "Sesi Baru" buat mulai.</p></div>
      </div>

    <Transition name="modal-pop">
      <div v-if="store.sessionModalMode" class="modal-overlay" @click.self="closeSessionModal">
        <div class="modal-card">
          <h2>{{ store.sessionModalMode === 'create' ? 'Sesi Baru' : 'Edit Sesi' }}</h2>
          <div class="field">
            <label>Nama Sesi</label>
            <input type="text" v-model="sessionNama" placeholder="cth: Opname Juli 2026">
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Tanggal Stock Opname</label>
            <DatePicker v-model="sessionTanggal">
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" @click="closeSessionModal">Batal</button>
            <button class="btn-amber" :disabled="saving" @click="saveSessionModal">{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal-pop">
      <div v-if="store.deletingSessionId" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="modal-card">
          <h2>Hapus Sesi?</h2>
          <p class="modal-desc">Hapus sesi "{{ deletingSessionNama }}"? Semua data opname yang udah keisi di sesi ini bakal ikut kehapus dan gak bisa dibalikin lagi.</p>
          <div class="modal-actions">
            <button class="btn-ghost" @click="closeDeleteModal">Batal</button>
            <button class="btn-danger" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Menghapus...' : 'Hapus' }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal-pop">
      <div v-if="store.exportingSession" class="modal-overlay" @click.self="closeExportModal">
        <div class="modal-card">
          <h2>Export Sesi</h2>
          <p class="modal-desc" style="margin-bottom:16px;">Sesi "{{ store.exportingSession?.nama }}"</p>

          <Transition name="fade" mode="out-in">
          <div v-if="exportStep === 'options'" key="options">
            <button class="export-option" @click="chooseExportPdf">
              <span class="ico"><i class="ti ti-file-type-pdf"></i></span>
              <span class="txt">
                <span class="label">Counting 1 (PDF)</span>
                <span class="desc">Lembar counting per sector, siap print & gunting</span>
              </span>
            </button>
            <button class="export-option" :disabled="!isSelesai" @click="chooseExportXlsx">
              <span class="ico"><i class="ti ti-file-type-xls"></i></span>
              <span class="txt">
                <span class="label">SO Template (Excel)</span>
                <span class="desc">{{ isSelesai ? 'Qty final hasil otorisasi admin' : 'Tersedia setelah sesi ditandai Selesai' }}</span>
              </span>
            </button>
            <div class="modal-actions">
              <button class="btn-ghost" @click="closeExportModal">Batal</button>
            </div>
          </div>

          <div v-else key="pdf">
            <div class="field">
              <label>Zona</label>
              <SearchableSelect v-model="exportZonaId" :options="exportZonaOptions" placeholder="Pilih zona..." />
            </div>
            <div class="field" style="margin-bottom:0;">
              <label>Sector</label>
              <SearchableSelect v-model="exportSectorId" :options="exportSectorOptions" placeholder="Pilih sector..." />
            </div>
            <div class="modal-actions">
              <button class="btn-ghost" @click="backToExportOptions">Kembali</button>
              <button class="btn-amber" :disabled="exportingPdf" @click="confirmExportPdf">{{ exportingPdf ? 'Membuat PDF...' : 'Cetak PDF' }}</button>
            </div>
          </div>
          </Transition>
        </div>
      </div>
    </Transition>
    </div>
  `,
};