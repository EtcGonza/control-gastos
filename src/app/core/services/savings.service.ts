import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { Currency } from '../models/credit-card/card-purchase.model';
import {
  Saving,
  SavingMovement,
  SavingMovementType,
} from '../models/saving/saving.model';
import { roundMoney } from '../utils/currency.utils';
import { todayIso } from '../utils/date.utils';
import { StorageService } from './storage.service';
import { UsdRateService } from './usd-rate.service';

/**
 * Maneja los ahorros del usuario (ARS y USD) con sus movimientos
 * (depósitos / retiros) y los agregados de balance.
 *
 * El valor en pesos del total USD usa el último TC oficial conocido como
 * referencia (estimado).
 */
@Injectable({ providedIn: 'root' })
export class SavingsService {
  private readonly storage = inject(StorageService);
  private readonly usdRate = inject(UsdRateService);

  private readonly _savings = signal<Saving[]>(
    this.storage.readArray<Saving>(STORAGE_KEYS.savings)
  );
  readonly savings = this._savings.asReadonly();

  /** Total de ahorros en pesos. */
  readonly savingsTotalArs = computed(() =>
    this._savings()
      .filter((s) => s.currency === 'ARS')
      .reduce((acc, s) => acc + s.amount, 0)
  );

  /** Total de ahorros en dólares. */
  readonly savingsTotalUsd = computed(() =>
    this._savings()
      .filter((s) => s.currency === 'USD')
      .reduce((acc, s) => acc + s.amount, 0)
  );

  /** Valor en pesos del total USD usando el último TC oficial vendedor conocido. */
  readonly savingsTotalUsdInArs = computed(() => {
    const usd = this.savingsTotalUsd();
    if (usd === 0) return 0;
    const latest = this.usdRate.latestRate();
    return latest ? roundMoney(usd * latest.rate) : 0;
  });

  /** Gran total en pesos: ARS directos + USD convertidos al TC actual. */
  readonly savingsGrandTotalArs = computed(
    () => this.savingsTotalArs() + this.savingsTotalUsdInArs()
  );

  addSaving(input: {
    description: string;
    amount: number;
    currency: Currency;
  }): Saving {
    const now = new Date().toISOString();
    const initialMovement: SavingMovement = {
      id: crypto.randomUUID(),
      type: 'deposit',
      amount: input.amount,
      date: todayIso(),
      description: 'Depósito inicial',
      createdAt: now,
    };
    const saving: Saving = {
      id: crypto.randomUUID(),
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency,
      movements: [initialMovement],
      createdAt: now,
      updatedAt: now,
    };
    this._savings.update((list) => [saving, ...list]);
    this.storage.write(STORAGE_KEYS.savings, this._savings());
    return saving;
  }

  /**
   * Edita la descripción del ahorro. El monto y la moneda no se tocan acá
   * (el monto cambia sólo a través de movimientos).
   */
  updateSaving(id: string, patch: { description: string }): void {
    this._savings.update((list) =>
      list.map((s) =>
        s.id === id
          ? {
              ...s,
              description: patch.description.trim() || s.description,
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    this.storage.write(STORAGE_KEYS.savings, this._savings());
  }

  removeSaving(id: string): void {
    this._savings.update((list) => list.filter((s) => s.id !== id));
    this.storage.write(STORAGE_KEYS.savings, this._savings());
  }

  /**
   * Registra un movimiento sobre un ahorro y actualiza el saldo:
   *  - `deposit`: suma al saldo.
   *  - `withdrawal`: resta del saldo.
   */
  addSavingMovement(
    savingId: string,
    input: {
      type: SavingMovementType;
      amount: number;
      date: string;
      description?: string;
    }
  ): void {
    const now = new Date().toISOString();
    const movement: SavingMovement = {
      id: crypto.randomUUID(),
      type: input.type,
      amount: Math.abs(input.amount),
      date: input.date,
      description: input.description?.trim() || undefined,
      createdAt: now,
    };

    this._savings.update((list) =>
      list.map((s) => {
        if (s.id !== savingId) return s;
        const movements = [...(s.movements ?? []), movement];
        const delta =
          movement.type === 'deposit' ? movement.amount : -movement.amount;
        return {
          ...s,
          amount: roundMoney(s.amount + delta),
          movements,
          updatedAt: now,
        };
      })
    );
    this.storage.write(STORAGE_KEYS.savings, this._savings());
  }

  /** Elimina un movimiento y revierte su impacto en el saldo. */
  removeSavingMovement(savingId: string, movementId: string): void {
    this._savings.update((list) =>
      list.map((s) => {
        if (s.id !== savingId) return s;
        const movements = s.movements ?? [];
        const m = movements.find((x) => x.id === movementId);
        if (!m) return s;
        const delta = m.type === 'deposit' ? -m.amount : m.amount;
        return {
          ...s,
          amount: roundMoney(s.amount + delta),
          movements: movements.filter((x) => x.id !== movementId),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    this.storage.write(STORAGE_KEYS.savings, this._savings());
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setSavingsBulk(list: Saving[]): void {
    this._savings.set(list);
    this.storage.write(STORAGE_KEYS.savings, this._savings());
  }
}
