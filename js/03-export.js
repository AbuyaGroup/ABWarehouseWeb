// =========================================================
// MODAL: EXPORT SESI
// =========================================================
// Sesi AKTIF -> cuma boleh export Counting 1 (PDF), soalnya opname_final
// baru keisi setelah sesi dikonfirmasi selesai lewat halaman review.
// Sesi SELESAI -> boleh export dua-duanya.
function openExportModal(session){
  state.exportingSession = session;
  const isSelesai = session.status === 'selesai';

  el('exportModalDesc').textContent = `Sesi "${session.nama}"`;

  const xlsxBtn = el('exportOptionXlsx');
  xlsxBtn.disabled = !isSelesai;
  el('exportOptionXlsxDesc').textContent = isSelesai
    ? 'Qty final hasil otorisasi admin'
    : 'Tersedia setelah sesi ditandai Selesai';

  showExportOptionsStep();
  show('exportModal');
}

function closeExportModal(){
  hide('exportModal');
  state.exportingSession = null;
}

function showExportOptionsStep(){
  show('exportOptionsStep');
  hide('exportPdfStep');
}

function showExportPdfStep(){
  hide('exportOptionsStep');
  show('exportPdfStep');
}

el('exportModalCancel').onclick = closeExportModal;
el('exportModal').addEventListener('click', e => {
  if(e.target.id === 'exportModal') closeExportModal();
});

// Counting 1 (PDF) sekarang minta pilih Zona dulu, baru Sector, sebelum
// PDF-nya digenerate -- soalnya satu DC bisa punya banyak zona/sector dan
// biasanya yang mau dicetak cuma satu sector aja per print.
el('exportOptionPdf').onclick = async () => {
  if(!state.exportingSession) return;
  const dcId = state.exportingSession.dc_id;

  const zonaSelect = el('exportZonaSelect');
  const sectorSelect = el('exportSectorSelect');
  zonaSelect.innerHTML = '<option value="">Memuat zona...</option>';
  sectorSelect.innerHTML = '<option value="">-</option>';
  showExportPdfStep();

  const { data: zonesData, error } = await sb
    .from('zones').select('id, nama').eq('dc_id', dcId).order('nama');

  if(error){
    alert('Gagal muat daftar zona: ' + error.message);
    showExportOptionsStep();
    return;
  }
  if(!zonesData || !zonesData.length){
    alert('Belum ada zona yang terdaftar buat DC ini.');
    showExportOptionsStep();
    return;
  }

  zonaSelect.innerHTML = zonesData.map(z => `<option value="${z.id}">${z.nama}</option>`).join('');
  await loadSectorOptionsForExport(zonaSelect.value);
};

el('exportZonaSelect').addEventListener('change', (e) => {
  loadSectorOptionsForExport(e.target.value);
});

// Isi dropdown Sector berdasarkan Zona yang lagi dipilih di step PDF.
async function loadSectorOptionsForExport(zonaId){
  const sectorSelect = el('exportSectorSelect');
  if(!zonaId){
    sectorSelect.innerHTML = '<option value="">-</option>';
    return;
  }
  sectorSelect.innerHTML = '<option value="">Memuat sector...</option>';

  const { data, error } = await sb
    .from('sectors').select('id, nama').eq('zone_id', zonaId).order('nama');

  if(error){
    sectorSelect.innerHTML = '<option value="">Gagal muat sector</option>';
    return;
  }
  if(!data || !data.length){
    sectorSelect.innerHTML = '<option value="">Belum ada sector di zona ini</option>';
    return;
  }
  sectorSelect.innerHTML = data.map(s => `<option value="${s.id}">${s.nama}</option>`).join('');
}

el('exportPdfBack').onclick = showExportOptionsStep;

el('exportPdfConfirm').onclick = async () => {
  if(!state.exportingSession) return;
  const sectorId = el('exportSectorSelect').value;
  if(!sectorId){ alert('Pilih sector dulu.'); return; }

  const sessionId = state.exportingSession.id;
  const btn = el('exportPdfConfirm');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Membuat PDF...';

  await printSessionPdf(sessionId, sectorId);

  btn.disabled = false;
  btn.textContent = originalLabel;
  closeExportModal();
};

el('exportOptionXlsx').onclick = () => {
  if(!state.exportingSession || el('exportOptionXlsx').disabled) return;
  const session = state.exportingSession;
  closeExportModal();
  exportSoTemplateXlsx(session);
};

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD8DEE9' } },
  left: { style: 'thin', color: { argb: 'FFD8DEE9' } },
  bottom: { style: 'thin', color: { argb: 'FFD8DEE9' } },
  right: { style: 'thin', color: { argb: 'FFD8DEE9' } },
};

