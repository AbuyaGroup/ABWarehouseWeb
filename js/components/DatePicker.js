const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABELS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const DatePicker = {
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      isOpen: false,
      viewYear: new Date().getFullYear(),
      viewMonth: new Date().getMonth(),
      weekdayLabels: WEEKDAY_LABELS,
    };
  },
  computed: {
    label() {
      return this.modelValue ? formatTanggal(this.modelValue) : 'Pilih tanggal';
    },
    monthLabel() {
      return `${MONTH_LABELS[this.viewMonth]} ${this.viewYear}`;
    },
    todayIso() {
      return this.toIso(new Date());
    },
    cells() {
      const year = this.viewYear;
      const month = this.viewMonth;
      const startDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrevMonth = new Date(year, month, 0).getDate();
      const cells = [];
      for (let i = startDay - 1; i >= 0; i--) {
        cells.push(this.makeCell(new Date(year, month - 1, daysInPrevMonth - i), true));
      }
      for (let day = 1; day <= daysInMonth; day++) {
        cells.push(this.makeCell(new Date(year, month, day), false));
      }
      let next = 1;
      while (cells.length < 42) {
        cells.push(this.makeCell(new Date(year, month + 1, next), true));
        next++;
      }
      return cells;
    },
  },
  methods: {
    pad(n) { return String(n).padStart(2, '0'); },
    toIso(d) { return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`; },
    makeCell(d, otherMonth) {
      const iso = this.toIso(d);
      return {
        iso,
        day: d.getDate(),
        otherMonth,
        isToday: iso === this.todayIso,
        isSelected: !!this.modelValue && iso === this.modelValue,
      };
    },
    syncViewToModel() {
      const base = this.modelValue ? new Date(this.modelValue + 'T00:00:00') : new Date();
      this.viewYear = base.getFullYear();
      this.viewMonth = base.getMonth();
    },
    open() {
      this.isOpen = true;
      this.syncViewToModel();
      document.addEventListener('click', this.onOutsideClick, true);
    },
    close() {
      this.isOpen = false;
      document.removeEventListener('click', this.onOutsideClick, true);
    },
    toggle() { this.isOpen ? this.close() : this.open(); },
    onOutsideClick(e) {
      if (this.$el && !this.$el.contains(e.target)) this.close();
    },
    prevMonth() {
      if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear--; }
      else this.viewMonth--;
    },
    nextMonth() {
      if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear++; }
      else this.viewMonth++;
    },
    pick(cell) {
      this.$emit('update:modelValue', cell.iso);
      this.close();
    },
    goToday() {
      const now = new Date();
      this.$emit('update:modelValue', this.toIso(now));
      this.viewYear = now.getFullYear();
      this.viewMonth = now.getMonth();
      this.close();
    },
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onOutsideClick, true);
  },
  template: `
    <div class="fancy-select date-picker">
      <button type="button" :class="['fancy-select-trigger', { active: isOpen }]" @click="toggle">
        <span class="fancy-select-label">{{ label }}</span>
        <i class="ti ti-calendar fancy-select-chevron"></i>
      </button>
      <Transition name="pop">
        <div v-if="isOpen" class="fancy-select-popover date-picker-popover" @click.stop>
          <div class="date-picker-header">
            <button type="button" class="date-picker-nav" @click="prevMonth"><i class="ti ti-chevron-left"></i></button>
            <span class="date-picker-month">{{ monthLabel }}</span>
            <button type="button" class="date-picker-nav" @click="nextMonth"><i class="ti ti-chevron-right"></i></button>
          </div>
          <div class="date-picker-weekdays">
            <span v-for="d in weekdayLabels" :key="d">{{ d }}</span>
          </div>
          <div class="date-picker-grid">
            <button v-for="cell in cells" :key="cell.iso" type="button"
              :class="['date-picker-day', { 'other-month': cell.otherMonth, today: cell.isToday, selected: cell.isSelected }]"
              @click="pick(cell)">{{ cell.day }}</button>
          </div>
          <div class="date-picker-footer">
            <button type="button" class="date-picker-today-btn" @click="goToday">Hari ini</button>
          </div>
        </div>
      </Transition>
    </div>
  `,
};
