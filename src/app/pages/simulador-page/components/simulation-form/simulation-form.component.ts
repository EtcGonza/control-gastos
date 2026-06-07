import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency, SurchargeMode } from '../../../../core/models/credit-card/card-purchase.model';
import {
  IncomeBaseMode,
  SimulationConfig,
  SimulationItem,
  SimulationItemType,
} from '../../../../core/models/simulation/simulation.model';
import { TransactionsService } from '../../../../core/services/transactions.service';
import { todayIso } from '../../../../core/utils/date.utils';

@Component({
  selector: 'app-simulation-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulation-form.component.html',
})
export class SimulationFormComponent {
  protected readonly tx = inject(TransactionsService);

  @Output() readonly itemChange = new EventEmitter<SimulationItem | null>();
  @Output() readonly configChange = new EventEmitter<SimulationConfig>();

  // ----- estado del item -----
  protected readonly type = signal<SimulationItemType>('cuotas');
  protected description = '';
  protected amount: number | null = null;
  protected readonly currency = signal<Currency>('ARS');
  protected readonly surchargeMode = signal<SurchargeMode>('auto');
  protected purchaseDate = todayIso();

  // type === 'cuotas'
  protected cardId = '';
  protected installments: number | null = 12;

  // type === 'suscripcion'
  protected subscriptionCardId = '';
  protected startDate = todayIso();
  protected cancelDate = '';

  // ----- estado de la config -----
  protected readonly configOpen = signal<boolean>(false);
  protected readonly horizonOptions: SimulationConfig['horizonMonths'][] = [6, 12, 18, 24];
  protected readonly horizonMonths = signal<SimulationConfig['horizonMonths']>(12);
  protected readonly incomeBase = signal<IncomeBaseMode>('avg-3m');
  protected manualIncomeArs: number | null = null;
  protected monthlyInflationPct = 0;
  protected monthlyDevaluationPct = 0;

  setType(t: SimulationItemType): void {
    this.type.set(t);
    // Default amount cero al cambiar tipo no es agresivo: dejamos lo que haya.
    this.emitChange();
  }

  setCurrency(c: Currency): void {
    this.currency.set(c);
    this.emitChange();
  }

  setSurchargeMode(m: SurchargeMode): void {
    this.surchargeMode.set(m);
    this.emitChange();
  }

  setHorizon(h: SimulationConfig['horizonMonths']): void {
    this.horizonMonths.set(h);
    this.emitConfig();
  }

  setIncomeBase(b: IncomeBaseMode): void {
    this.incomeBase.set(b);
    this.emitConfig();
  }

  /** Re-emite el item con el estado actual (o null si todavía no es válido). */
  emitChange(): void {
    this.itemChange.emit(this.buildItem());
    this.emitConfig();
  }

  emitConfig(): void {
    this.configChange.emit({
      horizonMonths: this.horizonMonths(),
      incomeBase: this.incomeBase(),
      manualIncomeArs: this.manualIncomeArs ?? undefined,
      monthlyInflationPct: Number(this.monthlyInflationPct) || 0,
      monthlyDevaluationPct: Number(this.monthlyDevaluationPct) || 0,
    });
  }

  private buildItem(): SimulationItem | null {
    if (!this.amount || this.amount <= 0) return null;

    const base: Partial<SimulationItem> = {
      id: 'sim-current',
      type: this.type(),
      description: this.description.trim() || this.defaultDescription(),
      currency: this.currency(),
      amount: Number(this.amount),
      surchargeMode: this.currency() === 'USD' ? this.surchargeMode() : undefined,
      purchaseDate: this.purchaseDate || todayIso(),
    };

    if (this.type() === 'cuotas') {
      if (!this.installments || this.installments < 1) return null;
      return {
        ...(base as SimulationItem),
        cardId: this.cardId || undefined,
        installments: Number(this.installments),
      };
    }

    if (this.type() === 'suscripcion') {
      return {
        ...(base as SimulationItem),
        subscriptionCardId: this.subscriptionCardId || undefined,
        startDate: this.startDate || todayIso(),
        cancelDate: this.cancelDate || undefined,
      };
    }

    return base as SimulationItem;
  }

  private defaultDescription(): string {
    switch (this.type()) {
      case 'contado':
        return 'Compra al contado';
      case 'cuotas':
        return 'Compra en cuotas';
      case 'suscripcion':
        return 'Suscripción';
    }
  }
}
