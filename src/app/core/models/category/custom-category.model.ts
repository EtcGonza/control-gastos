export type CustomCategoryType = 'expense' | 'income';

/**
 * Categoría definida por el usuario, complementaria a las hardcodeadas en
 * EXPENSE_CATEGORIES / INCOME_CATEGORIES.
 *
 * El tipo `expense` aplica para operaciones de gasto Y para compras con
 * tarjeta. El tipo `income` aplica para operaciones de ingreso.
 */
export interface CustomCategory {
  id: string;
  name: string;
  type: CustomCategoryType;
  color: string;       // hex, ej: '#a855f7'
  /**
   * Si está archivada, NO aparece en los pickers de nuevas operaciones pero
   * las transacciones existentes que la referencian siguen mostrándola
   * normalmente. Es un soft delete: el usuario la puede reactivar.
   */
  archived?: boolean;
  createdAt: string;
}
