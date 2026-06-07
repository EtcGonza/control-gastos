import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecurringTemplate } from '../../../../core/models/recurring-template/recurring-template.model';
import { TransactionsService } from '../../../../core/services/transactions.service';

@Component({
  selector: 'app-recurring-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recurring-templates.component.html',
})
export class RecurringTemplatesComponent {
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
