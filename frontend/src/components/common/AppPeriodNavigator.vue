<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  type PeriodGranularity,
  type PeriodNavigatorModel,
  type ComputedPeriodRange,
  computePeriodRange,
  stepBackward,
  stepForward,
  formatDateStr,
  parseDateStr,
  jumpToMonth,
  jumpToQuarter,
  FRENCH_MONTHS,
} from '../../utils/periodNavigator';

interface Props {
  modelValue?: PeriodNavigatorModel;
  initialGranularity?: PeriodGranularity;
  initialDate?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialGranularity: 'month',
  initialDate: () => formatDateStr(new Date()),
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: PeriodNavigatorModel): void;
  (e: 'change', range: ComputedPeriodRange): void;
}>();

const granularity = ref<PeriodGranularity>(
  props.modelValue?.granularity || props.initialGranularity
);
const referenceDate = ref<string>(
  props.modelValue?.referenceDate || props.initialDate
);

const isPopoverOpen = ref(false);
const popoverContainerRef = ref<HTMLElement | null>(null);

// Popover year selection
const popoverYear = ref<number>(
  parseDateStr(referenceDate.value).getFullYear()
);

const granularities: { id: PeriodGranularity; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
];

const quarters = [
  { index: 0, label: 'T1 (Jan - Mar)', short: 'T1' },
  { index: 1, label: 'T2 (Avr - Juin)', short: 'T2' },
  { index: 2, label: 'T3 (Juil - Sept)', short: 'T3' },
  { index: 3, label: 'T4 (Oct - Déc)', short: 'T4' },
];

const computedRange = computed(() => {
  return computePeriodRange(granularity.value, referenceDate.value);
});

// Sync changes upward
function notifyChange() {
  const model: PeriodNavigatorModel = {
    granularity: granularity.value,
    referenceDate: referenceDate.value,
  };
  emit('update:modelValue', model);
  emit('change', computedRange.value);
}

// Watch external modelValue updates
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      if (newVal.granularity && newVal.granularity !== granularity.value) {
        granularity.value = newVal.granularity;
      }
      if (newVal.referenceDate && newVal.referenceDate !== referenceDate.value) {
        referenceDate.value = newVal.referenceDate;
        popoverYear.value = parseDateStr(newVal.referenceDate).getFullYear();
      }
    }
  },
  { deep: true }
);

function setGranularity(g: PeriodGranularity) {
  if (granularity.value === g) return;
  granularity.value = g;
  notifyChange();
}

function onPrev() {
  referenceDate.value = stepBackward(granularity.value, referenceDate.value);
  popoverYear.value = parseDateStr(referenceDate.value).getFullYear();
  notifyChange();
}

function onNext() {
  if (!computedRange.value.canStepForward) return;
  referenceDate.value = stepForward(granularity.value, referenceDate.value);
  popoverYear.value = parseDateStr(referenceDate.value).getFullYear();
  notifyChange();
}

function onResetToCurrent() {
  referenceDate.value = formatDateStr(new Date());
  popoverYear.value = new Date().getFullYear();
  notifyChange();
}

function togglePopover() {
  isPopoverOpen.value = !isPopoverOpen.value;
  if (isPopoverOpen.value) {
    popoverYear.value = parseDateStr(referenceDate.value).getFullYear();
  }
}

function closePopover() {
  isPopoverOpen.value = false;
}

function selectMonth(mIndex: number) {
  granularity.value = 'month';
  referenceDate.value = jumpToMonth(popoverYear.value, mIndex);
  closePopover();
  notifyChange();
}

function selectQuarter(qIndex: number) {
  granularity.value = 'quarter';
  referenceDate.value = jumpToQuarter(popoverYear.value, qIndex);
  closePopover();
  notifyChange();
}

function stepPopoverYear(delta: number) {
  const currentYear = new Date().getFullYear();
  const targetYear = popoverYear.value + delta;
  if (targetYear > currentYear) return; // Future guard
  popoverYear.value = targetYear;
}

