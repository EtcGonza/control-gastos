import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomCategory, CustomCategoryType } from '../../../../core/models/category/custom-category.model';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '../../../../core/models/transaction/transaction.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { TransactionsService } from '../../../../core/services/transactions.service';

const DEFAULT_COLOR_PALETTE = [
  '#a855f7', '#06b6d4', '#f472b6', '#84cc16', '#eab308',
  '#ef4444', '#0ea5e9', '#22c55e', '#f97316', '#8b5cf6',
];

@Component({
  selector: 'app-categories-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories-manager.component.html',
})
export class CategoriesManagerComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  protected readonly activeTab = signal<CustomCategoryType>('expense');
  protected readonly showArchived = signal<boolean>(false);

  // ---- form alta ----
  protected newName = '';
  protected newColor = DEFAULT_COLOR_PALETTE[0];
  protected readonly error = signal<string | null>(null);

  // ---- edit inline ----
  protected readonly editingId = signal<string | null>(null);
  protected editName = '';
  protected editColor = DEFAULT_COLOR_PALETTE[0];
  protected readonly editError = signal<string | null>(null);

  protected readonly defaultsForTab = computed(() =>
    this.activeTab() === 'expense'
      ? DEFAULT_EXPENSE_CATEGORIES
      : DEFAULT_INCOME_CATEGORIES
  );

  protected readonly activeCustoms = computed(() =>
    this.tx.customCategories().filter((c) => !c.archived)
  );

  protected readonly activeCustomsForTab = computed(() =>
    this.tx.customCategories().filter((c) => c.type === this.activeTab() && !c.archived)
  );

  protected readonly archivedCustomsForTab = computed(() =>
    this.tx.customCategories().filter((c) => c.type === this.activeTab() && c.archived)
  );

  protected canAdd(): boolean {
    return this.newName.trim().length > 0;
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
    const used = this.tx.customCategories().map((c) => c.color.toLowerCase());
    const next = DEFAULT_COLOR_PALETTE.find((c) => !used.includes(c.toLowerCase()));
    this.newColor = next ?? DEFAULT_COLOR_PALETTE[0];
  }

  startEdit(cat: CustomCategory): void {
    this.editingId.set(cat.id);
    this.editName = cat.name;
    this.editColor = cat.color;
    this.editError.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  saveEdit(id: string): void {
    this.editError.set(null);
    if (!this.editName.trim()) {
      this.editError.set('El nombre no puede estar vacío.');
      return;
    }
    const ok = this.tx.updateCustomCategory(id, {
      name: this.editName,
      color: this.editColor,
    });
    if (!ok) {
      this.editError.set('Ya existe otra categoría con ese nombre.');
      return;
    }
    this.editingId.set(null);
  }

  async archive(cat: CustomCategory): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Archivar categoría',
      message: `¿Archivar la categoría "${cat.name}"? Ya no va a aparecer en los selectores para nuevas operaciones, pero todos los registros que ya la usan la siguen mostrando normalmente. La podés reactivar más adelante.`,
      confirmText: 'Archivar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeCustomCategory(cat.id);
    }
  }

  reactivate(cat: CustomCategory): void {
    this.tx.reactivateCustomCategory(cat.id);
  }
}
