import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../services/confirm.service';
import { NavigationService } from '../../services/navigation.service';
import { MonthlyEntry, TransactionsService } from '../../services/transactions.service';

type TypeFilter = 'all' | 'ingreso' | 'gasto';
type SourceFilter = 'all' | 'transaction' | 'installment' | 'subscription';
type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

@Component({
  selector: 'app-transaction-list',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-slate-800">Movimientos del mes</h2>
        <span class="text-xs text-slate-400">
          @if (anyFilterActive()) {
            {{ filtered().length }} de {{ tx.monthlyEntries().length }}
          } @else {
            {{ tx.monthlyEntries().length }} registros
          }
        </span>
      </div>

      <!-- ====== Filtros y orden ====== -->
      @if (tx.monthlyEntries().length > 0) {
        <div class="space-y-2 mb-4">
          <!-- Tipo -->
          <div class="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button type="button" (click)="typeFilter.set('all')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="typeFilter() === 'all' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
              Todos
            </button>
            <button type="button" (click)="typeFilter.set('ingreso')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="typeFilter() === 'ingreso' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'">
              Ingresos
            </button>
            <button type="button" (click)="typeFilter.set('gasto')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="typeFilter() === 'gasto' ? 'bg-white shadow text-rose-600' : 'text-slate-500'">
              Gastos
            </button>
          </div>

          <!-- Origen -->
          <div class="flex gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-medium">
            <button type="button" (click)="sourceFilter.set('all')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="sourceFilter() === 'all' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
              Todos
            </button>
            <button type="button" (click)="sourceFilter.set('transaction')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="sourceFilter() === 'transaction' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
              Manuales
            </button>
            <button type="button" (click)="sourceFilter.set('installment')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="sourceFilter() === 'installment' ? 'bg-white shadow text-purple-700' : 'text-slate-500'">
              Cuotas
            </button>
            <button type="button" (click)="sourceFilter.set('subscription')"
                    class="flex-1 py-1.5 rounded-lg transition"
                    [ngClass]="sourceFilter() === 'subscription' ? 'bg-white shadow text-pink-700' : 'text-slate-500'">
              Suscrip.
            </button>
          </div>

          <!-- Categoría + Orden -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="relative">
              <select [(ngModel)]="categoryFilterValue"
                      class="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">Categoría: todas</option>
                @for (cat of availableCategories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="relative">
              <select [(ngModel)]="sortValue"
                      class="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="date-desc">Ordenar: Fecha (más nuevo)</option>
                <option value="date-asc">Ordenar: Fecha (más viejo)</option>
                <option value="amount-desc">Ordenar: Monto (mayor)</option>
                <option value="amount-asc">Ordenar: Monto (menor)</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          @if (anyFilterActive()) {
            <button type="button" (click)="resetFilters()"
                    class="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition">
              ✕ Limpiar filtros
            </button>
          }
        </div>
      }

      @if (tx.monthlyEntries().length === 0) {
        <div class="text-center py-10 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p class="text-sm">No hay movimientos registrados.</p>
          <p class="text-xs">Empezá agregando un ingreso o un gasto.</p>
        </div>
      } @else if (filtered().length === 0) {
        <div class="text-center py-8 text-slate-400">
          <p class="text-sm">No hay movimientos que coincidan con los filtros.</p>
          <button type="button" (click)="resetFilters()"
                  class="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
            Limpiar filtros
          </button>
        </div>
      } @else {
        <ul class="divide-y divide-slate-100 -mx-2">
          @for (t of paginated(); track t.id) {
            @if (editingId() === t.id && t.source === 'transaction') {
              <!-- ===== Modo edición de movimiento manual ===== -->
              <li class="px-2 py-3 bg-indigo-50/40 rounded-lg my-0.5">
                <div class="grid grid-cols-12 gap-2">
                  <div class="col-span-12">
                    <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Descripción</label>
                    <input type="text" [(ngModel)]="editDescription"
                           class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  </div>
                  <div class="col-span-6 sm:col-span-3">
                    <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Monto</label>
                    <input type="number" min="0" step="0.01" [(ngModel)]="editAmount"
                           class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  </div>
                  <div class="col-span-6 sm:col-span-3">
                    <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Fecha</label>
                    <input type="date" [(ngModel)]="editDate"
                           class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  </div>
                  <div class="col-span-12 sm:col-span-6">
                    <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Categoría</label>
                    <select [(ngModel)]="editCategory"
                            class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      @for (cat of editCategoryOptions(); track cat.id) {
                        <option [value]="cat.id">{{ cat.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-span-12 flex items-center justify-between flex-wrap gap-2">
                    <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                      <input type="checkbox" [(ngModel)]="editFixed"
                             class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                      Marcado como fijo mensual
                    </label>
                    <div class="flex gap-2">
                      <button type="button" (click)="cancelEditTx()"
                              class="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-300 transition">
                        Cancelar
                      </button>
                      <button type="button" (click)="saveEditTx(t)"
                              class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition">
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            } @else {
            <li class="flex items-center gap-3 px-2 py-3 hover:bg-slate-50 rounded-lg transition group">
              <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    [style.background-color]="tx.colorForCategory(t.category)">
                {{ tx.nameForCategory(t.category).charAt(0) }}
              </span>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-medium text-slate-800 truncate">{{ t.description }}</p>
                  @if (t.installment) {
                    <span class="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full uppercase">
                      Cuota {{ t.installment.number }}/{{ t.installment.total }}
                    </span>
                  } @else if (t.subscription) {
                    <span class="text-[10px] font-semibold text-pink-700 bg-pink-100 px-1.5 py-0.5 rounded-full uppercase">
                      Suscripción
                    </span>
                  } @else if (t.fixed) {
                    <span class="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full uppercase">Fijo</span>
                  }
                  @if (t.currency === 'USD') {
                    <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase">USD</span>
                    @if (t.conversion?.surchargePct && t.conversion!.surchargePct > 0) {
                      <span class="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase">
                        +{{ (t.conversion!.surchargePct * 100) | number:'1.0-0' }}%
                      </span>
                    }
                    @if (t.conversion?.usdDirect) {
                      <span class="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full uppercase">
                        Pago USD
                      </span>
                    }
                  }
                </div>
                <p class="text-xs text-slate-400">
                  {{ tx.nameForCategory(t.category) }} ·
                  @if (t.installment) {
                    <span>{{ t.installment.cardLabel }}</span>
                  } @else if (t.subscription) {
                    <span>{{ t.subscription.cardLabel }}</span>
                  } @else {
                    <span>{{ t.date | date:'dd MMM' }}</span>
                  }
                </p>
              </div>

              <div class="text-right whitespace-nowrap">
                <p class="font-semibold text-sm"
                   [ngClass]="t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'">
                  {{ t.type === 'ingreso' ? '+' : '-' }}{{ t.currency === 'USD' ? 'US$' : '$' }}{{ t.amount | number:'1.2-2' }}
                </p>
                @if (arsConv(t); as conv) {
                  <p class="text-[11px] text-slate-400">
                    {{ conv.estimated ? '≈ ' : '' }}{{ '$' }}{{ conv.arsAmount | number:'1.2-2' }} ARS
                    <span class="text-slate-300"
                          [attr.title]="'TC ' + conv.rateDate + ' · $' + (conv.rate | number:'1.2-2')">
                      ({{ conv.estimated ? 'TC estimado' : 'TC oficial' }})
                    </span>
                  </p>
                }
              </div>

              <!-- Acción contextual (siempre reserva el espacio para mantener alineación) -->
              <div class="w-14 flex-shrink-0 flex items-center justify-end gap-0.5">
                @if (t.source === 'transaction') {
                  <button type="button" (click)="startEditTx(t)"
                          class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition p-1"
                          title="Editar movimiento">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  </button>
                  <button type="button" (click)="tx.remove(t.id)"
                          class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition p-1"
                          title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                } @else if (t.installment) {
                  <button type="button" (click)="removePurchase(t.installment.purchaseId)"
                          class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition p-1"
                          title="Eliminar la compra entera (todas las cuotas)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                } @else if (t.subscription) {
                  <button type="button" (click)="goToSubscriptions()"
                          class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition p-1"
                          title="Ir a Suscripciones">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                }
              </div>
            </li>
            }
          }
        </ul>

        <!-- ===== Paginación (siempre visible cuando hay movimientos) ===== -->
        @if (filtered().length > 0) {
          <div class="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
            <div class="flex items-center gap-2">
              <span>Mostrando {{ pageStart() }}-{{ pageEnd() }} de {{ filtered().length }}</span>
            </div>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1.5">
                <span class="text-slate-500">Por página:</span>
                <select [(ngModel)]="pageSizeValue"
                        class="rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option [value]="10">10</option>
                  <option [value]="15">15</option>
                  <option [value]="20">20</option>
                  <option [value]="30">30</option>
                </select>
              </label>
              <!-- Botones prev/next sólo cuando hay más de una página -->
              @if (totalPages() > 1) {
                <div class="flex items-center gap-1">
                  <button type="button" (click)="goToPage(currentPage() - 1)"
                          [disabled]="currentPage() === 1"
                          class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Anterior">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span class="px-2 font-semibold text-slate-700 tabular-nums">
                    {{ currentPage() }} / {{ totalPages() }}
                  </span>
                  <button type="button" (click)="goToPage(currentPage() + 1)"
                          [disabled]="currentPage() >= totalPages()"
                          class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Siguiente">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class TransactionList {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly nav = inject(NavigationService);

  // ============ Edición de movimiento manual ============
  protected readonly editingId = signal<string | null>(null);
  protected editDescription = '';
  protected editAmount: number | null = null;
  protected editCategory = '';
  protected editDate = '';
  protected editFixed = false;

  /** Categorías disponibles según el tipo del movimiento en edición. */
  protected readonly editCategoryOptions = computed(() => {
    const id = this.editingId();
    if (!id) return [];
    const t = this.tx.transactions().find((x) => x.id === id);
    if (!t) return [];
    return t.type === 'ingreso'
      ? this.tx.allIncomeCategories()
      : this.tx.allExpenseCategories();
  });

  startEditTx(t: MonthlyEntry): void {
    if (t.source !== 'transaction') return;
    this.editingId.set(t.id);
    this.editDescription = t.description;
    this.editAmount = t.amount;
    this.editCategory = t.category;
    this.editDate = t.date;
    this.editFixed = t.fixed;
  }

  cancelEditTx(): void {
    this.editingId.set(null);
  }

  saveEditTx(t: MonthlyEntry): void {
    if (this.editingId() !== t.id) return;
    if (!this.editDescription.trim() || this.editAmount == null || this.editAmount <= 0) return;
    this.tx.updateTransaction(t.id, {
      description: this.editDescription,
      amount: Number(this.editAmount),
      category: this.editCategory,
      date: this.editDate,
      fixed: this.editFixed,
    });
    this.editingId.set(null);
  }

  // ============ Filtros y orden ============
  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly sourceFilter = signal<SourceFilter>('all');
  protected readonly categoryFilter = signal<string>('all');
  protected readonly sort = signal<SortMode>('date-desc');

  // Bindings ngModel para select (delegan a los signals)
  get categoryFilterValue(): string {
    return this.categoryFilter();
  }
  set categoryFilterValue(v: string) {
    this.categoryFilter.set(v);
  }

  get sortValue(): SortMode {
    return this.sort();
  }
  set sortValue(v: SortMode) {
    this.sort.set(v);
  }

  /** Categorías únicas presentes en las entradas del mes — devuelve {id, name} para mostrar el nombre. */
  protected readonly availableCategories = computed(() => {
    const ids = new Set<string>();
    this.tx.monthlyEntries().forEach((e) => ids.add(e.category));
    return Array.from(ids)
      .map((id) => ({ id, name: this.tx.nameForCategory(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly anyFilterActive = computed(
    () =>
      this.typeFilter() !== 'all' ||
      this.sourceFilter() !== 'all' ||
      this.categoryFilter() !== 'all' ||
      this.sort() !== 'date-desc'
  );

  /** Entradas filtradas + ordenadas. */
  protected readonly filtered = computed(() => {
    const tf = this.typeFilter();
    const sf = this.sourceFilter();
    const cf = this.categoryFilter();
    const so = this.sort();

    let list = this.tx.monthlyEntries().filter((e) => {
      if (tf !== 'all' && e.type !== tf) return false;
      if (sf !== 'all' && e.source !== sf) return false;
      if (cf !== 'all' && e.category !== cf) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (so) {
        case 'date-asc':
          return a.date.localeCompare(b.date);
        case 'date-desc':
          return b.date.localeCompare(a.date);
        case 'amount-asc':
          return this.comparableAmount(a) - this.comparableAmount(b);
        case 'amount-desc':
          return this.comparableAmount(b) - this.comparableAmount(a);
      }
    });

    return list;
  });

  /** Para ordenar por monto: mezcla ARS y USD usando el TC actual como denominador común. */
  private comparableAmount(e: MonthlyEntry): number {
    if (e.currency === 'ARS') return e.amount;
    const conv = this.tx.convertEntryToArs(e);
    if (conv) return conv.arsAmount;
    // Cuota pago-directo-USD o sin TC: estimamos con el último TC conocido
    const latest = this.tx.latestRate();
    return latest ? e.amount * latest.rate : e.amount;
  }

  resetFilters(): void {
    this.typeFilter.set('all');
    this.sourceFilter.set('all');
    this.categoryFilter.set('all');
    this.sort.set('date-desc');
  }

  // ============ Paginación ============
  private readonly PAGE_SIZE_KEY = 'control-gastos:tx-list-page-size';
  protected readonly pageSize = signal<number>(this.loadPageSize());
  protected readonly currentPage = signal<number>(1);

  get pageSizeValue(): number {
    return this.pageSize();
  }
  set pageSizeValue(v: number) {
    const n = Number(v);
    this.pageSize.set(n);
    this.currentPage.set(1);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.PAGE_SIZE_KEY, String(n));
    }
  }

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize()))
  );

  protected readonly paginated = computed(() => {
    const size = this.pageSize();
    const page = this.currentPage();
    const start = (page - 1) * size;
    return this.filtered().slice(start, start + size);
  });

  protected pageStart(): number {
    if (this.filtered().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  protected pageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filtered().length);
  }

  goToPage(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(clamped);
  }

  private loadPageSize(): number {
    if (typeof localStorage === 'undefined') return 10;
    const v = localStorage.getItem(this.PAGE_SIZE_KEY);
    const n = v ? Number(v) : 10;
    return [10, 15, 20, 30].includes(n) ? n : 10;
  }

  constructor() {
    // Si cambian los filtros o el mes, volver a la página 1
    effect(() => {
      this.typeFilter();
      this.sourceFilter();
      this.categoryFilter();
      this.sort();
      this.tx.selectedMonth();
      untracked(() => this.currentPage.set(1));
    });
    // Si la página actual queda fuera de rango (ej. borrar items), retroceder.
    effect(() => {
      const tp = this.totalPages();
      if (this.currentPage() > tp) {
        untracked(() => this.currentPage.set(tp));
      }
    });
  }

  color(cat: string): string {
    return this.tx.colorForCategory(cat);
  }

  arsConv(t: MonthlyEntry) {
    if (t.currency !== 'USD' || t.conversion?.usdDirect) return null;
    return this.tx.convertEntryToArs(t);
  }

  goToSubscriptions(): void {
    this.nav.setSection('suscripciones');
  }

  async removePurchase(id: string): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar compra',
      message: 'Se borran todas las cuotas de esta compra (pasadas y futuras). Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removePurchase(id);
    }
  }
}
