const SearchableSelect = {
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Pilih...' },
  },
  emits: ['update:modelValue'],
  data() {
    return { isOpen: false, query: '' };
  },
  computed: {
    selectedLabel() {
      const found = this.options.find(o => String(o.value) === String(this.modelValue));
      return found ? found.label : '';
    },
    filteredOptions() {
      const q = this.query.trim().toLowerCase();
      if (!q) return this.options;
      return this.options.filter(o => o.label.toLowerCase().includes(q));
    },
  },
  methods: {
    open() {
      this.isOpen = true;
      this.query = '';
      document.addEventListener('click', this.onOutsideClick, true);
      this.$nextTick(() => this.$refs.searchInput && this.$refs.searchInput.focus());
    },
    close() {
      this.isOpen = false;
      document.removeEventListener('click', this.onOutsideClick, true);
    },
    toggle() { this.isOpen ? this.close() : this.open(); },
    onOutsideClick(e) {
      if (this.$el && !this.$el.contains(e.target)) this.close();
    },
    pick(opt) {
      this.$emit('update:modelValue', opt.value);
      this.close();
    },
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onOutsideClick, true);
  },
  template: `
    <div class="fancy-select">
      <button type="button" :class="['fancy-select-trigger', { active: isOpen }]" @click="toggle">
        <span class="fancy-select-label">{{ selectedLabel || placeholder }}</span>
        <i class="ti ti-chevron-down fancy-select-chevron"></i>
      </button>
      <Transition name="pop">
        <div v-if="isOpen" class="fancy-select-popover" @click.stop>
          <div class="fancy-select-search">
            <i class="ti ti-search"></i>
            <input ref="searchInput" type="text" v-model="query" placeholder="Cari...">
          </div>
          <div class="fancy-select-options">
            <div v-if="!filteredOptions.length" class="fancy-select-empty">Gak ketemu.</div>
            <button v-for="opt in filteredOptions" :key="opt.value" type="button"
              :class="['fancy-select-option', { active: String(opt.value) === String(modelValue) }]"
              @click="pick(opt)">{{ opt.label }}</button>
          </div>
        </div>
      </Transition>
    </div>
  `,
};
