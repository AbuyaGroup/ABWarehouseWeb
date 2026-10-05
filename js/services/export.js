const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD8DEE9' } },
  left: { style: 'thin', color: { argb: 'FFD8DEE9' } },
  bottom: { style: 'thin', color: { argb: 'FFD8DEE9' } },
  right: { style: 'thin', color: { argb: 'FFD8DEE9' } },
};

async function exportSoTemplateXlsx(session) {
  try {
    const { data: finalData, error: finalErr } = await sb
      .from('opname_final')
      .select('barcode, qty_final, authorized_at, master_produk(nama, kode_produk, kategori, sub_kategori, satuan)')
      .eq('session_id', session.id)
      .order('authorized_at', { ascending: false });
    if (finalErr) throw finalErr;

    if (!finalData || !finalData.length) {
      toast('Belum ada data qty final buat sesi ini (opname_final masih kosong).', 'warn');
      return;
    }

    const latestAuthorizedAt = finalData[0].authorized_at;
    const latestBatch = finalData.filter(row => row.authorized_at === latestAuthorizedAt);

    const totalsByBarcode = {};
    latestBatch.forEach(row => {
      if (!totalsByBarcode[row.barcode]) totalsByBarcode[row.barcode] = { qty: 0, master_produk: row.master_produk };
      totalsByBarcode[row.barcode].qty += Number(row.qty_final) || 0;
    });
    const rows = Object.entries(totalsByBarcode)
      .map(([barcode, v]) => ({ barcode, qty_final: v.qty, master_produk: v.master_produk }))
      .sort((a, b) => a.barcode.localeCompare(b.barcode));

    const header = ['No', 'Product Name', 'Product Code', 'Category', 'Sub Category', 'Unit', 'Opname Qty', 'Opname Value'];
    const dcNama = Store.currentDc?.nama || '';

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

    sheet.addRow([]);

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
      const value = 0;

      const r = sheet.addRow([no, p.nama || '(produk tak dikenal)', p.kode_produk || '', p.kategori || '', p.sub_kategori || '', p.satuan || '', qty, value]);
      r.eachCell((cell, colNumber) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: (colNumber === 1 || colNumber === 6 || colNumber === 7 || colNumber === 8) ? 'center' : 'left' };
        if (no % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } };
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
    toast('Gagal export SO Template: ' + (err.message || err));
  }
}

async function printSessionPdf(sessionId, sectorId) {
  const session = Store.sessions.find(x => x.id === sessionId);
  if (!session) return;
  if (!sectorId) { toast('Pilih sector dulu.', 'warn'); return; }

  try {
    const { data: sectorRow, error: sectorErr } = await sb
      .from('sectors').select('id, nama, zone_id').eq('id', sectorId).maybeSingle();
    if (sectorErr) throw sectorErr;
    if (!sectorRow) { toast('Sector gak ketemu.'); return; }

    const { data: psData, error: psErr } = await sb
      .from('produk_sectors')
      .select('barcode, sector_id, master_produk(nama, satuan)')
      .eq('sector_id', sectorId);
    if (psErr) throw psErr;
    if (!psData || !psData.length) { toast('Belum ada produk yang ke-assign ke sector ini (tabel produk_sectors).', 'warn'); return; }

    const { data: entriesData, error: entriesErr } = await sb
      .from('opname_entries')
      .select('barcode, sector_id, qty_fisik, updated_by, profiles(nama)')
      .eq('session_id', sessionId)
      .eq('sector_id', sectorId);
    if (entriesErr) throw entriesErr;

    const entriesByKey = {};
    (entriesData || []).forEach(e => { entriesByKey[`${e.barcode}|${e.sector_id}`] = e; });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297;
    const halfH = pageH / 2;
    const header = ['Scanner', 'Sector', 'Sequence', 'Nama Produk', 'Unit', 'Counting 2', 'Counting 1'];
    const dcNama = Store.currentDc?.nama || '';

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
  } catch (err) {
    console.error('Gagal generate PDF counting sheet:', err);
    toast('Gagal bikin PDF: ' + (err.message || err));
  }
}

function drawCountingSheetCopy(doc, startY, header, rows, dcNama, session, sector) {
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
    styles: { fontSize: 11, cellPadding: 2.2, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.2 },
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 11.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
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

async function loadSectorOptionsForExport(zonaId) {
  if (!zonaId) return [];
  const { data, error } = await sb.from('sectors').select('id, nama').eq('zone_id', zonaId).order('nama');
  if (error) return [];
  return data || [];
}

async function loadZonaOptionsForExport(dcId) {
  const { data, error } = await sb.from('zones').select('id, nama').eq('dc_id', dcId).order('nama');
  if (error) return { error: 'Gagal muat daftar zona: ' + error.message };
  if (!data || !data.length) return { error: 'Belum ada zona yang terdaftar buat DC ini.', warn: true };
  return { data };
}
