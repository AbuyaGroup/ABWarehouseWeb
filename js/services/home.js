const HOME_PAGE_SIZE = 1000;

async function fetchAllRows(buildQuery) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + HOME_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < HOME_PAGE_SIZE) break;
    from += HOME_PAGE_SIZE;
  }
  return { data: rows, error: null };
}

function isSameLocalDay(iso, ref) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

async function loadHomeData(dcId, userId) {
  const { data: sessionsData, error: sessErr } = await sb
    .from('opname_sessions').select('*').eq('dc_id', dcId).order('created_at', { ascending: false });
  if (sessErr) return { error: 'Gagal muat sesi: ' + sessErr.message };
  const sessions = sessionsData || [];
  Store.sessions = sessions;

  const activeSessions = sessions.filter(s => s.status === 'aktif');
  const active = activeSessions[0] || null;

  const { data: zonesData, error: zonesErr } = await sb
    .from('zones').select('id, nama').eq('dc_id', dcId).order('nama');
  if (zonesErr) return { error: 'Gagal muat zona: ' + zonesErr.message };
  const zones = zonesData || [];
  const zoneIds = zones.map(z => z.id);

  let sectors = [];
  if (zoneIds.length) {
    const { data, error } = await sb.from('sectors').select('id, zone_id').in('zone_id', zoneIds);
    if (error) return { error: 'Gagal muat sector: ' + error.message };
    sectors = data || [];
  }
  const sectorZone = {};
  sectors.forEach(s => { sectorZone[s.id] = s.zone_id; });
  const sectorIds = sectors.map(s => s.id);

  let produkSectors = [];
  if (sectorIds.length) {
    const { data, error } = await fetchAllRows(() => sb
      .from('produk_sectors').select('id, barcode, sector_id').in('sector_id', sectorIds).order('id'));
    if (error) return { error: 'Gagal muat produk: ' + error.message };
    produkSectors = data;
  }

  const required = new Set();
  const zoneStats = {};
  zones.forEach(z => { zoneStats[z.id] = { total: 0, checked: 0 }; });
  produkSectors.forEach(ps => {
    const key = `${ps.barcode}|${ps.sector_id}`;
    if (required.has(key)) return;
    required.add(key);
    const zid = sectorZone[ps.sector_id];
    if (zoneStats[zid]) zoneStats[zid].total++;
  });

  let checked = 0;
  let mineToday = 0;
  let activity = [];

  if (active) {
    const { data: entriesData, error: entErr } = await fetchAllRows(() => sb
      .from('opname_entries')
      .select('id, barcode, sector_id, qty_fisik, updated_by, updated_at')
      .eq('session_id', active.id)
      .order('updated_at', { ascending: true }));
    if (entErr) return { error: 'Gagal muat data opname: ' + entErr.message };

    const latest = {};
    entriesData.forEach(e => { latest[`${e.barcode}|${e.sector_id}`] = e; });

    const today = new Date();
    Object.entries(latest).forEach(([key, e]) => {
      if (e.qty_fisik === null || e.qty_fisik === undefined) return;
      if (required.has(key)) {
        checked++;
        const zid = sectorZone[e.sector_id];
        if (zoneStats[zid]) zoneStats[zid].checked++;
      }
      if (e.updated_by === userId && isSameLocalDay(e.updated_at, today)) mineToday++;
    });

    const { data: actData, error: actErr } = await sb
      .from('opname_entries')
      .select('id, barcode, sector_id, qty_fisik, updated_at, master_produk(nama, satuan), sectors(nama)')
      .eq('session_id', active.id)
      .eq('updated_by', userId)
      .order('updated_at', { ascending: false })
      .limit(8);
    if (!actErr) activity = actData || [];
  }

  return {
    error: null,
    data: {
      sessions,
      active,
      otherActiveCount: Math.max(0, activeSessions.length - 1),
      zones: zones.map(z => ({ ...z, ...zoneStats[z.id] })),
      total: required.size,
      checked,
      mineToday,
      activity,
    },
  };
}

async function openSessionFromHome(dc, sessionId, zona) {
  if (Store.realtimeChannel) { sb.removeChannel(Store.realtimeChannel); Store.realtimeChannel = null; }
  Store.currentDc = dc;
  Store.activeSessionId = sessionId;
  Store.searchQuery = '';
  Store.sidebarOpen = false;
  await loadEntries();
  await loadZones(dc.id);
  if (zona) await enterZona(zona);
  else Store.currentScreen = 'zona';
}

function goHome() { goToScreen('home'); }
