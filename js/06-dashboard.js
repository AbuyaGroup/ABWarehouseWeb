async function loadProdukForZona(zonaId){
  const { data: sectorsData, error: sectorsErr } = await sb
    .from('sectors').select('*').eq('zone_id', zonaId).order('nama');
  if(sectorsErr){
    console.error('Gagal muat sectors:', sectorsErr);
    state.sectorsList = [];
    state.produkList = [];
    return;
  }
  state.sectorsList = sectorsData || [];

  const sectorIds = state.sectorsList.map(s => s.id);
  if(!sectorIds.length){
    state.produkList = [];
    return;
  }

  const { data: psData, error: psErr } = await sb
    .from('produk_sectors')
    .select('id, sector_id, barcode, master_produk(nama, kode_produk, kategori, sub_kategori, satuan)')
    .in('sector_id', sectorIds);
  if(psErr){
    console.error('Gagal muat produk_sectors:', psErr);
    state.produkList = [];
    return;
  }

  state.produkList = (psData || []).map(ps => {
    const sector = state.sectorsList.find(s => s.id === ps.sector_id);
    return {
      id: ps.id,
      barcode: ps.barcode,
      nama: ps.master_produk?.nama || '(produk tak dikenal)',
      kode_produk: ps.master_produk?.kode_produk || '',
      kategori: ps.master_produk?.kategori || '',
      sub_kategori: ps.master_produk?.sub_kategori || '',
      satuan: ps.master_produk?.satuan || '',
      sector_id: ps.sector_id,
      sector_nama: sector ? sector.nama : '-',
    };
  });
}

async function loadProdukForDc(dcId){
  const { data: zonesData, error: zonesErr } = await sb
    .from('zones').select('id').eq('dc_id', dcId);
  if(zonesErr){
    console.error('Gagal muat zones:', zonesErr);
    state.sectorsList = [];
    state.produkList = [];
    return;
  }
  const zoneIds = (zonesData || []).map(z => z.id);
  if(!zoneIds.length){
    state.sectorsList = [];
    state.produkList = [];
    return;
  }

  const { data: sectorsData, error: sectorsErr } = await sb
    .from('sectors').select('*').in('zone_id', zoneIds).order('nama');
  if(sectorsErr){
    console.error('Gagal muat sectors:', sectorsErr);
    state.sectorsList = [];
    state.produkList = [];
    return;
  }
  state.sectorsList = sectorsData || [];

  const sectorIds = state.sectorsList.map(s => s.id);
  if(!sectorIds.length){
    state.produkList = [];
    return;
  }

  const { data: psData, error: psErr } = await sb
    .from('produk_sectors')
    .select('id, sector_id, barcode, master_produk(nama, kode_produk, kategori, sub_kategori, satuan)')
    .in('sector_id', sectorIds);
  if(psErr){
    console.error('Gagal muat produk_sectors:', psErr);
    state.produkList = [];
    return;
  }

  state.produkList = (psData || []).map(ps => {
    const sector = state.sectorsList.find(s => s.id === ps.sector_id);
    return {
      id: ps.id,
      barcode: ps.barcode,
      nama: ps.master_produk?.nama || '(produk tak dikenal)',
      kode_produk: ps.master_produk?.kode_produk || '',
      kategori: ps.master_produk?.kategori || '',
      sub_kategori: ps.master_produk?.sub_kategori || '',
      satuan: ps.master_produk?.satuan || '',
      sector_id: ps.sector_id,
      sector_nama: sector ? sector.nama : '-',
    };
  });
}

async function reloadProdukList(){
  if(state.viewAllDc){
    await loadProdukForDc(state.currentDc.id);
  } else {
    await loadProdukForZona(state.currentZonaId);
  }
}

function renderSectorFilterOptions(){
  const sel = el('sectorFilterSelect');
  if(!sel) return;
  sel.innerHTML = '<option value="">Semua Sector</option>' +
    state.sectorsList.map(s => `<option value="${s.id}">${s.nama}</option>`).join('');
  sel.value = state.sectorFilter || '';
}

async function loadSessions(dcId){
  const { data } = await sb.from('opname_sessions').select('*').eq('dc_id', dcId).order('created_at', { ascending:false });
  state.sessions = data || [];
}

async function loadEntries(){
  if(!state.activeSessionId) return;
  const { data, error } = await sb
    .from('opname_entries')
    .select('*, profiles(nama)')
    .eq('session_id', state.activeSessionId)

    .order('updated_at', { ascending: true });
  if(error){
    console.error('Gagal muat opname_entries:', error);
    state.entries = {};
    return;
  }
  state.entries = {};
  (data||[]).forEach(e => {
    if(e.updated_by && e.profiles?.nama) state.profilesById[e.updated_by] = e.profiles.nama;

    state.entries[`${e.barcode}|${e.sector_id}`] = e;
  });
}

function getUpdatedByNama(e){
  if(!e || !e.updated_by) return null;
  return e.profiles?.nama || state.profilesById[e.updated_by] || null;
}

