async function loadDcs() {
  const { data, error } = await sb.from('dcs').select('*').order('urutan');
  if (error) { console.error('Gagal muat dcs:', error); Store.dcs = []; return; }
  Store.dcs = data || [];
}

async function loadSessions(dcId) {
  const { data } = await sb.from('opname_sessions').select('*').eq('dc_id', dcId).order('created_at', { ascending: false });
  Store.sessions = data || [];
}

async function createSession({ nama, tanggal, dcId }) {
  const { data, error } = await sb.from('opname_sessions')
    .insert({ nama, tanggal, dc_id: dcId, status: 'aktif' }).select();
  if (error) return { error: 'Gagal bikin sesi: ' + error.message };
  await loadSessions(dcId);
  return { data: data && data[0] };
}

async function updateSession(id, { nama, tanggal }) {
  const { error } = await sb.from('opname_sessions').update({ nama, tanggal }).eq('id', id);
  if (error) return { error: 'Gagal simpan perubahan: ' + error.message };
  await loadSessions(Store.currentDc.id);
  return { error: null };
}

async function toggleSessionStatus(id) {
  const s = Store.sessions.find(x => x.id === id);
  if (!s) return;
  const newStatus = s.status === 'aktif' ? 'selesai' : 'aktif';
  const { error } = await sb.from('opname_sessions').update({ status: newStatus }).eq('id', id);
  if (error) { toast('Gagal update status: ' + error.message); return; }
  await loadSessions(Store.currentDc.id);
}

async function deleteSessionFull(id) {
  const { error: entriesErr } = await sb.from('opname_entries').delete().eq('session_id', id).select();
  if (entriesErr) return { error: `Gagal hapus data opname di sesi ini. ${entriesErr.message} (code: ${entriesErr.code || '-'})` };

  const { data: sessionData, error } = await sb.from('opname_sessions').delete().eq('id', id).select();
  if (error) return { error: `Gagal hapus sesi. ${error.message} (code: ${error.code || '-'})` };

  if (!sessionData || sessionData.length === 0) {
    return { error: 'Sesi gak berhasil kehapus. Kemungkinan besar akun ini gak punya izin (RLS policy) buat hapus data di tabel opname_sessions.' };
  }

  if (Store.activeSessionId === id) Store.activeSessionId = null;
  await loadSessions(Store.currentDc.id);
  return { error: null };
}

function updateSessionNameLabels() {
  const s = Store.sessions.find(x => x.id === Store.activeSessionId);
  return s ? s.nama : '';
}

async function loadSessionReviewRows(sessionId) {
  const { data: entriesData, error: entriesErr } = await sb
    .from('opname_entries')
    .select('id, barcode, sector_id, qty_fisik, master_produk(nama, satuan), sectors(nama), updated_at')
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: true });
  if (entriesErr) throw entriesErr;

  if (!entriesData || !entriesData.length) return [];

  const dedupedByKey = {};
  entriesData.forEach(e => { dedupedByKey[`${e.barcode}|${e.sector_id}`] = e; });

  const aggByBarcode = {};
  Object.values(dedupedByKey).forEach(e => {
    if (!aggByBarcode[e.barcode]) {
      aggByBarcode[e.barcode] = {
        barcode: e.barcode,
        nama: e.master_produk?.nama || '(produk tak dikenal)',
        satuan: e.master_produk?.satuan || '',
        sectorNamas: [],
        qtyCounting: 0,
      };
    }
    const agg = aggByBarcode[e.barcode];
    const sectorNama = e.sectors?.nama || '-';
    if (!agg.sectorNamas.includes(sectorNama)) agg.sectorNamas.push(sectorNama);
    agg.qtyCounting += Number(e.qty_fisik) || 0;
  });

  return Object.values(aggByBarcode)
    .sort((a, b) => a.barcode.localeCompare(b.barcode))
    .map(agg => ({
      barcode: agg.barcode,
      nama: agg.nama,
      satuan: agg.satuan,
      sectorNama: agg.sectorNamas.join(', '),
      qtyCounting: agg.qtyCounting,
      qtyFinal: agg.qtyCounting,
    }));
}

async function confirmSessionFinal(sessionId, rows, authorizedBy) {
  const payload = rows.map(row => ({
    session_id: sessionId,
    barcode: row.barcode,
    qty_final: row.qtyFinal,
    authorized_by: authorizedBy,
  }));

  const { error: insertErr } = await sb.from('opname_final').insert(payload);
  if (insertErr) throw insertErr;

  const { error: statusErr } = await sb.from('opname_sessions').update({ status: 'selesai' }).eq('id', sessionId);
  if (statusErr) throw statusErr;

  await loadSessions(Store.currentDc.id);
}
