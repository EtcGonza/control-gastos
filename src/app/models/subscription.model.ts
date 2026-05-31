import { Currency, SurchargeMode } from './card-purchase.model';

export interface PriceEntry {
  /** Primera fecha (ISO yyyy-MM-dd) desde la cual este precio aplica. */
  from: string;
  amount: number;
}

export interface Subscription {
  id: string;
  cardId: string;
  description: string;
  currency: Currency;
  startDate: string;       // ISO yyyy-MM-dd - primer cobro
  cancelDate?: string;     // ISO yyyy-MM-dd - si se cancela
  priceHistory: PriceEntry[]; // siempre al menos 1 entry. Ordenado por from asc.
  /**
   * Si está archivada, se oculta del panel de gestión pero sigue contribuyendo
   * a los meses pasados en los que estuvo activa. Al archivar se cancela
   * automáticamente con fecha de hoy si no estaba cancelada.
   */
  archived?: boolean;
  /**
   * Si está presente, usar este día de cierre para calcular el mes de
   * facturación en vez del cierre actual de la tarjeta. Se setea cuando el
   * usuario edita la tarjeta y elige "aplicar sólo a futuro".
   */
  closingDaySnapshot?: number;
  /** Sólo aplica cuando currency === 'USD'. Default 'auto'. */
  surchargeMode?: SurchargeMode;
  createdAt: string;
}
