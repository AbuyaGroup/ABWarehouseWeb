// =========================================================
// SESSION REVIEW -- revisi qty final sebelum sesi ditutup
// =========================================================
async function openSessionReview(sessionId){
  const session = state.sessions.find(x => x.id === sessionId);
  if(!session) return;

  state.reviewSessionId = sessionId;
  state.reviewRows = [];
  el('reviewSessionName').innerHTML = `<div class="mark"><i class="ti ti-clipboard-check"></i></div>${session.nama}`;
  el('userChip5').innerHTML = el('userChip').innerHTML;
  el('reviewTableBody').innerHTML = '';
  hide('emptyReviewMsg');
  el('confirmReviewBtn').disabled = true;

  hide('sessionListScreen');
  show('sessionReviewScreen');

  try {
    // Entries hasil scan buat sesi ini, sekalian detail produk & sector-nya.
    // sector_id sekarang ada langsung di opname_entries, jadi gak perlu lagi
    // nebak sector lewat produk_sectors (satu barcode bisa ada di > 1 sector,
    // makanya harus liat sector_id di entry-nya masing-masing).
    const { data: entriesData, error: entriesErr } = await sb
      .from('opname_entries')
      .select('id, barcode, sector_id, qty_fisik, master_produk(nama, satuan), sectors(nama), updated_at')
      .eq('session_id', sessionId)
      // Diurutin ascending updated_at, bukan barcode -- soalnya kalau ada
      // > 1 row buat barcode+sector yang sama (misal: scan ulang di waktu
      // lain -- uploadEntries() di app insert row baru, bukan update yang
      // lama), dedupe di bawah butuh row PALING BARU diproses terakhir
      // biar itu yang menang overwrite.
      .order('updated_at', { ascending: true });
    if(entriesErr) throw entriesErr;

    if(!entriesData || !entriesData.length){
      show('emptyReviewMsg');
      return;
    }

    // Dedupe per barcode+sector -- kalau gak di-dedupe, barcode yang
    // ke-scan ulang bakal muncul 2x di tabel review DAN ke-double-count pas
    // ditulis ke opname_final waktu sesi dikonfirmasi selesai.
    const dedupedByKey = {};
    entriesData.forEach(e => {
      dedupedByKey[`${e.barcode}|${e.sector_id}`] = e;
    });

    // Agregasi lanjut per barcode -- kalau produk yang sama ke-assign ke
    // beberapa sector (misal ke-scan di A01 & A02), qty-nya DIJUMLAHIN jadi
    // satu baris per produk. opname_final sendiri emang gak nyimpen sector_id,
    // jadi lebih benar diagregasi dari sini (bukan nunggu pas export doang).
    const aggByBarcode = {};
    Object.values(dedupedByKey).forEach(e => {
      if(!aggByBarcode[e.barcode]){
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
      if(!agg.sectorNamas.includes(sectorNama)) agg.sectorNamas.push(sectorNama);
      agg.qtyCounting += Number(e.qty_fisik) || 0;
    });

    state.reviewRows = Object.values(aggByBarcode)
      .sort((a, b) => a.barcode.localeCompare(b.barcode))
      .map(agg => ({
        barcode: agg.barcode,
        nama: agg.nama,
        satuan: agg.satuan,
        sectorNama: agg.sectorNamas.join(', '),
        qtyCounting: agg.qtyCounting,
      }));

    renderReviewTable();
  } catch(err){
    console.error('Gagal muat data review:', err);
    alert('Gagal muat data review: ' + (err.message || err));
  } finally {
    el('confirmReviewBtn').disabled = !(state.reviewRows && state.reviewRows.length);
  }
}

function renderReviewTable(){
  el('reviewTableBody').innerHTML = state.reviewRows.map((row, idx) => `
    <tr>
      <td>${row.nama}</td>
      <td>${row.barcode}</td>
      <td>${row.sectorNama}</td>
      <td class="num">${row.satuan}</td>
      <td class="num">${row.qtyCounting}</td>
      <td class="num">
        <input type="number" step="any" class="qty-final-input" data-idx="${idx}" value="${row.qtyCounting}">
      </td>
    </tr>
  `).join('');

  el('reviewTableBody').querySelectorAll('.qty-final-input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = Number(input.getAttribute('data-idx'));
      const original = state.reviewRows[idx].qtyCounting;
      const changed = input.value === '' || Number(input.value) !== Number(original);
      input.classList.toggle('changed', changed);
    });
  });
}

function closeSessionReview(){
  state.reviewSessionId = null;
  state.reviewRows = [];
  hide('sessionReviewScreen');
  show('sessionListScreen');
}

el('backFromReviewBtn').onclick = () => closeSessionReview();
el('cancelReviewBtn').onclick = () => closeSessionReview();
el('logoutBtn5').onclick = () => forceLogout();

el('confirmReviewBtn').onclick = async () => {
  if(!state.reviewSessionId || !state.reviewRows.length) return;

  const authorizedBy = state.session?.user?.id;
  if(!authorizedBy){
    alert('Sesi login gak valid, coba login ulang.');
    return;
  }

  const confirmed = confirm(
    'Yakin mau konfirmasi & tandai sesi ini SELESAI? Qty final bakal disimpen ke opname_final dan sesi ini gak bisa discan lagi kecuali diaktifin ulang.'
  );
  if(!confirmed) return;

  const btn = el('confirmReviewBtn');
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Menyimpan...';

  try {
    // Baca ulang nilai Qty Final dari tiap input, biar dapet nilai paling baru
    el('reviewTableBody').querySelectorAll('.qty-final-input').forEach(input => {
      const idx = Number(input.getAttribute('data-idx'));
      state.reviewRows[idx].qtyFinal = input.value === '' ? 0 : Number(input.value);
    });

    // Qty final (hasil review/revisi admin) disimpen ke opname_final --
    // BUKAN nulis balik ke opname_entries, biar data mentah hasil scan
    // (opname_entries) tetep utuh sebagai arsip, terpisah dari angka yang
    // udah di-otorisasi admin.
    const payload = state.reviewRows.map(row => ({
      session_id: state.reviewSessionId,
      barcode: row.barcode,
      qty_final: row.qtyFinal,
      authorized_by: authorizedBy,
    }));

    const { error: insertErr } = await sb.from('opname_final').insert(payload);
    if(insertErr) throw insertErr;

    // Tandai sesi selesai
    const { error: statusErr } = await sb
      .from('opname_sessions').update({ status: 'selesai' }).eq('id', state.reviewSessionId);
    if(statusErr) throw statusErr;

    await loadSessions(state.currentDc.id);
    closeSessionReview();
    renderSessionList();
  } catch(err){
    console.error('Gagal konfirmasi sesi:', err);
    alert('Gagal konfirmasi: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
};

