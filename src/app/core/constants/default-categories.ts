/**
 * Barrel que re-exporta las categorías default desde `transaction.model.ts`.
 *
 * Las categorías default viven en el modelo de transacción porque su existencia
 * es parte del contrato del tipo `Category`. Este archivo provee un import
 * más semánticamente claro para los servicios:
 *
 * ```ts
 * import { DEFAULT_CATEGORIES } from '@core/constants/default-categories';
 * ```
 */
export {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORIES_BY_ID,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  FALLBACK_EXPENSE_CATEGORY_ID,
  FALLBACK_INCOME_CATEGORY_ID,
  SUBSCRIPTION_CATEGORY_ID,
  UNKNOWN_CATEGORY_ID,
} from '../models/transaction/transaction.model';
export type { DefaultCategoryDef } from '../models/transaction/transaction.model';
