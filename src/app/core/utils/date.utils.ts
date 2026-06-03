/** Devuelve el mes actual en formato `YYYY-MM`. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Hoy en ISO `YYYY-MM-DD`. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Diferencia en meses entre dos `YYYY-MM` (b - a).
 * Ej: `monthDiff('2026-01', '2026-04') === 3`.
 */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/**
 * Clampa un día al último día válido del mes/año pasado.
 * Ej: `clampDayInMonth(2026, 2, 30) === 28`.
 */
export function clampDayInMonth(year: number, month1Based: number, day: number): number {
  const lastDay = new Date(year, month1Based, 0).getDate();
  return Math.min(day, lastDay);
}

/** Nombre corto del mes (1-12) en español. */
const MONTH_SHORT_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Devuelve `Mar 2026` a partir de `2026-03`. */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_SHORT_NAMES[m - 1]} ${y}`;
}
