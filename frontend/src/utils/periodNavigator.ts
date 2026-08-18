/**
 * Pure Date Math Engine for ERP-Grade Period Navigation
 * Handles day, week, month, quarter, year boundaries, steppers, and calendar edge cases.
 */

export type PeriodGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface PeriodNavigatorModel {
  granularity: PeriodGranularity;
  referenceDate: string; // ISO 'YYYY-MM-DD'
}

export interface ComputedPeriodRange {
  granularity: PeriodGranularity;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  label: string; // French descriptive label (ex: "Mars 2025", "T2 2025")
  shortLabel: string;
  priorStartDate: string;
  priorEndDate: string;
  priorPeriodLabel: string;
  isCurrentPeriod: boolean;
  canStepForward: boolean;
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_SHORT_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'
];

/**
 * Format Date to local ISO string YYYY-MM-DD
 */
export function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD into a local midnight Date object
 */
export function parseDateStr(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/**
 * Format a Date into short French date (DD/MM/YYYY)
 */
export function formatFrenchShort(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/**
 * Compute period boundaries and comparison metadata from granularity and reference date
 */
export function computePeriodRange(
  granularity: PeriodGranularity,
  referenceDateInput: string | Date = new Date()
): ComputedPeriodRange {
  const ref = typeof referenceDateInput === 'string' ? parseDateStr(referenceDateInput) : new Date(referenceDateInput);
  const now = new Date();
  const todayStr = formatDateStr(now);

  const year = ref.getFullYear();
  const month = ref.getMonth(); // 0-11
  const day = ref.getDate();

  switch (granularity) {
    case 'day': {
      const startDate = formatDateStr(ref);
      const endDate = startDate;
      const priorDate = new Date(ref);
      priorDate.setDate(priorDate.getDate() - 1);
      const priorStartDate = formatDateStr(priorDate);
      const priorEndDate = priorStartDate;

      const isCurrentPeriod = startDate === todayStr;
      const canStepForward = startDate < todayStr;

      // Label
      const dayFormatted = `${day} ${MONTH_NAMES_FR[month]} ${year}`;
      const label = isCurrentPeriod ? `Aujourd'hui (${dayFormatted})` : dayFormatted;
      const priorPeriodLabel = isCurrentPeriod ? 'vs hier' : `vs ${formatFrenchShort(priorDate)}`;

      return {
        granularity: 'day',
        startDate,
        endDate,
        label,
        shortLabel: formatFrenchShort(ref),
        priorStartDate,
        priorEndDate,
        priorPeriodLabel,
        isCurrentPeriod,
        canStepForward,
      };
    }

    case 'week': {
      // ISO Week (Monday to Sunday)
      const dayOfWeek = (ref.getDay() + 6) % 7; // Monday = 0, Sunday = 6
      const monday = new Date(ref);
      monday.setDate(monday.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const startDate = formatDateStr(monday);
      const endDate = formatDateStr(sunday);

      const priorMonday = new Date(monday);
      priorMonday.setDate(priorMonday.getDate() - 7);
      const priorSunday = new Date(sunday);
      priorSunday.setDate(priorSunday.getDate() - 7);

      const priorStartDate = formatDateStr(priorMonday);
      const priorEndDate = formatDateStr(priorSunday);

      // Today's week Monday
      const todayDayOfWeek = (now.getDay() + 6) % 7;
      const currentWeekMonday = new Date(now);
      currentWeekMonday.setDate(currentWeekMonday.getDate() - todayDayOfWeek);
      const currentWeekMondayStr = formatDateStr(currentWeekMonday);

      const isCurrentPeriod = startDate === currentWeekMondayStr;
      const canStepForward = startDate < currentWeekMondayStr;

      const label = `Semaine du ${monday.getDate()} ${MONTH_SHORT_FR[monday.getMonth()]} au ${sunday.getDate()} ${MONTH_SHORT_FR[sunday.getMonth()]} ${sunday.getFullYear()}`;
      const priorPeriodLabel = 'vs semaine précédente';

      return {
        granularity: 'week',
        startDate,
        endDate,
        label,
        shortLabel: `Sem. du ${monday.getDate()} ${MONTH_SHORT_FR[monday.getMonth()]}`,
        priorStartDate,
        priorEndDate,
        priorPeriodLabel,
        isCurrentPeriod,
        canStepForward,
      };
    }

    case 'month': {
      const startDate = formatDateStr(new Date(year, month, 1));
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = formatDateStr(new Date(year, month, lastDay));

      const priorMonthDate = new Date(year, month - 1, 1);
      const priorLastDay = new Date(priorMonthDate.getFullYear(), priorMonthDate.getMonth() + 1, 0).getDate();
      const priorStartDate = formatDateStr(priorMonthDate);
      const priorEndDate = formatDateStr(new Date(priorMonthDate.getFullYear(), priorMonthDate.getMonth(), priorLastDay));

      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const isCurrentPeriod = year === currentYear && month === currentMonth;
      const canStepForward = year < currentYear || (year === currentYear && month < currentMonth);

      const monthName = MONTH_NAMES_FR[month];
      const priorMonthName = MONTH_NAMES_FR[priorMonthDate.getMonth()];
      const label = `${monthName} ${year}`;
      const priorPeriodLabel = `vs ${priorMonthName} ${priorMonthDate.getFullYear()}`;

      return {
        granularity: 'month',
        startDate,
        endDate,
        label,
        shortLabel: `${MONTH_SHORT_FR[month]} ${year}`,
        priorStartDate,
        priorEndDate,
        priorPeriodLabel,
        isCurrentPeriod,
        canStepForward,
      };
    }

    case 'quarter': {
      const qIndex = Math.floor(month / 3); // 0 (T1), 1 (T2), 2 (T3), 3 (T4)
      const qStartMonth = qIndex * 3;
      const qEndMonth = qStartMonth + 2;
      const qEndDay = new Date(year, qEndMonth + 1, 0).getDate();

      const startDate = formatDateStr(new Date(year, qStartMonth, 1));
      const endDate = formatDateStr(new Date(year, qEndMonth, qEndDay));

      // Prior quarter calculation (with year boundary wrapping)
      let priorQYear = year;
      let priorQIndex = qIndex - 1;
      if (priorQIndex < 0) {
        priorQIndex = 3;
        priorQYear = year - 1;
      }
      const priorQStartMonth = priorQIndex * 3;
      const priorQEndMonth = priorQStartMonth + 2;
      const priorQEndDay = new Date(priorQYear, priorQEndMonth + 1, 0).getDate();

      const priorStartDate = formatDateStr(new Date(priorQYear, priorQStartMonth, 1));
      const priorEndDate = formatDateStr(new Date(priorQYear, priorQEndMonth, priorQEndDay));

      const currentYear = now.getFullYear();
      const currentQIndex = Math.floor(now.getMonth() / 3);

      const isCurrentPeriod = year === currentYear && qIndex === currentQIndex;
      const canStepForward = year < currentYear || (year === currentYear && qIndex < currentQIndex);

      const label = `T${qIndex + 1} ${year} (${MONTH_SHORT_FR[qStartMonth]} - ${MONTH_SHORT_FR[qEndMonth]})`;
      const priorPeriodLabel = `vs T${priorQIndex + 1} ${priorQYear}`;

      return {
        granularity: 'quarter',
        startDate,
        endDate,
        label,
        shortLabel: `T${qIndex + 1} ${year}`,
        priorStartDate,
        priorEndDate,
        priorPeriodLabel,
        isCurrentPeriod,
        canStepForward,
      };
    }

    case 'year': {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const priorStartDate = `${year - 1}-01-01`;
      const priorEndDate = `${year - 1}-12-31`;

      const currentYear = now.getFullYear();
      const isCurrentPeriod = year === currentYear;
      const canStepForward = year < currentYear;

      const label = `Année ${year}`;
      const priorPeriodLabel = `vs Année ${year - 1}`;

      return {
        granularity: 'year',
        startDate,
        endDate,
        label,
        shortLabel: `${year}`,
        priorStartDate,
        priorEndDate,
        priorPeriodLabel,
        isCurrentPeriod,
        canStepForward,
      };
    }
  }
}

/**
 * Step reference date backward by 1 unit of the given granularity
 */
export function stepBackward(granularity: PeriodGranularity, referenceDateStr: string): string {
  const d = parseDateStr(referenceDateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  switch (granularity) {
    case 'day':
      d.setDate(d.getDate() - 1);
      return formatDateStr(d);

    case 'week':
      d.setDate(d.getDate() - 7);
      return formatDateStr(d);

    case 'month': {
      const targetMonth = month - 1;
      const targetYear = targetMonth < 0 ? year - 1 : year;
      const normalizedMonth = (targetMonth + 12) % 12;
      const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(day, maxDaysInTargetMonth);
      return formatDateStr(new Date(targetYear, normalizedMonth, clampedDay));
    }

    case 'quarter': {
      const targetMonth = month - 3;
      const targetYear = targetMonth < 0 ? year - 1 : year;
      const normalizedMonth = (targetMonth + 12) % 12;
      const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      return formatDateStr(new Date(targetYear, normalizedMonth, Math.min(day, maxDays)));
    }

    case 'year': {
      const targetYear = year - 1;
      const isLeapTarget = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
      const clampedDay = (month === 1 && day === 29 && !isLeapTarget) ? 28 : day;
      return formatDateStr(new Date(targetYear, month, clampedDay));
    }
  }
}

/**
 * Step reference date forward by 1 unit of the given granularity (if not in future)
 */
export function stepForward(granularity: PeriodGranularity, referenceDateStr: string): string {
  const d = parseDateStr(referenceDateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  switch (granularity) {
    case 'day':
      d.setDate(d.getDate() + 1);
      return formatDateStr(d);

    case 'week':
      d.setDate(d.getDate() + 7);
      return formatDateStr(d);

    case 'month': {
      const targetMonth = month + 1;
      const targetYear = targetMonth > 11 ? year + 1 : year;
      const normalizedMonth = targetMonth % 12;
      const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(day, maxDaysInTargetMonth);
      return formatDateStr(new Date(targetYear, normalizedMonth, clampedDay));
    }

    case 'quarter': {
      const targetMonth = month + 3;
      const targetYear = targetMonth > 11 ? year + 1 : year;
      const normalizedMonth = targetMonth % 12;
      const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      return formatDateStr(new Date(targetYear, normalizedMonth, Math.min(day, maxDays)));
    }

    case 'year': {
      const targetYear = year + 1;
      const isLeapTarget = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
      const clampedDay = (month === 1 && day === 29 && !isLeapTarget) ? 28 : day;
      return formatDateStr(new Date(targetYear, month, clampedDay));
    }
  }
}

/**
 * Helpers for quick jumps
 */
export function jumpToMonth(year: number, monthIndex: number): string {
  return formatDateStr(new Date(year, monthIndex, 1));
}

export function jumpToQuarter(year: number, quarterIndex: number): string {
  const startMonth = quarterIndex * 3;
  return formatDateStr(new Date(year, startMonth, 1));
}

export function jumpToYear(year: number): string {
  return formatDateStr(new Date(year, 0, 1));
}

export const FRENCH_MONTHS = MONTH_NAMES_FR.map((name, index) => ({
  index,
  name,
  shortName: MONTH_SHORT_FR[index],
}));
