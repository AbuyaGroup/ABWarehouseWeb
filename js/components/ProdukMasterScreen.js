const ProdukMasterScreen = {
  components: { PaginationBar },
  data() {
    return {
      store: Store,
      searchInput: '',
      loading: false,

      modalOpen: false,
      mode: 'create',
      editingBarcode: null,
      formBarcode: '',
      formNama: '',
      formKode: '',
      formKategori: '',
      formSubKategori: '',
      formSatuan: '',
      saving: false,
    };
  },
  watch: {
    modalOpen(v) { v ? lockScroll() : unlockScroll(); },
  },
  async mounted() {
    Store.produkMasterSearchQuery = '';
    Store.produkMasterPage = 1;
    this.searchInput = '';
    this.loading = true;
    await loadAndSetAllMasterProduk();
    this.loading = false;
  },
  computed: {
    filtered() {
      const q = Store.produkMasterSearchQuery;
      return this.store.allMasterProduk.filter(p =>
        !q ||
        p.nama?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.kode_produk?.toLowerCase().includes(q)
      );
    },
    totalPages() { return Math.max(1, Math.ceil(this.filtered.length / 10)); },
    pageItems() {
      let page = Store.produkMasterPage;
      if (page > this.totalPages) page = this.totalPages;
      if (page < 1) page = 1;
      return this.filtered.slice((page - 1) * 10, page * 10);
    },
  },
  methods: {
    onSearchInput() {
      Store.produkMasterSearchQuery = this.searchInput.trim().toLowerCase();
      Store.produkMasterPage = 1;
    },
    goToPage(n) { Store.produkMasterPage = n; },

    openCreate() {
      this.mode = 'create'; this.editingBarcode = null;
      this.formBarcode = ''; this.formNama = ''; this.formKode = '';
      this.formKategori = ''; this.formSubKategori = ''; this.formSatuan = '';
      this.modalOpen = true;
    },
    openEdit(p) {
      this.mode = 'edit'; this.editingBarcode = p.barcode;
      this.formBarcode = p.barcode; this.formNama = p.nama; this.formKode = p.kode_produk || '';
      this.formKategori = p.kategori || ''; this.formSubKategori = p.sub_kategori || ''; this.formSatuan = p.satuan || '';
      this.modalOpen = true;
    },
    closeModal() { this.modalOpen = false; },
    async save() {
      const barcode = this.formBarcode.trim();
      const nama = this.formNama.trim();
      if (!barcode) { toast('Barcode wajib diisi.', 'warn'); return; }
      if (!nama) { toast('Nama produk wajib diisi.', 'warn'); return; }

      this.saving = true;
      const isEdit = this.mode === 'edit';
      const { error } = await saveMasterProduk({
        isEdit, barcode, editingBarcode: this.editingBarcode, nama,
        kode_produk: this.formKode.trim(), kategori: this.formKategori.trim(),
        sub_kategori: this.formSubKategori.trim(), satuan: this.formSatuan.trim(),
      });
      this.saving = false;
      if (error) { toast(error); return; }
      this.closeModal();
    },
    async remove(p) {
      const confirmed = await confirmDialog({
        title: 'Hapus Produk?',
        message: `Hapus produk "${p.nama}" dari Master Produk? Semua assignment-nya ke sector mana pun bakal ikut kehapus.\n\nKalau produk ini udah pernah dipake buat scan, penghapusan bakal ditolak otomatis biar data histori gak ilang.`,
        confirmText: 'Hapus', danger: true,
      });
      if (!confirmed) return;
      const { error } = await deleteProdukMaster(p.barcode);
      if (error) toast(error);
    },
  },
  template: `
    <div class="main-content">
      <div class="dash-content">
        <div class="produk-toolbar">
          <div class="produk-toolbar-heading">
            <h1 style="font-size:19px;font-weight:600;margin:0 0 4px;">Master Produk</h1>
            <p class="hint" style="margin:0;">Semua produk yang terdaftar, lepas dari DC/Zona/Sector manapun.</p>
          </div>
          <div class="produk-toolbar-search">
            <div class="search-box">
              <i class="ti ti-search"></i>
              <input type="text" v-model="searchInput" placeholder="Cari produk..." @input="onSearchInput">
            </div>
          </div>
        </div>
        <div class="admin-actions">
          <button class="btn-ghost" @click="openCreate"><i class="ti ti-plus"></i> Produk Baru</button>
        </div>

        <div v-if="!loading && store.allMasterProduk.length" class="produk-table-wrap">
          <div class="table-scroll">
          <table class="produk-table">
            <colgroup>
              <col style="width:14%"><col style="width:28%"><col style="width:18%">
              <col style="width:17%"><col style="width:12%"><col style="width:11%">
            </colgroup>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Produk</th>
                <th>Barcode</th>
                <th>Kode Produk</th>
                <th>Satuan</th>
                <th class="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtered.length"><td colspan="6" class="empty-state">Gak ada produk yang cocok.</td></tr>
              <tr v-for="p in pageItems" :key="p.barcode">
                <td><span class="kategori-tag">{{ p.kategori || '-' }}</span></td>
                <td class="produk-nama">{{ p.nama }}</td>
                <td>{{ p.barcode }}</td>
                <td>{{ p.kode_produk || '-' }}</td>
                <td>{{ p.satuan || '-' }}</td>
                <td class="num">
                  <button class="btn-icon" title="Edit" @click="openEdit(p)"><i class="ti ti-edit"></i></button>
                  <button class="btn-icon danger" title="Hapus produk" @click="remove(p)"><i class="ti ti-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <PaginationBar :page="store.produkMasterPage" :total-pages="totalPages" @goto="goToPage" />
        </div>
        <div v-else-if="loading" class="produk-table-wrap">
          <div class="table-scroll">
          <table class="produk-table">
            <tbody>
              <tr v-for="n in 6" :key="n" class="skeleton-row">
                <td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
                <td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
        <div v-else class="empty-state"><p>Belum ada produk yang terdaftar.</p></div>
      </div>

    <Transition name="modal-pop">
      <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <h2>{{ mode === 'create' ? 'Produk Baru' : 'Edit Produk' }}</h2>
          <div class="field">
            <label>Barcode</label>
            <input type="text" v-model="formBarcode" :disabled="mode === 'edit'" placeholder="cth: B290720260099">
          </div>
          <div class="field">
            <label>Nama Produk</label>
            <input type="text" v-model="formNama" placeholder="cth: Sambal Bawang Sachet">
          </div>
          <div class="field">
            <label>Kode Produk (opsional)</label>
            <input type="text" v-model="formKode" placeholder="cth: A011099">
          </div>
          <div class="field">
            <label>Kategori (opsional)</label>
            <input type="text" v-model="formKategori" placeholder="cth: FOOD">
          </div>
          <div class="field">
            <label>Sub Kategori (opsional)</label>
            <input type="text" v-model="formSubKategori" placeholder="cth: Bumbu">
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Satuan (opsional)</label>
            <input type="text" v-model="formSatuan" placeholder="cth: pack">
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