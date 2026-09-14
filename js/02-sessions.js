// =========================================================
// MAIN MENU (abis login)
// =========================================================
function renderMainMenu(){
  el('userChip9').innerHTML = `<i class="ti ti-user-circle"></i> ${state.profile?.nama || state.session?.user?.email || 'User'} ${state.profile?.role === 'admin' ? '· Admin' : ''}`;
  el('menuMasterBtn').classList.toggle('hidden', state.profile?.role !== 'admin');
}

el('menuStockOpnameBtn').onclick = () => {
  hide('mainMenuScreen');
  renderSelector();
  show('selectorScreen');
};

el('menuMasterBtn').onclick = () => {
  hide('mainMenuScreen');
  el('userChip10').innerHTML = el('userChip9').innerHTML;
  show('masterMenuScreen');
};

el('backFromMasterMenuBtn').onclick = () => {
  hide('masterMenuScreen');
  show('mainMenuScreen');
};

el('logoutBtn10').onclick = () => forceLogout();

el('masterMenuDcBtn').onclick = () => {
  hide('masterMenuScreen');
  el('userChip9b').innerHTML = el('userChip9').innerHTML;
  renderManageDcGrid();
  show('manageDcScreen');
};

el('logoutBtn8').onclick = () => forceLogout();

el('backFromSelectorBtn').onclick = () => {
  hide('selectorScreen');
  show('mainMenuScreen');
};

// =========================================================
// DC SELECTOR (khusus Stock Opname)
// =========================================================
async function loadDcs(){
  const { data, error } = await sb.from('dcs').select('*').order('urutan');
  if(error){
    console.error('Gagal muat dcs:', error);
    state.dcs = [];
    return;
  }
  state.dcs = data || [];
}

function renderSelector(){
  el('userChip').innerHTML = `<i class="ti ti-user-circle"></i> ${state.profile?.nama || state.session?.user?.email || 'User'} ${state.profile?.role === 'admin' ? '· Admin' : ''}`;

  let dcsToShow = state.dcs;
  if(state.profile?.role !== 'admin'){
    dcsToShow = state.dcs.filter(d => d.id === state.profile?.dc_id);
    el('selectorHint').textContent = 'DC yang bisa lo akses:';
  }

  el('dcGrid').innerHTML = dcsToShow.map(dc => `
    <button class="dc-card" data-dc="${dc.id}">
      <div class="dc-icon"><i class="ti ${dc.icon || 'ti-building-warehouse'}"></i></div>
      <div>
        <p class="name">${dc.nama}</p>
        <p class="sub">${dc.sub || ''}</p>
      </div>
      <div class="footer"><span>Stock opname</span><i class="ti ti-arrow-right"></i></div>
    </button>
  `).join('');

  document.querySelectorAll('[data-dc]').forEach(card => {
    card.onclick = () => openDc(card.getAttribute('data-dc'));
  });
}

el('backBtn').onclick = () => {
  if(state.realtimeChannel){ sb.removeChannel(state.realtimeChannel); state.realtimeChannel = null; }
  if(state.viewAllDc){
    // Mode Semua Produk -- topbar-nya statis kaya di Pilih Zona, jadi
    // perilaku tombol back-nya juga disamain: balik ke pilih Sesi.
    state.viewAllDc = false;
    el('switchViewBtn').classList.remove('is-all');
    hide('dashboardScreen');
    show('sessionListScreen');
  } else {
    hide('dashboardScreen');
    show('zonaScreen');
  }
};

el('backToSelectorBtn').onclick = () => {
  if(state.realtimeChannel){ sb.removeChannel(state.realtimeChannel); state.realtimeChannel = null; }
  hide('zonaScreen');
  show('sessionListScreen');
};

el('backToSelectorFromSessionBtn').onclick = () => {
  hide('sessionListScreen');
  show('selectorScreen');
};

el('logoutBtn3').onclick = () => forceLogout();
el('logoutBtn4').onclick = () => forceLogout();

// =========================================================
// ZONA SELECTOR
// =========================================================

async function openDc(dcId){
  state.currentDc = state.dcs.find(d => d.id === dcId);
  state.currentZona = null;
  state.activeSessionId = null;
  state.entries = {};
  state.searchQuery = '';

  el('sessionListDcName').innerHTML = `<div class="mark"><i class="ti ${state.currentDc.icon||'ti-box'}"></i></div>${state.currentDc.nama} · ${state.currentDc.sub||''}`;
  el('userChip3').innerHTML = el('userChip').innerHTML;

  hide('selectorScreen');
  show('sessionListScreen');

  await loadSessions(dcId);
  renderSessionList();
}

