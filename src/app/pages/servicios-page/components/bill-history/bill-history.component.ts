import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import {
  ServiceBill,
  UtilityService,
} from '../../../../core/models/service/service.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { TransactionsService } from '../../../../core/services/transactions.service';
import { BillFormComponent } from '../bill-form/bill-form.component';

interface SparkDot {
  x: number;
  y: number;
  from: string;
  amount: number;
}

@Component({
  selector: 'app-bill-history',
  standalone: true,
  imports: [CommonModule, BillFormComponent],
  templateUrl: './bill-history.component.html',
})
export class BillHistoryComponent {
  private readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  @Input({ required: true }) service!: UtilityService;

  protected readonly editingBillId = signal<string | null>(null);

  protected readonly sortedBills = computed(() =>
    [...this.service.bills].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  );

  /** Sparkline derivado de los últimos 12 montos, viejos a la izquierda. */
  protected readonly sparkline = computed<{ path: string; dots: SparkDot[] }>(() => {
    const ordered = [...this.service.bills]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(-12);
    if (ordered.length < 2) return { path: '', dots: [] };

    const w = 200;
    const h = 40;
    const padX = 4;
    const padY = 4;
    const amounts = ordered.map((b) => b.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const range = max - min || 1;

    const dots: SparkDot[] = ordered.map((b, i) => {
      const x = padX + ((w - padX * 2) * i) / (ordered.length - 1);
      const y = h - padY - ((b.amount - min) / range) * (h - padY * 2);
      return { x, y, from: b.dueDate, amount: b.amount };
    });

    const path = dots
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(2)} ${d.y.toFixed(2)}`)
      .join(' ');

    return { path, dots };
  });

  onUpdate(patch: {
    dueDate: string;
    amount: number;
    comprobante?: string;
    notes?: string;
  }): void {
    const id = this.editingBillId();
    if (!id) return;
    this.tx.updateServiceBill(this.service.id, id, patch);
    this.editingBillId.set(null);
  }

  async removeBill(bill: ServiceBill): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar factura',
      message: `¿Eliminar la factura del ${new Date(bill.dueDate + 'T00:00').toLocaleDateString('es-AR')} por $${bill.amount.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeServiceBill(this.service.id, bill.id);
    }
  }
}
