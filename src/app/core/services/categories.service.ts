import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_CATEGORIES_BY_ID,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DefaultCategoryDef,
} from '../constants/default-categories';
import { STORAGE_KEYS } from '../constants/storage-keys';
import {
  CustomCategory,
  CustomCategoryType,
} from '../models/category/custom-category.model';
import { StorageService } from './storage.service';

/** Vista combinada de categoría — sirve para defaults y customs por igual. */
export interface CategoryView {
  id: string;
  name: string;
  color: string;
}

/**
 * Maneja categorías de gastos e ingresos.
 *
 * Las categorías DEFAULT viven en `core/models/transaction/transaction.model.ts`
 * con IDs estables (`cat-alquiler`, `cat-suscripciones`, ...). Las CUSTOM las
 * crea el usuario y tienen UUID. Soft delete (`archived: true`) mantiene
 * los registros viejos resolvibles sin permitir nuevos usos.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly storage = inject(StorageService);

  /** Categorías personalizadas creadas por el usuario (incluye archivadas). */
  private readonly _customCategories = signal<CustomCategory[]>(
    this.storage.readArray<CustomCategory>(STORAGE_KEYS.customCategories)
  );
  readonly customCategories = this._customCategories.asReadonly();

  /** Categorías de gasto disponibles en pickers: defaults + customs no archivadas. */
  readonly allExpenseCategories = computed<CategoryView[]>(() => {
    const customExp = this._customCategories()
      .filter((c) => c.type === 'expense' && !c.archived)
      .map((c) => ({ id: c.id, name: c.name, color: c.color }));
    return [...DEFAULT_EXPENSE_CATEGORIES.map(this.defToView), ...customExp];
  });

  /** Categorías de ingreso disponibles en pickers (sin archivadas). */
  readonly allIncomeCategories = computed<CategoryView[]>(() => {
    const customInc = this._customCategories()
      .filter((c) => c.type === 'income' && !c.archived)
      .map((c) => ({ id: c.id, name: c.name, color: c.color }));
    return [...DEFAULT_INCOME_CATEGORIES.map(this.defToView), ...customInc];
  });

  /** Resuelve un ID a su CategoryView (default o custom). null si no existe. */
  categoryViewById(id: string): CategoryView | null {
    const def = DEFAULT_CATEGORIES_BY_ID[id];
    if (def) return this.defToView(def);
    const custom = this._customCategories().find((c) => c.id === id);
    if (custom) return { id: custom.id, name: custom.name, color: custom.color };
    return null;
  }

  /** Nombre de display de una categoría por ID. "Sin categoría" si no existe. */
  nameForCategory(id: string): string {
    return this.categoryViewById(id)?.name ?? 'Sin categoría';
  }

  /** Color de una categoría por ID. Gris si no existe. */
  colorForCategory(id: string): string {
    return this.categoryViewById(id)?.color ?? '#64748b';
  }

  /** Crea una nueva categoría custom. Rechaza si el nombre ya existe en su tipo. */
  addCustomCategory(input: {
    name: string;
    type: CustomCategoryType;
    color: string;
  }): CustomCategory | null {
    const name = input.name.trim();
    if (!name) return null;
    if (this.nameExistsInType(name, input.type)) return null;

    const cat: CustomCategory = {
      id: crypto.randomUUID(),
      name,
      type: input.type,
      color: input.color,
      createdAt: new Date().toISOString(),
    };
    this._customCategories.update((list) => [...list, cat]);
    this.storage.write(STORAGE_KEYS.customCategories, this._customCategories());
    return cat;
  }

  /**
   * Edita nombre y/o color de una categoría custom. Las transacciones que la
   * referencian por ID toman el cambio automáticamente (display).
   * Devuelve true si pudo actualizar, false si hay conflicto de nombre.
   */
  updateCustomCategory(id: string, patch: { name?: string; color?: string }): boolean {
    const current = this._customCategories().find((c) => c.id === id);
    if (!current) return false;

    const trimmed = patch.name?.trim();
    if (trimmed !== undefined && trimmed !== current.name) {
      if (!trimmed) return false;
      if (this.nameExistsInType(trimmed, current.type, id)) return false;
    }

    this._customCategories.update((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              ...(trimmed !== undefined ? { name: trimmed } : {}),
              ...(patch.color ? { color: patch.color } : {}),
            }
          : c
      )
    );
    this.storage.write(STORAGE_KEYS.customCategories, this._customCategories());
    return true;
  }

  /**
   * "Eliminar" una categoría custom = archivarla (soft delete). Los registros
   * existentes que la referencian la SIGUEN mostrando con su nombre y color
   * originales; lo único que cambia es que ya no aparece en los pickers de
   * nuevas operaciones. Se puede revertir con `reactivateCustomCategory`.
   */
  removeCustomCategory(id: string): void {
    this._customCategories.update((list) =>
      list.map((c) => (c.id === id ? { ...c, archived: true } : c))
    );
    this.storage.write(STORAGE_KEYS.customCategories, this._customCategories());
  }

  /** Reactiva una categoría custom archivada. */
  reactivateCustomCategory(id: string): void {
    this._customCategories.update((list) =>
      list.map((c) => {
        if (c.id !== id) return c;
        const { archived: _ignored, ...rest } = c;
        return rest;
      })
    );
    this.storage.write(STORAGE_KEYS.customCategories, this._customCategories());
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setCustomCategoriesBulk(list: CustomCategory[]): void {
    this._customCategories.set(list);
    this.storage.write(STORAGE_KEYS.customCategories, this._customCategories());
  }

  /** Helper: ¿existe ya el nombre en defaults o customs del mismo type? */
  private nameExistsInType(
    name: string,
    type: CustomCategoryType,
    excludeId?: string
  ): boolean {
    const lower = name.toLowerCase();
    const defaults =
      type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
    if (defaults.some((d) => d.name.toLowerCase() === lower)) return true;
    return this._customCategories().some(
      (c) =>
        c.type === type &&
        c.id !== excludeId &&
        c.name.toLowerCase() === lower
    );
  }

  private defToView(d: DefaultCategoryDef): CategoryView {
    return { id: d.id, name: d.name, color: d.color };
  }
}
