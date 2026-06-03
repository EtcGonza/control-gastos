import { Currency } from '../credit-card/card-purchase.model';

export type SavingMovementType = 'deposit' | 'withdrawal';

/**
 * Movimiento individual sobre un ahorro: depósito (aumenta) o retiro
 * (disminuye). El monto siempre es positivo; el tipo indica el signo.
 */
export interface SavingMovement {
  id: string;
  type: SavingMovementType;
  amount: number;        // siempre positivo
  date: string;          // ISO yyyy-MM-dd, cuándo ocurrió
  description?: string;
  createdAt: string;     // ISO timestamp de cuándo se registró
}

/**
 * Ahorro del usuario: un monto guardado en una moneda específica con
 * historial opcional de movimientos.
 *
 * El campo `amount` es el saldo actual. Las modificaciones se hacen vía
 * `addSavingMovement` que actualiza el saldo Y agrega un registro en
 * `movements`. Los ahorros viejos (creados antes de los movimientos)
 * pueden no tener el campo `movements`.
 */
export interface Saving {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  movements?: SavingMovement[];
  createdAt: string;
  updatedAt: string;
}
