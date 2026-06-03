import { Injectable, signal } from '@angular/core';
import { currentMonthKey } from '../utils/date.utils';

/**
 * Mes seleccionado para vistas mensuales (lista, summary, charts).
 *
 * Es un singleton compartido entre las páginas Mes y Análisis. Los demás
 * services derivan sus computeds de este signal cuando necesitan "lo del mes
 * actual".
 */
@Injectable({ providedIn: 'root' })
export class MonthService {
  private readonly _selectedMonth = signal<string>(currentMonthKey());
  readonly selectedMonth = this._selectedMonth.asReadonly();

  setMonth(month: string): void {
    this._selectedMonth.set(month);
  }
}
