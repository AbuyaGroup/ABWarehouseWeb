const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const IMPORT_CHUNK = 500;

const IMPORT_COLUMNS = [
  { key: 'dc_id', label: 'DC ID', width: 12, aliases: ['dcid', 'iddc'] },
  { key: 'dc_nama', label: 'DC Nama', width: 18, aliases: ['dcnama', 'namadc', 'dc'] },
  { key: 'dc_sub', label: 'DC Sub-judul', width: 18, aliases: ['dcsubjudul', 'dcsub', 'subjudul', 'dclokasi'] },
  { key: 'zona_id', label: 'Zona ID', width: 14, aliases: ['zonaid', 'idzona', 'zoneid'] },
  { key: 'zona_nama', label: 'Zona Nama', width: 16, aliases: ['zonanama', 'namazona', 'zona', 'zone'] },
  { key: 'sector_id', label: 'Sector ID', width: 16, aliases: ['sectorid', 'idsector', 'sektorid'] },
  { key: 'sector_nama', label: 'Sector Nama', width: 14, aliases: ['sectornama', 'namasector', 'sector', 'sektor'] },
  { key: 'barcode', label: 'Barcode', width: 16, aliases: ['barcode', 'kodebarcode'] },
  { key: 'produk_nama', label: 'Nama Produk', width: 30, aliases: ['namaproduk', 'produknama', 'produk', 'productname'] },
  { key: 'kode_produk', label: 'Kode Produk', width: 14, aliases: ['kodeproduk', 'productcode'] },
  { key: 'kategori', label: 'Kategori', width: 14, aliases: ['kategori', 'category'] },
  { key: 'sub_kategori', label: 'Sub Kategori', width: 16, aliases: ['subkategori', 'subcategory'] },
  { key: 'satuan', label: 'Satuan', width: 10, aliases: ['satuan', 'unit'] },
];

function normHeader(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('').trim();
    if (v.text !== undefined) return cellText(v.text);
    if (v.result !== undefined) return cellText(v.result);
    return '';
  }
  return String(v).trim();
}

function safeFileName(s) { return String(s || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_'); }

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function styleHeaderRow(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF223BAE' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = THIN_BORDER;
  });
  row.height = 20;
}

function addTableSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map(c => ({ width: c.width || 14 }));
  styleHeaderRow(sheet.addRow(columns.map(c => c.label)));
  rows.forEach(r => {
    const row = sheet.addRow(r);
    row.eachCell({ includeEmpty: true }, cell => { cell.border = THIN_BORDER; });
  });
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchIn(table, select, field, values, extra) {
  const rows = [];
  for (const part of chunk(values, 150)) {
    const { data, error } = await fetchAllRows(() => {
      let q = sb.from(table).select(select).in(field, part);
      if (extra) q = extra(q);
      return q;
    });
    if (error) return { data: null, error };
    rows.push(...data);
  }
  return { data: rows, error: null };
}

async function loadDcStructure(dcId) {
  const { data: zones, error: zErr } = await sb.from('zones').select('id, nama, dc_id').eq('dc_id', dcId).order('nama');
  if (zErr) throw zErr;
  const zoneIds = (zones || []).map(z => z.id);
  let sectors = [];
  if (zoneIds.length) {
    const res = await fetchIn('sectors', 'id, nama, zone_id', 'zone_id', zoneIds, q => q.order('id'));
    if (res.error) throw res.error;
    sectors = res.data;
  }
  let produkSectors = [];
  if (sectors.length) {
    const res = await fetchIn('produk_sectors', 'id, barcode, sector_id, sequence, master_produk(nama, kode_produk, kategori, sub_kategori, satuan)', 'sector_id', sectors.map(s => s.id), q => q.order('id'));
    if (res.error) throw res.error;
    produkSectors = res.data;
  }
  return { zones: zones || [], sectors, produkSectors };
}

