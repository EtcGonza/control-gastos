/** Redondea a 2 decimales sin sorpresas de punto flotante. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
