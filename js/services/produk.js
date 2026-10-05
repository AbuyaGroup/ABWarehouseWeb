async function loadZones(dcId) {
  const { data, error } = await sb.from('zones').select('*').eq('dc_id', dcId).order('nama');
  if (error) { console.error('Gagal muat zones:', error); Store.zonesList = []; return; }
  Store.zonesList = data || [];
}

async function loadSectorsAndProduk(sectorIds) {
  if (!sectorIds.length) { Store.produkList = []; return; }

  const { data: psData, error: psErr } = await sb
    .from('produk_sectors')
    .select('id, sector_id, barcode, master_produk(nama, kode_produk, kategori, sub_kategori, satuan)')
    .in('sector_id', sectorIds);
  if (psErr) { console.error('Gagal muat produk_sectors:', psErr); Store.produkList = []; return; }

  Store.produkList = (psData || []).map(ps => {
    const sector = Store.sectorsList.find(s => s.id === ps.sector_id);
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

async function loadProdukForZona(zonaId) {
  const { data: sectorsData, error: sectorsErr } = await sb
    .from('sectors').select('*').eq('zone_id', zonaId).order('nama');
  if (sectorsErr) { console.error('Gagal muat sectors:', sectorsErr); Store.sectorsList = []; Store.produkList = []; return; }
  Store.sectorsList = sectorsData || [];
  await loadSectorsAndProduk(Store.sectorsList.map(s => s.id));
}

async function loadProdukForDc(dcId) {
  const { data: zonesData, error: zonesErr } = await sb.from('zones').select('id').eq('dc_id', dcId);
  if (zonesErr) { console.error('Gagal muat zones:', zonesErr); Store.sectorsList = []; Store.produkList = []; return; }
  const zoneIds = (zonesData || []).map(z => z.id);
  if (!zoneIds.length) { Store.sectorsList = []; Store.produkList = []; return; }

  const { data: sectorsData, error: sectorsErr } = await sb
    .from('sectors').select('*').in('zone_id', zoneIds).order('nama');
  if (sectorsErr) { console.error('Gagal muat sectors:', sectorsErr); Store.sectorsList = []; Store.produkList = []; return; }
  Store.sectorsList = sectorsData || [];
  await loadSectorsAndProduk(Store.sectorsList.map(s => s.id));
}

async function reloadProdukList() {
  if (Store.viewAllDc) await loadProdukForDc(Store.currentDc.id);
  else await loadProdukForZona(Store.currentZonaId);
}

async function loadEntries() {
  if (!Store.activeSessionId) return;
  const { data, error } = await sb
    .from('opname_entries')
    .select('*, profiles(nama)')
    .eq('session_id', Store.activeSessionId)
    .order('updated_at', { ascending: true });
  if (error) { console.error('Gagal muat opname_entries:', error); Store.entries = {}; return; }

  const entries = {};
  (data || []).forEach(e => {
    if (e.updated_by && e.profiles?.nama) Store.profilesById[e.updated_by] = e.profiles.nama;
    entries[`${e.barcode}|${e.sector_id}`] = e;
  });
  Store.entries = entries;
}

function getUpdatedByNama(e) {
  if (!e || !e.updated_by) return null;
  return e.profiles?.nama || Store.profilesById[e.updated_by] || null;
}

async function enterZona(zona) {
  Store.currentZonaId = zona.id;
  Store.currentZona = zona.nama;
  Store.sectorFilter = '';
  Store.viewAllDc = false;
  Store.searchQuery = '';
  Store.dashboardPage = 1;
  Store.dashLoading = true;
  Store.currentScreen = 'dashboard';

  setSync(false, 'memuat...');
  await loadProdukForZona(zona.id);
  Store.dashLoading = false;
  subscribeRealtime();
  setSync(true, 'tersambung');
}

async function switchToAllDcView() {
  Store.viewAllDc = true;
  Store.currentZonaId = null;
  Store.currentZona = '';
  Store.sectorFilter = '';
  Store.searchQuery = '';
  Store.dashboardPage = 1;
  Store.dashLoading = true;
  Store.currentScreen = 'dashboard';

  setSync(false, 'memuat...');
  await loadProdukForDc(Store.currentDc.id);
  Store.dashLoading = false;
  subscribeRealtime();
  setSync(true, 'tersambung');
}

function exitAllDcView() {
  if (Store.realtimeChannel) { sb.removeChannel(Store.realtimeChannel); Store.realtimeChannel = null; }
  Store.viewAllDc = false;
  Store.currentScreen = 'zona';
}

function backFromDashboard() {
  if (Store.realtimeChannel) { sb.removeChannel(Store.realtimeChannel); Store.realtimeChannel = null; }
  if (Store.viewAllDc) {
    Store.viewAllDc = false;
    Store.currentScreen = 'sessionList';
  } else {
    Store.currentScreen = 'zona';
  }
}

function subscribeRealtime() {
  if (Store.realtimeChannel) sb.removeChannel(Store.realtimeChannel);
  const channelKey = Store.viewAllDc
    ? ('inventory-sync-alldc-' + Store.currentDc.id)
    : ('inventory-sync-' + Store.currentZonaId);

  Store.realtimeChannel = sb.channel(channelKey)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'opname_entries' }, async payload => {
      const row = payload.new || payload.old;
      if (!row || row.session_id !== Store.activeSessionId) return;
      if (payload.eventType === 'DELETE') {
        delete Store.entries[`${row.barcode}|${row.sector_id}`];
      } else {
        if (row.updated_by) {
          const { data: profileData } = await sb.from('profiles').select('nama').eq('id', row.updated_by).single();
          if (profileData?.nama) Store.profilesById[row.updated_by] = profileData.nama;
        }
        Store.entries[`${row.barcode}|${row.sector_id}`] = row;
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produk_sectors' }, async payload => {
      const row = payload.new || payload.old;
      const sectorIds = Store.sectorsList.map(s => s.id);
      if (!row || !sectorIds.includes(row.sector_id)) return;
      await reloadProdukList();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'master_produk' }, async payload => {
      const barcode = payload.new?.barcode;
      if (!barcode || !Store.produkList.some(p => p.barcode === barcode)) return;
      await reloadProdukList();
    })
    .subscribe(status => {
      setSync(status === 'SUBSCRIBED', status === 'SUBSCRIBED' ? 'tersambung' : 'terputus');
    });
}