function buildStructureRows(dc, { zones, sectors, produkSectors }) {
  const byName = (a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id', { numeric: true });
  const rows = [];
  const dcCols = [dc.id, dc.nama, dc.sub || ''];
  if (!zones.length) rows.push([...dcCols, '', '', '', '', '', '', '', '', '', '']);
  [...zones].sort(byName).forEach(z => {
    const zSectors = sectors.filter(s => s.zone_id === z.id).sort(byName);
    if (!zSectors.length) rows.push([...dcCols, z.id, z.nama, '', '', '', '', '', '', '', '']);
    zSectors.forEach(s => {
      const items = produkSectors.filter(ps => ps.sector_id === s.id)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || String(a.barcode).localeCompare(String(b.barcode)));
      if (!items.length) rows.push([...dcCols, z.id, z.nama, s.id, s.nama, '', '', '', '', '', '']);
      items.forEach(ps => {
        const p = ps.master_produk || {};
        rows.push([...dcCols, z.id, z.nama, s.id, s.nama, ps.barcode, p.nama || '', p.kode_produk || '', p.kategori || '', p.sub_kategori || '', p.satuan || '']);
      });
    });
  });
  return rows;
}

async function exportDcData(dc, { includeSessions = true, sessionIds = null } = {}) {
  const structure = await loadDcStructure(dc.id);
  const zoneById = Object.fromEntries(structure.zones.map(z => [z.id, z]));
  const sectorById = Object.fromEntries(structure.sectors.map(s => [s.id, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Abuya Inventory';
  workbook.created = new Date();

  const structureRows = buildStructureRows(dc, structure);
  addTableSheet(workbook, 'Struktur', IMPORT_COLUMNS, structureRows);

  const summary = {
    zona: structure.zones.length,
    sector: structure.sectors.length,
    produk: new Set(structure.produkSectors.map(p => p.barcode)).size,
    penempatan: structure.produkSectors.length,
    sesi: 0,
    entri: 0,
  };

  if (includeSessions) {
    const { data: sessionsData, error: sErr } = await sb.from('opname_sessions').select('*').eq('dc_id', dc.id).order('tanggal', { ascending: false });
    if (sErr) throw sErr;
    const sessions = (sessionsData || []).filter(s => !sessionIds || sessionIds.includes(s.id));
    summary.sesi = sessions.length;

    addTableSheet(workbook, 'Sesi', [
      { label: 'Sesi ID', width: 38 }, { label: 'Nama Sesi', width: 32 }, { label: 'Tanggal', width: 12 },
      { label: 'Status', width: 10 }, { label: 'Dibuat', width: 20 },
    ], sessions.map(s => [s.id, s.nama, (s.tanggal || '').slice(0, 10), s.status, s.created_at ? new Date(s.created_at).toLocaleString('id-ID') : '']));

    const sessionById = Object.fromEntries(sessions.map(s => [s.id, s]));
    const ids = sessions.map(s => s.id);
    let entries = [];
    let finals = [];
    if (ids.length) {
      const eRes = await fetchIn('opname_entries', 'id, session_id, barcode, sector_id, qty_fisik, updated_by, updated_at, master_produk(nama, satuan), profiles(nama)', 'session_id', ids, q => q.order('updated_at', { ascending: true }));
      if (eRes.error) throw eRes.error;
      const latest = {};
      eRes.data.forEach(e => { latest[`${e.session_id}|${e.barcode}|${e.sector_id}`] = e; });
      entries = Object.values(latest);

      const fRes = await fetchIn('opname_final', 'session_id, barcode, qty_final, authorized_at, master_produk(nama, kode_produk, satuan)', 'session_id', ids, q => q.order('authorized_at', { ascending: true }));
      if (fRes.error) throw fRes.error;
      const latestBatch = {};
      fRes.data.forEach(f => {
        const cur = latestBatch[f.session_id];
        if (!cur || f.authorized_at > cur) latestBatch[f.session_id] = f.authorized_at;
      });
      const agg = {};
      fRes.data.filter(f => f.authorized_at === latestBatch[f.session_id]).forEach(f => {
        const k = `${f.session_id}|${f.barcode}`;
        if (!agg[k]) agg[k] = { ...f, qty_final: 0 };
        agg[k].qty_final += Number(f.qty_final) || 0;
      });
      finals = Object.values(agg);
    }
    summary.entri = entries.length;

    entries.sort((a, b) => {
      const sa = sessionById[a.session_id]?.nama || '', sbn = sessionById[b.session_id]?.nama || '';
      const za = zoneById[sectorById[a.sector_id]?.zone_id]?.nama || '', zb = zoneById[sectorById[b.sector_id]?.zone_id]?.nama || '';
      return sa.localeCompare(sbn) || za.localeCompare(zb, 'id', { numeric: true })
        || String(sectorById[a.sector_id]?.nama || '').localeCompare(String(sectorById[b.sector_id]?.nama || ''), 'id', { numeric: true })
        || String(a.barcode).localeCompare(String(b.barcode));
    });

    addTableSheet(workbook, 'Hasil Opname', [
      { label: 'Sesi', width: 28 }, { label: 'Tanggal', width: 12 }, { label: 'Zona', width: 14 }, { label: 'Sector', width: 12 },
      { label: 'Barcode', width: 16 }, { label: 'Nama Produk', width: 30 }, { label: 'Satuan', width: 9 },
      { label: 'Qty Fisik', width: 10 }, { label: 'Diinput oleh', width: 18 }, { label: 'Waktu Input', width: 20 },
    ], entries.map(e => {
      const s = sessionById[e.session_id] || {};
      const sec = sectorById[e.sector_id];
      const z = sec ? zoneById[sec.zone_id] : null;
      return [s.nama || '', (s.tanggal || '').slice(0, 10), z?.nama || '', sec?.nama || e.sector_id, e.barcode,
        e.master_produk?.nama || '', e.master_produk?.satuan || '', e.qty_fisik ?? '', e.profiles?.nama || '',
        e.updated_at ? new Date(e.updated_at).toLocaleString('id-ID') : ''];
    }));

    finals.sort((a, b) => String(sessionById[a.session_id]?.nama || '').localeCompare(String(sessionById[b.session_id]?.nama || '')) || String(a.barcode).localeCompare(String(b.barcode)));
    addTableSheet(workbook, 'Qty Final', [
      { label: 'Sesi', width: 28 }, { label: 'Barcode', width: 16 }, { label: 'Nama Produk', width: 30 },
      { label: 'Kode Produk', width: 14 }, { label: 'Satuan', width: 9 }, { label: 'Qty Final', width: 10 }, { label: 'Dikonfirmasi', width: 20 },
    ], finals.map(f => [sessionById[f.session_id]?.nama || '', f.barcode, f.master_produk?.nama || '', f.master_produk?.kode_produk || '',
      f.master_produk?.satuan || '', f.qty_final, f.authorized_at ? new Date(f.authorized_at).toLocaleString('id-ID') : '']));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(workbook, `${safeFileName(dc.nama)}_Data_${stamp}.xlsx`);
  return summary;
}

async function downloadImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  addTableSheet(workbook, 'Import', IMPORT_COLUMNS, [
    ['dc-c', 'DC C', 'Surabaya', 'dc-c-z1', 'Zona 1', 'dc-c-z1-s1', 'S001', '8991234567890', 'Contoh Produk A', 'K001', 'FOOD', 'Snack', 'pcs'],
    ['dc-c', 'DC C', 'Surabaya', 'dc-c-z1', 'Zona 1', 'dc-c-z1-s1', 'S001', '8991234567891', 'Contoh Produk B', 'K002', 'FOOD', 'Minuman', 'pack'],
    ['dc-c', 'DC C', 'Surabaya', 'dc-c-z1', 'Zona 1', 'dc-c-z1-s2', 'S002', '', '', '', '', '', ''],
    ['dc-c', 'DC C', 'Surabaya', 'dc-c-z2', 'Zona 2', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '8991234567892', 'Produk tanpa sector', '', 'NON FOOD', '', 'pcs'],
  ]);
  const guide = workbook.addWorksheet('Petunjuk');
  guide.columns = [{ width: 22 }, { width: 90 }];
  styleHeaderRow(guide.addRow(['Kolom', 'Keterangan']));
  [
    ['DC ID', 'Wajib kalau baris ini berisi Zona/Sector. ID unik huruf kecil, cth: dc-c. Kalau ID sudah ada, DC dipakai ulang.'],
    ['DC Nama', 'Wajib untuk DC baru.'],
    ['DC Sub-judul', 'Opsional, cth: lokasi DC.'],
    ['Zona ID / Zona Nama', 'Opsional. Zona ID harus unik di seluruh sistem. Zona Nama wajib untuk zona baru.'],
    ['Sector ID / Sector Nama', 'Opsional, butuh Zona. Sector ID harus unik. Sector Nama wajib untuk sector baru.'],
    ['Barcode', 'Opsional. Kalau diisi bareng Sector, produk otomatis ditempatkan di sector itu.'],
    ['Nama Produk', 'Wajib untuk barcode baru.'],
    ['Kode Produk, Kategori, Sub Kategori, Satuan', 'Opsional.'],
    ['', ''],
    ['Cara kerja', 'Data yang sudah ada tidak dihapus. Baris dengan ID/barcode yang sudah ada dilewati, kecuali opsi "Perbarui data yang sudah ada" dicentang.'],
    ['Tips', 'File hasil Export (sheet "Struktur") bisa langsung diedit lalu di-import lagi.'],
  ].forEach(r => { const row = guide.addRow(r); row.alignment = { wrapText: true, vertical: 'top' }; });
  await downloadWorkbook(workbook, 'Template_Import_Abuya_Inventory.xlsx');
}

async function parseImportFile(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet('Import') || workbook.getWorksheet('Struktur') || workbook.worksheets[0];
  if (!sheet) throw new Error('File kosong, nggak ada sheet yang bisa dibaca.');

  let headerRowNo = 0;
  let colMap = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const map = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const h = normHeader(cellText(cell.value));
      const def = IMPORT_COLUMNS.find(c => normHeader(c.label) === h || c.aliases.includes(h));
      if (def && !map[def.key]) map[def.key] = col;
    });
    if (Object.keys(map).length >= 2 && (map.dc_id || map.barcode)) { headerRowNo = r; colMap = map; break; }
  }
  if (!headerRowNo) throw new Error('Header kolom nggak ketemu. Pakai template import (kolom DC ID, Zona ID, Sector ID, Barcode, dst).');

  const rows = [];
  for (let r = headerRowNo + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rec = { _row: r };
    IMPORT_COLUMNS.forEach(c => { rec[c.key] = colMap[c.key] ? cellText(row.getCell(colMap[c.key]).value) : ''; });
    if (IMPORT_COLUMNS.every(c => !rec[c.key])) continue;
    rows.push(rec);
  }
  return { sheetName: sheet.name, rows, missingColumns: IMPORT_COLUMNS.filter(c => !colMap[c.key]).map(c => c.label) };
}

