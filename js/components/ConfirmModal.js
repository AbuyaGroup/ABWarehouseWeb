const ConfirmModal = {
  data() {
    return { store: Store };
  },
  watch: {
    'store.confirm.open'(v) { v ? lockScroll() : unlockScroll(); },
  },
  methods: {
    ok() { resolveConfirm(true); },
    cancel() { resolveConfirm(false); },
    onBackdrop(e) { if (e.target === e.currentTarget) this.cancel(); },
  },
  template: `
    <Transition name="modal-pop">
      <div v-if="store.confirm.open" class="modal-overlay confirm-backdrop" @click="onBackdrop">
        <div class="modal-card confirm-card">
          <h2>{{ store.confirm.title }}</h2>
          <p class="modal-desc confirm-message">{{ store.confirm.message }}</p>
          <div class="modal-actions confirm-actions">
            <button class="btn-ghost" @click="cancel">{{ store.confirm.cancelText }}</button>
            <button :class="store.confirm.danger ? 'btn-danger' : 'btn-amber'" @click="ok">{{ store.confirm.confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  `,
};
