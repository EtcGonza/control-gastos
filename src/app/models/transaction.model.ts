export type TransactionType = 'ingreso' | 'gasto';

export type ExpenseCategory =
  | 'Alquiler'
  | 'Servicios'
  | 'Alimentos'
  | 'Transporte'
  | 'Salud'
  | 'Entretenimiento'
  | 'Suscripciones'
  | 'Otros';

export type IncomeCategory = 'Sueldo' | 'Horas extras' | 'Otros';

export type Category = ExpenseCategory | IncomeCategory;

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
  'Suscripciones',
  'Otros',
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Sueldo',
  'Horas extras',
  'Otros',
];

export const CATEGORY_COLORS: Record<Category, string> = {
  Alquiler: '#6366f1',
  Servicios: '#0ea5e9',
  Alimentos: '#f59e0b',
  Transporte: '#10b981',
  Salud: '#ef4444',
  Entretenimiento: '#ec4899',
  Suscripciones: '#f97316',
  Sueldo: '#22c55e',
  'Horas extras': '#06b6d4',
  Otros: '#64748b',
};