// Click outside handling
function handleClickOutside(event: MouseEvent) {
  if (
    popoverContainerRef.value &&
    !popoverContainerRef.value.contains(event.target as Node)
  ) {
    closePopover();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  // Emit initial range on mount
  emit('change', computedRange.value);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="app-period-navigator" ref="popoverContainerRef">
    <div class="navigator-main-row">
      <!-- Part 1: Granularity Segmented Control -->
      <div class="granularity-segmented-control" role="tablist">
        <button
          v-for="g in granularities"
          :key="g.id"
          :class="['granularity-tab', granularity === g.id ? 'active' : '']"
          @click="setGranularity(g.id)"
          type="button"
        >
          {{ g.label }}
        </button>
      </div>

      <!-- Part 2: Navigation Stepper & Clickable Label -->
      <div class="stepper-control-group">
        <!-- Prev Button -->
        <button
          class="stepper-btn"
          @click="onPrev"
          type="button"
          title="Période précédente"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <!-- Central Clickable Period Label -->
        <button
          class="period-label-trigger"
          @click.stop="togglePopover"
          type="button"
          :title="'Cliquer pour choisir directement une date'"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="calendar-icon">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span class="period-label-text">{{ computedRange.label }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="chevron-icon">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <!-- Next Button (with Future Guard) -->
        <button
          :class="['stepper-btn', !computedRange.canStepForward ? 'disabled' : '']"
          :disabled="!computedRange.canStepForward"
          @click="onNext"
          type="button"
          :title="computedRange.canStepForward ? 'Période suivante' : 'Période future non autorisée'"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <!-- Reset to Today Shortcut -->
        <button
          v-if="!computedRange.isCurrentPeriod"
          class="reset-shortcut-btn"
          @click="onResetToCurrent"
          type="button"
          title="Revenir à la période actuelle"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Aujourd'hui</span>
        </button>
      </div>

      <!-- Part 3: Active Range Metadata Badge -->
      <div class="range-dates-badge">
        <span class="badge-dot"></span>
        <span class="range-text font-mono">{{ computedRange.startDate }} &rarr; {{ computedRange.endDate }}</span>
      </div>
    </div>

    <!-- Quick Jump Popover -->
    <div v-if="isPopoverOpen" class="quick-jump-popover" @click.stop>
      <div class="popover-header">
        <span class="popover-title">Accès Rapide par Période</span>
        <button class="popover-close-btn" @click="closePopover" type="button">&times;</button>
      </div>

      <!-- Year Selector Row -->
      <div class="popover-year-row">
        <button class="year-stepper-btn" @click="stepPopoverYear(-1)" type="button">
          &lsaquo;
        </button>
        <span class="year-display font-mono">{{ popoverYear }}</span>
        <button
          :class="['year-stepper-btn', popoverYear >= new Date().getFullYear() ? 'disabled' : '']"
          :disabled="popoverYear >= new Date().getFullYear()"
          @click="stepPopoverYear(1)"
          type="button"
        >
          &rsaquo;
        </button>
      </div>

      <!-- Months Grid -->
      <div class="popover-section-title">Sélectionner un Mois :</div>
      <div class="months-grid">
        <button
          v-for="m in FRENCH_MONTHS"
          :key="m.index"
          :class="[
            'month-pill-btn',
            granularity === 'month' &&
            popoverYear === parseDateStr(referenceDate).getFullYear() &&
            m.index === parseDateStr(referenceDate).getMonth()
              ? 'selected'
              : '',
            popoverYear === new Date().getFullYear() && m.index > new Date().getMonth()
              ? 'future-disabled'
              : ''
          ]"
          :disabled="popoverYear === new Date().getFullYear() && m.index > new Date().getMonth()"
          @click="selectMonth(m.index)"
          type="button"
        >
          {{ m.shortName }}
        </button>
      </div>

      <!-- Quarters Selection -->
      <div class="popover-section-title" style="margin-top: 12px;">Ou Sélectionner un Trimestre :</div>
      <div class="quarters-grid">
        <button
          v-for="q in quarters"
          :key="q.index"
          :class="[
            'quarter-pill-btn',
            granularity === 'quarter' &&
            popoverYear === parseDateStr(referenceDate).getFullYear() &&
            q.index === Math.floor(parseDateStr(referenceDate).getMonth() / 3)
              ? 'selected'
              : '',
            popoverYear === new Date().getFullYear() && q.index > Math.floor(new Date().getMonth() / 3)
              ? 'future-disabled'
              : ''
          ]"
          :disabled="popoverYear === new Date().getFullYear() && q.index > Math.floor(new Date().getMonth() / 3)"
          @click="selectQuarter(q.index)"
          type="button"
        >
          {{ q.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-period-navigator {
  position: relative;
  width: 100%;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  box-shadow: var(--shadow-sm);
}

.navigator-main-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Granularity Segmented Control */
.granularity-segmented-control {
  display: inline-flex;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 3px;
  gap: 2px;
}

.granularity-tab {
  background: transparent;
  border: none;
  padding: 5px 12px;
  border-radius: var(--radius-xs);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.granularity-tab:hover {
  color: var(--color-text-primary);
}

.granularity-tab.active {
  background-color: var(--color-primary);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Stepper Group */
.stepper-control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stepper-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stepper-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-dark);
}

.stepper-btn.disabled,
.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Central Clickable Label */
.period-label-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  height: 32px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.period-label-trigger:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.calendar-icon {
  color: var(--color-primary);
}

.chevron-icon {
  color: var(--color-text-secondary);
}

.reset-shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  height: 28px;
  background-color: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  color: var(--color-primary);
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-shortcut-btn:hover {
  background-color: rgba(37, 99, 235, 0.15);
}

/* Range Metadata Badge */
.range-dates-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  padding: 5px 10px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-success);
}

/* Quick Jump Popover */
.quick-jump-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 16px;
  width: 320px;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.popover-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.popover-close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--color-text-secondary);
  cursor: pointer;
  line-height: 1;
}

.popover-year-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  background-color: var(--color-surface);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.year-stepper-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  font-weight: bold;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 0 6px;
}

.year-stepper-btn.disabled,
.year-stepper-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.year-display {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
}

.popover-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.month-pill-btn {
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 500;
  padding: 6px 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.month-pill-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.month-pill-btn.selected {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
  font-weight: 700;
}

.month-pill-btn.future-disabled,
.month-pill-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.quarters-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.quarter-pill-btn {
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 500;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.quarter-pill-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.quarter-pill-btn.selected {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
  font-weight: 700;
}

.quarter-pill-btn.future-disabled,
.quarter-pill-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 800px) {
  .navigator-main-row {
    flex-direction: column;
    align-items: stretch;
  }
  .granularity-segmented-control {
    display: flex;
    justify-content: space-between;
  }
  .granularity-tab {
    flex: 1;
    text-align: center;
    padding: 6px 4px;
    font-size: 11px;
  }
  .stepper-control-group {
    justify-content: center;
  }
  .range-dates-badge {
    justify-content: center;
  }
  .quick-jump-popover {
    left: 0;
    transform: none;
    width: 100%;
  }
}
</style>
