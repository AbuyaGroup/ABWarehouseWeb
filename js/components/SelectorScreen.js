const SelectorScreen = {
  data() {
    return { store: Store };
  },
  computed: {
    isAdmin() { return this.store.profile?.role === 'admin'; },
    dcsToShow() {
      if (this.isAdmin) return this.store.dcs;
      return this.store.dcs.filter(d => d.id === this.store.profile?.dc_id);
    },
    hintText() { return this.isAdmin ? 'Pilih DC untuk melihat Zona' : 'DC antum :'; },
  },
  methods: {
    openDc(dc) { openDcSessions(dc); },
  },
  template: `
    <div class="main-content">
      <div class="wrap">
        <h1>Pilih Distribution Center</h1>
        <p class="hint">{{ hintText }}</p>
        <div class="dc-grid">
          <button v-for="dc in dcsToShow" :key="dc.id" class="dc-card" @click="openDc(dc)">
            <div class="dc-icon"><i class="ti" :class="dc.icon || 'ti-building-warehouse'"></i></div>
            <div>
              <p class="name">{{ dc.nama }}</p>
              <p class="sub">{{ dc.sub || '' }}</p>
            </div>
            <div class="footer"><span>Stock opname</span><i class="ti ti-arrow-right"></i></div>
          </button>
        </div>
      </div>
    </div>
  `,
};
