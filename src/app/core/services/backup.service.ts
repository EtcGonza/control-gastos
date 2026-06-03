import { Injectable, inject } from '@angular/core';
import { CustomCategory } from '../models/category/custom-category.model';
import {
  CardPurchase,
} from '../models/credit-card/card-purchase.model';
import { CreditCard } from '../models/credit-card/credit-card.model';
import { RecurringTemplate } from '../models/recurring-template/recurring-template.model';
import { Saving } from '../models/saving/saving.model';
import { Subscription } from '../models/subscription/subscription.model';
import { Transaction } from '../models/transaction/transaction.model';
import { CardsService } from './cards.service';
import { CategoriesService } from './categories.service';
import { RecurringTemplatesService } from './recurring-templates.service';
import { SavingsService } from './savings.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsdRateService } from './usd-rate.service';

/** Estructura del archivo de exportación de datos (respaldo). */
export interface ExportFile {
  app: 'control-gastos';
  schemaVersion: number;
  exportedAt: string;
  data: {
    transactions: Transaction[];
    templates: RecurringTemplate[];
    cards: CreditCard[];
    purchases: CardPurchase[];
    subscriptions: Subscription[];
    rates: Record<string, number>;
    customCategories?: CustomCategory[]; // opcional para retrocompat
    savings?: Saving[]; // opcional para retrocompat
  };
}

/** Counts por entidad usados por la UI de respaldo. */
export interface DataCounts {
  transactions: number;
  templates: number;
  cards: number;
  purchases: number;
  subscriptions: number;
  rates: number;
  customCategories: number;
  savings: number;
}

/**
 * Orquesta export / import / wipe de TODOS los datos del usuario.
 *
 * Conoce los services individuales y delega cada read/write a su dueño.
 * Mantiene también el callback `transactionsAccessor` para leer/escribir
 * las transacciones reales (que viven en TransactionsService).
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly categories = inject(CategoriesService);
  private readonly cards = inject(CardsService);
  private readonly subs = inject(SubscriptionsService);
  private readonly savings = inject(SavingsService);
  private readonly templates = inject(RecurringTemplatesService);
  private readonly usdRate = inject(UsdRateService);

  /**
   * Accessor a las transacciones (read/write). Lo registra el dueño
   * (TransactionsService) al arrancar.
   */
  private txAccessor: {
    read: () => Transaction[];
    write: (list: Transaction[]) => void;
  } | null = null;

  registerTransactionsAccessor(accessor: {
    read: () => Transaction[];
    write: (list: Transaction[]) => void;
  }): void {
    this.txAccessor = accessor;
  }

  /** Snapshot serializable de todos los datos. */
  exportData(): ExportFile {
    return {
      app: 'control-gastos',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        transactions: this.txAccessor?.read() ?? [],
        templates: this.templates.templates(),
        cards: this.cards.cards(),
        purchases: this.cards.purchases(),
        subscriptions: this.subs.subscriptions(),
        rates: this.usdRate.rates(),
        customCategories: this.categories.customCategories(),
        savings: this.savings.savings(),
      },
    };
  }

  /**
   * Reemplaza todos los datos por los del archivo importado. Asume que el
   * archivo ya fue validado con `validateImportFile`.
   */
  importData(file: ExportFile): void {
    const d = file.data;
    this.txAccessor?.write(Array.isArray(d.transactions) ? d.transactions : []);
    this.templates.setTemplatesBulk(Array.isArray(d.templates) ? d.templates : []);
    this.cards.setCardsBulk(Array.isArray(d.cards) ? d.cards : []);
    this.cards.setPurchasesBulk(Array.isArray(d.purchases) ? d.purchases : []);
    this.subs.setSubscriptionsBulk(
      Array.isArray(d.subscriptions) ? d.subscriptions : []
    );
    this.usdRate.setRatesBulk(
      d.rates && typeof d.rates === 'object' && !Array.isArray(d.rates)
        ? d.rates
        : {}
    );
    this.categories.setCustomCategoriesBulk(
      Array.isArray(d.customCategories) ? d.customCategories : []
    );
    this.savings.setSavingsBulk(Array.isArray(d.savings) ? d.savings : []);
  }

  /**
   * Valida que un objeto desconocido tenga la forma de un export válido.
   * Devuelve el archivo tipado o un mensaje de error.
   */
  validateImportFile(
    raw: unknown
  ): { ok: true; file: ExportFile } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object') {
      return {
        ok: false,
        error: 'El archivo no contiene un JSON con la estructura esperada.',
      };
    }
    const obj = raw as Record<string, unknown>;
    if (obj['app'] !== 'control-gastos') {
      return {
        ok: false,
        error: 'El archivo no parece ser un respaldo de Control de Gastos.',
      };
    }
    if (typeof obj['schemaVersion'] !== 'number') {
      return { ok: false, error: 'Falta o es inválido el campo schemaVersion.' };
    }
    if (obj['schemaVersion'] > 1) {
      return {
        ok: false,
        error: `El archivo fue creado con una versión más nueva (v${obj['schemaVersion']}). Actualizá la app para importarlo.`,
      };
    }
    if (!obj['data'] || typeof obj['data'] !== 'object') {
      return { ok: false, error: 'Falta la sección "data" en el archivo.' };
    }
    return { ok: true, file: raw as ExportFile };
  }

  /** Borra todos los datos persistidos. */
  clearAllData(): void {
    this.txAccessor?.write([]);
    this.templates.setTemplatesBulk([]);
    this.cards.setCardsBulk([]);
    this.cards.setPurchasesBulk([]);
    this.subs.setSubscriptionsBulk([]);
    this.usdRate.setRatesBulk({});
    this.categories.setCustomCategoriesBulk([]);
    this.savings.setSavingsBulk([]);
  }

  /** Conteo por entidad — útil para mostrar resúmenes. */
  dataCounts(): DataCounts {
    return {
      transactions: this.txAccessor?.read().length ?? 0,
      templates: this.templates.templates().length,
      cards: this.cards.cards().length,
      purchases: this.cards.purchases().length,
      subscriptions: this.subs.subscriptions().length,
      rates: Object.keys(this.usdRate.rates()).length,
      customCategories: this.categories.customCategories().length,
      savings: this.savings.savings().length,
    };
  }
}
