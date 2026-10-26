const DataImportScreen = {
  data() {
    return {
      store: Store,
      file: null,
      parsed: null,
      result: null,
      updateExisting: false,
      stage: 'idle',
      errorText: '',
      dragOver: false,
      progress: { done: 0, total: 0, label: '' },
      importResult: null,
      downloadingTemplate: false,
    };
  },
  computed: {
    counts() { return this.result?.counts || {}; },
    errors() { return this.result?.errors || []; },
    shownErrors() { return this.errors.slice(0, 100); },
    skipped() { return this.result?.skipped || []; },
    shownSkipped() { return this.skipped.slice(0, 100); },
    canImport() { return this.stage === 'preview' && !this.errors.length && this.result?.totalChanges > 0; },
    progressPct() { return this.progress.total ? Math.round((this.progress.done / this.progress.total) * 100) : 0; },
    statCards() {
      const c = this.counts;
      return [
        { key: 'dcs', label: 'DC baru', icon: 'ti-building-warehouse', value: c.dcs || 0 },
        { key: 'zones', label: 'Zona baru', icon: 'ti-layout-grid', value: c.zones || 0 },
        { key: 'sectors', label: 'Sector baru', icon: 'ti-layout-columns', value: c.sectors || 0 },
        { key: 'produk', label: 'Produk baru', icon: 'ti-package', value: c.produk || 0 },
        { key: 'placements', label: 'Penempatan produk', icon: 'ti-arrows-right-left', value: c.placements || 0 },
        { key: 'updates', label: 'Diperbarui', icon: 'ti-pencil', value: c.updates || 0 },
      ];
    },
    detailGroups() {
      const p = this.result?.plan;
      if (!p) return [];
      const fmt = (map, f) => [...map.values()].map(f);
      return [
        { label: 'DC baru', items: fmt(p.dcs, d => `${d.id} · ${d.nama}`) },
        { label: 'Zona baru', items: fmt(p.zones, z => `${z.id} · ${z.nama} (${z.dc_id})`) },
        { label: 'Sector baru', items: fmt(p.sectors, s => `${s.id} · ${s.nama} (${s.zone_id})`) },
        { label: 'Produk baru', items: fmt(p.produk, x => `${x.barcode} · ${x.nama}`) },
        { label: 'Penempatan produk', items: fmt(p.placements, x => `${x.barcode} → ${x.sector_id}`) },
        { label: 'Diperbarui', items: [
          ...[...p.dcUpdates.keys()].map(k => `DC ${k}`),
          ...[...p.zoneUpdates.keys()].map(k => `Zona ${k}`),
          ...[...p.sectorUpdates.keys()].map(k => `Sector ${k}`),
          ...[...p.produkUpdates.keys()].map(k => `Produk ${k}`),
        ] },
      ].filter(g => g.items.length);
    },
  },
  watch: {
    updateExisting() { if (this.parsed && this.stage === 'preview') this.analyze(); },
  },
  methods: {
    async getTemplate() {
      this.downloadingTemplate = true;
      try { await downloadImportTemplate(); } catch (err) { toast('Gagal bikin template: ' + (err.message || err)); }
      this.downloadingTemplate = false;
    },
    pickFile() { this.$refs.fileInput && this.$refs.fileInput.click(); },
    onFileChange(e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) this.loadFile(f);
    },
    onDrop(e) {
      this.dragOver = false;
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) this.loadFile(f);
    },
    async loadFile(f) {
      if (this.stage === 'importing') return;
      if (!/\.xlsx$/i.test(f.name)) { toast('Format file harus .xlsx (Excel).', 'warn'); return; }
      this.file = f;
      this.parsed = null;
      this.result = null;
      this.importResult = null;
      this.errorText = '';
      this.stage = 'parsing';
      try {
        this.parsed = await parseImportFile(f);
        if (!this.parsed.rows.length) throw new Error('Nggak ada baris data di file ini.');
        await this.analyze();
      } catch (err) {
        console.error('Gagal baca file import:', err);
        this.errorText = err.message || String(err);
        this.stage = 'idle';
      }
    },
    async analyze() {
      this.stage = 'parsing';
      try {
        this.result = await buildImportPlan(this.parsed.rows, { updateExisting: this.updateExisting });
        this.stage = 'preview';
      } catch (err) {
        console.error('Gagal cek data import:', err);
        this.errorText = 'Gagal cek data ke database: ' + (err.message || err);
        this.stage = 'idle';
      }
    },
    reset() {
      this.file = null; this.parsed = null; this.result = null; this.importResult = null;
      this.errorText = ''; this.stage = 'idle';
    },
    async runImport() {
      if (!this.canImport) return;
      const c = this.counts;
      const ok = await confirmDialog({
        title: 'Import data?',
        message: `Akan menambahkan ${c.dcs} DC, ${c.zones} zona, ${c.sectors} sector, ${c.produk} produk, dan ${c.placements} penempatan produk${c.updates ? `, serta memperbarui ${c.updates} data` : ''}.${this.skipped.length ? `\n\n${this.skipped.length} baris produk Not Active dilewati.` : ''} Lanjut?`,
        confirmText: 'Import',
      });
      if (!ok) return;
      this.stage = 'importing';
      this.progress = { done: 0, total: this.result.totalChanges, label: 'Memulai...' };
      const res = await executeImportPlan(this.result.plan, p => { this.progress = p; });
      this.importResult = res;
      this.stage = 'done';
      if (res.error) toast(res.error, 'error', 8000);
      else toast(`Import selesai: ${res.done} perubahan tersimpan.`, 'success');
    },
  },
  template: `
    <div class="main-content">
      <div class="wrap data-wrap">
        <header class="data-head">
          <p class="data-eyebrow">Data</p>
          <h1>Import Data</h1>
          <p class="hint">Tambah DC, Zona, Sector, dan Produk sekaligus dari file Excel.</p>
        </header>

        <div class="data-layout">
          <section class="data-panel">
            <div class="data-step">
              <span class="data-step-no">1</span>
              <div class="data-step-body">
                <h3>Siapkan file</h3>
                <p class="data-muted">Pakai template, atau file hasil Export (sheet "Struktur") yang udah diedit.</p>
                <button type="button" class="btn-ghost data-btn-ghost" :disabled="downloadingTemplate" @click="getTemplate">
                  <i class="ti ti-download"></i> {{ downloadingTemplate ? 'Menyiapkan...' : 'Download template' }}
                </button>
              </div>
            </div>

            <div class="data-step">
              <span class="data-step-no">2</span>
              <div class="data-step-body">
                <h3>Upload file</h3>
                <input ref="fileInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="data-file-input" @change="onFileChange">
                <div v-if="!file" :class="['data-drop', { over: dragOver }]" role="button" tabindex="0"
                  @click="pickFile" @keydown.enter.prevent="pickFile" @keydown.space.prevent="pickFile"
                  @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="onDrop">
                  <i class="ti ti-file-upload"></i>
                  <b>Klik atau tarik file ke sini</b>
                  <span>Format .xlsx</span>
                </div>
                <div v-else class="data-file">
                  <span class="data-file-icon"><i class="ti ti-file-spreadsheet"></i></span>
                  <div class="data-file-info">
                    <b>{{ file.name }}</b>
                    <span v-if="parsed">{{ parsed.rows.length }} baris · sheet "{{ parsed.sheetName }}"</span>
                    <span v-else-if="stage === 'parsing'">Membaca file...</span>
                  </div>
                  <button v-if="stage !== 'importing'" type="button" class="data-link" @click="reset">Ganti file</button>
                </div>
                <div v-if="errorText" class="data-alert danger"><i class="ti ti-alert-triangle"></i><span>{{ errorText }}</span></div>
                <label class="data-check" :class="{ disabled: stage === 'importing' || stage === 'done' }">
                  <input type="checkbox" v-model="updateExisting" :disabled="stage === 'importing' || stage === 'done'">
                  <span class="data-check-box"><i class="ti ti-check"></i></span>
                  <span>Perbarui nama/detail data yang sudah ada</span>
                </label>
              </div>
            </div>

            <div class="data-step">
              <span class="data-step-no">3</span>
              <div class="data-step-body">
                <h3>Cek & import</h3>
                <p v-if="stage === 'idle'" class="data-muted">Upload file dulu, nanti ringkasannya muncul di sini sebelum disimpan.</p>
                <p v-else-if="stage === 'parsing'" class="data-muted">Mengecek data ke database...</p>

                <template v-else>
                  <div class="data-stats">
                    <div v-for="s in statCards" :key="s.key" :class="['data-stat', { zero: !s.value }]">
                      <i class="ti" :class="s.icon"></i>
                      <b>{{ s.value }}</b>
                      <span>{{ s.label }}</span>
                    </div>
                  </div>

                  <div v-if="errors.length" class="data-alert danger data-error-box">
                    <div class="data-error-title"><i class="ti ti-alert-triangle"></i> {{ errors.length }} masalah ditemukan. Perbaiki file lalu upload ulang.</div>
                    <ul>
                      <li v-for="(e, i) in shownErrors" :key="i"><b>Baris {{ e.row }}</b> {{ e.msg }}</li>
                    </ul>
                    <p v-if="errors.length > shownErrors.length" class="data-muted">+{{ errors.length - shownErrors.length }} masalah lain</p>
                  </div>
                  <details v-if="skipped.length" class="data-alert warn data-skip-box">
                    <summary class="data-error-title"><i class="ti ti-archive"></i> {{ skipped.length }} baris dilewati karena produknya Not Active. Data lain tetap bisa di-import.</summary>
                    <ul>
                      <li v-for="(e, i) in shownSkipped" :key="i"><b>Baris {{ e.row }}</b> {{ e.msg }}</li>
                    </ul>
                    <p v-if="skipped.length > shownSkipped.length" class="data-muted">+{{ skipped.length - shownSkipped.length }} baris lain</p>
                  </details>
                  <div v-if="!errors.length && stage === 'preview' && !result.totalChanges" class="data-alert info">
                    <i class="ti ti-info-circle"></i><span>Semua data di file ini sudah ada. Nggak ada yang perlu ditambahkan.</span>
                  </div>

                  <details v-if="detailGroups.length && !errors.length" class="data-details">
                    <summary>Lihat rincian</summary>
                    <div v-for="g in detailGroups" :key="g.label" class="data-detail-group">
                      <b>{{ g.label }} ({{ g.items.length }})</b>
                      <ul>
                        <li v-for="(it, i) in g.items.slice(0, 50)" :key="i">{{ it }}</li>
                        <li v-if="g.items.length > 50" class="data-muted">+{{ g.items.length - 50 }} lainnya</li>
                      </ul>
                    </div>
                  </details>

                  <div v-if="stage === 'importing' || stage === 'done'" class="data-progress">
                    <div class="data-progress-label">
                      <span>{{ stage === 'importing' ? progress.label : (importResult?.error ? 'Import berhenti' : 'Import selesai') }}</span>
                      <span>{{ progress.done }}/{{ progress.total }}</span>
                    </div>
                    <div class="home-track"><div class="home-fill" :class="{ danger: importResult?.error }" :style="{ width: progressPct + '%' }"></div></div>
                  </div>

                  <div v-if="stage === 'done' && importResult" :class="['data-alert', importResult.error ? 'danger' : 'success']">
                    <i class="ti" :class="importResult.error ? 'ti-alert-triangle' : 'ti-circle-check'"></i>
                    <span v-if="importResult.error">{{ importResult.error }} Sebanyak {{ importResult.done }} perubahan sebelumnya sudah tersimpan. Upload file yang sama lagi untuk melanjutkan sisanya.</span>
                    <span v-else>{{ importResult.done }} perubahan tersimpan.</span>
                  </div>

                  <div class="data-actions">
                    <button v-if="stage === 'done'" class="btn-ghost data-btn-ghost" @click="reset"><i class="ti ti-file-upload"></i> Import file lain</button>
                    <button v-else class="btn-amber data-btn" :disabled="!canImport" @click="runImport">
                      <i class="ti ti-database-import"></i> {{ stage === 'importing' ? 'Mengimport...' : 'Import sekarang' }}
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </section>

          <aside class="data-panel data-aside">
            <h3>Aturan import</h3>
            <ul class="data-rules">
              <li><i class="ti ti-plus"></i><span>Data baru ditambahkan. Data lama <b>tidak dihapus</b>.</span></li>
              <li><i class="ti ti-key"></i><span>DC, Zona, dan Sector dicocokkan lewat <b>ID</b>. Produk lewat <b>Barcode</b>.</span></li>
              <li><i class="ti ti-arrow-merge"></i><span>ID yang sudah ada dipakai ulang. Nama baru cuma diterapkan kalau opsi "Perbarui" dicentang.</span></li>
              <li><i class="ti ti-map-pin"></i><span>Barcode + Sector di baris yang sama = produk ditempatkan di sector itu.</span></li>
              <li><i class="ti ti-archive"></i><span>Produk yang <b>Not Active</b> dibiarkan apa adanya: nggak ditempatkan dan nggak diubah, biar sesi opname lama tetap sama. Barisnya cuma dilewati.</span></li>
              <li><i class="ti ti-shield-check"></i><span>Kalau ada baris bermasalah, nggak ada yang disimpan sampai filenya dibetulkan.</span></li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  `,
};