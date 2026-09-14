// =========================================================
// MASTER > PRODUK -- kelola master_produk secara global,
// LEPAS dari DC/Zona/Sector manapun.
// =========================================================
el('masterMenuProdukBtn').onclick = () => {
  hide('masterMenuScreen');
  el('userChip11').innerHTML = el('userChip10').innerHTML;
  state.produkMasterSearchQuery = '';
  state.produkMasterPage = 1;
  el('produkMasterSearchInput').value = '';
  show('manageProdukMasterScreen');
  loadAndRenderProdukMaster();
};

el('backFromProdukMasterBtn').onclick = () => {
  hide('manageProdukMasterScreen');
  show('masterMenuScreen');
};

el('logoutBtn11').onclick = () => forceLogout();

async function loadAndRenderProdukMaster(){
  const { data, error } = await sb.from('master_produk').select('*').order('nama');
  if(error){
    console.error('Gagal muat master_produk:', error);
    state.allMasterProduk = [];
  } else {
    state.allMasterProduk = data || [];
  }
  renderProdukMasterGrid();
}

function renderProdukMasterGrid(){
  if(!state.allMasterProduk.length){
    hide('produkMasterTableWrap');
    el('produkMasterGrid').innerHTML = '';
    el('produkMasterPagination').classList.add('hidden');
    show('emptyProdukMasterMsg');
    return;
  }
  hide('emptyProdukMasterMsg');
  show('produkMasterTableWrap');

  const q = state.produkMasterSearchQuery;
  const filtered = state.allMasterProduk.filter(p =>
    !q ||
    p.nama?.toLowerCase().includes(q) ||
    p.barcode?.toLowerCase().includes(q) ||
    p.kode_produk?.toLowerCase().includes(q)
  );

  if(!filtered.length){
    el('produkMasterGrid').innerHTML = `<tr><td colspan="6" class="empty-state">Gak ada produk yang cocok.</td></tr>`;
    el('produkMasterPagination').classList.add('hidden');
    return;
  }

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(state.produkMasterPage > totalPages) state.produkMasterPage = totalPages;
  if(state.produkMasterPage < 1) state.produkMasterPage = 1;
  const pageItems = filtered.slice(
    (state.produkMasterPage - 1) * PAGE_SIZE,
    state.produkMasterPage * PAGE_SIZE
  );

  el('produkMasterGrid').innerHTML = pageItems.map(p => `
    <tr>
      <td><span class="kategori-tag">${p.kategori || '-'}</span></td>
      <td class="produk-nama">${p.nama}</td>
      <td>${p.barcode}</td>
      <td>${p.kode_produk || '-'}</td>
      <td>${p.satuan || '-'}</td>
      <td class="num">
        <button class="btn-icon" data-edit-produk-master="${p.barcode}" title="Edit"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-delete-produk-master="${p.barcode}" title="Hapus produk"><i class="ti ti-trash"></i></button>
      </td>
    </tr>
  `).join('');

  renderPaginationBar({
    prefix: 'produkMaster',
    page: state.produkMasterPage,
    totalPages,
    onGoTo: (n) => { state.produkMasterPage = n; renderProdukMasterGrid(); },
  });

  document.querySelectorAll('[data-edit-produk-master]').forEach(btn => {
    btn.onclick = () => {
      const p = state.allMasterProduk.find(x => x.barcode === btn.getAttribute('data-edit-produk-master'));
      if(p) openProdukMasterModal('edit', p);
    };
  });
  document.querySelectorAll('[data-delete-produk-master]').forEach(btn => {
    btn.onclick = () => deleteProdukMaster(btn.getAttribute('data-delete-produk-master'));
  });
}

el('produkMasterSearchInput').addEventListener('input', (e) => {
  state.produkMasterSearchQuery = e.target.value.trim().toLowerCase();
  state.produkMasterPage = 1;
  renderProdukMasterGrid();
});

