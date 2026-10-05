const ManageProdukScreen = {
  components: { SearchableSelect },
  data() {
    return {
      store: Store,
      searchInput: '',

      sectorModalOpen: false,
      sectorMode: 'create',
      sectorEditingId: null,
      sectorFormId: '',
      sectorFormNama: '',
      sectorSaving: false,

      assignModalOpen: false,
      assignSearch: '',
      assignSelected: null,
      assignSectorId: '',
      assignSaving: false,
    };
  },
  watch: {
    sectorModalOpen(v) { v ? lockScroll() : unlockScroll(); },
    assignModalOpen(v) { v ? lockScroll() : unlockScroll(); },
  },
  computed: {
    sectorOptions() {
      return [{ value: '', label: 'Semua Sector' }, ...this.store.sectorsList.map(s => ({ value: s.id, label: s.nama }))];
    },
    assignSectorOptions() {
      return this.store.sectorsList.map(s => ({ value: s.id, label: s.nama }));
    },
    produkZonaIni() {
      return this.store.sectorFilter ? this.store.produkList.filter(p => p.sector_id === this.store.sectorFilter) : this.store.produkList;
    },
    filtered() {
      return this.produkZonaIni.filter(p => !this.store.searchQuery || p.nama.toLowerCase().includes(this.store.searchQuery));
    },
    assignMatches() {
      const q = this.assignSearch.trim().toLowerCase();
      if (!q) return [];
      return this.store.allMasterProduk.filter(p =>
        p.nama?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.kode_produk?.toLowerCase().includes(q)
      ).slice(0, 20);
    },
  },
  methods: {
    onSearchInput() { Store.searchQuery = this.searchInput.toLowerCase(); },

    openSectorCreate() {
      if (!Store.currentZonaId) { toast('Pilih zona dulu.', 'warn'); return; }
      this.sectorMode = 'create'; this.sectorEditingId = null;
      this.sectorFormId = ''; this.sectorFormNama = '';
      this.sectorModalOpen = true;
    },
    openSectorEdit(sector) {
      this.sectorMode = 'edit'; this.sectorEditingId = sector.id;
      this.sectorFormId = sector.id; this.sectorFormNama = sector.nama;
      this.sectorModalOpen = true;
    },
    closeSectorModal() { this.sectorModalOpen = false; },
    async saveSector() {
      const id = this.sectorFormId.trim();
      const nama = this.sectorFormNama.trim();
      if (!id) { toast('ID Sector wajib diisi.', 'warn'); return; }
      if (!nama) { toast('Nama Sector wajib diisi.', 'warn'); return; }

      this.sectorSaving = true;
      const isEdit = this.sectorMode === 'edit';
      const { error } = await saveSector({ isEdit, id: isEdit ? this.sectorEditingId : id, nama, zonaId: Store.currentZonaId });
      this.sectorSaving = false;
      if (error) { toast(error); return; }
      await loadProdukForZona(Store.currentZonaId);
      this.closeSectorModal();
    },
    async removeSector(sector) {
      const confirmed = await confirmDialog({
        title: 'Hapus Sector?',
        message: `Hapus Sector "${sector.nama}"? Semua assignment produk di sector ini bakal ikut kehapus.\n\nKalau sector ini udah pernah dipake buat scan, penghapusan bakal ditolak otomatis biar data histori gak ilang.`,
        confirmText: 'Hapus', danger: true,
      });
      if (!confirmed) return;
      const { error } = await deleteSector(sector.id);
      if (error) { toast(error); return; }
      if (Store.sectorFilter === sector.id) Store.sectorFilter = '';
      await loadProdukForZona(Store.currentZonaId);
    },
    async removeProdukSector(item) {
      const confirmed = await confirmDialog({
        title: 'Hapus Produk dari Sector?',
        message: `Hapus "${item.nama}" dari sector ini? (data produk & assignment di sector laen gak kepengaruh)`,
        confirmText: 'Hapus', danger: true,
      });
      if (!confirmed) return;
      const { error } = await deleteProdukSector(item.id);
      if (error) { toast(error); return; }
      await loadProdukForZona(Store.currentZonaId);
    },

    async openAssignModal() {
      if (!Store.sectorsList.length) { toast('Belum ada sector yang bisa dipilih. Bikin sector dulu.', 'warn'); return; }
      this.assignSelected = null;
      this.assignSearch = '';
      this.assignSectorId = Store.sectorFilter || Store.sectorsList[0].id;
      await ensureAllMasterProdukLoaded();
      this.assignModalOpen = true;
    },
    closeAssignModal() { this.assignModalOpen = false; },
    pickProduk(p) {
      this.assignSelected = p;
      this.assignSearch = '';
    },
    clearAssignSelected() { this.assignSelected = null; },
    async saveAssign() {
      const produk = this.assignSelected;
      const sectorId = this.assignSectorId;
      if (!produk) { toast('Cari & pilih produk dulu.', 'warn'); return; }
      if (!sectorId) { toast('Pilih sector dulu.', 'warn'); return; }

      this.assignSaving = true;
      try {
        const result = await assignProdukToSector(produk, sectorId);
        if (result?.warn) { toast(result.warn, 'warn'); }
        await loadProdukForZona(Store.currentZonaId);
        this.closeAssignModal();
      } catch (err) {
        toast('Gagal assign produk: ' + (err.message || err));
      } finally {
        this.assignSaving = false;
      }
    },
  },
  template: `
    <div class="main-content">
      <div class="dash-content">
        <div class="produk-toolbar">
          <div class="produk-toolbar-heading">
            <h1 style="font-size:19px;font-weight:600;margin:0;">Sector &amp; Produk</h1>
            <p class="hint" style="margin:2px 0 0;">Zona {{ store.currentZona }}</p>
          </div>
          <div class="produk-toolbar-search">
            <div class="search-box">
              <i class="ti ti-search"></i>
              <input type="text" v-model="searchInput" placeholder="Cari produk..." @input="onSearchInput">
            </div>
            <SearchableSelect v-model="store.sectorFilter" :options="sectorOptions" placeholder="Semua Sector" />
          </div>
        </div>
        <div class="admin-actions">
          <button class="btn-ghost" @click="openSectorCreate"><i class="ti ti-plus"></i> Sector Baru</button>
          <button class="btn-ghost" @click="openAssignModal"><i class="ti ti-plus"></i> Produk Baru</button>
        </div>
        <div class="sector-manage-list">
          <div v-for="s in store.sectorsList" :key="s.id" class="sector-chip">
            <span>{{ s.nama }}</span>
            <button class="btn-icon-xs" title="Edit sector" @click="openSectorEdit(s)"><i class="ti ti-edit"></i></button>
            <button class="btn-icon-xs danger" title="Hapus sector" @click="removeSector(s)"><i class="ti ti-trash"></i></button>
          </div>
        </div>

        <div v-if="produkZonaIni.length" class="produk-table-wrap">
          <div class="table-scroll">
          <table class="produk-table">
            <colgroup>
              <col style="width:13%"><col style="width:27%"><col style="width:18%">
              <col style="width:12%"><col style="width:15%"><col style="width:15%">
            </colgroup>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Produk</th>
                <th>Barcode</th>
                <th>Satuan</th>
                <th>Sector</th>
                <th class="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtered.length"><td colspan="6" class="empty-state">Gak ada produk yang cocok.</td></tr>
              <tr v-for="p in filtered" :key="p.id">
                <td><span class="kategori-tag">{{ p.kategori || '-' }}</span></td>
                <td class="produk-nama">{{ p.nama }}</td>
                <td>{{ p.barcode }}</td>
                <td>{{ p.satuan || '-' }}</td>
                <td><span class="sector-tag">{{ p.sector_nama }}</span></td>
                <td class="num">
                  <button class="btn-icon danger" title="Lepas dari sector ini" @click="removeProdukSector(p)"><i class="ti ti-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
        <div v-else class="empty-state"><p>Belum ada produk yang ke-assign ke sector di zona ini.</p></div>
      </div>

    <Transition name="modal-pop">
      <div v-if="sectorModalOpen" class="modal-overlay" @click.self="closeSectorModal">
        <div class="modal-card">
          <h2>{{ sectorMode === 'create' ? 'Sector Baru' : 'Edit Sector' }}</h2>
          <p class="modal-desc" style="margin-bottom:16px;">{{ sectorMode === 'create' ? ('Sector ini bakal dibikin di dalem Zona: ' + store.currentZona) : ('Sector ini ada di dalem Zona: ' + store.currentZona) }}</p>
          <div class="field">
            <label>ID (unik, cth: dc-b-p-001)</label>
            <input type="text" v-model="sectorFormId" :disabled="sectorMode === 'edit'" placeholder="dc-b-p-001">
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Nama</label>
            <input type="text" v-model="sectorFormNama" placeholder="cth: P001">
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" @click="closeSectorModal">Batal</button>
            <button class="btn-amber" :disabled="sectorSaving" @click="saveSector">{{ sectorSaving ? 'Menyimpan...' : 'Simpan' }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal-pop">
      <div v-if="assignModalOpen" class="modal-overlay" @click.self="closeAssignModal">
        <div class="modal-card">
          <h2>Assign Produk ke Sector</h2>
          <p class="modal-desc" style="margin-bottom:16px;">Cari produk yang udah terdaftar di Master Produk, terus assign ke sector ini. Belum ada produknya? Bikin dulu lewat menu Master → Produk.</p>
          <div class="field">
            <label>Cari Produk (nama / barcode / kode)</label>
            <input type="text" v-model="assignSearch" placeholder="Ketik buat cari...">
            <div :class="['assign-produk-results', { show: assignMatches.length || (assignSearch.trim() && !assignMatches.length) }]">
              <div v-if="assignSearch.trim() && !assignMatches.length" class="assign-produk-result-item">Gak ketemu. Bikin dulu lewat Master → Produk.</div>
              <div v-for="p in assignMatches" :key="p.barcode" class="assign-produk-result-item" @click="pickProduk(p)">
                <b>{{ p.nama }}</b>
                <span>{{ p.barcode }}{{ p.kode_produk ? ' · ' + p.kode_produk : '' }}</span>
              </div>
            </div>
          </div>
          <div v-if="assignSelected" class="field">
            <label>Produk Terpilih</label>
            <div class="assign-produk-selected">
              <span>{{ assignSelected.nama }} <span style="font-weight:400;opacity:.75;">({{ assignSelected.barcode }})</span></span>
              <button type="button" title="Ganti produk" @click="clearAssignSelected"><i class="ti ti-x"></i></button>
            </div>
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Assign ke Sector</label>
            <SearchableSelect v-model="assignSectorId" :options="assignSectorOptions" placeholder="Pilih sector..." />
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" @click="closeAssignModal">Batal</button>
            <button class="btn-amber" :disabled="!assignSelected || assignSaving" @click="saveAssign">{{ assignSaving ? 'Menyimpan...' : 'Simpan' }}</button>
          </div>
        </div>
      </div>
    </Transition>
    </div>
  `,
};