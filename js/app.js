const SCREEN_COMPONENTS = {
  login: LoginScreen,
  home: HomeScreen,
  selector: SelectorScreen,
  sessionList: SessionListScreen,
  sessionReview: SessionReviewScreen,
  zona: ZonaScreen,
  dashboard: DashboardScreen,
  manageDc: ManageDcScreen,
  manageZona: ManageZonaScreen,
  manageProduk: ManageProdukScreen,
  produkMaster: ProdukMasterScreen,
};

const App = {
  components: { AppSidebar, ToastStack, ConfirmModal },
  data() {
    return { store: Store, transitionName: 'fade' };
  },
  watch: {
    'store.currentScreen'(newVal, oldVal) {
      this.transitionName = (newVal === 'login' || oldVal === 'login') ? 'screen' : 'fade';
    },
  },
  computed: {
    currentComponent() { return SCREEN_COMPONENTS[this.store.currentScreen] || null; },
  },
  template: `
    <AppSidebar />
    <Transition :name="transitionName" mode="out-in">
      <component :is="currentComponent" :key="store.currentScreen"></component>
    </Transition>
    <ToastStack />
    <ConfirmModal />
  `,
};

Vue.createApp(App).mount('#app');

(async function init() {
  if (SKIP_LOGIN) {
    Store.profile = { role: 'admin', nama: 'Mode Testing (tanpa login)' };
    await loadDcs();
    Store.currentScreen = 'selector';
  } else {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      Store.session = data.session;
      const { error } = await afterLogin();
      if (error) toast(error, 'error', 6000);
    }
  }

  Store.booting = false;
  const splash = document.getElementById('appBootSplash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 220);
  }
})();