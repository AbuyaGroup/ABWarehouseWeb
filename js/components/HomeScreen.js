const HomeScreen = {
  data() {
    return {
      store: Store,
      loading: true,
      errorText: '',
      home: null,
      channel: null,
      reloadTimer: null,
      now: Date.now(),
      clockTimer: null,
      opening: false,
    };
  },
  computed: {
    dc() { return this.store.dcs.find(d => d.id === this.store.profile?.dc_id) || null; },
    firstName() {
      const nama = this.store.profile?.nama || this.store.session?.user?.email?.split('@')[0] || 'User';
      return nama.split(' ')[0];
    },
    todayLabel() {
      return new Date(this.now).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
    active() { return this.home?.active || null; },
    total() { return this.home?.total || 0; },
    checked() { return this.home?.checked || 0; },
    remaining() { return Math.max(0, this.total - this.checked); },
    pct() { return this.total ? Math.round((this.checked / this.total) * 100) : 0; },
    zones() { return this.home?.zones || []; },
    activity() { return this.home?.activity || []; },
    untouchedCount() { return this.zones.filter(z => z.total > 0 && z.checked === 0).length; },
  },
  async mounted() {
    this.clockTimer = setInterval(() => { this.now = Date.now(); }, 60000);
    await this.load();
  },
  beforeUnmount() {
    clearInterval(this.clockTimer);
    clearTimeout(this.reloadTimer);
    this.unsubscribe();
  },
  methods: {
    formatTanggal,
    async load(silent = false) {
      if (!this.dc) { this.loading = false; return; }
      if (!silent) this.loading = true;
      const { data, error } = await loadHomeData(this.dc.id, this.store.session?.user?.id);
      this.loading = false;
      if (error) { this.errorText = error; if (!silent) toast(error); return; }
      this.errorText = '';
      this.home = data;
      this.subscribe();
    },
    subscribe() {
      const sessionId = this.active?.id;
      if (!sessionId) { this.unsubscribe(); return; }
      if (this.channel && this.channel.__sessionId === sessionId) return;
      this.unsubscribe();
      this.channel = sb.channel('home-' + sessionId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'opname_entries', filter: `session_id=eq.${sessionId}` }, () => this.scheduleReload())
        .subscribe();
      this.channel.__sessionId = sessionId;
    },
    unsubscribe() {
      if (this.channel) { sb.removeChannel(this.channel); this.channel = null; }
    },
    scheduleReload() {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => this.load(true), 1500);
    },
    zonePct(z) { return z.total ? Math.round((z.checked / z.total) * 100) : 0; },
    zoneState(z) {
      if (!z.total) return 'empty';
      if (z.checked >= z.total) return 'done';
      if (z.checked === 0) return 'todo';
      return 'progress';
    },
    zoneStateLabel(z) {
      return { empty: 'Tanpa produk', done: 'Selesai', todo: 'Belum mulai', progress: 'Berjalan' }[this.zoneState(z)];
    },
    relativeTime(iso) {
      if (!iso) return '-';
      const diff = Math.max(0, this.now - new Date(iso).getTime());
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'baru saja';
      if (min < 60) return `${min} menit lalu`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr} jam lalu`;
      return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    },
    formatNum(n) { return Number(n || 0).toLocaleString('id-ID'); },
    async continueSession(zona) {
      if (!this.active || this.opening) return;
      this.opening = true;
      await openSessionFromHome(this.dc, this.active.id, zona || null);
      this.opening = false;
    },
    openAllSessions() { if (this.dc) openDcSessions(this.dc); },
  },
  template: `
    <div class="main-content">
      <div class="wrap home-wrap">
        <header class="home-head">
          <p class="home-date">{{ todayLabel }}</p>
          <h1>Halo, {{ firstName }} 👋</h1>
          <p v-if="dc" class="home-dc"><i class="ti" :class="dc.icon || 'ti-building-warehouse'"></i> {{ dc.nama }}<span v-if="dc.sub"> · {{ dc.sub }}</span></p>
        </header>

        <div v-if="!dc" class="home-panel home-empty">
          <div class="home-empty-icon"><i class="ti ti-building-off"></i></div>
          <h2>Akun lo belum terhubung ke DC</h2>
          <p>Minta admin buat assign DC ke akun ini dulu.</p>
        </div>

        <template v-else-if="loading">
          <div class="home-skeleton home-skeleton-hero"></div>
          <div class="home-kpis">
            <div class="home-skeleton home-skeleton-kpi"></div>
            <div class="home-skeleton home-skeleton-kpi"></div>
            <div class="home-skeleton home-skeleton-kpi"></div>
          </div>
        </template>

        <div v-else-if="errorText && !home" class="home-panel home-empty">
          <div class="home-empty-icon"><i class="ti ti-cloud-off"></i></div>
          <h2>Data gagal dimuat</h2>
          <p>{{ errorText }}</p>
          <button class="btn-ghost" @click="load()"><i class="ti ti-refresh"></i> Coba lagi</button>
        </div>

        <template v-else>
          <section v-if="active" class="home-hero">
            <div class="home-hero-top">
              <div class="home-hero-title">
                <span class="home-eyebrow"><span class="home-live-dot"></span> Sesi aktif</span>
                <h2>{{ active.nama }}</h2>
                <p class="home-hero-meta"><i class="ti ti-calendar"></i> {{ formatTanggal(active.tanggal) }}</p>
              </div>
              <button class="btn-amber home-cta" :disabled="opening" @click="continueSession()">
                {{ opening ? 'Membuka...' : 'Lanjutkan' }} <i class="ti ti-arrow-right"></i>
              </button>
            </div>
            <div class="home-progress">
              <div class="home-progress-label">
                <span><b>{{ formatNum(checked) }}</b> / {{ formatNum(total) }} item dicek</span>
                <span class="home-progress-pct">{{ pct }}%</span>
              </div>
              <div class="home-track home-track-lg" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
                <div class="home-fill" :style="{ width: pct + '%' }"></div>
              </div>
            </div>
            <button type="button" class="home-link" @click="openAllSessions">
              <span v-if="home.otherActiveCount">+{{ home.otherActiveCount }} sesi aktif lain · </span>Lihat semua sesi <i class="ti ti-chevron-right"></i>
            </button>
          </section>

          <section v-else class="home-hero home-hero-empty">
            <div class="home-empty-icon"><i class="ti ti-clipboard-off"></i></div>
            <div>
              <h2>Belum ada sesi opname aktif</h2>
              <p>Sesi baru bakal muncul di sini begitu dibuat.</p>
            </div>
            <button class="btn-ghost" @click="openAllSessions"><i class="ti ti-history"></i> Lihat riwayat sesi</button>
          </section>

          <div v-if="active" class="home-kpis">
            <div class="home-kpi">
              <div class="home-kpi-icon"><i class="ti ti-chart-donut-3"></i></div>
              <div class="home-kpi-label">Progres DC</div>
              <div class="home-kpi-value">{{ pct }}<small>%</small></div>
              <div class="home-kpi-sub">{{ formatNum(checked) }} dari {{ formatNum(total) }} item</div>
            </div>
            <div class="home-kpi">
              <div class="home-kpi-icon warn"><i class="ti ti-list-check"></i></div>
              <div class="home-kpi-label">Belum dicek</div>
              <div class="home-kpi-value">{{ formatNum(remaining) }}</div>
              <div class="home-kpi-sub">item tersisa<span v-if="untouchedCount"> · {{ untouchedCount }} zona belum mulai</span></div>
            </div>
            <div class="home-kpi">
              <div class="home-kpi-icon success"><i class="ti ti-user-check"></i></div>
              <div class="home-kpi-label">Input saya hari ini</div>
              <div class="home-kpi-value">{{ formatNum(home.mineToday) }}</div>
              <div class="home-kpi-sub">item diisi</div>
            </div>
          </div>

          <div v-if="active" class="home-grid">
            <section class="home-panel">
              <div class="home-panel-head">
                <h3>Progres per zona</h3>
                <span class="home-panel-count">{{ zones.length }} zona</span>
              </div>
              <div v-if="zones.length" class="home-zone-list">
                <button v-for="z in zones" :key="z.id" type="button" class="home-zone" :class="'is-' + zoneState(z)" :disabled="opening || !z.total" @click="continueSession(z)">
                  <div class="home-zone-top">
                    <span class="home-zone-name">{{ z.nama }}</span>
                    <span class="home-zone-pill"><i v-if="zoneState(z) === 'done'" class="ti ti-check"></i>{{ zoneStateLabel(z) }}</span>
                  </div>
                  <div class="home-zone-bottom">
                    <div class="home-track"><div class="home-fill" :style="{ width: zonePct(z) + '%' }"></div></div>
                    <span class="home-zone-count">{{ formatNum(z.checked) }}/{{ formatNum(z.total) }}</span>
                  </div>
                </button>
              </div>
              <p v-else class="home-panel-empty">Belum ada zona di DC ini.</p>
            </section>

            <section class="home-panel">
              <div class="home-panel-head">
                <h3>Aktivitas terakhir saya</h3>
                <span class="home-panel-count">sesi ini</span>
              </div>
              <ul v-if="activity.length" class="home-activity">
                <li v-for="a in activity" :key="a.id">
                  <div class="home-activity-main">
                    <span class="home-activity-name">{{ a.master_produk?.nama || a.barcode }}</span>
                    <span class="home-activity-meta">{{ a.sectors?.nama || '-' }} · {{ relativeTime(a.updated_at) }}</span>
                  </div>
                  <span class="home-activity-qty">{{ a.qty_fisik ?? '-' }} <small>{{ a.master_produk?.satuan || '' }}</small></span>
                </li>
              </ul>
              <p v-else class="home-panel-empty">Lo belum input apa-apa di sesi ini.</p>
            </section>
          </div>
        </template>
      </div>
    </div>
  `,
};
