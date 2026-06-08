import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { UtilityService } from '../../../../core/models/service/service.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { TransactionsService } from '../../../../core/services/transactions.service';
import { formatMonthLabel } from '../../../../core/utils/date.utils';
import { BillFormComponent } from '../bill-form/bill-form.component';
import { BillHistoryComponent } from '../bill-history/bill-history.component';
import { ServiceFormComponent } from '../service-form/service-form.component';

@Component({
  selector: 'app-service-card',
  standalone: true,
  imports: [
    CommonModule,
    ServiceFormComponent,
    BillFormComponent,
    BillHistoryComponent,
  ],
  templateUrl: './service-card.component.html',
})
export class ServiceCardComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  @Input({ required: true }) service!: UtilityService;

  protected readonly showEditForm = signal<boolean>(false);
  protected readonly showBillForm = signal<boolean>(false);
  protected readonly showHistory = signal<boolean>(false);

  /** Inicial del nombre para el avatar. */
  protected readonly initial = computed(() =>
    (this.service.name[0] ?? '?').toUpperCase()
  );

  protected readonly forecast = computed(() => this.tx.forecastFor(this.service));

  protected readonly cardLabel = computed(() => {
    if (this.service.paymentMethod !== 'card' || !this.service.cardId) return null;
    const card = this.tx.cards().find((c) => c.id === this.service.cardId);
    return card ? this.tx.cardLabel(card) : null;
  });

  protected readonly paymentMethodLabel = computed(() => {
    switch (this.service.paymentMethod) {
      case 'card':
        return 'Tarjeta';
      case 'direct-debit':
        return 'Débito automático';
      case 'other':
        return 'Otro';
    }
  });

  /**
   * True si la próxima factura se debita en un mes distinto al del vencimiento
   * (caso típico: tarjeta de crédito con cierre intermedio).
   */
  protected readonly chargeMonthDiffersFromDueMonth = computed(() => {
    const fc = this.forecast();
    if (!fc.nextDueDate) return false;
    const dueMonth = fc.nextDueDate.slice(0, 7);
    const chargeMonth = this.tx.chargeMonthFor(this.service, fc.nextDueDate);
    return dueMonth !== chargeMonth;
  });

  protected readonly chargeMonthLabel = computed(() => {
    const fc = this.forecast();
    if (!fc.nextDueDate) return '';
    return formatMonthLabel(this.tx.chargeMonthFor(this.service, fc.nextDueDate));
  });

  protected readonly daysUntilLabel = computed(() => {
    const fc = this.forecast();
    if (!fc.nextDueDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(fc.nextDueDate + 'T00:00:00');
    const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'vence hoy';
    if (diff > 0) return `en ${diff} ${diff === 1 ? 'día' : 'días'}`;
    return `vencida hace ${-diff} ${-diff === 1 ? 'día' : 'días'}`;
  });

  toggleEdit(): void {
    this.showEditForm.update((v) => !v);
    if (this.showEditForm()) {
      this.showBillForm.set(false);
      this.showHistory.set(false);
    }
  }

  onEditSaved(): void {
    this.showEditForm.set(false);
  }

  toggleBillForm(): void {
    this.showBillForm.update((v) => !v);
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  onBillSubmit(input: {
    dueDate: string;
    amount: number;
    comprobante?: string;
    notes?: string;
  }): void {
    this.tx.addServiceBill(this.service.id, input);
    this.showBillForm.set(false);
  }

  archive(): void {
    this.tx.archiveService(this.service.id);
  }

  reactivate(): void {
    this.tx.reactivateService(this.service.id);
  }

  async remove(): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar servicio',
      message: `Vas a eliminar el servicio "${this.service.name}" y todas sus facturas (${this.service.bills.length}). Esta acción no se puede deshacer. ¿Querés continuar? Si lo único que querés es ocultar el servicio pero conservar el historial, usá "Archivar" en su lugar.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeService(this.service.id);
    }
  }
}
