import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { RecurringTemplate } from '../models/recurring-template/recurring-template.model';
import {
  Category,
  Transaction,
  TransactionType,
} from '../models/transaction/transaction.model';
import { MonthService } from './month.service';
import { StorageService } from './storage.service';

/**
 * Maneja las plantillas de movimientos "fijos" (sueldo, alquiler, etc.) que
 * se pueden aplicar con un click sobre el mes seleccionado.
 *
 * La aplicación de una plantilla genera una transacción real; para no
 * acoplarse a `TransactionsService` directamente (que ya inyecta varias
 * cosas), recibe un callback `applyHandler` registrado por el dueño.
 */
@Injectable({ providedIn: 'root' })
export class RecurringTemplatesService {
  private readonly storage = inject(StorageService);
  private readonly month = inject(MonthService);

  private readonly _templates = signal<RecurringTemplate[]>(
    this.storage.readArray<RecurringTemplate>(STORAGE_KEYS.templates)
  );
  readonly templates = this._templates.asReadonly();

  /** Callback que persiste la transacción generada al aplicar una plantilla. */
  private applyHandler: ((tx: Transaction) => void) | null = null;
  /** Callback que valida si la plantilla ya tiene una tx en el mes actual. */
  private isAppliedHandler: ((tpl: RecurringTemplate) => boolean) | null = null;

  registerApplyHandler(cb: (tx: Transaction) => void): void {
    this.applyHandler = cb;
  }

  registerIsAppliedHandler(cb: (tpl: RecurringTemplate) => boolean): void {
    this.isAppliedHandler = cb;
  }

  /**
   * Crea o actualiza la plantilla cuya `(type, description, category)` matchea
   * la entrada. Devuelve la plantilla resultante.
   */
  upsertTemplate(input: {
    type: TransactionType;
    description: string;
    category: Category;
    amount: number;
  }): RecurringTemplate {
    const key = this.templateKey(input.type, input.description, input.category);
    const existing = this._templates().find(
      (t) => this.templateKey(t.type, t.description, t.category) === key
    );

    const now = new Date().toISOString();
    if (existing) {
      const updated: RecurringTemplate = {
        ...existing,
        amount: input.amount,
        updatedAt: now,
      };
      this._templates.update((list) =>
        list.map((t) => (t.id === existing.id ? updated : t))
      );
      this.storage.write(STORAGE_KEYS.templates, this._templates());
      return updated;
    }

    const created: RecurringTemplate = {
      id: crypto.randomUUID(),
      ...input,
      updatedAt: now,
    };
    this._templates.update((list) => [created, ...list]);
    this.storage.write(STORAGE_KEYS.templates, this._templates());
    return created;
  }

  updateTemplateAmount(id: string, amount: number): void {
    this._templates.update((list) =>
      list.map((t) =>
        t.id === id ? { ...t, amount, updatedAt: new Date().toISOString() } : t
      )
    );
    this.storage.write(STORAGE_KEYS.templates, this._templates());
  }

  removeTemplate(id: string): void {
    this._templates.update((list) => list.filter((t) => t.id !== id));
    this.storage.write(STORAGE_KEYS.templates, this._templates());
  }

  /**
   * Aplica una plantilla al mes seleccionado. Crea una transacción real
   * vía el callback registrado. Devuelve true si se aplicó, false si la
   * plantilla no existe o ya estaba aplicada este mes.
   */
  applyTemplateToSelectedMonth(templateId: string): boolean {
    const tpl = this._templates().find((t) => t.id === templateId);
    if (!tpl) return false;
    if (this.isTemplateAppliedThisMonth(tpl)) return false;
    if (!this.applyHandler) return false;

    const month = this.month.selectedMonth();
    const today = new Date();
    const isCurrentMonth =
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` === month;
    const day = isCurrentMonth ? String(today.getDate()).padStart(2, '0') : '01';
    const date = `${month}-${day}`;

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: tpl.type,
      description: tpl.description,
      amount: tpl.amount,
      category: tpl.category,
      date,
      fixed: true,
    };
    this.applyHandler(newTx);
    return true;
  }

  isTemplateAppliedThisMonth(tpl: RecurringTemplate): boolean {
    return this.isAppliedHandler?.(tpl) ?? false;
  }

  /** Reemplaza el listado completo (uso interno de import). */
  setTemplatesBulk(list: RecurringTemplate[]): void {
    this._templates.set(list);
    this.storage.write(STORAGE_KEYS.templates, this._templates());
  }

  /** Clave compuesta usada para detectar plantillas duplicadas. */
  templateKey(type: TransactionType, description: string, category: Category): string {
    return `${type}::${category}::${description.trim().toLowerCase()}`;
  }
}
