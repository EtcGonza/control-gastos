/**
 * Claves de `localStorage` usadas por la app.
 *
 * IMPORTANTE: estas cadenas son contratos con los datos del usuario.
 * No renombrarlas sin un script de migración: los usuarios pierden sus
 * datos si las claves cambian.
 */
export const STORAGE_KEYS = {
  transactions: 'control-gastos:transactions',
  templates: 'control-gastos:templates',
  cards: 'control-gastos:cards',
  purchases: 'control-gastos:purchases',
  subscriptions: 'control-gastos:subscriptions',
  rates: 'control-gastos:rates',
  customCategories: 'control-gastos:custom-categories',
  savings: 'control-gastos:savings',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Prefijo común de todas las claves del proyecto. */
export const STORAGE_PREFIX = 'control-gastos:';
