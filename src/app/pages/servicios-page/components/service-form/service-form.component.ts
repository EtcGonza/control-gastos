import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ServicePaymentMethod,
  UtilityService,
} from '../../../../core/models/service/service.model';
import { TransactionsService } from '../../../../core/services/transactions.service';

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-form.component.html',
})
export class ServiceFormComponent implements OnChanges {
  protected readonly tx = inject(TransactionsService);

  /** Si se pasa, el form está en modo edición sobre ese servicio. */
  @Input() service: UtilityService | null = null;

  @Output() readonly saved = new EventEmitter<UtilityService | null>();
  @Output() readonly cancelled = new EventEmitter<void>();

  // Estado del form
  protected name = '';
  protected category = 'cat-servicios';
  protected readonly paymentMethod = signal<ServicePaymentMethod>('card');
  protected cardId = '';
  protected readonly error = signal<string | null>(null);

  protected readonly isEditMode = computed(() => this.service !== null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['service']) {
      this.hydrateFromInput();
    }
  }

  private hydrateFromInput(): void {
    if (this.service) {
      this.name = this.service.name;
      this.category = this.service.category;
      this.paymentMethod.set(this.service.paymentMethod);
      this.cardId = this.service.cardId ?? '';
    } else {
      this.name = '';
      this.category = 'cat-servicios';
      this.paymentMethod.set('card');
      this.cardId = '';
    }
    this.error.set(null);
  }

  setPaymentMethod(m: ServicePaymentMethod): void {
    this.paymentMethod.set(m);
    if (m !== 'card') this.cardId = '';
  }

  canSave(): boolean {
    if (!this.name.trim()) return false;
    if (this.paymentMethod() === 'card' && this.tx.cards().length > 0 && !this.cardId) {
      return false;
    }
    return true;
  }

  submit(): void {
    this.error.set(null);
    if (!this.canSave()) return;

    if (this.service) {
      // Edición
      const ok = this.tx.updateService(this.service.id, {
        name: this.name,
        category: this.category,
        paymentMethod: this.paymentMethod(),
        cardId: this.paymentMethod() === 'card' ? this.cardId || undefined : undefined,
      });
      if (!ok) {
        this.error.set('No se pudo guardar. Verificá los datos.');
        return;
      }
      this.saved.emit(this.service);
    } else {
      // Alta
      const created = this.tx.addService({
        name: this.name,
        category: this.category,
        paymentMethod: this.paymentMethod(),
        cardId: this.paymentMethod() === 'card' ? this.cardId || undefined : undefined,
      });
      if (!created) {
        this.error.set('No se pudo crear el servicio.');
        return;
      }
      this.saved.emit(created);
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
