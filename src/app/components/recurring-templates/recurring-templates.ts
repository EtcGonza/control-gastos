import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecurringTemplate } from '../../core/models/recurring-template/recurring-template.model';
import { TransactionsService } from '../../services/transactions.service';

@Component({
  selector: 'app-recurring-templates',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <button type="button" (click)="toggleExpanded()"
              class="w-full flex items-center justify-between text-left"
              [class.mb-4]="expanded()"
              [attr.aria-expanded]="expanded()">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
          </span>
          Fijos guardados
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {{ tx.templates().length }}
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
      @if (tx.templates().length === 0) {
        <div class="text-center py-6 text-slate-400">
          <p class="text-sm">No hay fijos guardados todavía.</p>
          <p class="text-xs mt-1">
            Marcá una transacción como <b>fija</b> al cargarla y se guardará acá como atajo.
          </p>
        </div>
      } @else {
        <!-- Tabs ingreso / gasto -->
        <div class="flex gap-1 mb-2 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          <button type="button" (click)="filter.set('todos')"
                  class="flex-1 py-1.5 rounded-lg transition"
                  [ngClass]="filter() === 'todos' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
            Todos
          </button>
          <button type="button" (click)="filter.set('gasto')"
                  class="flex-1 py-1.5 rounded-lg transition"
                  [ngClass]="filter() === 'gasto' ? 'bg-white shadow text-rose-600' : 'text-slate-500'">
            Gastos
          </button>
          <button type="button" (click)="filter.set('ingreso')"
                  class="flex-1 py-1.5 rounded-lg transition"
                  [ngClass]="filter() === 'ingreso' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'">
            Ingresos
          </button>
        </div>

        <!-- Toggle: ocultar ya cargados este mes -->
        <label class="flex items-center justify-between gap-2 mb-3 px-1 py-2 cursor-pointer select-none">
          <span class="text-xs text-slate-600">
            Ocultar los ya cargados este mes
            @if (appliedCount() > 0) {
              <span class="text-slate-400">({{ appliedCount() }})</span>
            }
          </span>
          <button type="button" role="switch"
                  [attr.aria-checked]="hideApplied()"
                  (click)="toggleHideApplied()"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition"
                  [ngClass]="hideApplied() ? 'bg-indigo-600' : 'bg-slate-300'">
            <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition"
                  [ngClass]="hideApplied() ? 'translate-x-5' : 'translate-x-1'"></span>
          </button>
        </label>

        <ul class="space-y-2">
          @for (t of filtered(); track t.id) {
            <li class="border border-slate-100 rounded-xl p-3 hover:border-indigo-200 transition group">
              <div class="flex items-center gap-3">
                <span class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      [style.background-color]="tx.colorForCategory(t.category)">
                  {{ tx.nameForCategory(t.category).charAt(0) }}
                </span>

                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-800 truncate text-sm">{{ t.description }}</p>
                  <p class="text-[11px] text-slate-400">
                    {{ tx.nameForCategory(t.category) }} ·
                    <span [ngClass]="t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'">
                      {{ t.type === 'ingreso' ? 'Ingreso' : 'Gasto' }} fijo
                    </span>
                  </p>
                </div>

                <!-- Monto editable inline -->
                @if (editingId() === t.id) {
                  <div class="flex items-center gap-1">
                    <input #amtInput type="number" min="0" step="0.01"
                           [(ngModel)]="editAmount"
                           (keydown.enter)="confirmEdit(t.id)"
                           (keydown.escape)="cancelEdit()"
                           class="w-20 rounded-lg border border-indigo-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <button type="button" (click)="confirmEdit(t.id)"
                            class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center"
                            title="Guardar">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button type="button" (click)="cancelEdit()"
                            class="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                            title="Cancelar">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                } @else {
                  <button type="button" (click)="startEdit(t)"
                          class="text-sm font-semibold whitespace-nowrap px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                          [ngClass]="t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'"
                          title="Click para modificar el monto">
                    {{ t.amount | currency:'USD':'symbol':'1.2-2' }}
                  </button>
                }
              </div>

              <!-- Acciones -->
              <div class="flex items-center gap-2 mt-2">
                @if (tx.isTemplateAppliedThisMonth(t)) {
                  <span class="flex-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 rounded-lg px-2 py-1.5 text-center">
                    Ya cargado este mes
                  </span>
                } @else {
                  <button type="button" (click)="apply(t.id)"
                          class="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center justify-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Cargar en {{ monthLabel() }}
                  </button>
                }
                <button type="button" (click)="remove(t.id)"
                        class="text-slate-300 hover:text-rose-500 transition p-1.5"
                        title="Eliminar plantilla">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </li>
          }
        </ul>
      }
      }
    </div>
  `,
})
export class RecurringTemplates {
  protected readonly tx = inject(TransactionsService);

  private readonly EXPANDED_KEY = 'control-gastos:templates-expanded';
  private readonly HIDE_APPLIED_KEY = 'control-gastos:templates-hide-applied';

  protected readonly filter = signal<'todos' | 'gasto' | 'ingreso'>('todos');
  protected readonly editingId = signal<string | null>(null);
  protected readonly expanded = signal<boolean>(this.loadExpanded());
  protected readonly hideApplied = signal<boolean>(this.loadHideApplied());
  protected editAmount: number | null = null;

  /** Cantidad de plantillas que ya están aplicadas en el mes seleccionado. */
  protected readonly appliedCount = computed(
    () => this.tx.templates().filter((t) => this.tx.isTemplateAppliedThisMonth(t)).length
  );

  toggleHideApplied(): void {
    this.hideApplied.update((v) => !v);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.HIDE_APPLIED_KEY, String(this.hideApplied()));
    }
  }

  private loadHideApplied(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const v = localStorage.getItem(this.HIDE_APPLIED_KEY);
    return v === null ? false : v === 'true';
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

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const hide = this.hideApplied();
    let list = this.tx.templates();
    if (f !== 'todos') list = list.filter((t) => t.type === f);
    if (hide) list = list.filter((t) => !this.tx.isTemplateAppliedThisMonth(t));
    return list;
  });

  protected readonly monthLabel = computed(() => {
    const [y, m] = this.tx.selectedMonth().split('-').map(Number);
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${names[m - 1]} ${y}`;
  });

  color(cat: string): string {
    return this.tx.colorForCategory(cat);
  }

  startEdit(t: RecurringTemplate): void {
    this.editingId.set(t.id);
    this.editAmount = t.amount;
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editAmount = null;
  }

  confirmEdit(id: string): void {
    if (this.editAmount != null && this.editAmount >= 0) {
      this.tx.updateTemplateAmount(id, Number(this.editAmount));
    }
    this.cancelEdit();
  }

  apply(id: string): void {
    this.tx.applyTemplateToSelectedMonth(id);
  }

  remove(id: string): void {
    this.tx.removeTemplate(id);
  }
}
