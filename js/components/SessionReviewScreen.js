const SessionReviewScreen = {
  data() {
    return { store: Store, loading: false, saving: false, sessionNama: '' };
  },
  async mounted() {
    this.loading = true;
    Store.reviewRows = [];
    const session = Store.sessions.find(x => x.id === Store.reviewSessionId);
    this.sessionNama = session ? session.nama : '';
    try {
      Store.reviewRows = await loadSessionReviewRows(Store.reviewSessionId);
    } catch (err) {
      console.error('Gagal muat data review:', err);
      toast('Gagal muat data review: ' + (err.message || err));
    } finally {
      this.loading = false;
    }
  },
  methods: {
    isChanged(row) { return Number(row.qtyFinal) !== Number(row.qtyCounting); },
    close() {
      Store.reviewSessionId = null;
      Store.reviewRows = [];
      Store.currentScreen = 'sessionList';
    },
    async confirm() {
      if (!Store.reviewSessionId || !Store.reviewRows.length) return;
      const authorizedBy = Store.session?.user?.id;
      if (!authorizedBy) { toast('Sesi login gak valid, coba login ulang.'); return; }

      const confirmed = await confirmDialog({
        title: 'Selesaikan Sesi?',
        message: 'Yakin mau konfirmasi & tandai sesi ini SELESAI? Qty final bakal disimpen ke opname_final dan sesi ini gak bisa discan lagi kecuali diaktifin ulang.',
        confirmText: 'Selesaikan',
      });
      if (!confirmed) return;

      this.saving = true;
      try {
        Store.reviewRows.forEach(row => {
          row.qtyFinal = row.qtyFinal === '' || row.qtyFinal === null || row.qtyFinal === undefined ? 0 : Number(row.qtyFinal);
        });
        await confirmSessionFinal(Store.reviewSessionId, Store.reviewRows, authorizedBy);
        this.close();
      } catch (err) {
        console.error('Gagal konfirmasi sesi:', err);
        toast('Gagal konfirmasi: ' + (err.message || err));
      } finally {
        this.saving = false;
      }
    },
  },
  template: `
    <div class="main-content">
      <div class="wrap">
        <h1>Review &amp; Konfirmasi Selesai — {{ sessionNama }}</h1>
        <p class="hint">Cek qty hasil counting, revisi kalau perlu di kolom "Qty Final", baru konfirmasi buat nutup sesi ini.</p>
        <div class="review-table-wrap">
          <table class="review-table">
            <thead>
              <tr>
                <th>Nama Produk</th>
                <th>Barcode</th>
                <th>Sector</th>
                <th class="num">Unit</th>
                <th class="num">Qty Counting</th>
                <th class="num">Qty Final</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in store.reviewRows" :key="row.barcode">
                <td>{{ row.nama }}</td>
                <td>{{ row.barcode }}</td>
                <td>{{ row.sectorNama }}</td>
                <td class="num">{{ row.satuan }}</td>
                <td class="num">{{ row.qtyCounting }}</td>
                <td class="num">
                  <input type="number" step="any" :class="['qty-final-input', { changed: isChanged(row) }]" v-model="row.qtyFinal">
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!loading && !store.reviewRows.length" class="empty-state"><p>Belum ada produk yang discan di sesi ini.</p></div>
        <div class="review-footer">
          <button class="btn-ghost" @click="close">Batal</button>
          <button class="btn-success" :disabled="!store.reviewRows.length || saving" @click="confirm">
            <i class="ti ti-check"></i> {{ saving ? 'Menyimpan...' : 'Konfirmasi & Selesaikan Sesi' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
