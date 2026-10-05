const ManageDcScreen = {
  data() {
    return {
      store: Store,
      modalOpen: false,
      mode: 'create',
      editingId: null,
      formId: '',
      formNama: '',
      formSub: '',
      formIcon: '',
      saving: false,
    };
  },
  watch: {
    modalOpen(v) { v ? lockScroll() : unlockScroll(); },
  },
  methods: {
    openZona(dc) {
      Store.currentDc = dc;
      loadZones(dc.id);
      Store.currentScreen = 'manageZona';
    },
    openCreate() {
      this.mode = 'create'; this.editingId = null;
      this.formId = ''; this.formNama = ''; this.formSub = ''; this.formIcon = '';
      this.modalOpen = true;
    },
    openEdit(dc) {
      this.mode = 'edit'; this.editingId = dc.id;
      this.formId = dc.id; this.formNama = dc.nama; this.formSub = dc.sub || ''; this.formIcon = dc.icon || '';
      this.modalOpen = true;
    },
    closeModal() { this.modalOpen = false; },
    async save() {
      const id = this.formId.trim();
      const nama = this.formNama.trim();
      const sub = this.formSub.trim();
      const icon = this.formIcon.trim();
      if (!id) { toast('ID DC wajib diisi.', 'warn'); return; }
      if (!nama) { toast('Nama DC wajib diisi.', 'warn'); return; }

      this.saving = true;
      const isEdit = this.mode === 'edit';
      const { error } = await saveDc({ isEdit, id: isEdit ? this.editingId : id, nama, sub, icon });
      this.saving = false;
      if (error) { toast(error); return; }
      this.closeModal();
    },
    async remove(dc) {
      const confirmed = await confirmDialog({
        title: 'Hapus DC?',
        message: `Hapus DC "${dc.nama}"? Kalau DC ini masih punya Zona, Sesi, atau data lain yang nempel, penghapusan bakal ditolak otomatis biar data gak ilang.`,
        confirmText: 'Hapus', danger: true,
      });
      if (!confirmed) return;
      const { error } = await deleteDc(dc.id);
      if (error) toast(error);
    },
  },
  template: `
    <div class="main-content">
      <div class="wrap">
        <div class="session-list-head">
          <div>
            <h1>Pilih Distribution Center</h1>
            <p class="hint">Pilih DC buat kelola Zona, Sector, dan Produk-nya.</p>
          </div>
          <button class="btn-amber" @click="openCreate"><i class="ti ti-plus"></i> DC Baru</button>
        </div>
        <div class="dc-grid">
          <div v-for="dc in store.dcs" :key="dc.id" class="dc-card">
            <div class="dc-card-main" @click="openZona(dc)">
              <div class="dc-icon"><i class="ti" :class="dc.icon || 'ti-building-warehouse'"></i></div>
              <div>
                <p class="name">{{ dc.nama }}</p>
                <p class="sub">{{ dc.sub || '' }}</p>
              </div>
            </div>
            <div class="zona-card-actions">
              <button class="btn-icon" title="Edit DC" @click="openEdit(dc)"><i class="ti ti-edit"></i></button>
              <button class="btn-icon danger" title="Hapus DC" @click="remove(dc)"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        </div>
      </div>

    <Transition name="modal-pop">
      <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <h2>{{ mode === 'create' ? 'DC Baru' : 'Edit DC' }}</h2>
          <div class="field">
            <label>ID (unik, huruf kecil, cth: dc-c)</label>
            <input type="text" v-model="formId" :disabled="mode === 'edit'" placeholder="dc-c">
          </div>
          <div class="field">
            <label>Nama</label>
            <input type="text" v-model="formNama" placeholder="cth: DC C">
          </div>
          <div class="field">
            <label>Sub-judul (opsional)</label>
            <input type="text" v-model="formSub" placeholder="cth: Jakarta Timur">
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Icon Tabler (opsional)</label>
            <input type="text" v-model="formIcon" placeholder="ti-building-warehouse">
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