async function loadExistingForImport(rows) {
  const dcIds = [...new Set(rows.map(r => r.dc_id).filter(Boolean))];
  const zoneIds = [...new Set(rows.map(r => r.zona_id).filter(Boolean))];
  const sectorIds = [...new Set(rows.map(r => r.sector_id).filter(Boolean))];
  const barcodes = [...new Set(rows.map(r => r.barcode).filter(Boolean))];

  const [dcsRes, zonesRes, sectorsRes, produkRes, psRes, urutanRes] = await Promise.all([
    dcIds.length ? fetchIn('dcs', 'id, nama, sub', 'id', dcIds) : { data: [] },
    zoneIds.length ? fetchIn('zones', 'id, nama, dc_id', 'id', zoneIds) : { data: [] },
    sectorIds.length ? fetchIn('sectors', 'id, nama, zone_id', 'id', sectorIds) : { data: [] },
    barcodes.length ? fetchIn('master_produk', 'barcode, nama, kode_produk, kategori, sub_kategori, satuan', 'barcode', barcodes) : { data: [] },
    sectorIds.length ? fetchIn('produk_sectors', 'id, barcode, sector_id, sequence', 'sector_id', sectorIds) : { data: [] },
    sb.from('dcs').select('urutan'),
  ]);
  const err = [dcsRes, zonesRes, sectorsRes, produkRes, psRes, urutanRes].find(r => r.error);
  if (err) throw err.error;

  return {
    dcs: Object.fromEntries(dcsRes.data.map(d => [d.id, d])),
    zones: Object.fromEntries(zonesRes.data.map(z => [z.id, z])),
    sectors: Object.fromEntries(sectorsRes.data.map(s => [s.id, s])),
    produk: Object.fromEntries(produkRes.data.map(p => [String(p.barcode), p])),
    produkSectors: psRes.data,
    maxUrutan: Math.max(0, ...(urutanRes.data || []).map(d => Number(d.urutan) || 0)),
  };
}

