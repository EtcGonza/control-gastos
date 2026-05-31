import { Category, TransactionType } from './transaction.model';

/**
 * Plantilla de un movimiento fijo (recurrente).
 *
 * Es un atajo independiente de las transacciones: editar `amount` acá NO
 * modifica las transacciones ya cargadas; sólo cambia el monto sugerido
 * para la próxima vez que se aplique.
 */
export interface RecurringTemplate {
  id: string;
  type: TransactionType;
  description: string;
  category: Category;
  amount: number; // último monto usado / próximo monto sugerido
  updatedAt: string; // ISO
}
