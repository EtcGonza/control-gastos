import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import {
  CardPurchase,
  Installment,
} from '../models/credit-card/card-purchase.model';
import { CreditCard } from '../models/credit-card/credit-card.model';
import { Subscription } from '../models/subscription/subscription.model';
import { roundMoney } from '../utils/currency.utils';
import { monthDiff } from '../utils/date.utils';
import { StorageService } from './storage.service';

/**
 * Maneja tarjetas de crédito, sus compras y la derivación de cuotas virtuales
 * (cuota = item visible en el mes que sale del prorrateo de una compra real).
 *
 * Las cuotas no se persisten: se calculan a demanda desde `purchases` + el
 * `closingDay` de cada tarjeta (o el snapshot guardado si el cierre cambió).
 *
 * La eliminación de una tarjeta CASCADE-borra sus compras y suscripciones.
 * Por eso este servicio también recibe el callback `onCardRemoved` para que
 * el dueño de las suscripciones (SubscriptionsService) limpie sus datos.
 */
@Injectable({ providedIn: 'root' })
export class CardsService {
  private readonly storage = inject(StorageService);

  private readonly _cards = signal<CreditCard[]>(
    this.storage.readArray<CreditCard>(STORAGE_KEYS.cards)
  );
  readonly cards = this._cards.asReadonly();

  private readonly _purchases = signal<CardPurchase[]>(
    this.storage.readArray<CardPurchase>(STORAGE_KEYS.purchases)
  );
  readonly purchases = this._purchases.asReadonly();

  /**
   * Callback que se invoca al borrar una tarjeta para que las suscripciones
   * asociadas también se limpien. Se setea desde SubscriptionsService al
   * arrancar.
   */
  private onCardRemovedCallback: ((cardId: string) => void) | null = null;

  registerCardRemovedCallback(cb: (cardId: string) => void): void {
    this.onCardRemovedCallback = cb;
  }

  /**
   * Permite a otros services consultar si una tarjeta tiene suscripciones.
   * Se setea desde SubscriptionsService.
   */
  private hasSubscriptionsForCardFn: ((cardId: string) => boolean) | null = null;

  registerHasSubscriptionsForCard(fn: (cardId: string) => boolean): void {
    this.hasSubscriptionsForCardFn = fn;
  }

  /**
   * Se setea desde SubscriptionsService para que el cambio de día de cierre
   * pueda crear/limpiar snapshots en las suscripciones asociadas.
   */
  private snapshotSubscriptionsClosingDayFn:
    | ((cardId: string, mode: 'snapshot-old' | 'clear-snapshot', oldClosingDay: number) => void)
    | null = null;

  registerSnapshotSubscriptionsClosingDay(
    fn: (cardId: string, mode: 'snapshot-old' | 'clear-snapshot', oldClosingDay: number) => void
  ): void {
    this.snapshotSubscriptionsClosingDayFn = fn;
  }

  addCard(input: Omit<CreditCard, 'id' | 'createdAt'>): CreditCard {
    const card: CreditCard = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this._cards.update((list) => [...list, card]);
    this.storage.write(STORAGE_KEYS.cards, this._cards());
    return card;
  }

