export type CardBrand = 'Visa' | 'Mastercard';

export interface CreditCard {
  id: string;
  brand: CardBrand;
  bank: string;
  closingDay: number; // día del mes (1-31)
  notes?: string;     // campo opcional (alias, últimos 4, etc.)
  createdAt: string;
}