// =========================================================
// MODAL: PRODUK BARU / EDIT PRODUK (master_produk, global)
// =========================================================
function openProdukMasterModal(mode, produk){
  state.produkMasterModalMode = mode;
  state.produkMasterModalEditingBarcode = produk ? produk.barcode : null;

  el('produkMasterModalTitle').textContent = mode === 'create' ? 'Produk Baru' : 'Edit Produk';
  el('produkMasterModalBarcode').disabled = mode === 'edit'; // barcode itu primary key, dikunci pas edit

  el('produkMasterModalBarcode').value = mode === 'edit' ? produk.barcode : '';
  el('produkMasterModalNama').value = mode === 'edit' ? produk.nama : '';
  el('produkMasterModalKode').value = mode === 'edit' ? (produk.kode_produk || '') : '';
  el('produkMasterModalKategori').value = mode === 'edit' ? (produk.kategori || '') : '';
  el('produkMasterModalSubKategori').value = mode === 'edit' ? (produk.sub_kategori || '') : '';
  el('produkMasterModalSatuan').value = mode === 'edit' ? (produk.satuan || '') : '';

  el('produkMasterModalSave').disabled = false;
  el('produkMasterModalSave').textContent = 'Simpan';
  show('produkMasterModal');
  el(mode === 'edit' ? 'produkMasterModalNama' : 'produkMasterModalBarcode').focus();
}

el('addProdukMasterBtn').onclick = () => openProdukMasterModal('create');

function closeProdukMasterModal(){ hide('produkMasterModal'); }
el('produkMasterModalCancel').onclick = closeProdukMasterModal;
el('produkMasterModal').addEventListener('click', e => {
  if(e.target.id === 'produkMasterModal') closeProdukMasterModal();
});

el('produkMasterModalSave').onclick = async () => {
  const barcode = el('produkMasterModalBarcode').value.trim();
  const nama = el('produkMasterModalNama').value.trim();
  const kode_produk = el('produkMasterModalKode').value.trim();
  const kategori = el('produkMasterModalKategori').value.trim();
  const sub_kategori = el('produkMasterModalSubKategori').value.trim();
  const satuan = el('produkMasterModalSatuan').value.trim();
  const isEdit = state.produkMasterModalMode === 'edit';

  if(!barcode){ alert('Barcode wajib diisi.'); return; }
  if(!nama){ alert('Nama produk wajib diisi.'); return; }

  el('produkMasterModalSave').disabled = true;
  el('produkMasterModalSave').textContent = 'Menyimpan...';

  const payload = {
    nama,
    kode_produk: kode_produk || null,
    kategori: kategori || null,
    sub_kategori: sub_kategori || null,
    satuan: satuan || null,
  };

  const { error } = isEdit
    ? await sb.from('master_produk').update(payload).eq('barcode', state.produkMasterModalEditingBarcode)
    : await sb.from('master_produk').insert({ barcode, ...payload });

  if(error){
    alert(`Gagal ${isEdit ? 'simpan perubahan' : 'bikin'} produk: ` + error.message);
    el('produkMasterModalSave').disabled = false;
    el('produkMasterModalSave').textContent = 'Simpan';
    return;
  }

  await loadAndRenderProdukMaster();
  closeProdukMasterModal();
};

// Hapus produk dari master_produk sepenuhnya -- semua assignment ke sector
// (produk_sectors) ikut kehapus (CASCADE). Kalau produk ini udah pernah
// discan/kepake (ada di opname_entries/opname_final), Supabase bakal nolak
// otomatis (FK constraint) biar data histori gak ilang.
async function deleteProdukMaster(barcode){
  const produk = state.allMasterProduk.find(p => p.barcode === barcode);
  if(!produk) return;

  const confirmed = confirm(
    `Hapus produk "${produk.nama}" dari Master Produk? Semua assignment-nya ke sector mana pun bakal ikut kehapus.\n\nKalau produk ini udah pernah dipake buat scan, penghapusan bakal ditolak otomatis biar data histori gak ilang.`
  );
  if(!confirmed) return;

  const { error } = await sb.from('master_produk').delete().eq('barcode', barcode);
  if(error){
    alert('Gagal hapus produk: ' + error.message);
    return;
  }

  await loadAndRenderProdukMaster();
}
