import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomCategoryType } from '../../models/custom-category.model';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../../models/transaction.model';
import { ConfirmService } from '../../services/confirm.service';
import { TransactionsService } from '../../services/transactions.service';

const DEFAULT_COLOR_PALETTE = [
  '#a855f7', '#06b6d4', '#f472b6', '#84cc16', '#eab308',
  '#ef4444', '#0ea5e9', '#22c55e', '#f97316', '#8b5cf6',
];

@Component({
  selector: 'app-categories-manager',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <button type="button" (click)="toggleExpanded()"
              class="w-full flex items-center justify-between text-left"
              [class.mb-4]="expanded()">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </span>
          Categorías
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {{ tx.customCategories().length }}
          </span>
          <span class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform"
                 [class.rotate-180]="expanded()"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </button>

      @if (expanded()) {
        <!-- Tabs: Gastos / Ingresos -->
        <div class="flex gap-1 mb-3 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          <button type="button" (click)="activeTab.set('expense')"
                  class="flex-1 py-1.5 rounded-lg transition"
                  [ngClass]="activeTab() === 'expense' ? 'bg-white shadow text-rose-600' : 'text-slate-500'">
            Gastos / Tarjeta
          </button>
          <button type="button" (click)="activeTab.set('income')"
                  class="flex-1 py-1.5 rounded-lg transition"
                  [ngClass]="activeTab() === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'">
            Ingresos
          </button>
        </div>

        <!-- Lista default + custom -->
        <div class="space-y-1.5 mb-3">
          @for (cat of defaultsForTab(); track cat) {
            <div class="flex items-center gap-2 px-2 py-1.5 text-xs">
              <span class="w-3 h-3 rounded-full flex-shrink-0"
                    [style.background-color]="tx.colorForCategory(cat)"></span>
              <span class="flex-1 text-slate-700">{{ cat }}</span>
              <span class="text-[10px] text-slate-400 uppercase">Default</span>
            </div>
          }
          @for (cat of customsForTab(); track cat.id) {
            <div class="flex items-center gap-2 px-2 py-1.5 text-xs">
              <span class="w-3 h-3 rounded-full flex-shrink-0"
                    [style.background-color]="cat.color"></span>
              <span class="flex-1 text-slate-700">{{ cat.name }}</span>
              <button type="button" (click)="remove(cat.id, cat.name)"
                      class="text-slate-300 hover:text-rose-500 transition p-0.5"
                      title="Eliminar categoría">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          }
        </div>

        <!-- Form de alta inline -->
        <form (ngSubmit)="add()" #f="ngForm" class="border-t border-slate-100 pt-3 flex items-center gap-2">
          <input type="color" [(ngModel)]="newColor" name="color"
                 class="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer flex-shrink-0"
                 title="Color de la categoría">
          <input type="text" [(ngModel)]="newName" name="name" required
                 maxlength="30"
                 placeholder="Nombre de la categoría"
                 class="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
          <button type="submit" [disabled]="!f.valid || !canAdd()"
                  class="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-fuchsia-600 hover:bg-fuchsia-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            Agregar
          </button>
        </form>

        @if (error()) {
          <p class="text-[11px] text-rose-600 mt-2">{{ error() }}</p>
        }

        <p class="text-[11px] text-slate-400 mt-3">
          Las categorías default no se pueden eliminar. Si borrás una categoría custom, los movimientos que la usaban siguen mostrando ese nombre pero quedan en color genérico.
        </p>
      }
    </div>
  `,
})
export class CategoriesManager {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  private readonly EXPANDED_KEY = 'control-gastos:categories-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());

  protected readonly activeTab = signal<CustomCategoryType>('expense');

  protected newName = '';
  protected newColor = DEFAULT_COLOR_PALETTE[0];

  protected readonly error = signal<string | null>(null);

  protected readonly defaultsForTab = computed<readonly string[]>(() =>
    this.activeTab() === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  );

  protected readonly customsForTab = computed(() =>
    this.tx.customCategories().filter((c) => c.type === this.activeTab())
  );

  protected canAdd(): boolean {
    return this.newName.trim().length > 0;
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.EXPANDED_KEY, String(this.expanded()));
    }
  }

  private loadExpanded(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const v = localStorage.getItem(this.EXPANDED_KEY);
    return v === null ? false : v === 'true';
  }

  add(): void {
    this.error.set(null);
    const result = this.tx.addCustomCategory({
      name: this.newName,
      type: this.activeTab(),
      color: this.newColor,
    });
    if (!result) {
      this.error.set('Ya existe una categoría con ese nombre.');
      return;
    }
    this.newName = '';
    // Rotar color para la próxima
    const used = this.tx
      .customCategories()
      .map((c) => c.color.toLowerCase());
    const next = DEFAULT_COLOR_PALETTE.find((c) => !used.includes(c.toLowerCase()));
    this.newColor = next ?? DEFAULT_COLOR_PALETTE[0];
  }

  async remove(id: string, name: string): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar categoría',
      message: `¿Eliminar la categoría "${name}"? Los movimientos que ya la usan no se modifican, pero la categoría dejará de aparecer en los formularios.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeCustomCategory(id);
    }
  }
}
