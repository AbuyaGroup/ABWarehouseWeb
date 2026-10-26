const BulkActionBar = {
  props: {
    count: { type: Number, default: 0 },
    noun: { type: String, default: 'item' },
    actionText: { type: String, default: 'Hapus' },
    busy: { type: Boolean, default: false },
    busyText: { type: String, default: 'Memproses...' },
  },
  emits: ['clear', 'action'],
  template: `
    <Transition name="bulk-bar">
      <div v-if="count > 0" class="bulk-bar" role="region" aria-label="Aksi massal">
        <div class="bulk-bar-info">
          <span class="bulk-bar-count">{{ count }}</span>
          <span>{{ noun }} dipilih</span>
        </div>
        <button type="button" class="bulk-bar-clear" :disabled="busy" @click="$emit('clear')">Batal pilih</button>
        <button type="button" class="bulk-bar-action" :disabled="busy" @click="$emit('action')">
          <i class="ti ti-trash"></i> {{ busy ? busyText : actionText }}
        </button>
      </div>
    </Transition>
  `,
};