function diffFields(existing, incoming, fields) {
  const patch = {};
  fields.forEach(f => {
    const v = incoming[f];
    if (v && String(existing[f] ?? '') !== v) patch[f] = v;
  });
  return Object.keys(patch).length ? patch : null;
}

async function buildImportPlan(rows, { updateExisting = false } = {}) {
  const existing = await loadExistingForImport(rows);
  const errors = [];
  const addError = (rowNo, msg) => errors.push({ row: rowNo, msg });

  const defs = { dc: new Map(), zone: new Map(), sector: new Map(), produk: new Map() };
  const merge = (kind, id, rowNo, values, labels) => {
    let d = defs[kind].get(id);
    if (!d) { d = { id, row: rowNo, v: {} }; defs[kind].set(id, d); }
    Object.entries(values).forEach(([k, val]) => {
      if (!val) return;
      if (!d.v[k]) { d.v[k] = val; d[`row_${k}`] = rowNo; return; }
      if (d.v[k] !== val) addError(rowNo, `${labels[k]} untuk "${id}" beda dengan baris ${d[`row_${k}`]} ("${d.v[k]}" vs "${val}").`);
    });
  };

  rows.forEach(row => {
    const { dc_id, zona_id, sector_id, barcode } = row;
    if (zona_id && !dc_id) { addError(row._row, `Zona "${zona_id}" butuh DC ID.`); return; }
    if (sector_id && !zona_id) { addError(row._row, `Sector "${sector_id}" butuh Zona ID.`); return; }
    if (!dc_id && !barcode) { addError(row._row, 'Isi minimal DC ID atau Barcode.'); return; }
    if (dc_id) merge('dc', dc_id, row._row, { nama: row.dc_nama, sub: row.dc_sub }, { nama: 'DC Nama', sub: 'DC Sub-judul' });
    if (zona_id) merge('zone', zona_id, row._row, { dc_id, nama: row.zona_nama }, { dc_id: 'DC', nama: 'Zona Nama' });
    if (sector_id) merge('sector', sector_id, row._row, { zone_id: zona_id, nama: row.sector_nama }, { zone_id: 'Zona', nama: 'Sector Nama' });
    if (barcode) merge('produk', barcode, row._row,
      { nama: row.produk_nama, kode_produk: row.kode_produk, kategori: row.kategori, sub_kategori: row.sub_kategori, satuan: row.satuan },
      { nama: 'Nama Produk', kode_produk: 'Kode Produk', kategori: 'Kategori', sub_kategori: 'Sub Kategori', satuan: 'Satuan' });
  });

  const plan = {
    dcs: new Map(), zones: new Map(), sectors: new Map(), produk: new Map(), placements: new Map(),
    dcUpdates: new Map(), zoneUpdates: new Map(), sectorUpdates: new Map(), produkUpdates: new Map(),
  };
  let urutan = existing.maxUrutan;

  defs.dc.forEach(d => {
    const ex = existing.dcs[d.id];
    if (ex) {
      if (updateExisting) { const patch = diffFields(ex, d.v, ['nama', 'sub']); if (patch) plan.dcUpdates.set(d.id, patch); }
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(d.id)) addError(d.row, `DC ID "${d.id}" cuma boleh huruf kecil, angka, - atau _.`);
    if (!d.v.nama) addError(d.row, `DC "${d.id}" belum ada, DC Nama wajib diisi.`);
    else plan.dcs.set(d.id, { id: d.id, nama: d.v.nama, sub: d.v.sub || null, urutan: ++urutan });
  });

  defs.zone.forEach(d => {
    const ex = existing.zones[d.id];
    if (ex) {
      if (ex.dc_id !== d.v.dc_id) addError(d.row, `Zona "${d.id}" sudah terdaftar di DC "${ex.dc_id}", bukan "${d.v.dc_id}".`);
      else if (updateExisting) { const patch = diffFields(ex, d.v, ['nama']); if (patch) plan.zoneUpdates.set(d.id, patch); }
      return;
    }
    if (!d.v.nama) addError(d.row, `Zona "${d.id}" belum ada, Zona Nama wajib diisi.`);
    else plan.zones.set(d.id, { id: d.id, nama: d.v.nama, dc_id: d.v.dc_id });
  });

  defs.sector.forEach(d => {
    const ex = existing.sectors[d.id];
    if (ex) {
      if (ex.zone_id !== d.v.zone_id) addError(d.row, `Sector "${d.id}" sudah terdaftar di zona "${ex.zone_id}", bukan "${d.v.zone_id}".`);
      else if (updateExisting) { const patch = diffFields(ex, d.v, ['nama']); if (patch) plan.sectorUpdates.set(d.id, patch); }
      return;
    }
    if (!d.v.nama) addError(d.row, `Sector "${d.id}" belum ada, Sector Nama wajib diisi.`);
    else plan.sectors.set(d.id, { id: d.id, nama: d.v.nama, zone_id: d.v.zone_id });
  });

  defs.produk.forEach(d => {
    const ex = existing.produk[d.id];
    if (ex) {
      if (updateExisting) {
        const patch = diffFields(ex, d.v, ['nama', 'kode_produk', 'kategori', 'sub_kategori', 'satuan']);
        if (patch) plan.produkUpdates.set(d.id, patch);
      }
      return;
    }
    if (!d.v.nama) { addError(d.row, `Barcode "${d.id}" belum ada, Nama Produk wajib diisi.`); return; }
    plan.produk.set(d.id, {
      barcode: d.id, nama: d.v.nama, kode_produk: d.v.kode_produk || null, kategori: d.v.kategori || null,
      sub_kategori: d.v.sub_kategori || null, satuan: d.v.satuan || null,
    });
  });

  const nextSeq = {};
  existing.produkSectors.forEach(ps => { nextSeq[ps.sector_id] = Math.max(nextSeq[ps.sector_id] || 0, Number(ps.sequence) || 0); });
  const placed = new Set(existing.produkSectors.map(ps => `${ps.barcode}|${ps.sector_id}`));
  rows.forEach(row => {
    if (!row.barcode || !row.sector_id || !row.zona_id || !row.dc_id) return;
    const key = `${row.barcode}|${row.sector_id}`;
    if (placed.has(key)) return;
    placed.add(key);
    nextSeq[row.sector_id] = (nextSeq[row.sector_id] || 0) + 1;
    plan.placements.set(key, { barcode: row.barcode, sector_id: row.sector_id, sequence: nextSeq[row.sector_id] });
  });

  errors.sort((a, b) => a.row - b.row);
  const counts = {
    dcs: plan.dcs.size, zones: plan.zones.size, sectors: plan.sectors.size, produk: plan.produk.size, placements: plan.placements.size,
    updates: plan.dcUpdates.size + plan.zoneUpdates.size + plan.sectorUpdates.size + plan.produkUpdates.size,
  };
  const totalChanges = Object.values(counts).reduce((a, b) => a + b, 0);
  return { plan, counts, totalChanges, errors, rowCount: rows.length };
}

