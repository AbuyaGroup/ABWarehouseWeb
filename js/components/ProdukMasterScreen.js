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
      activeTab: '',
      statusFilter: 'active',
    };
  },
  watch: {
    modalOpen(v) { v ? lockScroll() : unlockScroll(); },
    activeTab() {
      Store.produkMasterPage = 1;
      this.clearSelection();
    },
    statusFilter() {
      Store.produkMasterPage = 1;
      this.clearSelection();
    },
    noneCount(n) {
      if (!n && this.activeTab === '__none') this.activeTab = this.dcTabs[0]?.id || '';
    },
  },
  async mounted() {
    Store.produkMasterSearchQuery = '';
    Store.produkMasterPage = 1;
    this.searchInput = '';
    this.loading = true;
    if (!Store.dcs.length) await loadDcs();
    await loadAndSetAllMasterProduk();
    const preferred = this.dcTabs.find(t => t.id === Store.currentDc?.id) || this.dcTabs[0];
    this.activeTab = preferred ? preferred.id : (this.noneCount ? '__none' : '');
    this.loading = false;
  },
  computed: {
    dcTabs() {
      return this.store.dcs.map(d => ({ id: d.id, nama: d.nama, code: dcCodeOf(d) })).filter(t => t.code)
        .map(t => ({ ...t, count: this.store.allMasterProduk.filter(p => barcodeDcCode(p.barcode) === t.code).length }));
    },
    validCodes() { return this.dcTabs.map(t => t.code); },
    noneCount() { return this.store.allMasterProduk.filter(p => !this.validCodes.includes(barcodeDcCode(p.barcode))).length; },
    activeDcTab() { return this.dcTabs.find(t => t.id === this.activeTab) || null; },
    dcItems() {
      if (this.activeTab === '__none') return this.store.allMasterProduk.filter(p => !this.validCodes.includes(barcodeDcCode(p.barcode)));
      const tab = this.activeDcTab;
      if (!tab) return this.store.allMasterProduk;
      return this.store.allMasterProduk.filter(p => barcodeDcCode(p.barcode) === tab.code);
    },
    activeCount() { return this.dcItems.filter(p => isProdukActive(p)).length; },
    inactiveCount() { return this.dcItems.length - this.activeCount; },
    tabItems() {
      if (this.statusFilter === 'active') return this.dcItems.filter(p => isProdukActive(p));
      if (this.statusFilter === 'inactive') return this.dcItems.filter(p => !isProdukActive(p));
      return this.dcItems;
    },
    selectedProduk() { return this.store.allMasterProduk.filter(p => this.selected.has(p.barcode)); },
    bulkActivate() { return this.selectedProduk.length > 0 && this.selectedProduk.every(p => !isProdukActive(p)); },
    bulkTargets() { return this.selectedProduk.filter(p => isProdukActive(p) !== this.bulkActivate); },
    formDc() { return dcForBarcode(this.formBarcode); },
    barcodeRule() { return barcodeRuleText(); },
    filtered() {
      const q = Store.produkMasterSearchQuery;
      return this.tabItems.filter(p =>
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
    isActive(p) { return isProdukActive(p); },
    async bulkToggle() {
      if (!this.selected.size || this.bulkBusy) return;
      const activate = this.bulkActivate;
      const targets = this.bulkTargets.map(p => p.barcode);
      const skipped = this.selected.size - targets.length;
      if (!targets.length) { this.clearSelection(); return; }
      const skipNote = skipped ? `\n\n${skipped} produk lain sudah Not Active, jadi dilewati.` : '';
      const ok = await confirmDialog(activate ? {
        title: `Aktifkan ${targets.length} produk?`,
        message: `${targets.length} produk bakal kembali Active dan muncul lagi di daftar hitung sesi opname berikutnya.`,
        confirmText: `Aktifkan ${targets.length}`,
      } : {
        title: `Nonaktifkan ${targets.length} produk?`,
        message: `${targets.length} produk bakal jadi Not Active: nggak muncul lagi di daftar hitung sesi opname baru dan nggak bisa di-assign ke sector.\n\nData produk, penempatan di sector, dan hasil opname yang sudah ada tetap tersimpan. Bisa diaktifkan lagi kapan saja.${skipNote}`,
        confirmText: `Nonaktifkan ${targets.length}`, danger: true,
      });
      if (!ok) return;
      this.bulkBusy = true;
      this.bulkBusyText = 'Menyimpan...';
      const { updated, error } = await setProdukActive(targets, activate);
      this.bulkBusy = false;
      this.clearSelection();
      if (error) { toast(error, 'error', 8000); return; }
      if (updated < targets.length) { toast(`Cuma ${updated} dari ${targets.length} produk yang berubah. Cek izin update (RLS) di tabel master_produk.`, 'warn', 7000); return; }
      toast(`${updated} produk ${activate ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
    },
    goToPage(n) { Store.produkMasterPage = n; },

    setTab(id) { this.activeTab = id; },
    openCreate() {
      this.mode = 'create'; this.editingBarcode = null;
      this.formBarcode = this.activeDcTab ? this.activeDcTab.code : ''; this.formNama = ''; this.formKode = '';
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
      if (this.mode === 'create' && !dcForBarcode(barcode)) { toast(`Barcode harus diawali huruf DC (${this.barcodeRule}).`, 'warn', 5000); return; }
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
    async toggleStatus(p) {
      const activate = !isProdukActive(p);
      if (!activate) {
        const ok = await confirmDialog({
          title: 'Nonaktifkan produk?',
          message: `"${p.nama}" bakal jadi Not Active: nggak muncul lagi di daftar hitung sesi opname baru dan nggak bisa di-assign ke sector.\n\nData produk, penempatan di sector, dan hasil opname yang sudah ada tetap tersimpan.`,
          confirmText: 'Nonaktifkan', danger: true,
        });
        if (!ok) return;
      }
      const { error } = await setProdukActive([p.barcode], activate);
      if (error) { toast(error, 'error', 8000); return; }
      toast(`${p.nama} ${activate ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
    },
  },
  template: `
    <div class="main-content">
      <div class="dash-content">
        <div class="produk-toolbar">
          <div class="produk-toolbar-heading">
            <h1 style="font-size:19px;font-weight:600;margin:0 0 4px;">Master Produk</h1>
            <p class="hint" style="margin:0;">Produk dipisah per DC. Huruf depan barcode menentukan DC-nya.</p>
          </div>
          <div class="produk-toolbar-search">
            <div class="search-box">
              <i class="ti ti-search"></i>
              <input type="text" v-model="searchInput" placeholder="Cari produk..." @input="onSearchInput">
            </div>
          </div>
        </div>
        <div class="admin-actions produk-dc-bar">
          <div v-if="dcTabs.length || noneCount" class="dc-tabs" role="tablist">
            <button v-for="t in dcTabs" :key="t.id" type="button" role="tab" :aria-selected="activeTab === t.id" :class="['dc-tab', { active: activeTab === t.id }]" @click="setTab(t.id)">
              <span class="dc-tab-code">{{ t.code }}</span>{{ t.nama }}<span class="dc-tab-count">{{ t.count }}</span>
            </button>
            <button v-if="noneCount" type="button" role="tab" :aria-selected="activeTab === '__none'" :class="['dc-tab', 'warn', { active: activeTab === '__none' }]" @click="setTab('__none')">
              <i class="ti ti-alert-triangle"></i>Tanpa DC<span class="dc-tab-count">{{ noneCount }}</span>
            </button>
          </div>
          <div class="produk-dc-bar-right">
            <div class="status-filter" role="group" aria-label="Filter status">
              <button type="button" :class="{ active: statusFilter === 'active' }" @click="statusFilter = 'active'">Active <span>{{ activeCount }}</span></button>
              <button type="button" :class="{ active: statusFilter === 'inactive' }" @click="statusFilter = 'inactive'">Not Active <span>{{ inactiveCount }}</span></button>
              <button type="button" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">Semua</button>
            </div>
            <button class="btn-ghost" @click="openCreate"><i class="ti ti-plus"></i> Produk Baru</button>
          </div>
        </div>
        <div v-if="activeTab === '__none' && !loading" class="data-alert danger produk-none-note">
          <i class="ti ti-alert-triangle"></i>
          <span>Barcode produk di sini nggak diawali huruf DC ({{ barcodeRule }}), jadi nggak bisa di-assign ke DC mana pun. Hapus, atau bikin ulang dengan barcode yang benar.</span>
        </div>

        <div v-if="!loading && tabItems.length" class="produk-table-wrap">
          <div class="table-scroll">
          <table class="produk-table">
            <colgroup>
              <col style="width:48px"><col style="width:12%"><col style="width:25%"><col style="width:16%">
              <col style="width:13%"><col style="width:9%"><col style="width:12%"><col style="width:11%">
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
                <th>Status</th>
                <th class="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="showSelectAllHint" class="select-all-row">
                <td colspan="8">
                  <template v-if="!allFilteredSelected">Semua {{ pageItems.length }} produk di halaman ini dipilih. <button type="button" class="data-link" @click="selectAllFiltered">Pilih semua {{ filtered.length }} produk</button></template>
                  <template v-else>Semua {{ filtered.length }} produk dipilih. <button type="button" class="data-link" @click="clearSelection">Batal pilih</button></template>
                </td>
              </tr>
              <tr v-if="!filtered.length"><td colspan="8" class="empty-state">{{ statusFilter === 'inactive' ? 'Nggak ada produk Not Active.' : 'Gak ada produk yang cocok.' }}</td></tr>
              <tr v-for="p in pageItems" :key="p.barcode" :class="{ 'row-selected': isSelected(p), 'row-inactive': !isActive(p) }">
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
                <td><span :class="['status-pill', isActive(p) ? 'on' : 'off']">{{ isActive(p) ? 'Active' : 'Not Active' }}</span></td>
                <td class="num">
                  <button class="btn-icon" title="Edit" @click="openEdit(p)"><i class="ti ti-edit"></i></button>
                  <button v-if="isActive(p)" class="btn-icon danger" title="Nonaktifkan" @click="toggleStatus(p)"><i class="ti ti-archive"></i></button>
                  <button v-else class="btn-icon" title="Aktifkan lagi" @click="toggleStatus(p)"><i class="ti ti-refresh"></i></button>
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
                <td class="check-col"></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
                <td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
        <div v-else class="empty-state"><p>{{ activeDcTab ? 'Belum ada produk ' + activeDcTab.nama + '.' : 'Belum ada produk yang terdaftar.' }}</p></div>
      </div>

      <BulkActionBar :count="selected.size" noun="produk" :action-text="(bulkActivate ? 'Aktifkan ' : 'Nonaktifkan ') + bulkTargets.length" :icon="bulkActivate ? 'ti-refresh' : 'ti-archive'" :tone="bulkActivate ? 'primary' : 'danger'" :busy="bulkBusy" :busy-text="bulkBusyText" @clear="clearSelection" @action="bulkToggle" />

    <Transition name="modal-pop">
      <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <h2>{{ mode === 'create' ? 'Produk Baru' : 'Edit Produk' }}</h2>
          <div class="field">
            <label>Barcode</label>
            <input type="text" v-model="formBarcode" :disabled="mode === 'edit'" placeholder="cth: B290720260099">
            <p v-if="mode === 'create'" :class="['barcode-dc-hint', { ok: formDc, bad: formBarcode.trim() && !formDc }]">
              <template v-if="formDc"><i class="ti ti-circle-check"></i> Masuk ke {{ formDc.nama }}</template>
              <template v-else-if="formBarcode.trim()"><i class="ti ti-alert-circle"></i> Huruf depan nggak cocok dengan DC mana pun ({{ barcodeRule }})</template>
              <template v-else>Huruf depan menentukan DC: {{ barcodeRule }}</template>
            </p>
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