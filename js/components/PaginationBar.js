const PaginationBar = {
  props: {
    page: { type: Number, required: true },
    totalPages: { type: Number, required: true },
  },
  emits: ['goto'],
  computed: {
    pages() { return Array.from({ length: this.totalPages }, (_, i) => i + 1); },
  },
  methods: {
    go(n) {
      this.$emit('goto', n);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  },
  template: `
    <div v-if="totalPages > 1" class="pagination-bar">
      <button class="pg-btn pg-text" :disabled="page <= 1" @click="go(1)">First</button>
      <button class="pg-btn" :disabled="page <= 1" @click="go(Math.max(1, page - 1))"><i class="ti ti-chevrons-left"></i></button>
      <div class="pg-numbers">
        <button v-for="n in pages" :key="n" :class="['pg-num', { active: n === page }]" @click="go(n)">{{ n }}</button>
      </div>
      <button class="pg-btn" :disabled="page >= totalPages" @click="go(Math.min(totalPages, page + 1))"><i class="ti ti-chevrons-right"></i></button>
      <button class="pg-btn pg-text" :disabled="page >= totalPages" @click="go(totalPages)">Last</button>
    </div>
  `,
};
