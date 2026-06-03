import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import {
  USD_AUTO_SURCHARGE_THRESHOLDS,
  USD_DIGITAL_SERVICE_VAT,
  USD_RATE_API_BASE,
  USD_TOURISM_SURCHARGE,
} from '../constants/usd-rate.constants';
import { SurchargeMode } from '../models/credit-card/card-purchase.model';
import { roundMoney } from '../utils/currency.utils';
import { StorageService } from './storage.service';

/** Detalle de conversión USD → ARS para una entrada mensual. */
export interface UsdConversion {
  /** Fecha de cierre del resumen en que se aplica el TC: ISO YYYY-MM-DD. */
  closingDate: string;
  /** % de recargo (0, 0.21, 0.30 o 0.60). */
  surchargePct: number;
  /** Si es true, el usuario va a pagar el resumen en USD: no convertir. */
  usdDirect: boolean;
}

/** Resultado de aplicar el TC + recargo sobre un monto en USD. */
export interface ArsConversionResult {
  arsAmount: number;
  rate: number;
  surchargePct: number;
  /** True si se usó un TC de otra fecha por falta de dato exacto. */
  estimated: boolean;
  /** Fecha real del TC usado. */
  rateDate: string;
}

/**
 * Servicio de cotizaciones del dólar oficial vendedor.
 *
 * Mantiene un cache local `fecha → cotización`, consulta a argentinadatos.com
 * cuando falta un dato, y expone helpers de conversión USD → ARS aplicando los
 * recargos correspondientes (PAÍS, Ganancias, IVA Servicios Digitales,
 * turismo, etc.).
 */
@Injectable({ providedIn: 'root' })
export class UsdRateService {
  private readonly storage = inject(StorageService);

  /** Mapa de fecha (YYYY-MM-DD) → cotización oficial vendedor. */
  private readonly _rates = signal<Record<string, number>>(
    this.storage.readRecord<number>(STORAGE_KEYS.rates)
  );
  readonly rates = this._rates.asReadonly();

  /** Set de fechas que ya pedimos al API (para no reintentar). */
  private readonly _fetchedRates = new Set<string>();

  /**
   * Devuelve el % de recargo que aplica sobre el dólar oficial para una fecha
   * y modo dados.
   *
   *  - `usd-payment` / `none`: 0
   *  - `digital-service`: 0.21 (IVA Servicios Digitales)
   *  - `tourism`: 0.30 (servicios turísticos pagados en pesos)
   *  - `auto`: depende del histórico de impuestos (PAÍS + Ganancias)
   */
  surchargeForDate(date: string, mode: SurchargeMode = 'auto'): number {
    if (mode === 'usd-payment' || mode === 'none') return 0;
    if (mode === 'digital-service') return USD_DIGITAL_SERVICE_VAT;
    if (mode === 'tourism') return USD_TOURISM_SURCHARGE;
    // auto
    if (date < USD_AUTO_SURCHARGE_THRESHOLDS.before.until) {
      return USD_AUTO_SURCHARGE_THRESHOLDS.before.pct;
    }
    if (date < USD_AUTO_SURCHARGE_THRESHOLDS.middle.until) {
      return USD_AUTO_SURCHARGE_THRESHOLDS.middle.pct;
    }
    return USD_AUTO_SURCHARGE_THRESHOLDS.after.pct;
  }

  /**
   * Construye el objeto de conversión a aplicar a una entrada USD en función
   * de la fecha del cierre del resumen y el modo de recargo.
   */
  buildConversion(closingDate: string, mode: SurchargeMode | undefined): UsdConversion {
    const m: SurchargeMode = mode ?? 'auto';
    return {
      closingDate,
      surchargePct: this.surchargeForDate(closingDate, m),
      usdDirect: m === 'usd-payment',
    };
  }

  /** TC oficial guardado para una fecha exacta (o null). */
  rateForDate(date: string): number | null {
    return this._rates()[date] ?? null;
  }

