function dcCodeOf(dc) {
  if (!dc) return '';
  const byId = String(dc.id || '').match(/^dc[-_ ]?([a-z])$/i);
  if (byId) return byId[1].toUpperCase();
  const byNama = String(dc.nama || '').trim().match(/(?:^|\s)([A-Za-z])$/);
  return byNama ? byNama[1].toUpperCase() : '';
}

function barcodeDcCode(barcode) {
  const first = String(barcode || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '';
}

function dcForBarcode(barcode, dcs = Store.dcs) {
  const code = barcodeDcCode(barcode);
  return code ? (dcs.find(d => dcCodeOf(d) === code) || null) : null;
}

function produkBelongsToDc(barcode, dc) {
  const code = dcCodeOf(dc);
  return !!code && barcodeDcCode(barcode) === code;
}

function isProdukActive(p) { return !p || p.is_active !== false; }

function missingStatusColumn(error) {
  return /is_active|deactivated_at/i.test(error?.message || '') && /column|schema/i.test(error?.message || '');
}

function barcodeRuleText(dcs = Store.dcs) {
  const list = dcs.map(d => ({ code: dcCodeOf(d), nama: d.nama })).filter(x => x.code);
  return list.map(x => `${x.code} = ${x.nama}`).join(', ');
}

async function saveDc({ isEdit, id, nama, sub, icon }) {
  const { error } = isEdit
    ? await sb.from('dcs').update({ nama, sub: sub || null, icon: icon || null }).eq('id', id)
    : await sb.from('dcs').insert({ id, nama, sub: sub || null, icon: icon || null, urutan: Store.dcs.length + 1 });
  if (error) return { error: `Gagal ${isEdit ? 'simpan perubahan' : 'bikin'} DC: ` + error.message };
  await loadDcs();
  return { error: null };
}

async function deleteDc(dcId) {
  const { error } = await sb.from('dcs').delete().eq('id', dcId);
  if (error) return { error: 'Gagal hapus DC: ' + error.message };
  await loadDcs();
  return { error: null };
}

async function saveZone({ isEdit, id, nama, dcId }) {
  const { error } = isEdit
    ? await sb.from('zones').update({ nama }).eq('id', id)
    : await sb.from('zones').insert({ id, nama, dc_id: dcId });
  if (error) return { error: `Gagal ${isEdit ? 'simpan perubahan' : 'bikin'} zona: ` + error.message };
  await loadZones(dcId);
  return { error: null };
}

async function deleteZona(zonaId, dcId) {
  const { error } = await sb.from('zones').delete().eq('id', zonaId);
  if (error) return { error: 'Gagal hapus zona: ' + error.message };
  await loadZones(dcId);
  return { error: null };
}

async function saveSector({ isEdit, id, nama, zonaId }) {
  const { error } = isEdit
    ? await sb.from('sectors').update({ nama }).eq('id', id)
    : await sb.from('sectors').insert({ id, nama, zone_id: zonaId });
  if (error) return { error: `Gagal ${isEdit ? 'simpan perubahan' : 'bikin'} sector: ` + error.message };
  return { error: null };
}

async function deleteSector(sectorId) {
  const { error } = await sb.from('sectors').delete().eq('id', sectorId);
  if (error) return { error: 'Gagal hapus sector: ' + error.message };
  return { error: null };
}

async function ensureAllMasterProdukLoaded() {
  if (!Store.allMasterProduk.length) {
    const { data, error } = await sb.from('master_produk').select('*').order('nama');
    if (!error) Store.allMasterProduk = data || [];
  }
}

async function assignProdukToSector(produk, sectorId) {
  if (!isProdukActive(produk)) {
    return { warn: `${produk.nama || produk.barcode} berstatus Not Active. Aktifkan dulu di Master → Produk.` };
  }
  if (Store.currentDc && !produkBelongsToDc(produk.barcode, Store.currentDc)) {
    return { warn: `Barcode ${produk.barcode} bukan produk ${Store.currentDc.nama}. Produk ${Store.currentDc.nama} harus diawali huruf ${dcCodeOf(Store.currentDc)}.` };
  }
  const { data: existingPs, error: psFindErr } = await sb
    .from('produk_sectors').select('id').eq('barcode', produk.barcode).eq('sector_id', sectorId).maybeSingle();
  if (psFindErr) throw psFindErr;

  if (existingPs) return { warn: 'Produk ini udah ke-assign ke sector ini sebelumnya.' };

  const sequence = Store.produkList.filter(p => p.sector_id === sectorId).length + 1;
  const { error: psErr } = await sb.from('produk_sectors').insert({
    barcode: produk.barcode, sector_id: sectorId, sequence,
  });
  if (psErr) throw psErr;
  return { error: null };
}

async function deleteProdukSector(psId) {
  const { error } = await sb.from('produk_sectors').delete().eq('id', psId);
  if (error) return { error: 'Gagal hapus: ' + error.message };
  return { error: null };
}

async function loadAndSetAllMasterProduk() {
  const { data, error } = await sb.from('master_produk').select('*').order('nama');
  if (error) { console.error('Gagal muat master_produk:', error); Store.allMasterProduk = []; return; }
  Store.allMasterProduk = data || [];
}

async function saveMasterProduk({ isEdit, barcode, editingBarcode, nama, kode_produk, kategori, sub_kategori, satuan }) {
  if (!isEdit && !dcForBarcode(barcode)) {
    return { error: `Barcode harus diawali huruf DC (${barcodeRuleText()}).` };
  }
  const payload = {
    nama,
    kode_produk: kode_produk || null,
    kategori: kategori || null,
    sub_kategori: sub_kategori || null,
    satuan: satuan || null,
  };
  const { error } = isEdit
    ? await sb.from('master_produk').update(payload).eq('barcode', editingBarcode)
    : await sb.from('master_produk').insert({ barcode, ...payload });
  if (error) return { error: `Gagal ${isEdit ? 'simpan perubahan' : 'bikin'} produk: ` + error.message };
  await loadAndSetAllMasterProduk();
  return { error: null };
}

async function setProdukActive(barcodes, active) {
  const patch = { is_active: active, deactivated_at: active ? null : new Date().toISOString() };
  let updated = 0;
  for (const part of chunk(barcodes, BULK_DELETE_CHUNK)) {
    const { data, error } = await sb.from('master_produk').update(patch).in('barcode', part).select('barcode');
    if (error) {
      await loadAndSetAllMasterProduk();
      const msg = missingStatusColumn(error)
        ? 'Kolom status belum ada di database. Jalankan file sql/produk_status.sql di Supabase SQL Editor dulu.'
        : error.message;
      return { updated, error: msg };
    }
    updated += (data || []).length;
  }
  await loadAndSetAllMasterProduk();
  return { updated, error: null };
}

const BULK_DELETE_CHUNK = 200;

async function findUsedValues(field, values) {
  const used = new Set();
  if (!values.length) return { used, error: null };
  for (const table of ['opname_entries', 'opname_final']) {
    if (field === 'sector_id' && table === 'opname_final') continue;
    const { data, error } = await fetchIn(table, field, field, values);
    if (error) return { used, error };
    data.forEach(r => used.add(String(r[field])));
  }
  return { used, error: null };
}

async function bulkDeleteRows(table, field, values) {
  let deleted = 0;
  for (const part of chunk(values, BULK_DELETE_CHUNK)) {
    const { data, error } = await sb.from(table).delete().in(field, part).select(field);
    if (error) return { deleted, error: error.message };
    deleted += (data || []).length;
  }
  return { deleted, error: null };
}

async function prepareBulkDeleteSectors(sectorIds) {
  const { used, error } = await findUsedValues('sector_id', sectorIds);
  if (error) return { error: 'Gagal cek riwayat opname: ' + error.message };
  return { deletable: sectorIds.filter(id => !used.has(String(id))), skipped: sectorIds.filter(id => used.has(String(id))), error: null };
}

async function bulkDeleteSectors(sectorIds) {
  return bulkDeleteRows('sectors', 'id', sectorIds);
}

async function bulkDeleteProdukSectors(psIds) {
  return bulkDeleteRows('produk_sectors', 'id', psIds);
}