async function printSessionPdf(sessionId, sectorId){
  const session = state.sessions.find(x => x.id === sessionId);
  if(!session) return;
  if(!sectorId){ alert('Pilih sector dulu.'); return; }

  try {

    const { data: sectorRow, error: sectorErr } = await sb
      .from('sectors').select('id, nama, zone_id').eq('id', sectorId).maybeSingle();
    if(sectorErr) throw sectorErr;
    if(!sectorRow){ alert('Sector gak ketemu.'); return; }

    const { data: psData, error: psErr } = await sb
      .from('produk_sectors')
      .select('barcode, sector_id, master_produk(nama, satuan)')
      .eq('sector_id', sectorId);
    if(psErr) throw psErr;
    if(!psData || !psData.length){
      alert('Belum ada produk yang ke-assign ke sector ini (tabel produk_sectors).');
      return;
    }

    const { data: entriesData, error: entriesErr } = await sb
      .from('opname_entries')
      .select('barcode, sector_id, qty_fisik, updated_by, profiles(nama)')
      .eq('session_id', sessionId)
      .eq('sector_id', sectorId);
    if(entriesErr) throw entriesErr;

    const entriesByKey = {};
    (entriesData || []).forEach(e => { entriesByKey[`${e.barcode}|${e.sector_id}`] = e; });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297;
    const halfH = pageH / 2;
    const header = ['Scanner', 'Sector', 'Sequence', 'Nama Produk', 'Unit', 'Counting 2', 'Counting 1'];
    const dcNama = state.currentDc?.nama || '';

    const rows = psData.map((ps, i) => {
      const e = entriesByKey[`${ps.barcode}|${sectorId}`];
      const scannerNama = getUpdatedByNama(e) || '-';
      const qty = (e && e.qty_fisik !== null && e.qty_fisik !== undefined) ? e.qty_fisik : '';
      return [scannerNama, sectorRow.nama, i + 1, ps.master_produk?.nama || '(produk tak dikenal)', ps.master_produk?.satuan || '', '', qty];
    });

    drawCountingSheetCopy(doc, 8, header, rows, dcNama, session, sectorRow);

    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(6, halfH, pageW - 6, halfH);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    doc.text('- - - - -  GUNTING DI SINI  - - - - -', pageW / 2, halfH - 1.5, { align: 'center' });

    drawCountingSheetCopy(doc, halfH + 8, header, rows, dcNama, session, sectorRow);

    const dcFileNama = dcNama.replace(/\s+/g, '_') || 'DC';
    const sessionFileNama = (session.nama || 'sesi').replace(/\s+/g, '_');
    const sectorFileNama = (sectorRow.nama || 'sector').replace(/\s+/g, '_');
    doc.save(`CountingSheet_${dcFileNama}_${sessionFileNama}_${sectorFileNama}.pdf`);
  } catch(err){
    console.error('Gagal generate PDF counting sheet:', err);
    alert('Gagal bikin PDF: ' + (err.message || err));
  }
}

function drawCountingSheetCopy(doc, startY, header, rows, dcNama, session, sector){
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`${dcNama} · Sector ${sector.nama}`, 8, startY);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(11);
  doc.text(`Sesi: ${session.nama}  ·  Tanggal: ${formatTanggal(session.tanggal)}`, 8, startY + 6);

  doc.autoTable({
    head: [header],
    body: rows,
    startY: startY + 9,
    margin: { left: 6, right: 6 },
    styles: { fontSize: 11, cellPadding: 2.2, valign: 'middle', lineColor: [0,0,0], lineWidth: 0.2 },
    theme: 'grid',
    headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', fontSize: 11.5, lineColor: [0,0,0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 29, halign: 'center' },
      6: { cellWidth: 29, halign: 'center' },
    },
  });
}

function updateSessionNameLabels(){
  const s = state.sessions.find(x => x.id === state.activeSessionId);
  const label = s ? `Sesi: <b>${s.nama}</b>` : '';
  el('zonaSessionLabel').innerHTML = label;
  el('sessionNameLabel').innerHTML = label;
  el('allDcSessionHint').innerHTML = label;
}