  /**
   * Actualiza una tarjeta. Si el día de cierre cambia, `closingDayMode` define
   * cómo aplica el cambio sobre compras y suscripciones existentes:
   *  - 'retroactive': se recomputa todo con el nuevo cierre (se limpian
   *    los snapshots).
   *  - 'future': las compras y suscripciones ya cargadas conservan el cierre
   *    con el que se hicieron (se les setea snapshot con el viejo cierre).
   *
   * Si la tarjeta no tiene compras ni suscripciones, el modo no importa.
   */
  updateCard(
    id: string,
    patch: Partial<Omit<CreditCard, 'id' | 'createdAt'>>,
    closingDayMode: 'retroactive' | 'future' = 'retroactive'
  ): void {
    const card = this._cards().find((c) => c.id === id);
    if (!card) return;

    const oldClosingDay = card.closingDay;
    const newClosingDay = patch.closingDay ?? card.closingDay;
    const closingDayChanged = newClosingDay !== oldClosingDay;

    if (closingDayChanged && closingDayMode === 'future') {
      // Snapshot del cierre viejo para compras/suscripciones ya cargadas.
      this._purchases.update((list) =>
        list.map((p) =>
          p.cardId === id && p.closingDaySnapshot === undefined
            ? { ...p, closingDaySnapshot: oldClosingDay }
            : p
        )
      );
      this.storage.write(STORAGE_KEYS.purchases, this._purchases());
      this.snapshotSubscriptionsClosingDayFn?.(id, 'snapshot-old', oldClosingDay);
    } else if (closingDayChanged && closingDayMode === 'retroactive') {
      // Limpiamos snapshots para que TODO se recompute con el nuevo cierre.
      this._purchases.update((list) =>
        list.map((p) => {
          if (p.cardId !== id || p.closingDaySnapshot === undefined) return p;
          const { closingDaySnapshot: _ignored, ...rest } = p;
          return rest;
        })
      );
      this.storage.write(STORAGE_KEYS.purchases, this._purchases());
      this.snapshotSubscriptionsClosingDayFn?.(id, 'clear-snapshot', oldClosingDay);
    }

    this._cards.update((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
    this.storage.write(STORAGE_KEYS.cards, this._cards());
  }

  /** ¿La tarjeta tiene compras o suscripciones asociadas? */
  cardHasEntries(cardId: string): boolean {
    const hasPurchases = this._purchases().some((p) => p.cardId === cardId);
    const hasSubs = this.hasSubscriptionsForCardFn?.(cardId) ?? false;
    return hasPurchases || hasSubs;
  }

  removeCard(id: string): void {
    this._purchases.update((list) => list.filter((p) => p.cardId !== id));
    this.storage.write(STORAGE_KEYS.purchases, this._purchases());
    this.onCardRemovedCallback?.(id);
    this._cards.update((list) => list.filter((c) => c.id !== id));
    this.storage.write(STORAGE_KEYS.cards, this._cards());
  }

  /** Label canónico de una tarjeta para mostrar en listas. */
  cardLabel(card: CreditCard): string {
    const main = `${card.brand} · ${card.bank}`;
    return card.notes ? `${main} · ${card.notes}` : main;
  }

  addPurchase(input: Omit<CardPurchase, 'id' | 'createdAt'>): CardPurchase {
    const purchase: CardPurchase = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this._purchases.update((list) => [purchase, ...list]);
    this.storage.write(STORAGE_KEYS.purchases, this._purchases());
    return purchase;
  }

  removePurchase(id: string): void {
    this._purchases.update((list) => list.filter((p) => p.id !== id));
    this.storage.write(STORAGE_KEYS.purchases, this._purchases());
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setCardsBulk(list: CreditCard[]): void {
    this._cards.set(list);
    this.storage.write(STORAGE_KEYS.cards, this._cards());
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setPurchasesBulk(list: CardPurchase[]): void {
    this._purchases.set(list);
    this.storage.write(STORAGE_KEYS.purchases, this._purchases());
  }

  /** Cuotas que caen en un mes YYYY-MM. */
  installmentsForMonth(month: string): Installment[] {
    const result: Installment[] = [];
    for (const p of this._purchases()) {
      const card = this._cards().find((c) => c.id === p.cardId);
      if (!card) continue;
      const closingDay = p.closingDaySnapshot ?? card.closingDay;
      const firstMonth = this.firstBillingMonth(p.purchaseDate, closingDay);
      const diff = monthDiff(firstMonth, month);
      if (diff >= 0 && diff < p.installments) {
        result.push({
          purchase: p,
          cardLabel: this.cardLabel(card),
          number: diff + 1,
          total: p.installments,
          amount: roundMoney(p.totalAmount / p.installments),
          month,
          closingDayForBill: closingDay,
        });
      }
    }
    return result;
  }

  /**
   * Primer mes (YYYY-MM) en que se va a cobrar una compra.
   *
   * Regla: si la fecha de compra es ESTRICTAMENTE menor al día EFECTIVO de
   * cierre del mes de compra, esa compra cierra ese mismo mes → se cobra al
   * mes siguiente. Si la compra es en el día del cierre o posterior, pasa al
   * período siguiente.
   *
   * El día efectivo de cierre se calcula clampeando al último día del mes:
   * si el cierre es el 30 pero el mes es febrero, el cierre efectivo es 28
   * (o 29 en años bisiestos).
   */
  firstBillingMonth(purchaseDate: string, closingDay: number): string {
    const [yStr, mStr, dStr] = purchaseDate.split('-');
    const y = Number(yStr);
    const m = Number(mStr); // 1-12
    const d = Number(dStr);

    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const effectiveClosingDay = Math.min(closingDay, lastDayOfMonth);

    const offset = d < effectiveClosingDay ? 1 : 2;
    const targetMonth0 = m - 1 + offset;
    const targetDate = new Date(y, targetMonth0, 1);
    return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Helper para que SubscriptionsService consulte la tarjeta asociada. */
  cardById(cardId: string): CreditCard | undefined {
    return this._cards().find((c) => c.id === cardId);
  }
}
