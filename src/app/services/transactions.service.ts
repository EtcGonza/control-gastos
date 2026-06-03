import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DEFAULT_CATEGORIES } from '../core/constants/default-categories';
import { STORAGE_KEYS } from '../core/constants/storage-keys';
import { CustomCategory, CustomCategoryType } from '../core/models/category/custom-category.model';
import { CardPurchase, Currency, Installment, SurchargeMode } from '../core/models/credit-card/card-purchase.model';
import { CreditCard } from '../core/models/credit-card/credit-card.model';
import { RecurringTemplate } from '../core/models/recurring-template/recurring-template.model';
import { Saving, SavingMovement, SavingMovementType } from '../core/models/saving/saving.model';
import { Subscription } from '../core/models/subscription/subscription.model';
import {
  Category,
  SUBSCRIPTION_CATEGORY_ID,
  Transaction,
  TransactionType,
  UNKNOWN_CATEGORY_ID,
} from '../core/models/transaction/transaction.model';
import { BackupService, DataCounts, ExportFile } from '../core/services/backup.service';
import { CardsService } from '../core/services/cards.service';
import { CategoriesService, CategoryView } from '../core/services/categories.service';
import { MonthService } from '../core/services/month.service';
import { RecurringTemplatesService } from '../core/services/recurring-templates.service';
import { SavingsService } from '../core/services/savings.service';
import { StorageService } from '../core/services/storage.service';
import { SubscriptionsService } from '../core/services/subscriptions.service';
import { ArsConversionResult, UsdConversion, UsdRateService } from '../core/services/usd-rate.service';

/** Una fila de la lista mensual: puede ser una transacción real, una cuota o un cobro de suscripción. */
export interface MonthlyEntry {
  id: string;
  source: 'transaction' | 'installment' | 'subscription';
  type: TransactionType;
  description: string;
  amount: number;
  category: Category;
  date: string;
  fixed: boolean;
  currency: Currency;
  /** Sólo presente cuando currency === 'USD'. Define cómo se convierte a ARS. */
  conversion?: UsdConversion;
  // sólo para cuotas
  installment?: {
    number: number;
    total: number;
    cardLabel: string;
    purchaseId: string;
  };
  // sólo para suscripciones
  subscription?: {
    cardLabel: string;
    subscriptionId: string;
  };
}

// Re-exports para compat con componentes existentes.
export type { ArsConversionResult, UsdConversion } from '../core/services/usd-rate.service';
export type { CategoryView } from '../core/services/categories.service';
export type { ExportFile, DataCounts } from '../core/services/backup.service';

/**
 * Servicio orquestador.
 *
 * Es dueño de las transacciones manuales y de la composición de entradas
 * mensuales (transacciones + cuotas + suscripciones). Para todo lo demás
 * (cotizaciones, categorías, tarjetas, suscripciones, ahorros, plantillas,
 * backup) delega a los services específicos que viven en `core/services/`.
 *
 * Los componentes existentes siguen inyectando este servicio durante la
 * migración. A medida que se refactorizan a la nueva estructura de Pages,
 * se irán enchufando directo a los services de Core y este orquestador
 * quedará más chico.
 */
