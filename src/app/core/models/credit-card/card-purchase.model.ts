import { Category } from '../transaction/transaction.model';

export type Currency = 'ARS' | 'USD';

/**
 * Modo de recargo para compras / suscripciones en USD.
 *  - 'auto': se infiere por fecha (60% pre-Dic 2024, 30% Dic 2024 a Ene 2026, 0% post).
 *  - 'none': sin recargo (compra directa en USD post Ene 2026).
 *  - 'digital-service': servicio digital del exterior (Steam, Netflix, Spotify,
 *    Adobe, AWS, etc.). Aplica 21% de IVA Servicios Digitales sobre el oficial.
 *  - 'tourism': servicio turístico pagado en pesos, 30% de recargo siempre.
 *  - 'usd-payment': el usuario va a pagar el resumen en USD, no se convierte a ARS.
 */
export type SurchargeMode =
  | 'auto'
  | 'none'
  | 'digital-service'
  | 'tourism'
  | 'usd-payment';

export interface CardPurchase {
  id: string;
  cardId: string;
  description: string;
  totalAmount: number;  // total a debitar (suma de cuotas)
  installments: number; // cantidad de cuotas
  purchaseDate: string; // ISO yyyy-MM-dd
  currency: Currency;
  category: Category;
  /** Sólo aplica cuando currency === 'USD'. Default 'auto'. */
  surchargeMode?: SurchargeMode;
  /**
   * Si está presente, usar este día de cierre para calcular el mes de facturación
   * en vez del cierre actual de la tarjeta. Se setea cuando el usuario edita la
   * tarjeta y elige "aplicar sólo a futuro": las compras ya cargadas conservan
   * el cierre con el que se hicieron.
   */
  closingDaySnapshot?: number;
  createdAt: string;
}

/** Cuota virtual generada para un mes dado (no se persiste). */
export interface Installment {
  purchase: CardPurchase;
  cardLabel: string;
  number: number;          // 1..N
  total: number;           // N
  amount: number;          // monto de esta cuota
  month: string;           // YYYY-MM en que se cobra
  closingDayForBill: number; // día de cierre vigente para esta cuota
}
