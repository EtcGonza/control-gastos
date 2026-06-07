import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency, SurchargeMode } from '../../../../core/models/credit-card/card-purchase.model';
import {
  Category,
  FALLBACK_EXPENSE_CATEGORY_ID,
  TransactionType,
} from '../../../../core/models/transaction/transaction.model';
import { CategoryView, TransactionsService } from '../../../../core/services/transactions.service';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

type FormMode = TransactionType | 'tarjeta';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule, InfoTooltipComponent],
  templateUrl: './transaction-form.component.html',
})
export class TransactionFormComponent {
  protected readonly tx = inject(TransactionsService);

  protected readonly mode = signal<FormMode>('gasto');

  // ----- form normal -----
  protected description = '';
  protected amount: number | null = null;
  protected date = new Date().toISOString().slice(0, 10);
  /** Almacenamos el ID, no el nombre. */
  protected category: Category = FALLBACK_EXPENSE_CATEGORY_ID;
  protected fixed = false;
  /** Categorías visibles según el tab activo. Reactivo si el usuario agrega custom. */
  protected readonly currentCategories = computed<CategoryView[]>(() =>
    this.mode() === 'ingreso'
      ? this.tx.allIncomeCategories()
      : this.tx.allExpenseCategories()
  );

  // ----- form tarjeta -----
  protected cardId = '';
  protected cDescription = '';
  protected cTotalAmount: number | null = null;
  protected cInstallments: number | null = null;
  protected cDate = new Date().toISOString().slice(0, 10);
  protected cCurrency: Currency = 'ARS';
  protected cSurchargeMode: SurchargeMode = 'auto';
  protected cCategory: Category = FALLBACK_EXPENSE_CATEGORY_ID;
  /** Para el tab Tarjeta — siempre categorías de gasto (defaults + custom). */
  protected readonly expenseCategories = this.tx.allExpenseCategories;

  setMode(m: FormMode): void {
    this.mode.set(m);
    if (m === 'ingreso') {
      this.category = 'cat-sueldo';
    } else if (m === 'gasto') {
      this.category = FALLBACK_EXPENSE_CATEGORY_ID;
    }
  }

  submit(): void {
    if (this.mode() === 'tarjeta') return;
    if (this.amount == null || this.amount <= 0 || !this.description.trim()) return;

    this.tx.add({
      type: this.mode() as TransactionType,
      description: this.description.trim(),
      amount: Number(this.amount),
      category: this.category,
      date: this.date,
      fixed: this.fixed,
    });

    this.description = '';
    this.amount = null;
    this.fixed = false;
  }

  submitPurchase(): void {
    if (!this.cardId || !this.cTotalAmount || !this.cInstallments || !this.cDescription.trim()) return;

    this.tx.addPurchase({
      cardId: this.cardId,
      description: this.cDescription.trim(),
      totalAmount: Number(this.cTotalAmount),
      installments: Number(this.cInstallments),
      purchaseDate: this.cDate,
      currency: this.cCurrency,
      category: this.cCategory,
      surchargeMode: this.cCurrency === 'USD' ? this.cSurchargeMode : undefined,
    });

    this.cDescription = '';
    this.cTotalAmount = null;
    this.cInstallments = null;
    this.cSurchargeMode = 'auto';
  }
}
