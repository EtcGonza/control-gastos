import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import {
  ServiceBill,
  ServiceCharge,
  ServiceForecast,
  ServicePaymentMethod,
  UtilityService,
} from '../models/service/service.model';
import { Category } from '../models/transaction/transaction.model';
import { roundMoney } from '../utils/currency.utils';
import { CardsService } from './cards.service';
import { StorageService } from './storage.service';

/**
 * Maneja servicios públicos recurrentes (luz, gas, agua, etc.).
 *
 * **Inferencia de intervalo**: el sistema NO declara frecuencia. Calcula
 * el intervalo promedio entre facturas consecutivas del histórico y proyecta
 * la próxima factura como `ultimaFactura + intervaloPromedio`.
 *
 * **Imputación al mes según `paymentMethod`**:
 *  - `card` + `cardId` → usa `cards.firstBillingMonth(dueDate, closingDay)`.
 *    La factura aparece en el mes del resumen de la tarjeta, no en el mes
 *    del `dueDate`. Misma lógica que compras con tarjeta y suscripciones.
 *  - `direct-debit` / `other` → cae en el mes del `dueDate` directo.
 */
@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly storage = inject(StorageService);
  private readonly cards = inject(CardsService);

  private readonly _services = signal<UtilityService[]>(
    this.storage.readArray<UtilityService>(STORAGE_KEYS.services)
  );
  readonly services = this._services.asReadonly();

  // ============================================================
  // CRUD de servicios
  // ============================================================

  addService(input: {
    name: string;
    category: Category;
    paymentMethod: ServicePaymentMethod;
    cardId?: string;
  }): UtilityService | null {
    const name = input.name.trim();
    if (!name) return null;

    const now = new Date().toISOString();
    const service: UtilityService = {
      id: crypto.randomUUID(),
      name,
      category: input.category,
      paymentMethod: input.paymentMethod,
      cardId: input.paymentMethod === 'card' ? input.cardId : undefined,
      bills: [],
      createdAt: now,
      updatedAt: now,
    };
    this._services.update((list) => [service, ...list]);
    this.persist();
    return service;
  }

  updateService(
    id: string,
    patch: Partial<Pick<UtilityService, 'name' | 'category' | 'paymentMethod' | 'cardId'>>
  ): boolean {
    const current = this._services().find((s) => s.id === id);
    if (!current) return false;

    const trimmedName = patch.name?.trim();
    if (trimmedName !== undefined && !trimmedName) return false;

    this._services.update((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const nextPaymentMethod = patch.paymentMethod ?? s.paymentMethod;
        return {
          ...s,
          ...(trimmedName !== undefined ? { name: trimmedName } : {}),
          ...(patch.category !== undefined ? { category: patch.category } : {}),
          paymentMethod: nextPaymentMethod,
          cardId:
            nextPaymentMethod === 'card'
              ? patch.cardId !== undefined
                ? patch.cardId
                : s.cardId
              : undefined,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    this.persist();
    return true;
  }

  /** Soft delete: marca `archived: true`. Conserva el histórico. */
  archiveService(id: string): void {
    this._services.update((list) =>
      list.map((s) =>
        s.id === id
          ? { ...s, archived: true, updatedAt: new Date().toISOString() }
          : s
      )
    );
    this.persist();
  }

  reactivateService(id: string): void {
    this._services.update((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const { archived: _ignored, ...rest } = s;
        return { ...rest, updatedAt: new Date().toISOString() };
      })
    );
    this.persist();
  }

  /** Hard delete (requiere confirmación en UI). */
  removeService(id: string): void {
    this._services.update((list) => list.filter((s) => s.id !== id));
    this.persist();
  }

  // ============================================================
  // Sub-CRUD de facturas
  // ============================================================

  addBill(
    serviceId: string,
    input: {
      dueDate: string;
      amount: number;
      comprobante?: string;
      notes?: string;
    }
  ): ServiceBill | null {
    if (!input.dueDate) return null;
    const now = new Date().toISOString();
    const bill: ServiceBill = {
      id: crypto.randomUUID(),
      dueDate: input.dueDate,
      amount: Number(input.amount),
      comprobante: input.comprobante?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
    };
    let found = false;
    this._services.update((list) =>
      list.map((s) => {
        if (s.id !== serviceId) return s;
        found = true;
        return { ...s, bills: [...s.bills, bill], updatedAt: now };
      })
    );
    if (!found) return null;
    this.persist();
    return bill;
  }

  updateBill(
    serviceId: string,
    billId: string,
    patch: Partial<Pick<ServiceBill, 'dueDate' | 'amount' | 'comprobante' | 'notes'>>
  ): void {
    this._services.update((list) =>
      list.map((s) => {
        if (s.id !== serviceId) return s;
        const bills = s.bills.map((b) =>
          b.id === billId
            ? {
                ...b,
                ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
                ...(patch.amount !== undefined ? { amount: Number(patch.amount) } : {}),
                comprobante: patch.comprobante?.trim() || b.comprobante,
                notes: patch.notes?.trim() || b.notes,
              }
            : b
        );
        return { ...s, bills, updatedAt: new Date().toISOString() };
      })
    );
    this.persist();
  }

  removeBill(serviceId: string, billId: string): void {
    this._services.update((list) =>
      list.map((s) => {
        if (s.id !== serviceId) return s;
        return {
          ...s,
          bills: s.bills.filter((b) => b.id !== billId),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    this.persist();
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setServicesBulk(list: UtilityService[]): void {
    this._services.set(list);
    this.persist();
  }

  // ============================================================
  // Inferencia y proyección
  // ============================================================

  /**
   * Días promedio entre facturas consecutivas (usa últimas 6, requiere mín 2).
   * Devuelve null si no hay suficiente histórico.
   */
  averageIntervalDays(service: UtilityService): number | null {
    const sorted = this.sortedBills(service);
    if (sorted.length < 2) return null;
    // Tomamos las últimas 6 facturas para que el cálculo refleje el ritmo reciente.
    const recent = sorted.slice(-6);
    let sumDays = 0;
    let counted = 0;
    for (let i = 1; i < recent.length; i++) {
      const diff = this.daysBetween(recent[i - 1].dueDate, recent[i].dueDate);
      if (diff > 0) {
        sumDays += diff;
        counted++;
      }
    }
    if (counted === 0) return null;
    return Math.round(sumDays / counted);
  }

  /** Forecast del servicio: fecha y monto estimados de la próxima factura. */
  forecastFor(service: UtilityService): ServiceForecast {
    const sorted = this.sortedBills(service);
    const interval = this.averageIntervalDays(service);
    const last = sorted[sorted.length - 1];

    return {
      nextDueDate: last && interval != null ? this.addDays(last.dueDate, interval) : null,
      estimatedAmount: last ? last.amount : null,
      averageIntervalDays: interval,
      basedOnBills: Math.min(sorted.length, 6),
    };
  }

  /**
   * Mes de imputación de una fecha según la forma de pago del servicio.
   *
   *  - `card` + `cardId` válido → usa `firstBillingMonth(date, closingDay)`.
   *  - de lo contrario → mes del `date` directo (`YYYY-MM`).
   *
   * Es público porque la UI lo usa también para mostrar "se debita en X".
   */
  chargeMonthFor(service: UtilityService, date: string): string {
    if (service.paymentMethod === 'card' && service.cardId) {
      const card = this.cards.cardById(service.cardId);
      if (card) {
        return this.cards.firstBillingMonth(date, card.closingDay);
      }
    }
    return date.slice(0, 7);
  }

  /**
   * Cargos de servicios que caen en un mes (YYYY-MM).
   *
   * Para cada servicio activo (no archivado):
   *  - Devuelve las facturas reales cuyo mes de cargo coincide con `month`.
   *  - Si no hay facturas reales en `month` pero la proyección de la próxima
   *    factura cae en `month`, devuelve la estimada.
   *  - Iterativamente proyecta más allá de la próxima: si el intervalo cae
   *    múltiples veces dentro o antes del mes consultado, considera todas
   *    las que correspondan al mes.
   *
   * Servicios archivados: sólo devuelven facturas reales pasadas (sin proyección).
   */
  serviceChargesForMonth(month: string): ServiceCharge[] {
    const result: ServiceCharge[] = [];
    for (const service of this._services()) {
      // 1) Facturas reales cargadas que caen en el mes (según mes de cargo).
      for (const bill of service.bills) {
        if (this.chargeMonthFor(service, bill.dueDate) === month) {
          result.push(this.buildCharge(service, bill.dueDate, bill.amount, false, bill.id));
        }
      }
      // 2) Proyecciones futuras (sólo si no está archivado).
      if (service.archived) continue;

      const interval = this.averageIntervalDays(service);
      const last = this.sortedBills(service).slice(-1)[0];
      if (interval == null || !last) continue;

      // Proyectamos sucesivamente y filtramos las que caen en `month`.
      // Limitamos a 60 iteraciones por seguridad (sirve hasta horizontes largos).
      let proyectedDate = this.addDays(last.dueDate, interval);
      for (let i = 0; i < 60; i++) {
        const proyectedMonth = this.chargeMonthFor(service, proyectedDate);
        // Si la proyección cae en `month`, la incluimos (a menos que ya haya
        // una factura real del mismo servicio en ese mes; en ese caso skip).
        if (proyectedMonth === month) {
          const alreadyCovered = result.some(
            (c) => c.serviceId === service.id && !c.estimated
          );
          if (!alreadyCovered) {
            result.push(
              this.buildCharge(service, proyectedDate, last.amount, true, undefined)
            );
          }
        }
        // Si nos pasamos del mes, paramos.
        if (proyectedMonth > month) break;
        proyectedDate = this.addDays(proyectedDate, interval);
      }
    }
    return result;
  }

  // ============================================================
  // Helpers privados
  // ============================================================

  private sortedBills(service: UtilityService): ServiceBill[] {
    return [...service.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  private buildCharge(
    service: UtilityService,
    dueDate: string,
    amount: number,
    estimated: boolean,
    billId: string | undefined
  ): ServiceCharge {
    return {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      dueDate,
      amount: roundMoney(amount),
      estimated,
      billId,
    };
  }

  /** Diferencia en días entre dos ISO YYYY-MM-DD. */
  private daysBetween(a: string, b: string): number {
    const ta = new Date(a + 'T00:00:00').getTime();
    const tb = new Date(b + 'T00:00:00').getTime();
    return Math.round((tb - ta) / (1000 * 60 * 60 * 24));
  }

  /** Suma `n` días a un ISO YYYY-MM-DD y devuelve ISO. */
  private addDays(iso: string, n: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private persist(): void {
    this.storage.write(STORAGE_KEYS.services, this._services());
  }
}