// =========================================================
// SESSION CRUD
// =========================================================
function renderSessionList(){
  if(!state.sessions.length){
    el('sessionListGrid').innerHTML = '';
    show('emptySessionMsg');
    return;
  }
  hide('emptySessionMsg');
  el('sessionListGrid').innerHTML = state.sessions.map(s => `
    <div class="session-card">
      <div class="info">
        <div class="nama">${s.nama}</div>
        <div class="meta"><span>${formatTanggal(s.tanggal)}</span><span class="status-badge ${s.status}">${s.status}</span></div>
      </div>
      <div class="actions">
        <button class="btn-icon" data-action="export" data-id="${s.id}" title="Export"><i class="ti ti-download"></i></button>
        <button class="btn-icon" data-action="rename" data-id="${s.id}" title="Edit sesi"><i class="ti ti-edit"></i></button>
        <button class="btn-icon" data-action="toggle" data-id="${s.id}" title="${s.status==='aktif' ? 'Tandai selesai' : 'Aktifkan lagi'}"><i class="ti ${s.status==='aktif' ? 'ti-check' : 'ti-refresh'}"></i></button>
        <button class="btn-icon danger" data-action="delete" data-id="${s.id}" title="Hapus sesi"><i class="ti ti-trash"></i></button>
        <button class="btn-amber" data-action="open" data-id="${s.id}">Buka</button>
      </div>
    </div>
  `).join('');

  el('sessionListGrid').querySelectorAll('[data-action]').forEach(btn => {
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    btn.onclick = () => {
      const s = state.sessions.find(x => x.id === id);
      if(action === 'open') openSession(id);
      else if(action === 'rename') openSessionModal('edit', s);
      else if(action === 'toggle'){
        // Sesi aktif -> mau ditandai selesai -> wajib lewat review qty final dulu.
        // Sesi selesai -> mau diaktifin lagi -> langsung toggle, gak perlu review.
        if(s.status === 'aktif') openSessionReview(id);
        else toggleSessionStatus(id);
      }
      else if(action === 'delete') openDeleteModal(s);
      else if(action === 'export') openExportModal(s);
    };
  });
}

el('newSessionBtn').onclick = () => openSessionModal('create');

// =========================================================
// MODAL: CREATE / EDIT SESI
// =========================================================
function openSessionModal(mode, session){
  state.sessionModalMode = mode;
  state.sessionModalEditingId = session ? session.id : null;

  el('sessionModalTitle').textContent = mode === 'create' ? 'Sesi Baru' : 'Edit Sesi';
  el('sessionModalSave').disabled = false;
  el('sessionModalSave').textContent = 'Simpan';

  const todayIso = new Date().toISOString().slice(0,10);
  if(mode === 'create'){
    const namaUser = state.profile?.nama || state.session?.user?.email || 'Admin';
    el('sessionModalNama').value = `${namaUser} · ${formatTanggal(todayIso)}`;
    el('sessionModalTanggal').value = todayIso;
  } else {
    el('sessionModalNama').value = session.nama;
    el('sessionModalTanggal').value = (session.tanggal || todayIso).slice(0,10);
  }

  show('sessionModal');
  el('sessionModalNama').focus();
}

function closeSessionModal(){
  hide('sessionModal');
}

el('sessionModalCancel').onclick = closeSessionModal;
el('sessionModal').addEventListener('click', e => {
  if(e.target.id === 'sessionModal') closeSessionModal();
});

el('sessionModalSave').onclick = async () => {
  const nama = el('sessionModalNama').value.trim();
  const tanggal = el('sessionModalTanggal').value;

  if(!nama){ alert('Nama sesi wajib diisi.'); return; }
  if(!tanggal){ alert('Tanggal stock opname wajib dipilih.'); return; }

  el('sessionModalSave').disabled = true;
  el('sessionModalSave').textContent = 'Menyimpan...';

  if(state.sessionModalMode === 'create'){
    const { data, error } = await sb.from('opname_sessions')
      .insert({ nama, tanggal, dc_id: state.currentDc.id, status: 'aktif' }).select();
    if(error){
      alert('Gagal bikin sesi: ' + error.message);
      el('sessionModalSave').disabled = false;
      el('sessionModalSave').textContent = 'Simpan';
      return;
    }
    await loadSessions(state.currentDc.id);
    renderSessionList();
    closeSessionModal();
    if(data && data[0]) openSession(data[0].id);
  } else {
    const id = state.sessionModalEditingId;
    const { error } = await sb.from('opname_sessions').update({ nama, tanggal }).eq('id', id);
    if(error){
      alert('Gagal simpan perubahan: ' + error.message);
      el('sessionModalSave').disabled = false;
      el('sessionModalSave').textContent = 'Simpan';
      return;
    }
    await loadSessions(state.currentDc.id);
    renderSessionList();
    if(state.activeSessionId === id) updateSessionNameLabels();
    closeSessionModal();
  }
};

// =========================================================
// MODAL: HAPUS SESI
// =========================================================
function openDeleteModal(session){
  state.deletingSessionId = session.id;
  el('deleteModalText').textContent = `Hapus sesi "${session.nama}"? Semua data opname yang udah keisi di sesi ini bakal ikut kehapus dan gak bisa dibalikin lagi.`;
  el('deleteModalConfirm').disabled = false;
  el('deleteModalConfirm').textContent = 'Hapus';
  show('deleteModal');
}

function closeDeleteModal(){
  hide('deleteModal');
  state.deletingSessionId = null;
}

el('deleteModalCancel').onclick = closeDeleteModal;
el('deleteModal').addEventListener('click', e => {
  if(e.target.id === 'deleteModal') closeDeleteModal();
});

