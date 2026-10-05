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

async function deleteProdukMaster(barcode) {
  const { error } = await sb.from('master_produk').delete().eq('barcode', barcode);
  if (error) return { error: 'Gagal hapus produk: ' + error.message };
  await loadAndSetAllMasterProduk();
  return { error: null };
}
