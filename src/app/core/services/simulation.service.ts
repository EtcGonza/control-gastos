import { Injectable, inject } from '@angular/core';
import {
  IncomeBaseMode,
  MonthProjection,
  SimulationConfig,
  SimulationItem,
  SimulationResult,
  SimulationWarning,
  SimulationWarningCode,
} from '../models/simulation/simulation.model';
import { roundMoney } from '../utils/currency.utils';
import { clampDayInMonth, formatMonthLabel } from '../utils/date.utils';
import { CardsService } from './cards.service';
import { TransactionsService } from './transactions.service';
import { UsdRateService } from './usd-rate.service';

/**
 * Calcula proyecciones what-if sobre compras hipotéticas.
 *
 * Es una capa **pura**: recibe input, devuelve resultado. NO maneja signals
 * propios, NO toca `localStorage`, NO modifica el estado de los services que
 * inyecta. Esto la hace trivial de invocar desde un `computed` del page sin
 * efectos secundarios.
 *
 * Reusa toda la maquinaria mes-arbitrario que ya existe en
 * `TransactionsService` (`incomeForMonth`, `expensesForMonth`,
 * `installmentsForMonth`, `subscriptionChargesForMonth`) y la lógica de
 * conversión USD de `UsdRateService`.
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly tx = inject(TransactionsService);
  private readonly usdRate = inject(UsdRateService);
  private readonly cards = inject(CardsService);

  /** Punto de entrada principal. */
  run(items: SimulationItem[], config: SimulationConfig): SimulationResult {
    const warnings: SimulationWarning[] = [];
    this.collectStructuralWarnings(items, config, warnings);

    const horizon = this.buildHorizon(config.horizonMonths);
    const incomeBase = this.resolveIncomeBase(config, warnings);
    const latestRate = this.usdRate.latestRate();

    // Cache de existingFixedExpenses por mes (no aplicamos inflación aún;
    // eso se hace al armar la MonthProjection según el offset).
    const existingFixedRaw = new Map<string, number>();
    for (const month of horizon) {
      existingFixedRaw.set(month, this.existingFixedForRaw(month));
    }

    let totalNominalArs = 0;
    let totalRealArs = 0;
    let totalNominalUsd = 0;

    const months: MonthProjection[] = horizon.map((month, offset) => {
      const projectedIncome = this.projectedIncomeFor(incomeBase, offset, config);

      const inflationFactor = Math.pow(1 + config.monthlyInflationPct / 100, offset);
      const existingFixedExpenses = roundMoney(
        (existingFixedRaw.get(month) ?? 0) * inflationFactor
      );

      let simulationImpact = 0;
      let simulationImpactUsd = 0;

      for (const item of items) {
        const impact = this.itemImpactFor(item, month, offset, config, latestRate);
        simulationImpact += impact.arsImpact;
        if (impact.usdDirect) simulationImpactUsd += impact.usdDirect;

        // Acumular totales globales en una sola pasada.
        totalRealArs += impact.arsImpact;
        if (impact.usdDirect) totalNominalUsd += impact.usdDirect;
      }

      simulationImpact = roundMoney(simulationImpact);
      const totalFixedExpenses = roundMoney(existingFixedExpenses + simulationImpact);
      const projectedBalance = roundMoney(projectedIncome - totalFixedExpenses);
      const committedPct = projectedIncome > 0
        ? roundMoney((totalFixedExpenses / projectedIncome) * 100)
        : 0;

      const baselineBalance = roundMoney(projectedIncome - existingFixedExpenses);
      const baselineCommittedPct = projectedIncome > 0
        ? roundMoney((existingFixedExpenses / projectedIncome) * 100)
        : 0;

      return {
        month,
        label: formatMonthLabel(month),
        projectedIncome: roundMoney(projectedIncome),
        existingFixedExpenses,
        simulationImpact,
        totalFixedExpenses,
        projectedBalance,
        committedPct,
        baselineBalance,
        baselineCommittedPct,
        isOverCommitted: committedPct > 80,
        isModerate: committedPct > 50 && committedPct <= 80,
        isComfortable: committedPct <= 50,
        isNegative: projectedBalance < 0,
        simulationImpactUsd: simulationImpactUsd > 0 ? roundMoney(simulationImpactUsd) : undefined,
      };
    });

    // Nominal (sin recargos, USD al TC actual): suma simple de items.
    for (const item of items) {
      totalNominalArs += this.nominalArsOf(item, latestRate);
    }

    const peakCommittedPct = months.reduce((max, m) => Math.max(max, m.committedPct), 0);
    const monthsInRed = months.filter((m) => m.isNegative).length;
    const monthsModerate = months.filter((m) => m.isModerate).length;
    const monthsOverCommitted = months.filter((m) => m.isOverCommitted).length;

    this.collectRuntimeWarnings(items, config, horizon, latestRate, warnings);

    return {
      months,
      totalNominalArs: roundMoney(totalNominalArs),
      totalRealArs: roundMoney(totalRealArs),
      totalNominalUsd: roundMoney(totalNominalUsd),
      peakCommittedPct: roundMoney(peakCommittedPct),
      monthsInRed,
      monthsModerate,
      monthsOverCommitted,
      warnings,
    };
  }

  // ============================================================
  // Horizonte y meses
  // ============================================================

  /** Devuelve los meses (YYYY-MM) del horizonte empezando por el mes actual. */
  private buildHorizon(horizonMonths: number): string[] {
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < horizonMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  // ============================================================
  // Ingresos
  // ============================================================

  /** Ingresos base mensuales según el modo elegido por el usuario. */
  private resolveIncomeBase(config: SimulationConfig, warnings: SimulationWarning[]): number {
    if (config.incomeBase === 'manual') {
      return Math.max(0, config.manualIncomeArs ?? 0);
    }
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (config.incomeBase === 'last-month') {
      // Tomamos el último mes COMPLETO (el anterior al actual) para no medir
      // un mes en curso a mitad de carga.
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      const value = this.tx.incomeForMonth(prevMonth);
      if (value === 0) {
        warnings.push({
          code: 'sin-ingresos-base',
          message: 'No hay ingresos cargados en el último mes. La proyección va a asumir cero hasta que cargues ingresos o uses un monto manual.',
        });
      }
      return value;
    }

    // 'avg-3m': promedio de los últimos 3 meses completos (no incluye el actual).
    let sum = 0;
    let counted = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const value = this.tx.incomeForMonth(month);
      if (value > 0) {
        sum += value;
        counted++;
      }
      // Suprimimos warning de "currentMonth" no usado.
      void currentMonth;
    }
    if (counted === 0) {
      warnings.push({
        code: 'sin-ingresos-base',
        message: 'No hay ingresos cargados en los últimos 3 meses. La proyección va a asumir cero hasta que cargues ingresos o uses un monto manual.',
      });
      return 0;
    }
    return sum / counted;
  }

  /** Ingresos proyectados para el mes con `offset` desde el mes actual. */
  private projectedIncomeFor(base: number, offset: number, config: SimulationConfig): number {
    if (base === 0) return 0;
    const factor = Math.pow(1 + config.monthlyInflationPct / 100, offset);
    return base * factor;
  }

  // ============================================================
  // Gastos fijos existentes (sin inflación; se aplica al armar la projection)
  // ============================================================

  /**
   * Gastos fijos en ARS para un mes futuro, **antes** de aplicar inflación.
   *
   * Incluye:
   *  - Cuotas existentes que caen en ese mes (convertidas a ARS si son USD).
   *  - Suscripciones existentes activas en ese mes (convertidas a ARS).
   *  - Transacciones manuales con `fixed: true` que ya existen en el mes
   *    (esto solo aplica al mes actual; los meses futuros no tienen tx reales).
   *
   * Para evitar contar el mes actual de manera asimétrica (donde sí hay tx
   * reales) vs los futuros (donde no), proyectamos así:
   *  - Mes actual: usa el dato real (`expensesForMonth` filtrando gastos fijos).
   *  - Meses futuros: solo cuotas + suscripciones (no plantillas manuales,
   *    porque el usuario podría no haberlas aplicado todavía).
   */
  private existingFixedForRaw(month: string): number {
    // Cuotas + suscripciones — esto es virtual, vale para cualquier mes.
    let total = this.tx
      .entriesForMonth(month)
      .filter(
        (e) =>
          (e.source === 'installment' || e.source === 'subscription') &&
          e.type === 'gasto'
      )
      .reduce((acc, e) => acc + this.entryArs(e), 0);

    // Transacciones manuales fijas: sólo cuentan en el mes actual (las
    // futuras no se materializan sin aplicar la plantilla).
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (month === currentMonth) {
      total += this.tx
        .entriesForMonth(month)
        .filter((e) => e.source === 'transaction' && e.type === 'gasto' && e.fixed)
        .reduce((acc, e) => acc + e.amount, 0);
    }

    return total;
  }

  /** Convierte una MonthlyEntry a ARS usando el TC actual conocido. */
  private entryArs(entry: ReturnType<TransactionsService['entriesForMonth']>[number]): number {
    if (entry.currency === 'ARS') return entry.amount;
    if (entry.conversion?.usdDirect) {
      const latest = this.usdRate.latestRate();
      return latest ? entry.amount * latest.rate : 0;
    }
    if (!entry.conversion) return 0;
    const conv = this.usdRate.convertToArs(entry.amount, entry.conversion);
    return conv?.arsAmount ?? 0;
  }

  // ============================================================
  // Impacto de un item simulado en un mes
  // ============================================================

  /**
   * Cuánto aporta `item` al mes `month` (offset meses desde hoy).
   * Devuelve el impacto en ARS y, si aplica, la fracción en USD-directo.
   */
  private itemImpactFor(
    item: SimulationItem,
    month: string,
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): { arsImpact: number; usdDirect?: number } {
    switch (item.type) {
      case 'contado':
        return this.contadoImpact(item, month, offset, config, latestRate);
      case 'cuotas':
        return this.cuotasImpact(item, month, offset, config, latestRate);
      case 'suscripcion':
        return this.suscripcionImpact(item, month, offset, config, latestRate);
    }
  }

  /** Una sola incidencia en el mes del `purchaseDate` (o el primer mes del horizonte si es anterior). */
  private contadoImpact(
    item: SimulationItem,
    month: string,
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): { arsImpact: number; usdDirect?: number } {
    if (!item.purchaseDate) return { arsImpact: 0 };
    const purchaseMonth = item.purchaseDate.slice(0, 7);
    if (purchaseMonth !== month) return { arsImpact: 0 };

    return this.convertItemToArs(item, item.purchaseDate, offset, config, latestRate);
  }

  /** Cuota correspondiente al mes, si cae dentro de la serie de cuotas. */
  private cuotasImpact(
    item: SimulationItem,
    month: string,
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): { arsImpact: number; usdDirect?: number } {
    if (!item.cardId || !item.installments || item.installments < 1 || !item.purchaseDate) {
      return { arsImpact: 0 };
    }
    const card = this.cards.cardById(item.cardId);
    if (!card) return { arsImpact: 0 };

    const firstMonth = this.cards.firstBillingMonth(item.purchaseDate, card.closingDay);
    const diff = this.monthDiff(firstMonth, month);
    if (diff < 0 || diff >= item.installments) return { arsImpact: 0 };

    const installmentAmount = item.amount / item.installments;
    // Para USD, la fecha de "cierre" del resumen de este mes:
    const closingDate = this.usdRate.billingClosingDate(month, card.closingDay);

    return this.convertAmountToArs(
      installmentAmount,
      item.currency,
      item.surchargeMode,
      closingDate,
      offset,
      config,
      latestRate
    );
  }

  /** Suscripción virtual: aparece todos los meses entre `startDate` y `cancelDate`. */
  private suscripcionImpact(
    item: SimulationItem,
    month: string,
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): { arsImpact: number; usdDirect?: number } {
    if (!item.subscriptionCardId || !item.startDate) return { arsImpact: 0 };
    const card = this.cards.cardById(item.subscriptionCardId);
    if (!card) return { arsImpact: 0 };

    const chargeDay = Number(item.startDate.split('-')[2]);
    const [mY, mM] = month.split('-').map(Number);

    // Misma lógica que SubscriptionsService.subscriptionChargesForMonth:
    // probamos offset 1 y 2 desde el mes fuente.
    for (const offsetTry of [1, 2]) {
      const sourceDate = new Date(mY, mM - 1 - offsetTry, 1);
      const sY = sourceDate.getFullYear();
      const sM = sourceDate.getMonth() + 1;
      const effChargeDay = clampDayInMonth(sY, sM, chargeDay);
      const effCloseDay = clampDayInMonth(sY, sM, card.closingDay);
      const actualOffset = effChargeDay < effCloseDay ? 1 : 2;
      if (actualOffset !== offsetTry) continue;

      const chargeDate = `${sY}-${String(sM).padStart(2, '0')}-${String(effChargeDay).padStart(2, '0')}`;

      if (chargeDate < item.startDate) continue;
      if (item.cancelDate && item.cancelDate < chargeDate) continue;

      const closingDate = this.usdRate.billingClosingDate(month, card.closingDay);
      return this.convertAmountToArs(
        item.amount,
        item.currency,
        item.surchargeMode,
        closingDate,
        offset,
        config,
        latestRate
      );
    }
    return { arsImpact: 0 };
  }

  /** Convierte el monto de un item ya ubicado en un mes a ARS según moneda. */
  private convertItemToArs(
    item: SimulationItem,
    referenceDate: string,
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): { arsImpact: number; usdDirect?: number } {
    if (item.currency === 'ARS') return { arsImpact: item.amount };
    return this.convertAmountToArs(
      item.amount,
      item.currency,
      item.surchargeMode,
      referenceDate,
      offset,
      config,
      latestRate
    );
  }

  /**
   * Convierte un monto USD a ARS aplicando recargo + TC proyectado del mes.
   * Si el modo es `usd-payment`, además devuelve el monto USD como obligación
   * directa.
   */
  private convertAmountToArs(
    amount: number,
    currency: 'ARS' | 'USD',
    surchargeMode: SimulationItem['surchargeMode'],
    referenceDate: string,
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): { arsImpact: number; usdDirect?: number } {
    if (currency === 'ARS') return { arsImpact: amount };

    const mode = surchargeMode ?? 'auto';
    const surchargePct = this.usdRate.surchargeForDate(referenceDate, mode);
    const projectedRate = this.projectedRateFor(offset, config, latestRate);

    if (mode === 'usd-payment') {
      // Pago directo en USD: no se convierte (queda como obligación USD).
      // El ARS equivalente lo igualamos al monto USD * TC proyectado para que
      // el balance ARS refleje el costo de oportunidad. Esto es coherente con
      // cómo el sistema actual incluye USD-direct en `entryArsAmount`.
      const arsImpact = projectedRate != null ? amount * projectedRate : 0;
      return { arsImpact, usdDirect: amount };
    }

    if (projectedRate == null) return { arsImpact: 0 };
    return { arsImpact: amount * projectedRate * (1 + surchargePct) };
  }

  /** TC proyectado para un mes con offset desde hoy. */
  private projectedRateFor(
    offset: number,
    config: SimulationConfig,
    latestRate: { date: string; rate: number } | null
  ): number | null {
    if (!latestRate) return null;
    const factor = Math.pow(1 + config.monthlyDevaluationPct / 100, offset);
    return latestRate.rate * factor;
  }

  /** Costo nominal en ARS (sin recargos) usando el TC actual. */
  private nominalArsOf(
    item: SimulationItem,
    latestRate: { date: string; rate: number } | null
  ): number {
    // Para nominal contamos el "amount" del item como total a debitar.
    if (item.currency === 'ARS') return item.amount;
    if (!latestRate) return 0;
    return item.amount * latestRate.rate;
  }

  // ============================================================
  // Warnings
  // ============================================================

  /** Warnings que dependen sólo del input (no de la corrida). */
  private collectStructuralWarnings(
    items: SimulationItem[],
    config: SimulationConfig,
    out: SimulationWarning[]
  ): void {
    for (const item of items) {
      if (item.type === 'cuotas' && !item.cardId) {
        this.pushOnce(out, {
          code: 'sin-tarjeta',
          message: 'Elegí una tarjeta para simular la compra en cuotas.',
        });
      }
      if (item.type === 'suscripcion' && !item.subscriptionCardId) {
        this.pushOnce(out, {
          code: 'sin-tarjeta',
          message: 'Elegí una tarjeta para simular la suscripción.',
        });
      }
      if (
        item.type === 'cuotas' &&
        item.installments &&
        item.installments > config.horizonMonths
      ) {
        this.pushOnce(out, {
          code: 'cuotas-exceden-horizonte',
          message: `La compra es en ${item.installments} cuotas pero el horizonte es de ${config.horizonMonths} meses. El total real considera todas las cuotas, pero la tabla sólo muestra las primeras.`,
        });
      }
    }
  }

  /** Warnings que dependen del estado runtime (TC disponible, etc.). */
  private collectRuntimeWarnings(
    items: SimulationItem[],
    _config: SimulationConfig,
    _horizon: string[],
    latestRate: { date: string; rate: number } | null,
    out: SimulationWarning[]
  ): void {
    const hasUsd = items.some((i) => i.currency === 'USD');
    if (hasUsd && !latestRate) {
      this.pushOnce(out, {
        code: 'tc-no-disponible',
        message: 'Todavía no hay cotización del dólar oficial cargada. Esperá unos segundos y volvé a simular.',
      });
    }
  }

  private pushOnce(arr: SimulationWarning[], w: SimulationWarning): void {
    if (!arr.some((x) => x.code === w.code)) arr.push(w);
  }

  // ============================================================
  // Helpers
  // ============================================================

  private monthDiff(a: string, b: string): number {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return (by - ay) * 12 + (bm - am);
  }
}

/** Re-exporto los tipos usados por consumidores. */
export type {
  SimulationItem,
  SimulationConfig,
  SimulationResult,
  MonthProjection,
  SimulationWarning,
  SimulationWarningCode,
  IncomeBaseMode,
} from '../models/simulation/simulation.model';
