import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency, SurchargeMode } from '../../../../core/models/credit-card/card-purchase.model';
import { Subscription } from '../../../../core/models/subscription/subscription.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { TransactionsService } from '../../../../core/services/transactions.service';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  selector: 'app-subscriptions-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, InfoTooltipComponent],
  templateUrl: './subscriptions-manager.component.html',
})
export class SubscriptionsManagerComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  private readonly EXPANDED_KEY = 'control-gastos:subs-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());
  protected readonly showForm = signal<boolean>(false);

  protected readonly priceEditId = signal<string | null>(null);
  protected readonly cancelId = signal<string | null>(null);
  protected readonly historyId = signal<string | null>(null);

  protected readonly today = new Date().toISOString().slice(0, 10);

  /** Suscripciones visibles (no archivadas). Las archivadas siguen contando en meses pasados. */
  protected readonly visibleSubs = computed(() =>
    this.tx.subscriptions().filter((s) => !s.archived)
  );

  protected readonly activeCount = computed(
    () => this.visibleSubs().filter((s) => !s.cancelDate).length
  );

  // form alta
  protected cardId = '';
  protected description = '';
  protected amount: number | null = null;
  protected currency: Currency = 'ARS';
  /** Default: 'digital-service' porque la mayoría de las suscripciones USD lo son. */
  protected surchargeMode: SurchargeMode = 'digital-service';
  protected startDate = new Date().toISOString().slice(0, 10);

  // form acciones
  protected newPriceAmount: number | null = null;
  protected newPriceFrom = new Date().toISOString().slice(0, 7);
  protected readonly todayMonth = new Date().toISOString().slice(0, 7);
  protected cancelDateInput = new Date().toISOString().slice(0, 10);

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

  cardLabel(cardId: string): string {
    const c = this.tx.cards().find((x) => x.id === cardId);
    return c ? this.tx.cardLabel(c) : '—';
  }

  chargeDay(s: Subscription): number {
    return Number(s.startDate.split('-')[2]);
  }

  submit(): void {
    if (!this.cardId || !this.description.trim() || !this.amount) return;
    if (this.startDate > this.today) return;
    this.tx.addSubscription({
      cardId: this.cardId,
      description: this.description.trim(),
      amount: Number(this.amount),
      currency: this.currency,
      startDate: this.startDate,
      surchargeMode: this.currency === 'USD' ? this.surchargeMode : undefined,
    });
    this.resetForm();
    this.showForm.set(false);
  }

  cancelAdd(): void {
    this.resetForm();
    this.showForm.set(false);
  }

  private resetForm(): void {
    this.cardId = '';
    this.description = '';
    this.amount = null;
    this.currency = 'ARS';
    this.surchargeMode = 'digital-service';
    this.startDate = new Date().toISOString().slice(0, 10);
  }

  startPriceEdit(s: Subscription): void {
    this.priceEditId.set(s.id);
    this.cancelId.set(null);
    this.newPriceAmount = this.tx.currentPrice(s);
    this.newPriceFrom = new Date().toISOString().slice(0, 7);
  }

  cancelPriceEdit(): void {
    this.priceEditId.set(null);
  }

  savePrice(id: string): void {
    if (this.newPriceAmount == null || this.newPriceAmount < 0) return;
    const fromDate = `${this.newPriceFrom}-01`;
    this.tx.addSubscriptionPrice(id, Number(this.newPriceAmount), fromDate);
    this.priceEditId.set(null);
  }

  startCancel(s: Subscription): void {
    this.cancelId.set(s.id);
    this.priceEditId.set(null);
    this.cancelDateInput = new Date().toISOString().slice(0, 10);
  }

  cancelCancel(): void {
    this.cancelId.set(null);
  }

  confirmCancel(id: string): void {
    if (this.cancelDateInput > this.today) return;
    this.tx.cancelSubscription(id, this.cancelDateInput);
    this.cancelId.set(null);
  }

  reactivate(id: string): void {
    this.tx.reactivateSubscription(id);
  }

  async remove(id: string): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar suscripción',
      message:
        'Los meses pasados en los que estuvo activa siguen quedando registrados. Sólo se oculta de este panel y deja de generar cobros futuros.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeSubscription(id);
    }
  }

  toggleHistory(id: string): void {
    this.historyId.update((current) => (current === id ? null : id));
  }
}
