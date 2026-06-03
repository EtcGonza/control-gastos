export type TransactionType = 'ingreso' | 'gasto';

/**
 * Una categoría siempre se referencia por su `id` (estable). El nombre y el
 * color se resuelven en tiempo de render desde el servicio. Esto permite
 * renombrar / cambiar color sin tocar los registros existentes.
 *
 * Los IDs de las categorías DEFAULT son slugs estables que no cambian (ej.
 * 'cat-alquiler'). Los IDs de categorías CUSTOM son UUIDs generados al
 * momento de crearlas.
 */
export type Category = string;

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: Category; // ahora siempre es un ID, no el nombre
  date: string; // ISO yyyy-MM-dd
  fixed: boolean;
}

/**
 * Categoría por defecto: nombre y color cableados, ID estable.
 * Estos IDs son fijos y referenciables desde código (ej. el motor de
 * suscripciones siempre usa 'cat-suscripciones').
 */
export interface DefaultCategoryDef {
  id: string;
  name: string;
  color: string;
  scope: 'expense' | 'income' | 'system';
}

/** Categorías por defecto del sistema. NO mover los IDs — son contratos estables. */
export const DEFAULT_CATEGORIES: DefaultCategoryDef[] = [
  // Gastos
  { id: 'cat-alquiler',        name: 'Alquiler',        color: '#6366f1', scope: 'expense' },
  { id: 'cat-servicios',       name: 'Servicios',       color: '#0ea5e9', scope: 'expense' },
  { id: 'cat-alimentos',       name: 'Alimentos',       color: '#f59e0b', scope: 'expense' },
  { id: 'cat-transporte',      name: 'Transporte',      color: '#10b981', scope: 'expense' },
  { id: 'cat-salud',           name: 'Salud',           color: '#ef4444', scope: 'expense' },
  { id: 'cat-entretenimiento', name: 'Entretenimiento', color: '#ec4899', scope: 'expense' },
  { id: 'cat-ropa',            name: 'Ropa',            color: '#a855f7', scope: 'expense' },
  { id: 'cat-otros',           name: 'Otros',           color: '#64748b', scope: 'expense' },

  // Ingresos
  { id: 'cat-sueldo',          name: 'Sueldo',          color: '#22c55e', scope: 'income' },
  { id: 'cat-horas-extras',    name: 'Horas extras',    color: '#06b6d4', scope: 'income' },
  { id: 'cat-otros-ingreso',   name: 'Otros',           color: '#64748b', scope: 'income' },

  // System: usadas internamente, no aparecen en pickers
  { id: 'cat-suscripciones',   name: 'Suscripciones',   color: '#f97316', scope: 'system' },
  { id: 'cat-desconocido',     name: 'Desconocido',     color: '#94a3b8', scope: 'system' },
];

/** ID de la categoría fallback para registros con categoría no reconocida (migración). */
export const UNKNOWN_CATEGORY_ID = 'cat-desconocido';

/** Lookup directo por ID. */
export const DEFAULT_CATEGORIES_BY_ID: Record<string, DefaultCategoryDef> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c])
);

/** Sólo las visibles en el picker de gastos. */
export const DEFAULT_EXPENSE_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c.scope === 'expense');

/** Sólo las visibles en el picker de ingresos. */
export const DEFAULT_INCOME_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c.scope === 'income');

/** ID de la categoría usada por el motor de suscripciones para los cobros generados. */
export const SUBSCRIPTION_CATEGORY_ID = 'cat-suscripciones';

/** ID de fallback cuando no se puede resolver una categoría (orphan). */
export const FALLBACK_EXPENSE_CATEGORY_ID = 'cat-otros';
export const FALLBACK_INCOME_CATEGORY_ID = 'cat-otros-ingreso';