async function executeImportPlan(plan, onProgress) {
  const steps = [
    { label: 'DC', table: 'dcs', rows: [...plan.dcs.values()] },
    { label: 'Zona', table: 'zones', rows: [...plan.zones.values()] },
    { label: 'Sector', table: 'sectors', rows: [...plan.sectors.values()] },
    { label: 'Produk', table: 'master_produk', rows: [...plan.produk.values()] },
    { label: 'Penempatan produk', table: 'produk_sectors', rows: [...plan.placements.values()] },
  ];
  const updates = [
    { label: 'DC', table: 'dcs', key: 'id', map: plan.dcUpdates },
    { label: 'Zona', table: 'zones', key: 'id', map: plan.zoneUpdates },
    { label: 'Sector', table: 'sectors', key: 'id', map: plan.sectorUpdates },
    { label: 'Produk', table: 'master_produk', key: 'barcode', map: plan.produkUpdates },
  ];
  const total = steps.reduce((a, s) => a + s.rows.length, 0) + updates.reduce((a, u) => a + u.map.size, 0);
  let done = 0;
  const report = (label) => onProgress && onProgress({ done, total, label });

  for (const step of steps) {
    for (const part of chunk(step.rows, IMPORT_CHUNK)) {
      report(`Menambahkan ${step.label}...`);
      const { error } = await sb.from(step.table).insert(part);
      if (error) return { error: `Gagal menambahkan ${step.label}: ${error.message}`, done, total };
      done += part.length;
    }
  }
  for (const u of updates) {
    for (const [id, patch] of u.map) {
      report(`Memperbarui ${u.label}...`);
      const { error } = await sb.from(u.table).update(patch).eq(u.key, id);
      if (error) return { error: `Gagal memperbarui ${u.label} "${id}": ${error.message}`, done, total };
      done++;
    }
  }
  report('Selesai');
  await loadDcs();
  Store.allMasterProduk = [];
  return { error: null, done, total };
}