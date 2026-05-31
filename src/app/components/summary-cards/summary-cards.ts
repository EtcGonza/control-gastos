import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TransactionsService } from '../../services/transactions.service';

@Component({
  selector: 'app-summary-cards',
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Ingresos -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 text-sm font-medium">Ingresos del mes</span>
            <span class="info-trigger w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center cursor-help">i</span>
          </div>
          <span class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </span>
        </div>
        <p class="text-2xl font-bold text-slate-800">{{ tx.monthlyIncome() | currency:'USD':'symbol':'1.2-2' }}</p>

        <div class="tooltip">
          <p class="font-semibold mb-1">Ingresos del mes</p>
          <p class="text-slate-300">
            Suma de todos los movimientos de tipo <b class="text-emerald-300">Ingreso</b>
            cargados en el mes seleccionado (sueldo, horas extras, etc.).
          </p>
        </div>
      </div>

      <!-- Gastos -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 text-sm font-medium">Gastos del mes</span>
            <span class="info-trigger w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center cursor-help">i</span>
          </div>
          <span class="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
          </span>
        </div>
        <p class="text-2xl font-bold text-slate-800">{{ tx.monthlyExpenses() | currency:'USD':'symbol':'1.2-2' }}</p>

        <div class="tooltip">
          <p class="font-semibold mb-1">Gastos del mes</p>
          <p class="text-slate-300">
            Suma de todos los movimientos de tipo <b class="text-rose-300">Gasto</b>
            del mes seleccionado, incluyendo <b>fijos</b> y <b>variables</b>.
          </p>
        </div>
      </div>

      <!-- Balance -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 text-sm font-medium">Queda a fin de mes</span>
            <span class="info-trigger w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center cursor-help">i</span>
          </div>
          <span class="w-9 h-9 rounded-full flex items-center justify-center"
                [ngClass]="tx.monthlyBalance() >= 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.45 7.45A1.55 1.55 0 0 1 4 5.9h16a1.55 1.55 0 0 1 1.55 1.55v9.1A1.55 1.55 0 0 1 20 18.1H4a1.55 1.55 0 0 1-1.55-1.55Z"/><path d="M16 14h2"/></svg>
          </span>
        </div>
        <p class="text-2xl font-bold"
           [ngClass]="tx.monthlyBalance() >= 0 ? 'text-emerald-600' : 'text-rose-600'">
          {{ tx.monthlyBalance() | currency:'USD':'symbol':'1.2-2' }}
        </p>

        <div class="tooltip">
          <p class="font-semibold mb-1">Queda a fin de mes</p>
          <p class="text-slate-300">
            Diferencia entre <b>Ingresos − Gastos</b> del mes.
            Si es positivo, es lo que te sobra para ahorrar o vivir; si es negativo, gastaste más de lo que entró.
          </p>
        </div>
      </div>

      <!-- % Gastos fijos -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 text-sm font-medium">Gastos fijos / ingresos</span>
            <span class="info-trigger w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center cursor-help">i</span>
          </div>
          <span class="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
        </div>
        <div class="flex items-baseline gap-2">
          <p class="text-2xl font-bold text-slate-800">{{ tx.fixedExpensesPercentage() | number:'1.0-1' }}%</p>
          <span class="text-xs text-slate-400">{{ tx.monthlyFixedExpenses() | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
        <div class="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all"
               [style.width.%]="getCapped(tx.fixedExpensesPercentage())"
               [ngClass]="barColor(tx.fixedExpensesPercentage())">
          </div>
        </div>

        <div class="tooltip">
          <p class="font-semibold mb-1">Gastos fijos sobre ingresos</p>
          <p class="text-slate-300">
            Porción de tus ingresos del mes que se va en <b>gastos marcados como fijos</b>
            (alquiler, servicios, suscripciones, etc.).
          </p>
          <p class="text-slate-400 text-[11px] mt-2">
            Cálculo: gastos fijos ÷ ingresos del mes · 100.
            <br>Color: <span class="text-emerald-300">verde</span> &lt; 50%,
            <span class="text-amber-300">ámbar</span> 50–80%,
            <span class="text-rose-300">rojo</span> &gt; 80%.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tooltip {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background: #0f172a;
      color: #fff;
      font-size: 12px;
      line-height: 1.4;
      padding: 10px 12px;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-4px);
      transition: opacity 150ms ease, transform 150ms ease, visibility 150ms;
      z-index: 30;
      pointer-events: none;
    }
    .tooltip::before {
      content: '';
      position: absolute;
      top: -5px;
      left: 24px;
      width: 10px;
      height: 10px;
      background: #0f172a;
      transform: rotate(45deg);
      border-radius: 2px;
    }
    .group:hover .tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .info-trigger {
      transition: background-color 150ms;
    }
    .group:hover .info-trigger {
      background-color: #6366f1;
      color: #fff;
    }
  `],
})
export class SummaryCards {
  protected readonly tx = inject(TransactionsService);

  getCapped(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  barColor(pct: number): string {
    if (pct < 50) return 'bg-emerald-500';
    if (pct < 80) return 'bg-amber-500';
    return 'bg-rose-500';
  }
}
