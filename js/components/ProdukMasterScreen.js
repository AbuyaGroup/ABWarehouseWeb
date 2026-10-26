const ProdukMasterScreen = {
  components: { PaginationBar, BulkActionBar },
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
      selected: new Set(),
      bulkBusy: false,
      bulkBusyText: 'Mengecek...',
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
    pageAllSelected() { return this.pageItems.length > 0 && this.pageItems.every(p => this.selected.has(p.barcode)); },
    pageSomeSelected() { return !this.pageAllSelected && this.pageItems.some(p => this.selected.has(p.barcode)); },
    allFilteredSelected() { return this.filtered.length > 0 && this.filtered.every(p => this.selected.has(p.barcode)); },
    showSelectAllHint() { return this.pageAllSelected && this.filtered.length > this.pageItems.length; },
  },
  methods: {
    onSearchInput() {
      Store.produkMasterSearchQuery = this.searchInput.trim().toLowerCase();
      Store.produkMasterPage = 1;
      this.clearSelection();
    },
    isSelected(p) { return this.selected.has(p.barcode); },
    toggleOne(p) { this.selected.has(p.barcode) ? this.selected.delete(p.barcode) : this.selected.add(p.barcode); },
    togglePage() {
      if (this.pageAllSelected) this.pageItems.forEach(p => this.selected.delete(p.barcode));
      else this.pageItems.forEach(p => this.selected.add(p.barcode));
    },
    selectAllFiltered() { this.filtered.forEach(p => this.selected.add(p.barcode)); },
    clearSelection() { this.selected.clear(); },
    async bulkDelete() {
      const barcodes = [...this.selected];
      if (!barcodes.length || this.bulkBusy) return;
      this.bulkBusy = true;
      this.bulkBusyText = 'Mengecek...';
      const check = await prepareBulkDeleteProduk(barcodes);
      if (check.error) { this.bulkBusy = false; toast(check.error); return; }
      const { deletable, skipped } = check;
      if (!deletable.length) {
        this.bulkBusy = false;
        toast(`Semua ${skipped.length} produk yang dipilih sudah pernah dipakai di sesi opname, jadi nggak bisa dihapus.`, 'warn', 6000);
        return;
      }
      const skipNote = skipped.length ? `\n\n${skipped.length} produk dilewati karena sudah pernah dipakai di sesi opname.` : '';
      const ok = await confirmDialog({
        title: `Hapus ${deletable.length} produk?`,
        message: `${deletable.length} produk bakal dihapus dari Master Produk, termasuk penempatannya di semua sector.${skipNote}\n\nTindakan ini nggak bisa dibatalkan.`,
        confirmText: `Hapus ${deletable.length}`, danger: true,
      });
      if (!ok) { this.bulkBusy = false; return; }
      this.bulkBusyText = 'Menghapus...';
      const { deleted, error } = await bulkDeleteMasterProduk(deletable);
      this.bulkBusy = false;
      this.clearSelection();
      if (error) { toast(`Berhenti setelah ${deleted} produk terhapus. ${error}`, 'error', 7000); return; }
      if (deleted < deletable.length) { toast(`Cuma ${deleted} dari ${deletable.length} produk yang terhapus. Cek izin hapus (RLS) di tabel master_produk.`, 'warn', 7000); return; }
      toast(`${deleted} produk dihapus${skipped.length ? `, ${skipped.length} dilewati` : ''}.`, 'success');
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
              <col style="width:48px"><col style="width:13%"><col style="width:27%"><col style="width:18%">
              <col style="width:16%"><col style="width:11%"><col style="width:11%">
            </colgroup>
            <thead>
              <tr>
                <th class="check-col">
                  <label class="data-check data-check-plain" title="Pilih semua di halaman ini">
                    <input type="checkbox" :checked="pageAllSelected" :indeterminate.prop="pageSomeSelected" :disabled="!pageItems.length" @change="togglePage">
                    <span class="data-check-box"><i class="ti ti-check"></i></span>
                  </label>
                </th>
                <th>Kategori</th>
                <th>Produk</th>
                <th>Barcode</th>
                <th>Kode Produk</th>
                <th>Satuan</th>
                <th class="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="showSelectAllHint" class="select-all-row">
                <td colspan="7">
                  <template v-if="!allFilteredSelected">Semua {{ pageItems.length }} produk di halaman ini dipilih. <button type="button" class="data-link" @click="selectAllFiltered">Pilih semua {{ filtered.length }} produk</button></template>
                  <template v-else>Semua {{ filtered.length }} produk dipilih. <button type="button" class="data-link" @click="clearSelection">Batal pilih</button></template>
                </td>
              </tr>
              <tr v-if="!filtered.length"><td colspan="7" class="empty-state">Gak ada produk yang cocok.</td></tr>
              <tr v-for="p in pageItems" :key="p.barcode" :class="{ 'row-selected': isSelected(p) }">
                <td class="check-col">
                  <label class="data-check data-check-plain">
                    <input type="checkbox" :checked="isSelected(p)" @change="toggleOne(p)">
                    <span class="data-check-box"><i class="ti ti-check"></i></span>
                  </label>
                </td>
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
                <td class="check-col"></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
                <td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
        <div v-else class="empty-state"><p>Belum ada produk yang terdaftar.</p></div>
      </div>

      <BulkActionBar :count="selected.size" noun="produk" :action-text="'Hapus ' + selected.size" :busy="bulkBusy" :busy-text="bulkBusyText" @clear="clearSelection" @action="bulkDelete" />

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