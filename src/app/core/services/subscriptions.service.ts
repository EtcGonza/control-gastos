import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import {
  Currency,
  SurchargeMode,
} from '../models/credit-card/card-purchase.model';
import { Subscription } from '../models/subscription/subscription.model';
import { roundMoney } from '../utils/currency.utils';
import { todayIso } from '../utils/date.utils';
import { CardsService } from './cards.service';
import { StorageService } from './storage.service';

/** Charge generado por una suscripción para un mes determinado. */
export interface SubscriptionCharge {
  subscriptionId: string;
  description: string;
  cardLabel: string;
  amount: number;
  currency: Currency;
  chargeDate: string;
  closingDayForBill: number;
  surchargeMode?: SurchargeMode;
}

/**
 * Maneja suscripciones con historial de precios y soft delete.
 *
 * Los cobros de las suscripciones son **virtuales** (no se persisten como
 * transacciones): se calculan a demanda a partir del precio vigente y la
 * fecha de inicio/cancelación.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionsService {
  private readonly storage = inject(StorageService);
  private readonly cards = inject(CardsService);

  private readonly _subscriptions = signal<Subscription[]>(
    this.storage.readArray<Subscription>(STORAGE_KEYS.subscriptions)
  );
  readonly subscriptions = this._subscriptions.asReadonly();

  constructor() {
    // Coordinación con CardsService: cuando se borra una tarjeta, eliminamos
    // las suscripciones asociadas. Cuando cambia su día de cierre, snapshot.
    this.cards.registerCardRemovedCallback((cardId) => {
      this._subscriptions.update((list) => list.filter((s) => s.cardId !== cardId));
      this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
    });

    this.cards.registerHasSubscriptionsForCard(
      (cardId) => this._subscriptions().some((s) => s.cardId === cardId)
    );

    this.cards.registerSnapshotSubscriptionsClosingDay((cardId, mode, oldClosingDay) => {
      if (mode === 'snapshot-old') {
        this._subscriptions.update((list) =>
          list.map((s) =>
            s.cardId === cardId && s.closingDaySnapshot === undefined
              ? { ...s, closingDaySnapshot: oldClosingDay }
              : s
          )
        );
      } else {
        this._subscriptions.update((list) =>
          list.map((s) => {
            if (s.cardId !== cardId || s.closingDaySnapshot === undefined) return s;
            const { closingDaySnapshot: _ignored, ...rest } = s;
            return rest;
          })
        );
      }
      this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
    });
  }

  addSubscription(input: {
    cardId: string;
    description: string;
    currency: Currency;
    startDate: string;
    amount: number;
    surchargeMode?: SurchargeMode;
  }): Subscription {
    const sub: Subscription = {
      id: crypto.randomUUID(),
      cardId: input.cardId,
      description: input.description,
      currency: input.currency,
      startDate: input.startDate,
      priceHistory: [{ from: input.startDate, amount: input.amount }],
      surchargeMode: input.surchargeMode,
      createdAt: new Date().toISOString(),
    };
    this._subscriptions.update((list) => [sub, ...list]);
    this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
    return sub;
  }

  cancelSubscription(id: string, cancelDate: string): void {
    this._subscriptions.update((list) =>
      list.map((s) => (s.id === id ? { ...s, cancelDate } : s))
    );
    this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
  }

  reactivateSubscription(id: string): void {
    this._subscriptions.update((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const { cancelDate: _ignored, ...rest } = s;
        return rest;
      })
    );
    this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
  }

  /**
   * Agrega un nuevo precio al historial con su fecha de vigencia.
   * Cualquier entrada existente con la misma fecha se reemplaza.
   */
  addSubscriptionPrice(id: string, amount: number, from: string): void {
    this._subscriptions.update((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const filtered = s.priceHistory.filter((p) => p.from !== from);
        const next = [...filtered, { from, amount }].sort((a, b) =>
          a.from.localeCompare(b.from)
        );
        return { ...s, priceHistory: next };
      })
    );
    this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
  }

  /**
   * "Elimina" una suscripción del panel: la marca como archivada y, si todavía
   * estaba activa, le pone fecha de cancelación hoy. Los meses pasados en los
   * que estuvo activa siguen mostrando el cobro.
   */
  removeSubscription(id: string): void {
    const today = todayIso();
    this._subscriptions.update((list) =>
      list.map((s) =>
        s.id === id
          ? { ...s, archived: true, cancelDate: s.cancelDate ?? today }
          : s
      )
    );
    this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setSubscriptionsBulk(list: Subscription[]): void {
    this._subscriptions.set(list);
    this.storage.write(STORAGE_KEYS.subscriptions, this._subscriptions());
  }

  /** Devuelve el precio vigente para una fecha (ISO yyyy-MM-dd). */
  priceForDate(sub: Subscription, date: string): number {
    let current = sub.priceHistory[0]?.amount ?? 0;
    for (const entry of sub.priceHistory) {
      if (entry.from <= date) current = entry.amount;
      else break;
    }
    return current;
  }

  /** Precio vigente "actual" (a hoy). Útil para listar. */
  currentPrice(sub: Subscription): number {
    return this.priceForDate(sub, todayIso());
  }

  /**
   * Total acumulado pagado en una suscripción desde su inicio hasta hoy
   * (o hasta la fecha de cancelación si está cancelada).
   * Devuelve la suma en la moneda original de la suscripción.
   */
  subscriptionTotalCost(sub: Subscription): {
    total: number;
    count: number;
    currency: Currency;
  } {
    const todayISO = todayIso();
    const chargeDay = Number(sub.startDate.split('-')[2]);
    const [sy, sm] = sub.startDate.split('-').map(Number);

    let total = 0;
    let count = 0;

    let curY = sy;
    let curM = sm; // 1-12
    const todayY = new Date().getFullYear();
    const todayM = new Date().getMonth() + 1;

    while (curY < todayY || (curY === todayY && curM <= todayM)) {
      const lastDay = new Date(curY, curM, 0).getDate();
      const day = Math.min(chargeDay, lastDay);
      const chargeDate = `${curY}-${String(curM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (
        chargeDate >= sub.startDate &&
        chargeDate <= todayISO &&
        (!sub.cancelDate || chargeDate <= sub.cancelDate)
      ) {
        total += this.priceForDate(sub, chargeDate);
        count++;
      }

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    return { total: roundMoney(total), count, currency: sub.currency };
  }

  /**
   * Cobros de suscripciones que aparecen en el resumen del mes M dado.
   *
   * Lógica:
   *  - El cobro mensual es siempre en el día `d` (derivado de startDate).
   *  - Con cierre `c`, si d < c el cobro aparece en el mes siguiente; si d >= c
   *    aparece dos meses después (mismo criterio que las compras con tarjeta).
   *  - El cobro de un mes X efectivamente ocurre si la suscripción ya empezó
   *    (startDate <= chargeDate_X) y no fue cancelada antes del chargeDate
   *    (cancelDate >= chargeDate_X o no existe).
   */
  subscriptionChargesForMonth(month: string): SubscriptionCharge[] {
    const result: SubscriptionCharge[] = [];

    for (const sub of this._subscriptions()) {
      const card = this.cards.cardById(sub.cardId);
      if (!card) continue;

      const chargeDay = Number(sub.startDate.split('-')[2]);
      const closingDay = sub.closingDaySnapshot ?? card.closingDay;
      const [mY, mM] = month.split('-').map(Number);

      // Una suscripción puede aparecer en `month` desde dos meses fuente
      // distintos (M-1 con offset 1, ó M-2 con offset 2).
      for (const offsetTry of [1, 2]) {
        const sourceDate = new Date(mY, mM - 1 - offsetTry, 1);
        const sY = sourceDate.getFullYear();
        const sM = sourceDate.getMonth() + 1;

        const lastDay = new Date(sY, sM, 0).getDate();
        const effChargeDay = Math.min(chargeDay, lastDay);
        const effCloseDay = Math.min(closingDay, lastDay);

        const actualOffset = effChargeDay < effCloseDay ? 1 : 2;
        if (actualOffset !== offsetTry) continue;

        const chargeDate = `${sY}-${String(sM).padStart(2, '0')}-${String(effChargeDay).padStart(2, '0')}`;

        if (chargeDate < sub.startDate) continue;
        if (sub.cancelDate && sub.cancelDate < chargeDate) continue;

        result.push({
          subscriptionId: sub.id,
          description: sub.description,
          cardLabel: this.cards.cardLabel(card),
          amount: this.priceForDate(sub, chargeDate),
          currency: sub.currency,
          chargeDate,
          closingDayForBill: closingDay,
          surchargeMode: sub.surchargeMode,
        });
      }
    }

    return result;
  }
}
