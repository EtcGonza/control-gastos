import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { NavigationService } from '../../../../core/services/navigation.service';
import { MonthlyEntry, TransactionsService } from '../../../../core/services/transactions.service';

type TypeFilter = 'all' | 'ingreso' | 'gasto';
type SourceFilter = 'all' | 'transaction' | 'installment' | 'subscription';
type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-list.component.html',
})
export class TransactionListComponent {
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
    effect(() => {
      this.typeFilter();
      this.sourceFilter();
      this.categoryFilter();
      this.sort();
      this.tx.selectedMonth();
      untracked(() => this.currentPage.set(1));
    });
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
