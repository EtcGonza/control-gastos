import { Currency, SurchargeMode } from '../credit-card/card-purchase.model';
import { Category } from '../transaction/transaction.model';

/** Tipo de compra a simular. */
export type SimulationItemType = 'contado' | 'cuotas' | 'suscripcion';

/**
 * Item simulado.
 *
 * El service acepta `SimulationItem[]` para permitir comparar múltiples
 * escenarios en el futuro; el MVP de UI sólo expone uno a la vez.
 */
export interface SimulationItem {
  /** UUID generado en cliente al cargar el item en el form. */
  id: string;
  type: SimulationItemType;

  /** Sólo display. Es lo que aparece como descripción en la tabla y el chart. */
  description: string;

  /** Sólo display y para colorear (usa `tx.colorForCategory`). */
  category?: Category;

  currency: Currency;

  /**
   * Monto total ingresado por el usuario.
   *  - 'contado': monto único.
   *  - 'cuotas': total a debitar (suma de las N cuotas, igual que el form real).
   *  - 'suscripcion': monto mensual.
   */
  amount: number;

  /** Sólo aplica si currency === 'USD'. */
  surchargeMode?: SurchargeMode;

  /**
   * Fecha tentativa de la compra (ISO YYYY-MM-DD). Se usa para:
   *  - 'contado': ubicar el impacto en el mes correspondiente.
   *  - 'cuotas': calcular el `firstBillingMonth` usando el cierre de la tarjeta.
   *  - 'suscripcion': no se usa (mirar `startDate`).
   */
  purchaseDate: string;

  // -- Sólo si type === 'cuotas' --

  /** Referencia a una tarjeta real (para tomar su `closingDay`). */
  cardId?: string;

  /** Cantidad de cuotas (1..N). */
  installments?: number;

  // -- Sólo si type === 'suscripcion' --

  /** Fecha del primer cobro. El día define el día fijo de cobro mensual. */
  startDate?: string;

  /** Fecha tentativa de cancelación dentro del horizonte (opcional). */
  cancelDate?: string;

  /** Tarjeta sobre la que se cobra la suscripción. */
  subscriptionCardId?: string;
}

/** Base sobre la que se proyectan los ingresos futuros. */
export type IncomeBaseMode = 'avg-3m' | 'last-month' | 'manual';

/** Configuración global de la corrida de simulación. */
export interface SimulationConfig {
  /** Meses a proyectar (incluye el mes actual). */
  horizonMonths: 6 | 12 | 18 | 24;

  /** De dónde se saca el monto base de ingresos para proyectar. */
  incomeBase: IncomeBaseMode;

  /** Sólo se usa si `incomeBase === 'manual'`. */
  manualIncomeArs?: number;

  /**
   * % mensual de inflación aplicado a gastos fijos existentes (cuotas previas,
   * suscripciones activas, plantillas marcadas como fijas). NO aplica a la
   * compra simulada (sus cuotas tienen monto nominal fijo por contrato).
   * Default 0.
   */
  monthlyInflationPct: number;

  /**
   * % mensual de devaluación aplicado al TC del último valor conocido para
   * proyectar la conversión USD → ARS de cuotas/suscripciones USD futuras.
   * Default 0 (asume TC plano).
   */
  monthlyDevaluationPct: number;
}

/** Detalle del impacto en un mes proyectado. */
export interface MonthProjection {
  /** YYYY-MM. */
  month: string;
  /** "Jul 26" para mostrar en tabla/chart. */
  label: string;

  // ---- Ingresos ----
  /** Ingresos en ARS proyectados para este mes. */
  projectedIncome: number;

  // ---- Gastos ----
  /** Cuotas + suscripciones + plantillas fijas existentes (en ARS). */
  existingFixedExpenses: number;
  /** Lo que aporta la compra simulada este mes (en ARS, ya con TC + recargo). */
  simulationImpact: number;
  /** existingFixedExpenses + simulationImpact. */
  totalFixedExpenses: number;

  // ---- Derivados ----
  /** projectedIncome - totalFixedExpenses. */
  projectedBalance: number;
  /** totalFixedExpenses / projectedIncome * 100. */
  committedPct: number;

  // ---- Comparativa sin simulación ----
  baselineBalance: number;
  baselineCommittedPct: number;

  // ---- Flags de UX ----
  /** committedPct > 80. */
  isOverCommitted: boolean;
  /** 50 < committedPct <= 80. */
  isModerate: boolean;
  /** committedPct <= 50. */
  isComfortable: boolean;
  /** projectedBalance < 0. */
  isNegative: boolean;

  /** Suma de cuotas USD modo 'usd-payment' del mes (opcional). */
  simulationImpactUsd?: number;
}

/** Códigos de advertencia que la UI muestra como warnings al usuario. */
export type SimulationWarningCode =
  | 'cuotas-exceden-horizonte'
  | 'sin-ingresos-base'
  | 'sin-tarjeta'
  | 'tc-no-disponible';

/** Warning concreto a renderizar en el summary del simulador. */
export interface SimulationWarning {
  code: SimulationWarningCode;
  /** Mensaje listo para mostrar al usuario, en español. */
  message: string;
}

/** Resultado de una corrida de `SimulationService.run`. */
export interface SimulationResult {
  /** Proyección mes a mes ordenada cronológicamente. */
  months: MonthProjection[];

  // ---- Totales agregados de la(s) compra(s) simulada(s) ----

  /**
   * Costo total nominal en ARS sin recargos.
   * Si la compra es USD, se convierte al último TC conocido (sin recargo, sin
   * proyección de devaluación).
   */
  totalNominalArs: number;

  /**
   * Costo total real en ARS incluyendo recargos (PAÍS, IVA digital, turismo) y
   * la proyección de devaluación cuando `monthlyDevaluationPct > 0`.
   */
  totalRealArs: number;

  /** Suma de obligaciones en USD si hay items modo 'usd-payment'. */
  totalNominalUsd: number;

  // ---- Highlights ----
  /** Máximo `committedPct` dentro del horizonte. */
  peakCommittedPct: number;
  /** Cantidad de meses con `projectedBalance < 0`. */
  monthsInRed: number;
  /** Cantidad de meses con 50 < `committedPct` <= 80. */
  monthsModerate: number;
  /** Cantidad de meses con `committedPct` > 80. */
  monthsOverCommitted: number;

  /** Advertencias para mostrar en el summary. */
  warnings: SimulationWarning[];
}
