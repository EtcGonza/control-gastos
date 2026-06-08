import { Category } from '../transaction/transaction.model';

/**
 * Forma de pago de un servicio.
 *
 *  - `card`: se paga con tarjeta de crédito → el cargo aparece en el mes del
 *    resumen siguiendo el `closingDay` de la tarjeta.
 *  - `direct-debit`: débito automático de cuenta o de tarjeta de débito → el
 *    cargo cae en el mes del `dueDate`.
 *  - `other`: efectivo, transferencia, Mercado Pago, etc. → cae en el mes del
 *    `dueDate`.
 */
export type ServicePaymentMethod = 'card' | 'direct-debit' | 'other';

/**
 * Servicio público recurrente (luz, gas, agua, internet, cable, etc.).
 *
 * El sistema NO declara la frecuencia; la infiere del histórico de facturas
 * cargado por el usuario (`bills[]`). Esto permite manejar patrones
 * irregulares (mensual, bimestral pagado en cuotas, ajustes intermedios).
 */
export interface UtilityService {
  id: string;
  /** Nombre libre. Ej: "Edenor", "Camuzzi", "ABSA", "Telecentro". */
  name: string;
  /** Categoría con la que se imputa el gasto. Default `cat-servicios`. */
  category: Category;
  paymentMethod: ServicePaymentMethod;
  /** Sólo aplica si `paymentMethod === 'card'`. */
  cardId?: string;
  /** Histórico de facturas pagadas/cargadas. */
  bills: ServiceBill[];
  /**
   * Soft delete: conserva el histórico pero no proyecta facturas nuevas.
   * Los pagos pasados siguen apareciendo en los meses que les corresponden.
   */
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Una factura individual cargada por el usuario.
 *
 * Cada factura es atómica: si un servicio bimestral se paga en 2 cuotas
 * mensuales, son DOS `ServiceBill` distintas en el array, no una sola.
 */
export interface ServiceBill {
  id: string;
  /** Fecha de vencimiento (ISO YYYY-MM-DD). */
  dueDate: string;
  /**
   * Monto en ARS. Puede ser **negativo** si la factura es un crédito o ajuste
   * a favor (ej. la luz devuelve $200 por algún reintegro).
   */
  amount: number;
  /** Número de comprobante / referencia del proveedor (opcional). */
  comprobante?: string;
  /** Nota libre (ej. "consumo de verano alto"). */
  notes?: string;
  createdAt: string;
}

// ============================================================
// Tipos derivados (calculados por ServicesService, no se persisten)
// ============================================================

/**
 * Pago previsto o real de un servicio en un mes dado.
 *
 * Lo emite `ServicesService.serviceChargesForMonth(month)` para que
 * `TransactionsService.entriesForMonth(month)` lo integre como una fuente
 * más (`source: 'service'`).
 */
export interface ServiceCharge {
  serviceId: string;
  serviceName: string;
  category: Category;
  /** Fecha estimada o real de vencimiento (ISO YYYY-MM-DD). */
  dueDate: string;
  /** Monto: el de la factura cargada (si existe) o el estimado. */
  amount: number;
  /**
   * True si la factura todavía no fue cargada y el monto viene de la
   * proyección. False si corresponde a una `ServiceBill` real del histórico.
   */
  estimated: boolean;
  /** Id de la factura si ya fue cargada. Undefined si es proyección. */
  billId?: string;
}

/**
 * Resumen del estado de inferencia para mostrar próxima factura en la card.
 *
 * Si el histórico tiene <2 facturas, `nextDueDate` y `averageIntervalDays`
 * son `null` (no se puede inferir intervalo).
 */
export interface ServiceForecast {
  /** Fecha de la próxima factura estimada (ISO YYYY-MM-DD). */
  nextDueDate: string | null;
  /** Monto estimado de la próxima factura. Usa el último monto cargado. */
  estimatedAmount: number | null;
  /** Días promedio entre facturas (inferido del histórico). */
  averageIntervalDays: number | null;
  /** Cuántas facturas se usaron para inferir el intervalo. */
  basedOnBills: number;
}
