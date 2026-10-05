const ManageZonaScreen = {
  data() {
    return {
      store: Store,
      modalOpen: false,
      mode: 'create',
      editingId: null,
      formId: '',
      formNama: '',
      saving: false,
    };
  },
  watch: {
    modalOpen(v) { v ? lockScroll() : unlockScroll(); },
  },
  methods: {
    formatTanggal,
    async openProduk(zona) {
      Store.currentZonaId = zona.id;
      Store.currentZona = zona.nama;
      Store.sectorFilter = '';
      Store.searchQuery = '';
      await loadProdukForZona(zona.id);
      Store.currentScreen = 'manageProduk';
    },
    openCreate() {
      this.mode = 'create'; this.editingId = null;
      this.formId = ''; this.formNama = '';
      this.modalOpen = true;
    },
    openEdit(zona) {
      this.mode = 'edit'; this.editingId = zona.id;
      this.formId = zona.id; this.formNama = zona.nama;
      this.modalOpen = true;
    },
    closeModal() { this.modalOpen = false; },
    async save() {
      const id = this.formId.trim();
      const nama = this.formNama.trim();
      if (!id) { toast('ID Zona wajib diisi.', 'warn'); return; }
      if (!nama) { toast('Nama Zona wajib diisi.', 'warn'); return; }

      this.saving = true;
      const isEdit = this.mode === 'edit';
      const { error } = await saveZone({ isEdit, id: isEdit ? this.editingId : id, nama, dcId: Store.currentDc.id });
      this.saving = false;
      if (error) { toast(error); return; }
      this.closeModal();
    },
    async remove(zona) {
      const confirmed = await confirmDialog({
        title: 'Hapus Zona?',
        message: `Hapus Zona "${zona.nama}"? Semua Sector & assignment produk di dalem zona ini bakal ikut kehapus.\n\nKalau zona ini udah pernah dipake buat scan (ada di opname_entries), penghapusan bakal ditolak otomatis biar data histori gak ilang.`,
        confirmText: 'Hapus', danger: true,
      });
      if (!confirmed) return;
      const { error } = await deleteZona(zona.id, Store.currentDc.id);
      if (error) toast(error);
    },
  },
  template: `
    <div class="main-content">
      <div class="wrap">
        <div class="session-list-head">
          <div>
            <h1>Kelola Data — Pilih Zona</h1>
            <p class="hint">{{ store.currentDc?.nama }}<span v-if="store.currentDc?.sub"> · {{ store.currentDc.sub }}</span> — tambah/liat Zona, Sector, dan Produk buat DC ini, lepas dari sesi opname manapun.</p>
          </div>
          <button class="btn-amber" @click="openCreate"><i class="ti ti-plus"></i> Zona Baru</button>
        </div>
        <div class="zona-picker-grid">
          <div v-for="z in store.zonesList" :key="z.id" class="zona-card">
            <button class="zona-card-main" @click="openProduk(z)">
              <span class="zona-name">{{ z.nama }}</span>
              <span class="zona-meta">
                <span><i class="ti ti-calendar"></i> {{ formatTanggal(z.created_at) }}</span>
              </span>
            </button>
            <div class="zona-card-actions">
              <button class="btn-icon" title="Edit zona" @click="openEdit(z)"><i class="ti ti-edit"></i></button>
              <button class="btn-icon danger" title="Hapus zona" @click="remove(z)"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        </div>
        <div v-if="!store.zonesList.length" class="empty-state"><p>Belum ada zona yang terdaftar buat DC ini.<br>Klik "Zona Baru" buat mulai.</p></div>
      </div>

    <Transition name="modal-pop">
      <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <h2>{{ mode === 'create' ? 'Zona Baru' : 'Edit Zona' }}</h2>
          <div class="field">
            <label>ID (unik, cth: dc-b-p)</label>
            <input type="text" v-model="formId" :disabled="mode === 'edit'" placeholder="dc-b-p">
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Nama</label>
            <input type="text" v-model="formNama" placeholder="cth: P">
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" @click="closeModal">Batal</button>
            <button class="btn-amber" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
          </div>
        </div>
      </div>
    </Transition>
    </div>
  `,
};
