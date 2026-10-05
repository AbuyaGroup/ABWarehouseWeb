const LoginScreen = {
  data() {
    return {
      username: '',
      password: '',
      showPassword: false,
      loading: false,
      errorMsg: '',
    };
  },
  methods: {
    togglePassword() { this.showPassword = !this.showPassword; },
    async submit() {
      if (this.loading) return;
      this.errorMsg = '';
      this.loading = true;
      const { error } = await doLogin(this.username, this.password);
      this.loading = false;
      if (error) { this.errorMsg = error; return; }
      this.password = '';
    },
    onKeydown(e) { if (e.key === 'Enter') this.submit(); },
  },
  template: `
    <div id="loginScreen">
      <div class="login-visual">
        <div class="login-visual-shape shape-1"></div>
        <div class="login-visual-shape shape-2"></div>
        <div class="login-visual-content">
          <div class="login-visual-brand"><div class="mark"><i class="ti ti-building-warehouse"></i></div><span>HAASIR</span></div>
          <h1 class="login-visual-headline">Tanggal 29 SO? Pakai ini aja dulu mas bro!</h1>
          <p class="login-visual-sub">Yang menghitung, merekap, dan menginventarisasi</p>
          <ul class="login-visual-points">
            <li><i class="ti ti-bolt"></i> Sinkron real-time antar device</li>
            <li><i class="ti ti-clipboard-check"></i> Review & konfirmasi qty final</li>
            <li><i class="ti ti-file-export"></i> Export PDF & Excel siap pakai</li>
          </ul>
        </div>
      </div>
      <div class="login-form-panel">
        <div class="login-card">
          <div class="login-brand login-brand-mobile"><div class="mark"><i class="ti ti-building-warehouse"></i></div><span>Abuya Inventory</span></div>
          <div class="login-brand"><div class="mark"><i class="ti ti-building-warehouse"></i></div><span>Masuk</span></div>
          <p class="sub">Inventory</p>
          <div :class="['login-error', { show: errorMsg }]">{{ errorMsg }}</div>
          <div class="field">
            <label>Username</label>
            <input type="text" v-model="username" autocomplete="username" @keydown="onKeydown">
          </div>
          <div class="field">
            <label>Password</label>
            <div class="password-wrap">
              <input :type="showPassword ? 'text' : 'password'" v-model="password" autocomplete="current-password" @keydown="onKeydown">
              <button type="button" class="password-toggle" tabindex="-1" @click="togglePassword"><i :class="['ti', showPassword ? 'ti-eye-off' : 'ti-eye']"></i></button>
            </div>
          </div>
          <button class="btn-primary" :disabled="loading" @click="submit">{{ loading ? 'Masuk...' : 'Masuk' }}</button>
        </div>
      </div>
    </div>
  `,
};
