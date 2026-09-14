// =========================================================
// AUTH
// =========================================================
el('loginBtn').onclick = doLogin;
el('loginPassword').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });

// Domain internal buat akun Supabase. User cuma perlu inget username-nya
// doang, domain ini nempel otomatis di belakang layar.
const EMAIL_DOMAIN = 'abuyagroup.com';

// Terima input "budi" ATAU "budi@abuyagroup.com" -- dua-duanya jalan.
function buildLoginEmail(input){
  const trimmed = (input || '').trim();
  if(trimmed.includes('@')) return trimmed;
  return `${trimmed}@${EMAIL_DOMAIN}`;
}

async function doLogin(){
  const email = buildLoginEmail(el('loginEmail').value);
  const password = el('loginPassword').value;
  el('loginError').classList.remove('show');
  el('loginBtn').disabled = true;
  el('loginBtn').textContent = 'Masuk...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  el('loginBtn').disabled = false;
  el('loginBtn').textContent = 'Masuk';

  if(error){
    el('loginError').textContent = 'Login gagal: ' + error.message;
    el('loginError').classList.add('show');
    return;
  }
  state.session = data.session;
  await afterLogin();
}

async function loadProfile(){
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.session.user.id).maybeSingle();
  if(!error && data) state.profile = data;
}

// Klaim sesi: generate token baru, simpen ke profiles. Ini otomatis
// "ngusir" device lain yang login pake akun yang sama.
async function claimSession(){
  state.mySessionToken = crypto.randomUUID();
  await sb.from('profiles').update({ active_session_token: state.mySessionToken }).eq('id', state.session.user.id);
}

function watchSessionKick(){
  state.sessionCheckChannel = sb.channel('session-kick-' + state.session.user.id)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles',
      filter: `id=eq.${state.session.user.id}`
    }, payload => {
      if(payload.new.active_session_token !== state.mySessionToken){
        alert('Akun ini baru aja login di device/browser lain, jadi sesi lo di sini otomatis ditutup.');
        forceLogout();
      }
    })
    .subscribe();
}

async function forceLogout(){
  if(state.realtimeChannel) sb.removeChannel(state.realtimeChannel);
  if(state.sessionCheckChannel) sb.removeChannel(state.sessionCheckChannel);
  await sb.auth.signOut();
  location.reload();
}

async function afterLogin(){
  await loadProfile();

  if(state.profile?.admin === 'scanner'){
    await sb.auth.signOut();
    el('loginError').textContent = 'Akun ini cuma bisa dipake login di app abwarehouse, bukan di web.';
    el('loginError').classList.add('show');
    state.session = null;
    state.profile = null;
    return;
  }

  await claimSession();
  watchSessionKick();
  await loadDcs();
  hide('loginScreen');
  renderMainMenu();
  show('mainMenuScreen');
}

[el('logoutBtn1'), el('logoutBtn2')].forEach(btn => {
  btn.onclick = () => forceLogout();
});

