const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

export function isValidISODate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateParts(iso: string): { year: number; month: number; day: number; weekday: number } {
  if (!isValidISODate(iso)) throw new Error(`Fecha inválida: ${iso}`);
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return { year: year!, month: month!, day: day!, weekday };
}

/** «jue 26 nov 2026» — calendar date, not a timezone-shifted instant. */
export function formatDayLabel(iso: string): string {
  const { year, month, day, weekday } = dateParts(iso);
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

export function formatMonthLabel(iso: string): string {
  const { year, month } = dateParts(iso);
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatLongDate(iso: string): string {
  const { year, month, day, weekday } = dateParts(iso);
  const name = WEEKDAYS_LONG[weekday]!;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${day} de ${MONTHS[month - 1]} de ${year}`;
}

export function editionPath(date: string, base: string): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${date}/`;
}

export interface Dated {
  date: string;
}

/** Items must already be sorted newest first. Months stay in that order. */
export function groupByMonth<T extends Dated>(items: readonly T[]): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = item.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({ key, label: formatMonthLabel(item.date), items: [item] });
    } else {
      last.items.push(item);
    }
  }
  return groups;
}

/**
 * `dates` is newest first.
 * `prev` is the older edition (día anterior). `next` is the newer one (día siguiente).
 */
export function neighbors(dates: readonly string[], date: string): { prev: string | null; next: string | null } {
  const index = dates.indexOf(date);
  if (index === -1) return { prev: null, next: null };
  return {
    next: index > 0 ? dates[index - 1]! : null,
    prev: index < dates.length - 1 ? dates[index + 1]! : null,
  };
}
