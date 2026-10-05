const ToastStack = {
  data() {
    return { store: Store };
  },
  methods: {
    icon(type) {
      return { success: 'ti-circle-check', error: 'ti-alert-circle', warn: 'ti-alert-triangle', info: 'ti-info-circle' }[type] || 'ti-info-circle';
    },
    close(id) { removeToast(id); },
  },
  template: `
    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <div v-for="t in store.toasts" :key="t.id" :class="['toast-item', 'toast-' + t.type]">
        <i :class="['ti', icon(t.type)]"></i>
        <span>{{ t.message }}</span>
        <button type="button" class="toast-close" @click="close(t.id)"><i class="ti ti-x"></i></button>
      </div>
    </TransitionGroup>
  `,
};
