export type TransactionType = 'ingreso' | 'gasto';

export type ExpenseCategory =
  | 'Alquiler'
  | 'Servicios'
  | 'Alimentos'
  | 'Transporte'
  | 'Salud'
  | 'Entretenimiento'
  | 'Ropa'
  | 'Otros';

export type IncomeCategory = 'Sueldo' | 'Horas extras' | 'Otros';

/**
 * Categoría puede ser una de las hardcodeadas (ExpenseCategory | IncomeCategory)
 * o una custom creada por el usuario. Por eso es string y no union literal.
 */
export type Category = string;

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: Category;
  date: string; // ISO yyyy-MM-dd
  fixed: boolean; // si es un gasto/ingreso fijo mensual
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Alquiler',
  'Servicios',
  'Alimentos',
  'Transporte',
  'Salud',
  'Entretenimiento',
  'Ropa',
  'Otros',
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Sueldo',
  'Horas extras',
  'Otros',
];

/**
 * Mapa de colores por categoría. Incluye 'Suscripciones' porque el sistema
 * sigue usando ese nombre como categoría automática para los cobros generados
 * desde el panel de Suscripciones (aunque el usuario ya no la puede elegir
 * manualmente desde el formulario).
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Alquiler: '#6366f1',
  Servicios: '#0ea5e9',
  Alimentos: '#f59e0b',
  Transporte: '#10b981',
  Salud: '#ef4444',
  Entretenimiento: '#ec4899',
  Ropa: '#a855f7',
  Suscripciones: '#f97316',
  Sueldo: '#22c55e',
  'Horas extras': '#06b6d4',
  Otros: '#64748b',
};
