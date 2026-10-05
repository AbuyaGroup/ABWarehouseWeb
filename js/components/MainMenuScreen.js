const MainMenuScreen = {
  data() {
    return { store: Store };
  },
  computed: {
    isAdmin() { return this.store.profile?.role === 'admin'; },
  },
  methods: {
    openStockOpname() { goToStockOpname(); },
    openMaster() { goToMaster(); },
  },
  template: `
    <div class="main-content">
      <div class="topbar">
        <div class="brand"><div class="mark"><i class="ti ti-building-warehouse"></i></div>Abuya Inventory</div>
      </div>
      <div class="wrap">
        <h1>Mau ngapain hari ini?</h1>
        <p class="hint">Pilih menu buat lanjut</p>
        <div class="dc-grid">
          <button class="dc-card" @click="openStockOpname">
            <div class="dc-icon"><i class="ti ti-clipboard-list"></i></div>
            <div>
              <p class="name">Stock Opname</p>
              <p class="sub">Proses counting & sesi stock opname</p>
            </div>
            <div class="footer"><span>Mulai</span><i class="ti ti-arrow-right"></i></div>
          </button>
          <button v-if="isAdmin" class="dc-card" @click="openMaster">
            <div class="dc-icon"><i class="ti ti-database-cog"></i></div>
            <div>
              <p class="name">Master</p>
              <p class="sub">Kelola DC, Zona, Sector, dan Produk</p>
            </div>
            <div class="footer"><span>Buka</span><i class="ti ti-arrow-right"></i></div>
          </button>
        </div>
      </div>
    </div>
  `,
};
