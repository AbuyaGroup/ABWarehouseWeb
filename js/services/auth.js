const EMAIL_DOMAIN = 'abuyagroup.com';

function buildLoginEmail(input) {
  const trimmed = (input || '').trim();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@${EMAIL_DOMAIN}`;
}

async function doLogin(username, password) {
  const email = buildLoginEmail(username);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Login gagal: ' + error.message };

  Store.session = data.session;
  return await afterLogin();
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('id', Store.session.user.id).maybeSingle();
  if (!error && data) Store.profile = data;
}

async function claimSession() {
  Store.mySessionToken = crypto.randomUUID();
  await sb.from('profiles').update({ active_session_token: Store.mySessionToken }).eq('id', Store.session.user.id);
}

function watchSessionKick() {
  Store.sessionCheckChannel = sb.channel('session-kick-' + Store.session.user.id)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles',
      filter: `id=eq.${Store.session.user.id}`,
    }, payload => {
      if (payload.new.active_session_token !== Store.mySessionToken) {
        toast('Akun ini baru aja login di device/browser lain, jadi sesi lo di sini otomatis ditutup.', 'warn', 6000);
        forceLogout();
      }
    })
    .subscribe();
}

async function forceLogout() {
  if (Store.realtimeChannel) sb.removeChannel(Store.realtimeChannel);
  if (Store.sessionCheckChannel) sb.removeChannel(Store.sessionCheckChannel);
  await sb.auth.signOut();
  location.reload();
}

async function afterLogin() {
  await loadProfile();

  if (Store.profile?.role === 'scanner') {
    await sb.auth.signOut();
    Store.session = null;
    Store.profile = null;
    return { error: 'Maaf, akun ini hanya bisa digunakan untuk login di aplikasi AbWarehouse' };
  }

  await claimSession();
  watchSessionKick();
  await loadDcs();
  Store.currentScreen = Store.profile?.role === 'admin' ? 'selector' : 'home';
  return { error: null };
}