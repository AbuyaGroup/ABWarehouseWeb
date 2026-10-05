const DashboardScreen = {
  components: { SearchableSelect, PaginationBar },
  data() {
    return { store: Store, searchInput: '' };
  },
  watch: {
    'store.sectorFilter'() { Store.dashboardPage = 1; },
  },
  computed: {
    sessionNama() {
      const s = this.store.sessions.find(x => x.id === this.store.activeSessionId);
      return s ? s.nama : '';
    },
    sectorOptions() {
      return [{ value: '', label: 'Semua Sector' }, ...this.store.sectorsList.map(s => ({ value: s.id, label: s.nama }))];
    },
    produkZonaIni() {
      return this.store.sectorFilter ? this.store.produkList.filter(p => p.sector_id === this.store.sectorFilter) : this.store.produkList;
    },
    filtered() {
      return this.produkZonaIni.filter(p => !this.store.searchQuery || p.nama.toLowerCase().includes(this.store.searchQuery));
    },
    totalPages() { return Math.max(1, Math.ceil(this.filtered.length / 10)); },
    pageItems() {
      let page = this.store.dashboardPage;
      if (page > this.totalPages) page = this.totalPages;
      if (page < 1) page = 1;
      return this.filtered.slice((page - 1) * 10, page * 10);
    },
    checkedCount() {
      return this.produkZonaIni.filter(p => {
        const e = this.store.entries[`${p.barcode}|${p.sector_id}`];
        return e && e.qty_fisik !== null && e.qty_fisik !== undefined;
      }).length;
    },
  },
  methods: {
    toggleView() { this.store.viewAllDc ? exitAllDcView() : switchToAllDcView(); },
    onSearchInput() {
      Store.searchQuery = this.searchInput.toLowerCase();
      Store.dashboardPage = 1;
    },
    entryFor(p) { return this.store.entries[`${p.barcode}|${p.sector_id}`]; },
    qtyOf(p) {
      const e = this.entryFor(p);
      return (e && e.qty_fisik !== null && e.qty_fisik !== undefined) ? e.qty_fisik : null;
    },
    scannerNama(p) { return getUpdatedByNama(this.entryFor(p)); },
    goToPage(n) { Store.dashboardPage = n; },
  },
  template: `
    <div class="main-content">
      <div class="dash-content">
        <div class="produk-toolbar">
          <div class="produk-toolbar-heading">
            <div v-if="store.viewAllDc" class="all-dc-header">
              <h1>Semua Produk</h1>
              <p class="hint">{{ store.currentDc?.nama }} · Sesi: <b>{{ sessionNama }}</b></p>
            </div>
            <div v-else class="session-bar">
              <span class="session-name-label">{{ store.currentDc?.nama }} · Zona {{ store.currentZona }} · Sesi: <b>{{ sessionNama }}</b></span>
            </div>
          </div>
          <div class="view-toggle-wrap">
            <button type="button" :class="['view-toggle', { 'is-all': store.viewAllDc }]" @click="toggleView">
              <span class="view-toggle-thumb"></span>
            </button>
            <span class="view-toggle-caption">Semua Zona / Semua Produk</span>
          </div>
          <div class="produk-toolbar-search">
            <div class="search-box">
              <i class="ti ti-search"></i>
              <input type="text" v-model="searchInput" placeholder="Cari produk..." @input="onSearchInput">
            </div>
            <SearchableSelect v-model="store.sectorFilter" :options="sectorOptions" placeholder="Semua Sector" />
          </div>
        </div>

        <div v-if="!store.dashLoading">
          <div v-if="!store.activeSessionId" class="empty-state"><p>Memuat sesi opname...</p></div>
          <div v-else-if="!produkZonaIni.length" class="empty-state"><p>Belum ada produk yang ke-assign ke sector di zona ini.<br>Hubungi admin buat nambahin produk ke sector lewat Supabase (tabel produk_sectors).</p></div>
          <div v-else class="produk-table-wrap">
            <div class="table-scroll">
            <table class="produk-table">
              <colgroup>
                <col style="width:15%"><col style="width:35%"><col style="width:16%">
                <col style="width:17%"><col style="width:17%">
              </colgroup>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Produk</th>
                  <th class="num">Jumlah</th>
                  <th>Scanner</th>
                  <th>Sector</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filtered.length"><td colspan="5" class="empty-state">Gak ada produk yang cocok.</td></tr>
                <tr v-for="p in pageItems" :key="p.id">
                  <td><span class="kategori-tag">{{ p.kategori || '-' }}</span></td>
                  <td class="produk-nama">{{ p.nama }}</td>
                  <td class="num">
                    <span :class="['qty', { kosong: qtyOf(p) === null }]">{{ qtyOf(p) === null ? 'Belum dihitung' : qtyOf(p) }}</span>
                    <span v-if="qtyOf(p) !== null" class="uom">{{ p.satuan || '' }}</span>
                  </td>
                  <td><span v-if="scannerNama(p)" class="scanned-by">✓ {{ scannerNama(p) }}</span><span v-else>-</span></td>
                  <td><span class="sector-tag">{{ p.sector_nama }}</span></td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
          <PaginationBar v-if="produkZonaIni.length" :page="store.dashboardPage" :total-pages="totalPages" @goto="goToPage" />
        </div>
        <div v-else class="produk-table-wrap">
          <div class="table-scroll">
          <table class="produk-table">
            <tbody>
              <tr v-for="n in 5" :key="n" class="skeleton-row">
                <td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
                <td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td><td><div class="skel-bar"></div></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
      <div class="footer-bar">
        <div class="footer-stat">Produk dicek<b>{{ checkedCount }}/{{ produkZonaIni.length }}</b></div>
      </div>
    </div>
  `,
};