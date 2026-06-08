import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServiceBill } from '../../../../core/models/service/service.model';
import { todayIso } from '../../../../core/utils/date.utils';

@Component({
  selector: 'app-bill-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bill-form.component.html',
})
export class BillFormComponent implements OnChanges {
  /** Si se pasa, está en modo edición. */
  @Input() bill: ServiceBill | null = null;
  /** Sugerencia de fecha de vencimiento (forecast.nextDueDate o today). */
  @Input() suggestedDueDate: string | null = null;

  @Output() readonly submitForm = new EventEmitter<{
    dueDate: string;
    amount: number;
    comprobante?: string;
    notes?: string;
  }>();
  @Output() readonly cancelled = new EventEmitter<void>();

  protected dueDate = todayIso();
  protected amount: number | null = null;
  protected comprobante = '';
  protected notes = '';

  protected readonly isEditMode = computed(() => this.bill !== null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bill']) {
      if (this.bill) {
        this.dueDate = this.bill.dueDate;
        this.amount = this.bill.amount;
        this.comprobante = this.bill.comprobante ?? '';
        this.notes = this.bill.notes ?? '';
      } else {
        this.dueDate = this.suggestedDueDate ?? todayIso();
        this.amount = null;
        this.comprobante = '';
        this.notes = '';
      }
    } else if (changes['suggestedDueDate'] && !this.bill) {
      this.dueDate = this.suggestedDueDate ?? todayIso();
    }
  }

  submit(): void {
    if (this.amount == null || !this.dueDate) return;
    this.submitForm.emit({
      dueDate: this.dueDate,
      amount: Number(this.amount),
      comprobante: this.comprobante.trim() || undefined,
      notes: this.notes.trim() || undefined,
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
