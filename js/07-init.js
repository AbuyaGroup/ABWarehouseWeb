// =========================================================
// INIT — cek udah login apa belum
// =========================================================
(async function init(){
  if(SKIP_LOGIN){
    state.profile = { role: 'admin', nama: 'Mode Testing (tanpa login)' };
    await loadDcs();
    hide('loginScreen');
    renderMainMenu();
    show('mainMenuScreen');
    return;
  }
  const { data } = await sb.auth.getSession();
  if(data.session){
    state.session = data.session;
    await afterLogin();
  }
})();