el('searchInput').addEventListener('input', (e) => {
  state.searchQuery = e.target.value.toLowerCase();
  state.dashboardPage = 1;
  renderDashboard();
});

el('sectorFilterSelect').addEventListener('change', (e) => {
  state.sectorFilter = e.target.value;
  state.dashboardPage = 1;
  renderDashboard();
});

function renderDashboard(){

  const produkZonaIni = state.sectorFilter
    ? state.produkList.filter(p => p.sector_id === state.sectorFilter)
    : state.produkList;

  if(!state.activeSessionId){
    hide('produkTableWrap');
    hide('produkPagination');
    hide('emptyZonaMsg');
    el('produkGrid').innerHTML = '';
    show('noSessionMsg');
    el('statChecked').textContent = '0/0';
    return;
  }
  hide('noSessionMsg');

  if(!produkZonaIni.length){
    hide('produkTableWrap');
    hide('produkPagination');
    el('produkGrid').innerHTML = '';
    show('emptyZonaMsg');
    el('statChecked').textContent = '0/0';
    return;
  }
  hide('emptyZonaMsg');
  show('produkTableWrap');

  const filtered = produkZonaIni.filter(p =>
    !state.searchQuery || p.nama.toLowerCase().includes(state.searchQuery)
  );

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(state.dashboardPage > totalPages) state.dashboardPage = totalPages;
  if(state.dashboardPage < 1) state.dashboardPage = 1;
  const pageItems = filtered.slice(
    (state.dashboardPage - 1) * PAGE_SIZE,
    state.dashboardPage * PAGE_SIZE
  );

  if(!filtered.length){
    el('produkGrid').innerHTML = `<tr><td colspan="5" class="empty-state">Gak ada produk yang cocok.</td></tr>`;
  } else {
    el('produkGrid').innerHTML = pageItems.map(p => {
      const e = state.entries[`${p.barcode}|${p.sector_id}`];
      const qty = (e && e.qty_fisik !== null && e.qty_fisik !== undefined) ? e.qty_fisik : null;
      const scannerNama = getUpdatedByNama(e);
      return `
        <tr>
          <td><span class="kategori-tag">${p.kategori || '-'}</span></td>
          <td class="produk-nama">${p.nama}</td>
          <td class="num">
            <span class="qty ${qty === null ? 'kosong' : ''}">${qty === null ? 'Belum dihitung' : qty}</span>
            ${qty === null ? '' : `<span class="uom">${p.satuan || ''}</span>`}
          </td>
          <td>${scannerNama ? `<span class="scanned-by">✓ ${scannerNama}</span>` : '-'}</td>
          <td><span class="sector-tag">${p.sector_nama}</span></td>
        </tr>`;
    }).join('');
  }

  renderPaginationBar({
    prefix: 'produk',
    page: state.dashboardPage,
    totalPages,
    onGoTo: (n) => { state.dashboardPage = n; renderDashboard(); },
  });

  const checked = produkZonaIni.filter(p => {
    const e = state.entries[`${p.barcode}|${p.sector_id}`];
    return e && e.qty_fisik !== null && e.qty_fisik !== undefined;
  }).length;
  el('statChecked').textContent = `${checked}/${produkZonaIni.length}`;
}

function setSync(ok, text){
  const dot = el('syncDot');
  if(!dot) return;
  dot.className = 'sync-dot ' + (ok ? 'on' : 'off');
  el('syncText').textContent = text;
}

function subscribeRealtime(){
  if(state.realtimeChannel) sb.removeChannel(state.realtimeChannel);
  const channelKey = state.viewAllDc
    ? ('inventory-sync-alldc-' + state.currentDc.id)
    : ('inventory-sync-' + state.currentZonaId);
  state.realtimeChannel = sb.channel(channelKey)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'opname_entries' }, async payload => {
      const row = payload.new || payload.old;
      if(!row || row.session_id !== state.activeSessionId) return;
      if(payload.eventType === 'DELETE'){
        delete state.entries[`${row.barcode}|${row.sector_id}`];
      } else {

        if(row.updated_by){
          const { data: profileData } = await sb.from('profiles').select('nama').eq('id', row.updated_by).single();
          if(profileData?.nama) state.profilesById[row.updated_by] = profileData.nama;
        }
        state.entries[`${row.barcode}|${row.sector_id}`] = row;
      }
      renderDashboard();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produk_sectors' }, async payload => {
      const row = payload.new || payload.old;
      const sectorIds = state.sectorsList.map(s => s.id);
      if(!row || !sectorIds.includes(row.sector_id)) return;

      await reloadProdukList();
      renderSectorFilterOptions();
      renderDashboard();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'master_produk' }, async payload => {
      const barcode = payload.new?.barcode;
      if(!barcode || !state.produkList.some(p => p.barcode === barcode)) return;
      await reloadProdukList();
      renderDashboard();
    })
    .subscribe(status => {
      setSync(status === 'SUBSCRIBED', status === 'SUBSCRIBED' ? 'tersambung' : 'terputus');
    });
}