  /** TC más reciente conocido (la fecha mayor cacheada). */
  latestRate(): { date: string; rate: number } | null {
    const entries = Object.entries(this._rates());
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[0].localeCompare(a[0]));
    return { date: entries[0][0], rate: entries[0][1] };
  }

  /**
   * Convierte un monto USD a ARS aplicando el TC y recargo del `conversion`.
   * Si no hay TC exacto, usa el último conocido y marca el resultado como
   * estimado. Devuelve null si todavía no hay ningún TC conocido o si la
   * entrada se paga directamente en USD.
   */
  convertToArs(amount: number, conversion: UsdConversion): ArsConversionResult | null {
    if (conversion.usdDirect) return null;
    const exact = this._rates()[conversion.closingDate];
    if (exact != null) {
      return {
        arsAmount: roundMoney(amount * exact * (1 + conversion.surchargePct)),
        rate: exact,
        surchargePct: conversion.surchargePct,
        estimated: false,
        rateDate: conversion.closingDate,
      };
    }
    const latest = this.latestRate();
    if (!latest) return null;
    return {
      arsAmount: roundMoney(amount * latest.rate * (1 + conversion.surchargePct)),
      rate: latest.rate,
      surchargePct: conversion.surchargePct,
      estimated: true,
      rateDate: latest.date,
    };
  }

  /** Permite al usuario sobreescribir manualmente un TC para una fecha. */
  setManualRate(date: string, rate: number): void {
    this._rates.update((r) => ({ ...r, [date]: rate }));
    this.storage.write(STORAGE_KEYS.rates, this._rates());
  }

  /** Reemplaza el cache completo (uso interno de import). */
  setRatesBulk(rates: Record<string, number>): void {
    this._rates.set(rates);
    this.storage.write(STORAGE_KEYS.rates, this._rates());
  }

  /**
   * Asegura que tengamos cotización para una fecha. Si no la tenemos y no la
   * pedimos antes, dispara fetch async al API público. Si la fecha no tiene
   * cotización oficial (feriado), busca la más cercana hacia atrás.
   */
  async ensureRate(date: string): Promise<void> {
    if (this._rates()[date] !== undefined) return;
    if (this._fetchedRates.has(date)) return;
    this._fetchedRates.add(date);

    try {
      const [y, m, d] = date.split('-');
      const url = `${USD_RATE_API_BASE}/${y}/${m}/${d}`;
      const res = await fetch(url);
      if (!res.ok) {
        await this.fallbackToNearest(date);
        return;
      }
      const data = await res.json();
      const rate = typeof data?.venta === 'number' ? data.venta : null;
      if (rate != null) {
        this._rates.update((r) => ({ ...r, [date]: rate }));
        this.storage.write(STORAGE_KEYS.rates, this._rates());
      } else {
        await this.fallbackToNearest(date);
      }
    } catch {
      await this.fallbackToNearest(date);
    }
  }

  /**
   * Pide la lista histórica y se queda con la cotización más cercana anterior
   * o igual a `date`. Se usa como fallback cuando el endpoint puntual falla.
   */
  private async fallbackToNearest(date: string): Promise<void> {
    try {
      const res = await fetch(USD_RATE_API_BASE);
      if (!res.ok) return;
      const arr = (await res.json()) as Array<{ fecha: string; venta: number }>;
      if (!Array.isArray(arr)) return;
      const valid = arr
        .filter((x) => x?.fecha <= date && typeof x.venta === 'number')
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      const closest = valid[0];
      if (closest) {
        this._rates.update((r) => ({ ...r, [date]: closest.venta }));
        this.storage.write(STORAGE_KEYS.rates, this._rates());
      }
    } catch {
      // silencio: usamos latestRate como fallback en la UI
    }
  }

  /**
   * Fecha de cierre del resumen que contiene una cuota o suscripción cobrada
   * en el mes `YYYY-MM` con día de cierre `closingDay`.
   *
   * Para una cuota visible en el mes M, el resumen cerró el día `closingDay`
   * del mes M-1 (clampeado al último día del mes).
   */
  billingClosingDate(month: string, closingDay: number): string {
    const [y, m] = month.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const py = prev.getFullYear();
    const pm0 = prev.getMonth();
    const lastDay = new Date(py, pm0 + 1, 0).getDate();
    const day = Math.min(closingDay, lastDay);
    return `${py}-${String(pm0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