@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly storage = inject(StorageService);
  private readonly monthSvc = inject(MonthService);
  private readonly usdRate = inject(UsdRateService);
  private readonly categoriesSvc = inject(CategoriesService);
  private readonly cardsSvc = inject(CardsService);
  private readonly subsSvc = inject(SubscriptionsService);
  private readonly savingsSvc = inject(SavingsService);
  private readonly templatesSvc = inject(RecurringTemplatesService);
  private readonly backupSvc = inject(BackupService);

  // ------------------------------------------------------------
  // Transacciones (lo único que sigue siendo "propio" de este servicio)
  // ------------------------------------------------------------

  private readonly _transactions = signal<Transaction[]>(
    this.storage.readArray<Transaction>(STORAGE_KEYS.transactions)
  );
  readonly transactions = this._transactions.asReadonly();

  // ------------------------------------------------------------
  // Re-exports desde otros services (mantienen la API histórica)
  // ------------------------------------------------------------

  readonly templates = this.templatesSvc.templates;
  readonly cards = this.cardsSvc.cards;
  readonly purchases = this.cardsSvc.purchases;
  readonly subscriptions = this.subsSvc.subscriptions;
  readonly rates = this.usdRate.rates;
  readonly customCategories = this.categoriesSvc.customCategories;
  readonly savings = this.savingsSvc.savings;
  readonly selectedMonth = this.monthSvc.selectedMonth;
  readonly allExpenseCategories = this.categoriesSvc.allExpenseCategories;
  readonly allIncomeCategories = this.categoriesSvc.allIncomeCategories;
  readonly savingsTotalArs = this.savingsSvc.savingsTotalArs;
  readonly savingsTotalUsd = this.savingsSvc.savingsTotalUsd;
  readonly savingsTotalUsdInArs = this.savingsSvc.savingsTotalUsdInArs;
  readonly savingsGrandTotalArs = this.savingsSvc.savingsGrandTotalArs;

  // ------------------------------------------------------------
  // Migración (sigue viviendo aquí: toca transactions + templates + purchases)
  // ------------------------------------------------------------

  /**
   * Reporte de la última corrida de migración. Si > 0 registros fueron
   * asignados a "Desconocido" se setea con el conteo. AppComponent lo escucha
   * y muestra un aviso al usuario, luego llama `acknowledgeMigrationReport()`.
   */
  private readonly _migrationReport = signal<{ unknownCount: number } | null>(null);
  readonly migrationReport = this._migrationReport.asReadonly();

  acknowledgeMigrationReport(): void {
    this._migrationReport.set(null);
  }

  constructor() {
    // Registramos accessor de transacciones para que BackupService pueda
    // leerlas / sobreescribirlas sin importar este servicio.
    this.backupSvc.registerTransactionsAccessor({
      read: () => this._transactions(),
      write: (list) => {
        this._transactions.set(list);
        this.storage.write(STORAGE_KEYS.transactions, this._transactions());
      },
    });

    // Coordinación con RecurringTemplatesService: cuando aplica una plantilla
    // necesita crear una transacción real. Le exponemos el callback.
    this.templatesSvc.registerApplyHandler((tx) => {
      this._transactions.update((list) => [tx, ...list]);
      this.storage.write(STORAGE_KEYS.transactions, this._transactions());
    });
    this.templatesSvc.registerIsAppliedHandler((tpl) => {
      const key = this.templatesSvc.templateKey(tpl.type, tpl.description, tpl.category);
      return this._transactions().some(
        (t) =>
          t.date.startsWith(this.monthSvc.selectedMonth()) &&
          t.fixed &&
          this.templatesSvc.templateKey(t.type, t.description, t.category) === key
      );
    });

    // Migración category nombre → ID
    this.migrateCategoryNamesToIds();

    // Auto-fetch de cotizaciones para entries USD del mes en pantalla.
    effect(() => {
      const entries = this.monthlyEntries();
      const needed = new Set<string>();
      for (const e of entries) {
        if (e.currency === 'USD' && e.conversion && !e.conversion.usdDirect) {
          needed.add(e.conversion.closingDate);
        }
      }
      untracked(() => {
        for (const date of needed) {
          this.usdRate.ensureRate(date);
        }
        const today = new Date().toISOString().slice(0, 10);
        this.usdRate.ensureRate(today);
      });
    });
  }

  // ============================================================
  // Entradas mensuales (transacciones + cuotas + suscripciones)
  // ============================================================

  entriesForMonth(month: string): MonthlyEntry[] {
    const txEntries: MonthlyEntry[] = this._transactions()
      .filter((t) => t.date.startsWith(month))
      .map((t) => ({
        id: t.id,
        source: 'transaction',
        type: t.type,
        description: t.description,
        amount: t.amount,
        category: t.category,
        date: t.date,
        fixed: t.fixed,
        currency: 'ARS',
      }));

    const installments = this.cardsSvc.installmentsForMonth(month);
    const instEntries: MonthlyEntry[] = installments.map((i) => {
      const closingDate = this.usdRate.billingClosingDate(month, i.closingDayForBill);
      const conversion: UsdConversion | undefined =
        i.purchase.currency === 'USD'
          ? this.usdRate.buildConversion(closingDate, i.purchase.surchargeMode)
          : undefined;
      return {
        id: `inst-${i.purchase.id}-${i.number}`,
        source: 'installment',
        type: 'gasto',
        description: i.purchase.description,
        amount: i.amount,
        category: i.purchase.category,
        date: i.purchase.purchaseDate,
        fixed: true,
        currency: i.purchase.currency,
        conversion,
        installment: {
          number: i.number,
          total: i.total,
          cardLabel: i.cardLabel,
          purchaseId: i.purchase.id,
        },
      };
    });

    const subEntries: MonthlyEntry[] = this.subsSvc
      .subscriptionChargesForMonth(month)
      .map((s) => {
        const closingDate = this.usdRate.billingClosingDate(month, s.closingDayForBill);
        const conversion: UsdConversion | undefined =
          s.currency === 'USD'
            ? this.usdRate.buildConversion(closingDate, s.surchargeMode)
            : undefined;
        return {
          id: `sub-${s.subscriptionId}-${s.chargeDate}`,
          source: 'subscription',
          type: 'gasto',
          description: s.description,
          amount: s.amount,
          category: SUBSCRIPTION_CATEGORY_ID,
          date: s.chargeDate,
          fixed: true,
          currency: s.currency,
          conversion,
          subscription: {
            cardLabel: s.cardLabel,
            subscriptionId: s.subscriptionId,
          },
        };
      });

    return [...txEntries, ...instEntries, ...subEntries].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  readonly monthlyEntries = computed<MonthlyEntry[]>(() =>
    this.entriesForMonth(this.monthSvc.selectedMonth())
  );

  /** Compatibilidad: alias usado por componentes existentes. */
  readonly monthlyTransactions = this.monthlyEntries;

  // ---------- Totales por mes arbitrario ----------

  incomeForMonth(month: string): number {
    return this.entriesForMonth(month)
      .filter((t) => t.type === 'ingreso' && t.currency === 'ARS')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  expensesForMonth(month: string): number {
    return this.entriesForMonth(month)
      .filter((t) => t.type === 'gasto')
      .reduce((acc, t) => acc + this.entryArsAmount(t), 0);
  }

  balanceForMonth(month: string): number {
    return this.incomeForMonth(month) - this.expensesForMonth(month);
  }

  expensesByCategoryForMonth(month: string): Array<{ category: string; total: number }> {
    const map = new Map<string, number>();
    this.entriesForMonth(month)
      .filter((t) => t.type === 'gasto')
      .forEach((t) => {
        const arsValue = this.entryArsAmount(t);
        if (arsValue > 0) {
          map.set(t.category, (map.get(t.category) ?? 0) + arsValue);
        }
      });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }

  // ---------- Totales del mes seleccionado ----------

  readonly monthlyIncome = computed(() =>
    this.monthlyEntries()
      .filter((t) => t.type === 'ingreso' && t.currency === 'ARS')
      .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly monthlyExpenses = computed(() =>
    this.monthlyEntries()
      .filter((t) => t.type === 'gasto')
      .reduce((acc, t) => acc + this.entryArsAmount(t), 0)
  );

  readonly monthlyFixedExpenses = computed(() =>
    this.monthlyEntries()
      .filter((t) => t.type === 'gasto' && t.fixed)
      .reduce((acc, t) => acc + this.entryArsAmount(t), 0)
  );

  readonly monthlyBalance = computed(() => this.monthlyIncome() - this.monthlyExpenses());

  readonly fixedExpensesPercentage = computed(() => {
    const income = this.monthlyIncome();
    if (income === 0) return 0;
    return (this.monthlyFixedExpenses() / income) * 100;
  });

  readonly expensesPercentage = computed(() => {
    const income = this.monthlyIncome();
    if (income === 0) return 0;
    return (this.monthlyExpenses() / income) * 100;
  });

  readonly expensesByCategory = computed(() => {
    const map = new Map<string, number>();
    this.monthlyEntries()
      .filter((t) => t.type === 'gasto')
      .forEach((t) => {
        const arsValue = this.entryArsAmount(t);
        if (arsValue > 0) {
          map.set(t.category, (map.get(t.category) ?? 0) + arsValue);
        }
      });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  });

  // ---------- Totales USD ----------

  readonly monthlyExpensesUSD = computed(() =>
    this.monthlyEntries()
      .filter(
        (t) =>
          t.type === 'gasto' &&
          t.currency === 'USD' &&
          t.conversion?.usdDirect === true
      )
      .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly monthlyInstallmentsUSDCount = computed(
    () =>
      this.monthlyEntries().filter(
        (t) =>
          (t.source === 'installment' || t.source === 'subscription') &&
          t.currency === 'USD' &&
          t.conversion?.usdDirect === true
      ).length
  );

  readonly monthlyConvertedFromUSD = computed(() =>
    this.monthlyEntries()
      .filter(
        (t) =>
          t.type === 'gasto' &&
          t.currency === 'USD' &&
          t.conversion &&
          !t.conversion.usdDirect
      )
      .reduce((acc, t) => acc + this.entryArsAmount(t), 0)
  );

  // ============================================================
  // Transacciones (CRUD)
  // ============================================================

  add(tx: Omit<Transaction, 'id'>): void {
    const newTx: Transaction = { ...tx, id: crypto.randomUUID() };
    this._transactions.update((list) => [newTx, ...list]);
    this.storage.write(STORAGE_KEYS.transactions, this._transactions());

    if (tx.fixed) {
      this.templatesSvc.upsertTemplate({
        type: tx.type,
        description: tx.description,
        category: tx.category,
        amount: tx.amount,
      });
    }
  }

  updateTransaction(
    id: string,
    patch: Partial<Pick<Transaction, 'description' | 'amount' | 'category' | 'date' | 'fixed'>>
  ): void {
    this._transactions.update((list) =>
      list.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              description: patch.description?.trim() ?? t.description,
            }
          : t
      )
    );
    this.storage.write(STORAGE_KEYS.transactions, this._transactions());
  }

  remove(id: string): void {
    this._transactions.update((list) => list.filter((t) => t.id !== id));
    this.storage.write(STORAGE_KEYS.transactions, this._transactions());
  }

  clearAll(): void {
    this._transactions.set([]);
    this.storage.write(STORAGE_KEYS.transactions, this._transactions());
  }

  // ============================================================
  // Misc
  // ============================================================

  setMonth(month: string): void {
    this.monthSvc.setMonth(month);
  }

  // ============================================================
  // Delegates a otros services (compat con componentes existentes)
  // ============================================================

  // Plantillas
  upsertTemplate(input: { type: TransactionType; description: string; category: Category; amount: number }): RecurringTemplate {
    return this.templatesSvc.upsertTemplate(input);
  }
  updateTemplateAmount(id: string, amount: number): void {
    this.templatesSvc.updateTemplateAmount(id, amount);
  }
  removeTemplate(id: string): void {
    this.templatesSvc.removeTemplate(id);
  }
  applyTemplateToSelectedMonth(id: string): boolean {
    return this.templatesSvc.applyTemplateToSelectedMonth(id);
  }
  isTemplateAppliedThisMonth(tpl: RecurringTemplate): boolean {
    return this.templatesSvc.isTemplateAppliedThisMonth(tpl);
  }

  // Tarjetas
  addCard(input: Omit<CreditCard, 'id' | 'createdAt'>): CreditCard {
    return this.cardsSvc.addCard(input);
  }
  updateCard(
    id: string,
    patch: Partial<Omit<CreditCard, 'id' | 'createdAt'>>,
    closingDayMode: 'retroactive' | 'future' = 'retroactive'
  ): void {
    this.cardsSvc.updateCard(id, patch, closingDayMode);
  }
  cardHasEntries(cardId: string): boolean {
    return this.cardsSvc.cardHasEntries(cardId);
  }
  removeCard(id: string): void {
    this.cardsSvc.removeCard(id);
  }
  cardLabel(card: CreditCard): string {
    return this.cardsSvc.cardLabel(card);
  }
  addPurchase(input: Omit<CardPurchase, 'id' | 'createdAt'>): CardPurchase {
    return this.cardsSvc.addPurchase(input);
  }
  removePurchase(id: string): void {
    this.cardsSvc.removePurchase(id);
  }
  installmentsForMonth(month: string): Installment[] {
    return this.cardsSvc.installmentsForMonth(month);
  }
  firstBillingMonth(purchaseDate: string, closingDay: number): string {
    return this.cardsSvc.firstBillingMonth(purchaseDate, closingDay);
  }

  // Cotizaciones / conversión
  surchargeForDate(date: string, mode: SurchargeMode = 'auto'): number {
    return this.usdRate.surchargeForDate(date, mode);
  }
  rateForDate(date: string): number | null {
    return this.usdRate.rateForDate(date);
  }
  latestRate(): { date: string; rate: number } | null {
    return this.usdRate.latestRate();
  }
  setManualRate(date: string, rate: number): void {
    this.usdRate.setManualRate(date, rate);
  }
  billingClosingDate(month: string, closingDay: number): string {
    return this.usdRate.billingClosingDate(month, closingDay);
  }
  convertEntryToArs(entry: MonthlyEntry): ArsConversionResult | null {
    if (entry.currency !== 'USD' || !entry.conversion) return null;
    return this.usdRate.convertToArs(entry.amount, entry.conversion);
  }

  // Categorías
  categoryViewById(id: string): CategoryView | null {
    return this.categoriesSvc.categoryViewById(id);
  }
  nameForCategory(id: string): string {
    return this.categoriesSvc.nameForCategory(id);
  }
  colorForCategory(id: string): string {
    return this.categoriesSvc.colorForCategory(id);
  }
  addCustomCategory(input: { name: string; type: CustomCategoryType; color: string }): CustomCategory | null {
    return this.categoriesSvc.addCustomCategory(input);
  }
  updateCustomCategory(id: string, patch: { name?: string; color?: string }): boolean {
    return this.categoriesSvc.updateCustomCategory(id, patch);
  }
  removeCustomCategory(id: string): void {
    this.categoriesSvc.removeCustomCategory(id);
  }
  reactivateCustomCategory(id: string): void {
    this.categoriesSvc.reactivateCustomCategory(id);
  }

  // Suscripciones
  addSubscription(input: { cardId: string; description: string; currency: Currency; startDate: string; amount: number; surchargeMode?: SurchargeMode }): Subscription {
    return this.subsSvc.addSubscription(input);
  }
  cancelSubscription(id: string, cancelDate: string): void {
    this.subsSvc.cancelSubscription(id, cancelDate);
  }
  reactivateSubscription(id: string): void {
    this.subsSvc.reactivateSubscription(id);
  }
  addSubscriptionPrice(id: string, amount: number, from: string): void {
    this.subsSvc.addSubscriptionPrice(id, amount, from);
  }
  removeSubscription(id: string): void {
    this.subsSvc.removeSubscription(id);
  }
  priceForDate(sub: Subscription, date: string): number {
    return this.subsSvc.priceForDate(sub, date);
  }
  currentPrice(sub: Subscription): number {
    return this.subsSvc.currentPrice(sub);
  }
  subscriptionTotalCost(sub: Subscription) {
    return this.subsSvc.subscriptionTotalCost(sub);
  }
  subscriptionChargesForMonth(month: string) {
    return this.subsSvc.subscriptionChargesForMonth(month);
  }

  // Ahorros
  addSaving(input: { description: string; amount: number; currency: Currency }): Saving {
    return this.savingsSvc.addSaving(input);
  }
  updateSaving(id: string, patch: { description: string }): void {
    this.savingsSvc.updateSaving(id, patch);
  }
  removeSaving(id: string): void {
    this.savingsSvc.removeSaving(id);
  }
  addSavingMovement(
    savingId: string,
    input: { type: SavingMovementType; amount: number; date: string; description?: string }
  ): void {
    this.savingsSvc.addSavingMovement(savingId, input);
  }
  removeSavingMovement(savingId: string, movementId: string): void {
    this.savingsSvc.removeSavingMovement(savingId, movementId);
  }

  // Backup
  exportData(): ExportFile {
    return this.backupSvc.exportData();
  }
  importData(file: ExportFile): void {
    this.backupSvc.importData(file);
  }
  validateImportFile(raw: unknown) {
    return this.backupSvc.validateImportFile(raw);
  }
  clearAllData(): void {
    this.backupSvc.clearAllData();
  }
  dataCounts(): DataCounts {
    return this.backupSvc.dataCounts();
  }

  // ============================================================
  // Helper interno: monto en ARS de una MonthlyEntry
  // ============================================================

  private entryArsAmount(entry: MonthlyEntry): number {
    if (entry.currency === 'ARS') return entry.amount;
    if (entry.conversion?.usdDirect) {
      const latest = this.usdRate.latestRate();
      return latest ? Math.round(entry.amount * latest.rate * 100) / 100 : 0;
    }
    if (!entry.conversion) return 0;
    const conv = this.usdRate.convertToArs(entry.amount, entry.conversion);
    return conv?.arsAmount ?? 0;
  }

  // ============================================================
  // Migración runtime: category nombre → ID
  // ============================================================

  /**
   * Idempotente. Recorre transactions/templates/purchases y, si la categoría
   * almacenada no es un ID conocido, intenta resolverla como nombre histórico
   * y la convierte al ID estable correspondiente. Lo que no se puede resolver
   * cae a `cat-desconocido` y se reporta para que la UI avise al usuario.
   */
  private migrateCategoryNamesToIds(): void {
    const knownIds = new Set<string>(
      DEFAULT_CATEGORIES.map((c) => c.id).concat(
        this.categoriesSvc.customCategories().map((c) => c.id)
      )
    );

    const nameToId = new Map<string, string>();
    for (const def of DEFAULT_CATEGORIES) {
      nameToId.set(def.name.toLowerCase(), def.id);
    }
    for (const c of this.categoriesSvc.customCategories()) {
      nameToId.set(c.name.toLowerCase(), c.id);
    }

    let unknownCount = 0;
    const resolve = (val: string | undefined | null): string => {
      const s = (val ?? '').trim();
      if (s && knownIds.has(s)) return s;
      const byName = nameToId.get(s.toLowerCase());
      if (byName) return byName;
      unknownCount++;
      return UNKNOWN_CATEGORY_ID;
    };

    // Transactions
    let txChanged = false;
    const newTxs = this._transactions().map((t) => {
      const newCat = resolve(t.category);
      if (newCat !== t.category) {
        txChanged = true;
        return { ...t, category: newCat };
      }
      return t;
    });
    if (txChanged) {
      this._transactions.set(newTxs);
      this.storage.write(STORAGE_KEYS.transactions, newTxs);
    }

    // Templates
    let tplChanged = false;
    const newTpls = this.templatesSvc.templates().map((t) => {
      const newCat = resolve(t.category);
      if (newCat !== t.category) {
        tplChanged = true;
        return { ...t, category: newCat };
      }
      return t;
    });
    if (tplChanged) {
      this.templatesSvc.setTemplatesBulk(newTpls);
    }

    // Purchases
    let purChanged = false;
    const newPurs = this.cardsSvc.purchases().map((p) => {
      const newCat = resolve(p.category);
      if (newCat !== p.category) {
        purChanged = true;
        return { ...p, category: newCat };
      }
      return p;
    });
    if (purChanged) {
      this.cardsSvc.setPurchasesBulk(newPurs);
    }

    if (unknownCount > 0) {
      this._migrationReport.set({ unknownCount });
    }
  }
}