async function openSession(id){
  state.activeSessionId = id;
  await loadEntries();
  updateSessionNameLabels();

  const session = state.sessions.find(x => x.id === id);
  const dcId = session ? session.dc_id : state.currentDc.id;

  el('zonaDcName').innerHTML = `<div class="mark"><i class="ti ${state.currentDc.icon||'ti-box'}"></i></div>${state.currentDc.nama} · ${state.currentDc.sub||''}`;
  el('userChip2').innerHTML = el('userChip').innerHTML;

  hide('sessionListScreen');
  await loadZones(dcId);
  renderZonaGrid();
  show('zonaScreen');
}

async function loadZones(dcId){
  const { data, error } = await sb.from('zones').select('*').eq('dc_id', dcId).order('nama');
  if(error){
    console.error('Gagal muat zones:', error);
    state.zonesList = [];
    return;
  }
  state.zonesList = data || [];
}

function renderZonaGrid(){
  if(!state.zonesList.length){
    el('zonaGrid').innerHTML = '';
    show('emptyZonaListMsg');
    return;
  }
  hide('emptyZonaListMsg');

  el('zonaGrid').innerHTML = state.zonesList.map(z => `
    <button class="zona-card" data-zona="${z.id}">
      <span class="zona-name">${z.nama}</span>
      <span class="zona-meta">
        <span><i class="ti ti-calendar"></i> ${formatTanggal(z.created_at)}</span>
      </span>
    </button>
  `).join('');

  document.querySelectorAll('[data-zona]').forEach(tile => {
    tile.onclick = () => openZona(tile.getAttribute('data-zona'));
  });
}

async function openZona(zonaId){
  const zona = state.zonesList.find(z => z.id === zonaId);
  state.currentZonaId = zonaId;
  state.currentZona = zona ? zona.nama : '';
  state.sectorFilter = '';
  state.viewAllDc = false;

  el('dashDcName').innerHTML = `<div class="mark"><i class="ti ${state.currentDc.icon||'ti-box'}"></i></div>${state.currentDc.nama} · Zona ${state.currentZona}`;
  el('backBtn').innerHTML = '<i class="ti ti-arrow-left"></i> Zona lain';
  el('switchViewBtn').classList.remove('is-all');
  el('userChip6').innerHTML = el('userChip').innerHTML;
  hide('allDcHeader');
  show('sessionBar');
  el('searchInput').value = '';
  state.searchQuery = '';
  state.dashboardPage = 1;

  hide('zonaScreen');
  show('dashboardScreen');
  setSync(false, 'memuat...');

  await loadProdukForZona(zonaId);
  renderSectorFilterOptions();
  renderDashboard();
  subscribeRealtime();
  setSync(true, 'tersambung');
}

async function switchToAllDcView(){
  state.viewAllDc = true;
  state.currentZonaId = null;
  state.currentZona = '';
  state.sectorFilter = '';

  el('dashDcName').innerHTML = `<div class="mark"><i class="ti ${state.currentDc.icon||'ti-box'}"></i></div>${state.currentDc.nama} · ${state.currentDc.sub||''}`;
  el('backBtn').innerHTML = '<i class="ti ti-arrow-left"></i> Sesi lain';
  el('switchViewBtn').classList.add('is-all');
  el('userChip6').innerHTML = el('userChip').innerHTML;
  hide('sessionBar');
  show('allDcHeader');
  updateSessionNameLabels();
  el('searchInput').value = '';
  state.searchQuery = '';
  state.dashboardPage = 1;

  hide('zonaScreen');
  show('dashboardScreen');
  setSync(false, 'memuat...');

  await loadProdukForDc(state.currentDc.id);
  renderSectorFilterOptions();
  renderDashboard();
  subscribeRealtime();
  setSync(true, 'tersambung');
}

el('switchViewFromZonaBtn').onclick = () => switchToAllDcView();

el('switchViewBtn').onclick = () => {
  if(state.viewAllDc){

    if(state.realtimeChannel){ sb.removeChannel(state.realtimeChannel); state.realtimeChannel = null; }
    state.viewAllDc = false;
    el('switchViewBtn').classList.remove('is-all');
    hide('dashboardScreen');
    show('zonaScreen');
  } else {
    switchToAllDcView();
  }
};