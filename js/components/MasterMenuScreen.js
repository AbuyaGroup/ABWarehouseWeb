const MasterMenuScreen = {
  methods: {
    goBack() { goToMainMenu(); },
    openProduk() { Store.currentScreen = 'produkMaster'; },
    openDc() { Store.currentScreen = 'manageDc'; },
  },
  template: `
    <div class="main-content">
      <div class="topbar">
        <button class="back-btn" @click="goBack"><i class="ti ti-arrow-left"></i> Menu lain</button>
        <div class="brand"><div class="mark"><i class="ti ti-database-cog"></i></div>Master Data</div>
      </div>
      <div class="wrap">
        <h1>Mau ngapain nich?</h1>
        <p class="hint">Tempat kelola data produk dan distribution center</p>
        <div class="dc-grid">
          <button class="dc-card" @click="openProduk">
            <div class="dc-icon"><i class="ti ti-package"></i></div>
            <div>
              <p class="name">Produk</p>
              <p class="sub">Tambah/Edit/Hapus <em>item</em> baru</p>
            </div>
            <div class="footer"><span>Klik aje udeh</span><i class="ti ti-arrow-right"></i></div>
          </button>
          <button class="dc-card" @click="openDc">
            <div class="dc-icon"><i class="ti ti-building-warehouse"></i></div>
            <div>
              <p class="name">DC</p>
              <p class="sub">kelola DC, Zona, Sector, dan assign existing item ke sector</p>
            </div>
            <div class="footer"><span>Klik aje udeh</span><i class="ti ti-arrow-right"></i></div>
          </button>
        </div>
      </div>
    </div>
  `,
};
