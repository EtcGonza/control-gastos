import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TransactionsService } from '../../services/transactions.service';

@Component({
  selector: 'app-category-breakdown',
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-slate-800">Gastos por categoría</h2>
        <span class="text-xs text-slate-400">{{ tx.monthlyExpenses() | currency:'USD':'symbol':'1.0-0' }} totales</span>
      </div>

      @if (tx.expensesByCategory().length === 0) {
        <p class="text-sm text-slate-400 text-center py-6">
          Sin gastos cargados este mes.
        </p>
      } @else {
        <div class="space-y-3">
          @for (item of tx.expensesByCategory(); track item.category) {
            <div>
              <div class="flex justify-between items-center text-sm mb-1">
                <span class="flex items-center gap-2 text-slate-700">
                  <span class="w-2.5 h-2.5 rounded-full" [style.background-color]="color(item.category)"></span>
                  {{ item.category }}
                </span>
                <span class="text-slate-500 font-medium">
                  {{ item.total | currency:'USD':'symbol':'1.0-0' }}
                  <span class="text-xs text-slate-400 ml-1">
                    ({{ percentage(item.total) | number:'1.0-1' }}%)
                  </span>
                </span>
              </div>
              <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all"
                     [style.width.%]="percentage(item.total)"
                     [style.background-color]="color(item.category)">
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CategoryBreakdown {
  protected readonly tx = inject(TransactionsService);

  color(cat: string): string {
    return this.tx.colorForCategory(cat);
  }

  percentage(amount: number): number {
    const total = this.tx.monthlyExpenses();
    if (total === 0) return 0;
    return (amount / total) * 100;
  }
}
