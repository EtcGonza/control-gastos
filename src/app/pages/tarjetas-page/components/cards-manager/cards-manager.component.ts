import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardBrand, CreditCard } from '../../../../core/models/credit-card/credit-card.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { TransactionsService } from '../../../../core/services/transactions.service';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  selector: 'app-cards-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, InfoTooltipComponent],
  templateUrl: './cards-manager.component.html',
})
export class CardsManagerComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  private readonly EXPANDED_KEY = 'control-gastos:cards-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());
  protected readonly showForm = signal<boolean>(false);

  // ---- form alta ----
  protected brand: CardBrand = 'Visa';
  protected bank = '';
  protected closingDay: number | null = null;
  protected notes = '';

  // ---- form edición ----
  protected readonly editingId = signal<string | null>(null);
  protected readonly showConflictPanel = signal<boolean>(false);
  protected readonly originalClosingDay = signal<number | null>(null);
  protected editBrand: CardBrand = 'Visa';
  protected editBank = '';
  protected editClosingDay: number | null = null;
  protected editNotes = '';

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

  // ============ Alta ============

  openAddForm(): void {
    this.cancelEdit();
    this.showForm.set(true);
  }

  submit(): void {
    if (!this.bank.trim() || !this.closingDay) return;
    this.tx.addCard({
      brand: this.brand,
      bank: this.bank.trim(),
      closingDay: Number(this.closingDay),
      notes: this.notes.trim() || undefined,
    });
    this.resetAdd();
    this.showForm.set(false);
  }

  cancel(): void {
    this.resetAdd();
    this.showForm.set(false);
  }

  private resetAdd(): void {
    this.brand = 'Visa';
    this.bank = '';
    this.closingDay = null;
    this.notes = '';
  }

  // ============ Edición ============

  startEdit(card: CreditCard): void {
    this.showForm.set(false);
    this.editingId.set(card.id);
    this.showConflictPanel.set(false);
    this.editBrand = card.brand;
    this.editBank = card.bank;
    this.editClosingDay = card.closingDay;
    this.editNotes = card.notes ?? '';
    this.originalClosingDay.set(card.closingDay);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.showConflictPanel.set(false);
    this.originalClosingDay.set(null);
  }

  cancelConflict(): void {
    this.showConflictPanel.set(false);
  }

  saveEdit(card: CreditCard): void {
    if (!this.editBank.trim() || !this.editClosingDay) return;
    const newClosingDay = Number(this.editClosingDay);
    const closingDayChanged = newClosingDay !== card.closingDay;
    const hasData = this.tx.cardHasEntries(card.id);

    if (closingDayChanged && hasData) {
      this.showConflictPanel.set(true);
      return;
    }

    this.confirmEdit(card, 'retroactive');
  }

  confirmEdit(card: CreditCard, mode: 'retroactive' | 'future'): void {
    this.tx.updateCard(
      card.id,
      {
        brand: this.editBrand,
        bank: this.editBank.trim(),
        closingDay: Number(this.editClosingDay),
        notes: this.editNotes.trim() || undefined,
      },
      mode
    );
    this.cancelEdit();
  }

  async remove(id: string): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar tarjeta',
      message:
        'Al eliminar esta tarjeta también se borran todas las compras y suscripciones asociadas. ¿Querés continuar?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeCard(id);
    }
  }
}
