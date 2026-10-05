const AppSidebar = {
  data() {
    return { store: Store, masterMenuOpen: false, opnameMenuOpen: false };
  },
  computed: {
    isAdmin() { return this.store.profile?.role === 'admin'; },
    userName() { return this.store.profile?.nama || this.store.session?.user?.email || 'User'; },
    dcsToShow() {
      if (this.isAdmin) return this.store.dcs;
      return this.store.dcs.filter(d => d.id === this.store.profile?.dc_id);
    },
    activeGroup() {
      const s = this.store.currentScreen;
      if (['selector', 'sessionList', 'sessionReview', 'zona', 'dashboard'].includes(s)) return 'opname';
      if (['manageDc', 'manageZona', 'manageProduk', 'produkMaster'].includes(s)) return 'master';
      return null;
    },
  },
  watch: {
    activeGroup(val) {
      if (val === 'master') this.masterMenuOpen = true;
      if (val === 'opname') this.opnameMenuOpen = true;
    },
    'store.sidebarCollapsed'(val) {
      document.body.classList.toggle('sidebar-collapsed', val);
    },
  },
  mounted() {
    document.body.classList.toggle('sidebar-collapsed', this.store.sidebarCollapsed);
  },
  methods: {
    toggleMobile() { this.store.sidebarOpen = !this.store.sidebarOpen; },
    closeMobile() { this.store.sidebarOpen = false; },
    toggleDesktopCollapse() { toggleSidebarCollapse(); },
    toggleOpnameMenu() {
      if (this.store.sidebarCollapsed) { toggleSidebarCollapse(); this.opnameMenuOpen = true; return; }
      this.opnameMenuOpen = !this.opnameMenuOpen;
    },
    openDcFromSidebar(dc) { openDcSessions(dc); },
    toggleMasterMenu() {
      if (this.store.sidebarCollapsed) { toggleSidebarCollapse(); this.masterMenuOpen = true; return; }
      this.masterMenuOpen = !this.masterMenuOpen;
    },
    openProdukMaster() { goToScreen('produkMaster'); },
    openManageDc() { goToScreen('manageDc'); },
    logout() { forceLogout(); },
  },
  template: `
    <button v-if="store.currentScreen !== 'login'" type="button" class="sidebar-toggle" @click="toggleMobile"><i class="ti ti-menu-2"></i></button>
    <div v-if="store.currentScreen !== 'login'" :class="['sidebar-backdrop', { hidden: !store.sidebarOpen }]" @click="closeMobile"></div>
    <div v-if="store.currentScreen !== 'login'" :class="['sidebar', { 'sidebar-open': store.sidebarOpen, 'sidebar-collapsed': store.sidebarCollapsed }]">
      <div class="sidebar-brand">
        <button type="button" class="mark" @click="toggleDesktopCollapse" title="Buka/tutup sidebar"><i class="ti ti-building-warehouse"></i></button>
        <span class="sidebar-label">ABWarehouse</span>
        <button type="button" class="sidebar-close" @click="closeMobile"><i class="ti ti-x"></i></button>
      </div>
      <ul class="sidebar-menu">
        <li class="sidebar-group" :class="{ open: opnameMenuOpen }">
          <a class="sidebar-group-toggle" :class="{ active: activeGroup === 'opname' }" @click="toggleOpnameMenu">
            <i class="ti ti-clipboard-list"></i> <span class="sidebar-label">Stock Opname</span>
            <i class="ti ti-chevron-down sidebar-group-caret"></i>
          </a>
          <Transition name="sidebar-collapse">
            <ul v-if="opnameMenuOpen" class="sidebar-submenu">
              <li v-for="dc in dcsToShow" :key="dc.id">
                <a :class="{ active: activeGroup === 'opname' && store.currentDc?.id === dc.id }" @click="openDcFromSidebar(dc)">
                  <i class="ti" :class="dc.icon || 'ti-building-warehouse'"></i> {{ dc.nama }}
                </a>
              </li>
            </ul>
          </Transition>
        </li>
        <li v-if="isAdmin" class="sidebar-group" :class="{ open: masterMenuOpen }">
          <a class="sidebar-group-toggle" :class="{ active: activeGroup === 'master' }" @click="toggleMasterMenu">
            <i class="ti ti-database-cog"></i> <span class="sidebar-label">Master</span>
            <i class="ti ti-chevron-down sidebar-group-caret"></i>
          </a>
          <Transition name="sidebar-collapse">
            <ul v-if="masterMenuOpen" class="sidebar-submenu">
              <li><a :class="{ active: store.currentScreen === 'produkMaster' }" @click="openProdukMaster"><i class="ti ti-package"></i> Produk</a></li>
              <li><a :class="{ active: ['manageDc', 'manageZona', 'manageProduk'].includes(store.currentScreen) }" @click="openManageDc"><i class="ti ti-building-warehouse"></i> DC</a></li>
            </ul>
          </Transition>
        </li>
      </ul>
      <div class="sidebar-user">
        <div class="sidebar-user-icon"><i class="ti ti-user-circle"></i></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">{{ userName }}</div>
          <div class="sidebar-user-role">{{ isAdmin ? 'Admin' : 'User' }}</div>
        </div>
        <button type="button" class="sidebar-logout-btn" title="Logout" @click="logout"><i class="ti ti-logout"></i></button>
      </div>
    </div>
  `,
};