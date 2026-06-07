import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency } from '../../../../core/models/credit-card/card-purchase.model';
import { Saving, SavingMovement, SavingMovementType } from '../../../../core/models/saving/saving.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { TransactionsService } from '../../../../core/services/transactions.service';

interface MovementRow extends SavingMovement {
  balanceAfter: number;
}

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './savings.component.html',
})
export class SavingsComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  protected readonly today = new Date().toISOString().slice(0, 10);

  // ----- form de alta del ahorro -----
  protected newDescription = '';
  protected newAmount: number | null = null;
  protected newCurrency: Currency = 'ARS';

  // ----- edición de descripción del ahorro -----
  protected readonly editingId = signal<string | null>(null);
  protected editDescription = '';

  // ----- expansión de movimientos -----
  protected readonly expandedId = signal<string | null>(null);

  // ----- form de movimiento -----
  protected movementType: SavingMovementType = 'withdrawal';
  protected movementAmount: number | null = null;
  protected movementDate = this.today;
  protected movementDescription = '';

  protected readonly countArs = computed(
    () => this.tx.savings().filter((s) => s.currency === 'ARS').length
  );
  protected readonly countUsd = computed(
    () => this.tx.savings().filter((s) => s.currency === 'USD').length
  );

  /** Movimientos de un ahorro con saldo acumulado, ordenados de más nuevo a más viejo. */
  movementsOf(s: Saving): MovementRow[] {
    const raw = s.movements ?? [];
    const sorted = [...raw].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt)
    );
    let balance = 0;
    const withBalance: MovementRow[] = sorted.map((m) => {
      balance += m.type === 'deposit' ? m.amount : -m.amount;
      return { ...m, balanceAfter: balance };
    });
    return withBalance.reverse();
  }

  // ============ Alta de ahorro ============

  add(): void {
    if (!this.newDescription.trim() || this.newAmount == null || this.newAmount < 0) return;
    this.tx.addSaving({
      description: this.newDescription,
      amount: Number(this.newAmount),
      currency: this.newCurrency,
    });
    this.newDescription = '';
    this.newAmount = null;
    this.newCurrency = 'ARS';
  }

  // ============ Edición de descripción ============

  startEdit(s: Saving): void {
    this.editingId.set(s.id);
    this.editDescription = s.description;
    this.expandedId.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(id: string): void {
    if (!this.editDescription.trim()) return;
    this.tx.updateSaving(id, { description: this.editDescription });
    this.editingId.set(null);
  }

  async remove(s: Saving): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar ahorro',
      message: `¿Eliminar "${s.description}" y todo su historial de movimientos? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) this.tx.removeSaving(s.id);
  }

  // ============ Expansión + movimientos ============

  toggleExpanded(id: string): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
    if (this.editingId() !== null) this.editingId.set(null);
    this.movementType = 'withdrawal';
    this.movementAmount = null;
    this.movementDate = this.today;
    this.movementDescription = '';
  }

  addMovement(savingId: string): void {
    if (this.movementAmount == null || this.movementAmount <= 0) return;
    if (this.movementDate > this.today) return;
    this.tx.addSavingMovement(savingId, {
      type: this.movementType,
      amount: Number(this.movementAmount),
      date: this.movementDate,
      description: this.movementDescription,
    });
    this.movementAmount = null;
    this.movementDescription = '';
  }

  async removeMovement(s: Saving, m: SavingMovement): Promise<void> {
    const action = m.type === 'deposit' ? 'depósito' : 'retiro';
    const sign = m.type === 'deposit' ? '+' : '-';
    const curSym = s.currency === 'USD' ? 'US$' : '$';
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar movimiento',
      message: `¿Eliminar el ${action} de ${sign}${curSym}${m.amount.toFixed(2)} del ${new Date(m.date + 'T00:00').toLocaleDateString('es-AR')}? El saldo se ajusta automáticamente.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) this.tx.removeSavingMovement(s.id, m.id);
  }
}