// SO Template (Excel) -- sumbernya opname_final (qty yang UDAH diotorisasi
// admin lewat halaman review), bukan opname_entries. Makanya cuma tersedia
// buat sesi yang statusnya udah 'selesai' (karena opname_final baru keisi
// pas admin confirm di halaman review).
async function exportSoTemplateXlsx(session){
  try {
    const { data: finalData, error: finalErr } = await sb
      .from('opname_final')
      .select('barcode, qty_final, authorized_at, master_produk(nama, kode_produk, kategori, sub_kategori, satuan)')
      .eq('session_id', session.id)
      .order('authorized_at', { ascending: false });
    if(finalErr) throw finalErr;

    if(!finalData || !finalData.length){
      alert('Belum ada data qty final buat sesi ini (opname_final masih kosong).');
      return;
    }

    // Kalau sesi ini pernah di-confirm lebih dari sekali, cuma ambil batch
    // confirm yang PALING BARU (semua baris dari 1x confirm punya
    // authorized_at yang sama persis, karena di-insert dalam 1 request/
    // transaksi). Batch lama dibuang biar gak dobel/basi.
    const latestAuthorizedAt = finalData[0].authorized_at;
    const latestBatch = finalData.filter(row => row.authorized_at === latestAuthorizedAt);

    // Satu barcode bisa punya lebih dari 1 baris di batch itu (kehitung di
    // beberapa sector sekaligus -- opname_final sendiri gak nyimpen sector_id),
    // jadi qty_final-nya dijumlahin per barcode buat dapet total per produk.
    const totalsByBarcode = {};
    latestBatch.forEach(row => {
      if(!totalsByBarcode[row.barcode]){
        totalsByBarcode[row.barcode] = { qty: 0, master_produk: row.master_produk };
      }
      totalsByBarcode[row.barcode].qty += Number(row.qty_final) || 0;
    });
    const rows = Object.entries(totalsByBarcode)
      .map(([barcode, v]) => ({ barcode, qty_final: v.qty, master_produk: v.master_produk }))
      .sort((a, b) => a.barcode.localeCompare(b.barcode));

    const header = ['No', 'Product Name', 'Product Code', 'Category', 'Sub Category', 'Unit', 'Opname Qty', 'Opname Value'];
    const dcNama = state.currentDc?.nama || '';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.columns = [
      { width: 5 }, { width: 32 }, { width: 14 }, { width: 12 },
      { width: 16 }, { width: 8 }, { width: 12 }, { width: 14 },
    ];

    sheet.mergeCells(1, 1, 1, header.length);
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Stock Opname Template';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF0C467C' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    sheet.addRow([]); // baris kosong pemisah (row 2)

    const headerRow = sheet.addRow(header);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C467C' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    });
    headerRow.height = 20;

    let no = 1;
    rows.forEach(row => {
      const p = row.master_produk || {};
      const qty = row.qty_final ?? 0;
      const value = 0; // belum ada data harga per produk, defaultnya 0 (bukan kosong)

      const r = sheet.addRow([no, p.nama || '(produk tak dikenal)', p.kode_produk || '', p.kategori || '', p.sub_kategori || '', p.satuan || '', qty, value]);
      r.eachCell((cell, colNumber) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: (colNumber === 1 || colNumber === 6 || colNumber === 7 || colNumber === 8) ? 'center' : 'left' };
        if(no % 2 === 0){
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } };
        }
      });
      no++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dcNama.replace(/\s+/g, '_')}_${session.nama.replace(/\s+/g, '_')}_SO_Template.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Gagal export SO Template:', err);
    alert('Gagal export SO Template: ' + (err.message || err));
  }
}

el('deleteModalConfirm').onclick = async () => {
  const id = state.deletingSessionId;
  if(!id) return;

  el('deleteModalConfirm').disabled = true;
  el('deleteModalConfirm').textContent = 'Menghapus...';

  // .select() dipakai di sini bukan buat datanya, tapi biar kita bisa tau
  // beneran ke-delete apa nggak. Supabase RLS itu KHUSUS: kalau policy DELETE
  // nge-block, gak ada error yang balik -- row-nya cuma "difilter" diem-diem
  // dan hasilnya keliatan "sukses" padahal 0 baris yang kehapus.
  const { data: entriesData, error: entriesErr } = await sb
    .from('opname_entries').delete().eq('session_id', id).select();
  if(entriesErr){
    console.error('Delete opname_entries error:', entriesErr);
    alert(`Gagal hapus data opname di sesi ini.\n\n${entriesErr.message}\ncode: ${entriesErr.code || '-'}`);
    el('deleteModalConfirm').disabled = false;
    el('deleteModalConfirm').textContent = 'Hapus';
    return;
  }

  const { data: sessionData, error } = await sb
    .from('opname_sessions').delete().eq('id', id).select();
  if(error){
    console.error('Delete opname_sessions error:', error);
    alert(`Gagal hapus sesi.\n\n${error.message}\ncode: ${error.code || '-'}`);
    el('deleteModalConfirm').disabled = false;
    el('deleteModalConfirm').textContent = 'Hapus';
    return;
  }

  if(!sessionData || sessionData.length === 0){
    // Ini kasus RLS-nya diem-diem block: gak ada error, tapi juga gak ada
    // baris yang kehapus.
    console.warn('Delete returned 0 rows -- kemungkinan besar RLS policy DELETE di opname_sessions gak ngizinin role ini.');
    alert('Sesi gak berhasil kehapus. Kemungkinan besar akun ini gak punya izin (RLS policy) buat hapus data di tabel opname_sessions. Cek policy DELETE di Supabase dashboard buat tabel opname_sessions & opname_entries.');
    el('deleteModalConfirm').disabled = false;
    el('deleteModalConfirm').textContent = 'Hapus';
    return;
  }

  if(state.activeSessionId === id) state.activeSessionId = null;
  await loadSessions(state.currentDc.id);
  renderSessionList();
  closeDeleteModal();
};

async function toggleSessionStatus(id){
  const s = state.sessions.find(x => x.id === id);
  if(!s) return;
  const newStatus = s.status === 'aktif' ? 'selesai' : 'aktif';

  const { error } = await sb.from('opname_sessions').update({ status: newStatus }).eq('id', id);
  if(error){ alert('Gagal update status: ' + error.message); return; }

  await loadSessions(state.currentDc.id);
  renderSessionList();
}

