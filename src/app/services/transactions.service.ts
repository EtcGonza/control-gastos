import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { CardPurchase, Currency, Installment, SurchargeMode } from '../models/card-purchase.model';
import { CreditCard } from '../models/credit-card.model';
import { CustomCategory, CustomCategoryType } from '../models/custom-category.model';
import { RecurringTemplate } from '../models/recurring-template.model';
import { Saving, SavingMovement, SavingMovementType } from '../models/saving.model';
import { Subscription } from '../models/subscription.model';
import {
  Category,
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORIES_BY_ID,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DefaultCategoryDef,
  FALLBACK_EXPENSE_CATEGORY_ID,
  FALLBACK_INCOME_CATEGORY_ID,
  SUBSCRIPTION_CATEGORY_ID,
  Transaction,
  TransactionType,
  UNKNOWN_CATEGORY_ID,
} from '../models/transaction.model';

/** Vista combinada de categoría — sirve para defaults y customs por igual. */
export interface CategoryView {
  id: string;
  name: string;
  color: string;
}

const STORAGE_KEY = 'control-gastos:transactions';
const TEMPLATES_KEY = 'control-gastos:templates';
const CARDS_KEY = 'control-gastos:cards';
const PURCHASES_KEY = 'control-gastos:purchases';
const SUBS_KEY = 'control-gastos:subscriptions';
const RATES_KEY = 'control-gastos:rates';
const CUSTOM_CATEGORIES_KEY = 'control-gastos:custom-categories';
const SAVINGS_KEY = 'control-gastos:savings';

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

/** Detalle de conversión USD → ARS para una entrada mensual. */
export interface UsdConversion {
  /** Fecha de cierre del resumen en que se aplica el TC: ISO YYYY-MM-DD. */
  closingDate: string;
  /** % de recargo (0, 0.30 o 0.60). */
  surchargePct: number;
  /** Si es true, el usuario va a pagar el resumen en USD: no convertir. */
  usdDirect: boolean;
}

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

/** Resultado de convertir una entrada USD a ARS. */
export interface ArsConversionResult {
  arsAmount: number;
  rate: number;
  surchargePct: number;
  estimated: boolean; // true si se usó un TC de otra fecha por falta de dato exacto
  rateDate: string;   // fecha real del TC usado
}

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly _transactions = signal<Transaction[]>(this.load(STORAGE_KEY));
  readonly transactions = this._transactions.asReadonly();

  private readonly _templates = signal<RecurringTemplate[]>(this.load<RecurringTemplate>(TEMPLATES_KEY));
  readonly templates = this._templates.asReadonly();

  private readonly _cards = signal<CreditCard[]>(this.load<CreditCard>(CARDS_KEY));
  readonly cards = this._cards.asReadonly();

  private readonly _purchases = signal<CardPurchase[]>(this.load<CardPurchase>(PURCHASES_KEY));
  readonly purchases = this._purchases.asReadonly();

  private readonly _subscriptions = signal<Subscription[]>(this.load<Subscription>(SUBS_KEY));
  readonly subscriptions = this._subscriptions.asReadonly();

  /** Mapa de fecha (YYYY-MM-DD) → cotización oficial vendedor. */
  private readonly _rates = signal<Record<string, number>>(this.loadRates());
  readonly rates = this._rates.asReadonly();

  /** Categorías personalizadas creadas por el usuario (incluye archivadas). */
  private readonly _customCategories = signal<CustomCategory[]>(
    this.load<CustomCategory>(CUSTOM_CATEGORIES_KEY)
  );
  readonly customCategories = this._customCategories.asReadonly();

  /**
   * Reporte de la última corrida de migración. Si > 0 registros fueron
   * asignados a "Desconocido" se setea con el conteo. Un consumidor (típicamente
   * el AppComponent) debería observarlo y mostrar un aviso al usuario, luego
   * llamar `acknowledgeMigrationReport()` para limpiarlo.
   */
  private readonly _migrationReport = signal<{ unknownCount: number } | null>(null);
  readonly migrationReport = this._migrationReport.asReadonly();

  acknowledgeMigrationReport(): void {
    this._migrationReport.set(null);
  }

  /** Ahorros declarados por el usuario (en ARS o USD). */
  private readonly _savings = signal<Saving[]>(this.load<Saving>(SAVINGS_KEY));
  readonly savings = this._savings.asReadonly();
  /** Set de fechas que ya pedimos al API (para no reintentar). */
  private readonly _fetchedRates = new Set<string>();
  /** True si por lo menos hubo un intento de fetch al cargar. */
  private readonly _ratesReady = signal<boolean>(false);

  private readonly _selectedMonth = signal<string>(this.currentMonth());
  readonly selectedMonth = this._selectedMonth.asReadonly();

  constructor() {
    // Migración de category: nombre → ID (corre una vez al iniciar; idempotente)
    this.migrateCategoryNamesToIds();

    // Cuando cambian las entradas mensuales (mes o data), aseguramos que
    // las cotizaciones necesarias estén pedidas. No tocamos otros signals
    // sincrónicamente — los fetches actualizan _rates en otra microtarea.
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
          this.ensureRate(date);
        }
        // Pedimos también el TC de hoy como referencia visible.
        const today = new Date().toISOString().slice(0, 10);
        this.ensureRate(today);
      });
    });
  }

  // ============================================================
  // Entradas mensuales (transacciones reales + cuotas virtuales)
  // ============================================================

  /** Construye las MonthlyEntries de un mes arbitrario (no atado al seleccionado). */
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

    const installments = this.installmentsForMonth(month);
    const instEntries: MonthlyEntry[] = installments.map((i) => {
      const closingDate = this.billingClosingDate(month, i.closingDayForBill);
      const conversion: UsdConversion | undefined =
        i.purchase.currency === 'USD'
          ? this.buildConversion(closingDate, i.purchase.surchargeMode)
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

    const subEntries: MonthlyEntry[] = this.subscriptionChargesForMonth(month).map((s) => {
      const closingDate = this.billingClosingDate(month, s.closingDayForBill);
      const conversion: UsdConversion | undefined =
        s.currency === 'USD'
          ? this.buildConversion(closingDate, s.surchargeMode)
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
    this.entriesForMonth(this._selectedMonth())
  );

  /** Ingresos ARS de un mes arbitrario. */
  incomeForMonth(month: string): number {
    return this.entriesForMonth(month)
      .filter((t) => t.type === 'ingreso' && t.currency === 'ARS')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  /** Gastos totales de un mes arbitrario, expresados en ARS (convirtiendo los USD). */
  expensesForMonth(month: string): number {
    return this.entriesForMonth(month)
      .filter((t) => t.type === 'gasto')
      .reduce((acc, t) => acc + this.entryArsAmount(t), 0);
  }

  /** Balance (ingresos - gastos) de un mes arbitrario. */
  balanceForMonth(month: string): number {
    return this.incomeForMonth(month) - this.expensesForMonth(month);
  }

  /** Gastos agrupados por categoría para un mes arbitrario (ARS). */
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

  /**
   * Total acumulado pagado en una suscripción desde su inicio hasta hoy
   * (o hasta la fecha de cancelación si está cancelada).
   *
   * Devuelve la suma en la moneda original de la suscripción.
   */
  subscriptionTotalCost(sub: Subscription): { total: number; count: number; currency: Currency } {
    const todayISO = new Date().toISOString().slice(0, 10);
    const chargeDay = Number(sub.startDate.split('-')[2]);
    const [sy, sm] = sub.startDate.split('-').map(Number);

    let total = 0;
    let count = 0;

    // Iteramos cada mes desde el mes del startDate hasta el mes actual.
    let curY = sy;
    let curM = sm; // 1-12
    const todayY = new Date().getFullYear();
    const todayM = new Date().getMonth() + 1;

    while (curY < todayY || (curY === todayY && curM <= todayM)) {
      const lastDay = new Date(curY, curM, 0).getDate();
      const day = Math.min(chargeDay, lastDay);
      const chargeDate = `${curY}-${String(curM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Filtros de actividad
      if (
        chargeDate >= sub.startDate &&
        chargeDate <= todayISO &&
        (!sub.cancelDate || chargeDate <= sub.cancelDate)
      ) {
        total += this.priceForDate(sub, chargeDate);
        count++;
      }

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    return { total: this.roundMoney(total), count, currency: sub.currency };
  }

  /** Compatibilidad: alias usado por componentes existentes. */
  readonly monthlyTransactions = this.monthlyEntries;

  // ---------- Totales ARS ----------

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

  readonly monthlyBalance = computed(
    () => this.monthlyIncome() - this.monthlyExpenses()
  );

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
  // Solo cuenta cuotas USD que se paguen directamente en USD (modo
  // 'usd-payment'). Las demás cuotas USD se convirtieron y ya están en
  // los totales ARS.

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

  /** Total convertido a ARS de las cuotas USD del mes (incluido recargo). */
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
  // Transacciones
  // ============================================================

  add(tx: Omit<Transaction, 'id'>): void {
    const newTx: Transaction = { ...tx, id: crypto.randomUUID() };
    this._transactions.update((list) => [newTx, ...list]);
    this.persist(STORAGE_KEY, this._transactions());

    if (tx.fixed) {
      this.upsertTemplate({
        type: tx.type,
        description: tx.description,
        category: tx.category,
        amount: tx.amount,
      });
    }
  }

  /**
   * Actualiza campos de una transacción manual. Si cambia el flag `fixed`
   * el caller decide si quiere upsertar/borrar una plantilla por separado;
   * acá no hay magia.
   */
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
    this.persist(STORAGE_KEY, this._transactions());
  }

  remove(id: string): void {
    this._transactions.update((list) => list.filter((t) => t.id !== id));
    this.persist(STORAGE_KEY, this._transactions());
  }

  clearAll(): void {
    this._transactions.set([]);
    this.persist(STORAGE_KEY, this._transactions());
  }

  // ============================================================
  // Plantillas (recurrentes)
  // ============================================================

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
      const updated: RecurringTemplate = { ...existing, amount: input.amount, updatedAt: now };
      this._templates.update((list) => list.map((t) => (t.id === existing.id ? updated : t)));
      this.persist(TEMPLATES_KEY, this._templates());
      return updated;
    }

    const created: RecurringTemplate = {
      id: crypto.randomUUID(),
      ...input,
      updatedAt: now,
    };
    this._templates.update((list) => [created, ...list]);
    this.persist(TEMPLATES_KEY, this._templates());
    return created;
  }

  updateTemplateAmount(id: string, amount: number): void {
    this._templates.update((list) =>
      list.map((t) =>
        t.id === id ? { ...t, amount, updatedAt: new Date().toISOString() } : t
      )
    );
    this.persist(TEMPLATES_KEY, this._templates());
  }

  removeTemplate(id: string): void {
    this._templates.update((list) => list.filter((t) => t.id !== id));
    this.persist(TEMPLATES_KEY, this._templates());
  }

  applyTemplateToSelectedMonth(templateId: string): boolean {
    const tpl = this._templates().find((t) => t.id === templateId);
    if (!tpl) return false;
    if (this.isTemplateAppliedThisMonth(tpl)) return false;

    const month = this._selectedMonth();
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
    this._transactions.update((list) => [newTx, ...list]);
    this.persist(STORAGE_KEY, this._transactions());
    return true;
  }

  isTemplateAppliedThisMonth(tpl: RecurringTemplate): boolean {
    const key = this.templateKey(tpl.type, tpl.description, tpl.category);
    return this._transactions().some(
      (t) =>
        t.date.startsWith(this._selectedMonth()) &&
        t.fixed &&
        this.templateKey(t.type, t.description, t.category) === key
    );
  }

  // ============================================================
  // Tarjetas
  // ============================================================

  addCard(input: Omit<CreditCard, 'id' | 'createdAt'>): CreditCard {
    const card: CreditCard = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this._cards.update((list) => [...list, card]);
    this.persist(CARDS_KEY, this._cards());
    return card;
  }

  /**
   * Actualiza una tarjeta. Si el día de cierre cambia, `closingDayMode` define
   * cómo aplica el cambio sobre compras y suscripciones existentes:
   *  - 'retroactive': se recomputa todo con el nuevo cierre (se limpian
   *    los snapshots).
   *  - 'future': las compras y suscripciones ya cargadas conservan el cierre
   *    con el que se hicieron (se les setea snapshot con el viejo cierre).
   *
   * Si la tarjeta no tiene compras ni suscripciones, el modo no importa.
   */
  updateCard(
    id: string,
    patch: Partial<Omit<CreditCard, 'id' | 'createdAt'>>,
    closingDayMode: 'retroactive' | 'future' = 'retroactive'
  ): void {
    const card = this._cards().find((c) => c.id === id);
    if (!card) return;

    const oldClosingDay = card.closingDay;
    const newClosingDay = patch.closingDay ?? card.closingDay;
    const closingDayChanged = newClosingDay !== oldClosingDay;

    if (closingDayChanged && closingDayMode === 'future') {
      // Snapshot del cierre viejo para compras/suscripciones ya cargadas
      // que todavía no tienen snapshot.
      this._purchases.update((list) =>
        list.map((p) =>
          p.cardId === id && p.closingDaySnapshot === undefined
            ? { ...p, closingDaySnapshot: oldClosingDay }
            : p
        )
      );
      this._subscriptions.update((list) =>
        list.map((s) =>
          s.cardId === id && s.closingDaySnapshot === undefined
            ? { ...s, closingDaySnapshot: oldClosingDay }
            : s
        )
      );
      this.persist(PURCHASES_KEY, this._purchases());
      this.persist(SUBS_KEY, this._subscriptions());
    } else if (closingDayChanged && closingDayMode === 'retroactive') {
      // Limpiamos snapshots para que TODO se recompute con el nuevo cierre.
      this._purchases.update((list) =>
        list.map((p) => {
          if (p.cardId !== id || p.closingDaySnapshot === undefined) return p;
          const { closingDaySnapshot: _ignored, ...rest } = p;
          return rest;
        })
      );
      this._subscriptions.update((list) =>
        list.map((s) => {
          if (s.cardId !== id || s.closingDaySnapshot === undefined) return s;
          const { closingDaySnapshot: _ignored, ...rest } = s;
          return rest;
        })
      );
      this.persist(PURCHASES_KEY, this._purchases());
      this.persist(SUBS_KEY, this._subscriptions());
    }

    this._cards.update((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
    this.persist(CARDS_KEY, this._cards());
  }

  /** ¿La tarjeta tiene compras o suscripciones asociadas? */
  cardHasEntries(cardId: string): boolean {
    return (
      this._purchases().some((p) => p.cardId === cardId) ||
      this._subscriptions().some((s) => s.cardId === cardId)
    );
  }

  removeCard(id: string): void {
    // Si se borra la tarjeta, eliminamos también sus compras y suscripciones
    this._purchases.update((list) => list.filter((p) => p.cardId !== id));
    this.persist(PURCHASES_KEY, this._purchases());
    this._subscriptions.update((list) => list.filter((s) => s.cardId !== id));
    this.persist(SUBS_KEY, this._subscriptions());
    this._cards.update((list) => list.filter((c) => c.id !== id));
    this.persist(CARDS_KEY, this._cards());
  }

  cardLabel(card: CreditCard): string {
    const main = `${card.brand} · ${card.bank}`;
    return card.notes ? `${main} · ${card.notes}` : main;
  }

  // ============================================================
  // Compras con tarjeta
  // ============================================================

  addPurchase(input: Omit<CardPurchase, 'id' | 'createdAt'>): CardPurchase {
    const purchase: CardPurchase = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this._purchases.update((list) => [purchase, ...list]);
    this.persist(PURCHASES_KEY, this._purchases());
    return purchase;
  }

  removePurchase(id: string): void {
    this._purchases.update((list) => list.filter((p) => p.id !== id));
    this.persist(PURCHASES_KEY, this._purchases());
  }

  /** Cuotas que caen en un mes YYYY-MM. */
  installmentsForMonth(month: string): Installment[] {
    const result: Installment[] = [];
    for (const p of this._purchases()) {
      const card = this._cards().find((c) => c.id === p.cardId);
      if (!card) continue;
      const closingDay = p.closingDaySnapshot ?? card.closingDay;
      const firstMonth = this.firstBillingMonth(p.purchaseDate, closingDay);
      const diff = this.monthDiff(firstMonth, month);
      if (diff >= 0 && diff < p.installments) {
        result.push({
          purchase: p,
          cardLabel: this.cardLabel(card),
          number: diff + 1,
          total: p.installments,
          amount: this.roundMoney(p.totalAmount / p.installments),
          month,
          closingDayForBill: closingDay,
        });
      }
    }
    return result;
  }

  /**
   * Primer mes (YYYY-MM) en que se va a cobrar una compra.
   *
   * Regla: si la fecha de compra es ESTRICTAMENTE menor al día EFECTIVO de
   * cierre del mes de compra, esa compra cierra ese mismo mes → se cobra al
   * mes siguiente. Si la compra es en el día del cierre o posterior, pasa al
   * período siguiente.
   *
   * El día efectivo de cierre se calcula clampeando al último día del mes:
   * si el cierre es el 30 pero el mes es febrero, el cierre efectivo es 28
   * (o 29 en años bisiestos).
   */
  firstBillingMonth(purchaseDate: string, closingDay: number): string {
    const [yStr, mStr, dStr] = purchaseDate.split('-');
    const y = Number(yStr);
    const m = Number(mStr); // 1-12
    const d = Number(dStr);

    // Día efectivo de cierre en el mes de la compra
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const effectiveClosingDay = Math.min(closingDay, lastDayOfMonth);

    // offset en meses respecto al mes de compra
    const offset = d < effectiveClosingDay ? 1 : 2;
    const targetMonth0 = m - 1 + offset; // 0-based, puede pasar 11
    const targetDate = new Date(y, targetMonth0, 1);
    return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Diferencia en meses entre dos YYYY-MM (b - a). */
  private monthDiff(a: string, b: string): number {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return (by - ay) * 12 + (bm - am);
  }

  private roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // ============================================================
  // Cotizaciones USD y conversión
  // ============================================================

  /**
   * Devuelve el % de recargo (0, 0.21, 0.30 o 0.60) que aplica sobre el dólar
   * oficial para una fecha y modo dados.
   *  - 'usd-payment' / 'none': 0
   *  - 'digital-service': 0.21 (IVA Servicios Digitales - Steam/Netflix/etc.)
   *  - 'tourism': 0.30 (servicios turísticos pagados en pesos)
   *  - 'auto':
   *      < 2024-12-01: 0.60 (PAIS 30% + Ganancias 30%)
   *      2024-12-01 ↔ 2026-01-02: 0.30 (sólo Ganancias)
   *      ≥ 2026-01-02: 0 (sin recargo)
   */
  surchargeForDate(date: string, mode: SurchargeMode = 'auto'): number {
    if (mode === 'usd-payment' || mode === 'none') return 0;
    if (mode === 'digital-service') return 0.21;
    if (mode === 'tourism') return 0.3;
    // auto
    if (date < '2024-12-01') return 0.6;
    if (date < '2026-01-02') return 0.3;
    return 0;
  }

  /**
   * Construye el objeto de conversión a aplicar a una entrada USD en función
   * de la fecha del cierre del resumen y el modo de recargo.
   */
  private buildConversion(
    closingDate: string,
    mode: SurchargeMode | undefined
  ): UsdConversion {
    const m: SurchargeMode = mode ?? 'auto';
    return {
      closingDate,
      surchargePct: this.surchargeForDate(closingDate, m),
      usdDirect: m === 'usd-payment',
    };
  }

  /**
   * Fecha de cierre del resumen que contiene una cuota de un mes dado.
   * Para una cuota visible en el mes M, el resumen cerró el día `closingDay`
   * del mes M-1.
   */
  billingClosingDate(month: string, closingDay: number): string {
    const [y, m] = month.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const py = prev.getFullYear();
    const pm0 = prev.getMonth();
    const lastDay = new Date(py, pm0 + 1, 0).getDate();
    const day = Math.min(closingDay, lastDay);
    return `${py}-${String(pm0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** TC oficial guardado para una fecha exacta (o null). */
  rateForDate(date: string): number | null {
    return this._rates()[date] ?? null;
  }

  /** TC más reciente conocido (la fecha mayor cacheada). */
  latestRate(): { date: string; rate: number } | null {
    const entries = Object.entries(this._rates());
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[0].localeCompare(a[0]));
    return { date: entries[0][0], rate: entries[0][1] };
  }

  /**
   * Convierte una entrada USD a ARS usando su `conversion`. Si no hay TC para
   * la fecha exacta, usa el último conocido y marca el resultado como
   * estimado. Devuelve null si todavía no hay ningún TC conocido.
   */
  convertEntryToArs(entry: MonthlyEntry): ArsConversionResult | null {
    if (entry.currency !== 'USD' || !entry.conversion) return null;
    if (entry.conversion.usdDirect) return null;
    const conv = entry.conversion;
    const exact = this._rates()[conv.closingDate];
    if (exact != null) {
      return {
        arsAmount: this.roundMoney(entry.amount * exact * (1 + conv.surchargePct)),
        rate: exact,
        surchargePct: conv.surchargePct,
        estimated: false,
        rateDate: conv.closingDate,
      };
    }
    const latest = this.latestRate();
    if (!latest) return null;
    return {
      arsAmount: this.roundMoney(entry.amount * latest.rate * (1 + conv.surchargePct)),
      rate: latest.rate,
      surchargePct: conv.surchargePct,
      estimated: true,
      rateDate: latest.date,
    };
  }

  /** Helper interno usado por las métricas mensuales. */
  private entryArsAmount(entry: MonthlyEntry): number {
    if (entry.currency === 'ARS') return entry.amount;
    // USD pago directo: aunque se cancela en dólares, representa una obligación
    // mensual real. La convertimos al último TC conocido como estimado para
    // que aparezca en el balance ARS y en los gastos fijos del mes.
    if (entry.conversion?.usdDirect) {
      const latest = this.latestRate();
      return latest ? this.roundMoney(entry.amount * latest.rate) : 0;
    }
    const conv = this.convertEntryToArs(entry);
    return conv?.arsAmount ?? 0;
  }

  /**
   * Asegura que tengamos cotización para una fecha. Si no la tenemos y no la
   * pedimos antes, dispara fetch async al API público.
   */
  private async ensureRate(date: string): Promise<void> {
    if (this._rates()[date] !== undefined) return;
    if (this._fetchedRates.has(date)) return;
    this._fetchedRates.add(date);

    try {
      const [y, m, d] = date.split('-');
      // argentinadatos.com expone histórico oficial. Endpoint:
      // /v1/cotizaciones/dolares/oficial/YYYY/MM/DD -> { fecha, casa, compra, venta }
      const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/${y}/${m}/${d}`;
      const res = await fetch(url);
      if (!res.ok) {
        // Si es un día sin cotización (feriado), buscamos el más cercano hacia atrás
        await this.fallbackToNearest(date);
        return;
      }
      const data = await res.json();
      const rate = typeof data?.venta === 'number' ? data.venta : null;
      if (rate != null) {
        this._rates.update((r) => ({ ...r, [date]: rate }));
        this.persist(RATES_KEY, this._rates());
      } else {
        await this.fallbackToNearest(date);
      }
    } catch {
      await this.fallbackToNearest(date);
    } finally {
      this._ratesReady.set(true);
    }
  }

  /**
   * Cuando el endpoint puntual falla (feriado, fin de semana, fecha sin dato),
   * pedimos la lista histórica y nos quedamos con la cotización más cercana
   * anterior o igual a `date`.
   */
  private async fallbackToNearest(date: string): Promise<void> {
    try {
      const res = await fetch(
        'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial'
      );
      if (!res.ok) return;
      const arr = (await res.json()) as Array<{ fecha: string; venta: number }>;
      if (!Array.isArray(arr)) return;
      const valid = arr
        .filter((x) => x?.fecha <= date && typeof x.venta === 'number')
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      const closest = valid[0];
      if (closest) {
        this._rates.update((r) => ({ ...r, [date]: closest.venta }));
        this.persist(RATES_KEY, this._rates());
      }
    } catch {
      // silencio: usamos latestRate como fallback en la UI
    }
  }

  /** Permite al usuario sobreescribir manualmente un TC para una fecha. */
  setManualRate(date: string, rate: number): void {
    this._rates.update((r) => ({ ...r, [date]: rate }));
    this.persist(RATES_KEY, this._rates());
  }

  // ============================================================
  // Categorías (defaults + custom)
  // ============================================================

  /**
   * Categorías de gasto disponibles en pickers: defaults + customs **no
   * archivadas**. Las archivadas no aparecen para crear movimientos nuevos
   * pero siguen siendo resolvibles por ID para mostrarse en registros viejos.
   */
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

  /** Convierte un default a la forma común. */
  private defToView(d: DefaultCategoryDef): CategoryView {
    return { id: d.id, name: d.name, color: d.color };
  }

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
    this.persist(CUSTOM_CATEGORIES_KEY, this._customCategories());
    return cat;
  }

  /**
   * Edita nombre y/o color de una categoría custom. Las transacciones que la
   * referencian por ID toman el cambio automáticamente (display).
   * Devuelve true si pudo actualizar, false si hay conflicto de nombre.
   */
  updateCustomCategory(
    id: string,
    patch: { name?: string; color?: string }
  ): boolean {
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
    this.persist(CUSTOM_CATEGORIES_KEY, this._customCategories());
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
    this.persist(CUSTOM_CATEGORIES_KEY, this._customCategories());
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
    this.persist(CUSTOM_CATEGORIES_KEY, this._customCategories());
  }

  /** Helper: ¿existe ya el nombre en defaults o customs del mismo type? */
  private nameExistsInType(
    name: string,
    type: CustomCategoryType,
    excludeId?: string
  ): boolean {
    const lower = name.toLowerCase();
    const defaults =
      type === 'expense'
        ? DEFAULT_EXPENSE_CATEGORIES
        : DEFAULT_INCOME_CATEGORIES;
    if (defaults.some((d) => d.name.toLowerCase() === lower)) return true;
    return this._customCategories().some(
      (c) =>
        c.type === type &&
        c.id !== excludeId &&
        c.name.toLowerCase() === lower
    );
  }

  // ============================================================
  // Ahorros
  // ============================================================

  /** Total de ahorros en pesos (suma de los `Saving` con currency='ARS'). */
  readonly savingsTotalArs = computed(() =>
    this._savings()
      .filter((s) => s.currency === 'ARS')
      .reduce((acc, s) => acc + s.amount, 0)
  );

  /** Total de ahorros en dólares (suma de los `Saving` con currency='USD'). */
  readonly savingsTotalUsd = computed(() =>
    this._savings()
      .filter((s) => s.currency === 'USD')
      .reduce((acc, s) => acc + s.amount, 0)
  );

  /** Valor en pesos del total USD usando el último TC oficial vendedor conocido. */
  readonly savingsTotalUsdInArs = computed(() => {
    const usd = this.savingsTotalUsd();
    if (usd === 0) return 0;
    const latest = this.latestRate();
    return latest ? this.roundMoney(usd * latest.rate) : 0;
  });

  /** Gran total en pesos: ARS directos + USD convertidos al TC actual. */
  readonly savingsGrandTotalArs = computed(
    () => this.savingsTotalArs() + this.savingsTotalUsdInArs()
  );

  addSaving(input: {
    description: string;
    amount: number;
    currency: Currency;
  }): Saving {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const initialMovement: SavingMovement = {
      id: crypto.randomUUID(),
      type: 'deposit',
      amount: input.amount,
      date: today,
      description: 'Depósito inicial',
      createdAt: now,
    };
    const saving: Saving = {
      id: crypto.randomUUID(),
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency,
      movements: [initialMovement],
      createdAt: now,
      updatedAt: now,
    };
    this._savings.update((list) => [saving, ...list]);
    this.persist(SAVINGS_KEY, this._savings());
    return saving;
  }

  /** Edita la descripción del ahorro. El monto y la moneda no se tocan acá
   *  (el monto cambia sólo a través de movimientos). */
  updateSaving(id: string, patch: { description: string }): void {
    this._savings.update((list) =>
      list.map((s) =>
        s.id === id
          ? {
              ...s,
              description: patch.description.trim() || s.description,
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    this.persist(SAVINGS_KEY, this._savings());
  }

  removeSaving(id: string): void {
    this._savings.update((list) => list.filter((s) => s.id !== id));
    this.persist(SAVINGS_KEY, this._savings());
  }

  /**
   * Registra un movimiento sobre un ahorro y actualiza el saldo:
   * - `deposit`: suma al saldo.
   * - `withdrawal`: resta del saldo.
   *
   * El monto siempre se ingresa positivo; el tipo determina la dirección.
   */
  addSavingMovement(
    savingId: string,
    input: {
      type: SavingMovementType;
      amount: number;
      date: string;
      description?: string;
    }
  ): void {
    const now = new Date().toISOString();
    const movement: SavingMovement = {
      id: crypto.randomUUID(),
      type: input.type,
      amount: Math.abs(input.amount),
      date: input.date,
      description: input.description?.trim() || undefined,
      createdAt: now,
    };

    this._savings.update((list) =>
      list.map((s) => {
        if (s.id !== savingId) return s;
        const movements = [...(s.movements ?? []), movement];
        const delta =
          movement.type === 'deposit' ? movement.amount : -movement.amount;
        return {
          ...s,
          amount: this.roundMoney(s.amount + delta),
          movements,
          updatedAt: now,
        };
      })
    );
    this.persist(SAVINGS_KEY, this._savings());
  }

  /**
   * Elimina un movimiento y revierte su impacto en el saldo.
   */
  removeSavingMovement(savingId: string, movementId: string): void {
    this._savings.update((list) =>
      list.map((s) => {
        if (s.id !== savingId) return s;
        const movements = s.movements ?? [];
        const m = movements.find((x) => x.id === movementId);
        if (!m) return s;
        const delta = m.type === 'deposit' ? -m.amount : m.amount;
        return {
          ...s,
          amount: this.roundMoney(s.amount + delta),
          movements: movements.filter((x) => x.id !== movementId),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    this.persist(SAVINGS_KEY, this._savings());
  }

  // ============================================================
  // Export / Import / Reset
  // ============================================================

  /** Conteo de cada entidad — útil para mostrar resúmenes. */
  dataCounts(): {
    transactions: number;
    templates: number;
    cards: number;
    purchases: number;
    subscriptions: number;
    rates: number;
    customCategories: number;
    savings: number;
  } {
    return {
      transactions: this._transactions().length,
      templates: this._templates().length,
      cards: this._cards().length,
      purchases: this._purchases().length,
      subscriptions: this._subscriptions().length,
      rates: Object.keys(this._rates()).length,
      customCategories: this._customCategories().length,
      savings: this._savings().length,
    };
  }

  /** Snapshot serializable de todos los datos (todas las entidades, sin UI). */
  exportData(): ExportFile {
    return {
      app: 'control-gastos',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        transactions: this._transactions(),
        templates: this._templates(),
        cards: this._cards(),
        purchases: this._purchases(),
        subscriptions: this._subscriptions(),
        rates: this._rates(),
        customCategories: this._customCategories(),
        savings: this._savings(),
      },
    };
  }

  /**
   * Reemplaza todos los datos por los del archivo importado. Asume que el
   * archivo ya fue validado con `validateImportFile`.
   */
  importData(file: ExportFile): void {
    const d = file.data;
    this._transactions.set(Array.isArray(d.transactions) ? d.transactions : []);
    this._templates.set(Array.isArray(d.templates) ? d.templates : []);
    this._cards.set(Array.isArray(d.cards) ? d.cards : []);
    this._purchases.set(Array.isArray(d.purchases) ? d.purchases : []);
    this._subscriptions.set(Array.isArray(d.subscriptions) ? d.subscriptions : []);
    this._rates.set(
      d.rates && typeof d.rates === 'object' && !Array.isArray(d.rates)
        ? d.rates
        : {}
    );
    this._customCategories.set(
      Array.isArray(d.customCategories) ? d.customCategories : []
    );
    this._savings.set(Array.isArray(d.savings) ? d.savings : []);

    this.persist(STORAGE_KEY, this._transactions());
    this.persist(TEMPLATES_KEY, this._templates());
    this.persist(CARDS_KEY, this._cards());
    this.persist(PURCHASES_KEY, this._purchases());
    this.persist(SUBS_KEY, this._subscriptions());
    this.persist(RATES_KEY, this._rates());
    this.persist(CUSTOM_CATEGORIES_KEY, this._customCategories());
    this.persist(SAVINGS_KEY, this._savings());
  }

  /**
   * Valida que un objeto desconocido tenga la forma de un export válido.
   * Devuelve el archivo tipado o un mensaje de error.
   */
  validateImportFile(raw: unknown): { ok: true; file: ExportFile } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'El archivo no contiene un JSON con la estructura esperada.' };
    }
    const obj = raw as Record<string, unknown>;
    if (obj['app'] !== 'control-gastos') {
      return { ok: false, error: 'El archivo no parece ser un respaldo de Control de Gastos.' };
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

  /** Borra todos los datos persistidos (sin tocar la UI state). */
  clearAllData(): void {
    this._transactions.set([]);
    this._templates.set([]);
    this._cards.set([]);
    this._purchases.set([]);
    this._subscriptions.set([]);
    this._rates.set({});
    this._customCategories.set([]);
    this._savings.set([]);
    this.persist(STORAGE_KEY, []);
    this.persist(TEMPLATES_KEY, []);
    this.persist(CARDS_KEY, []);
    this.persist(PURCHASES_KEY, []);
    this.persist(SUBS_KEY, []);
    this.persist(RATES_KEY, {});
    this.persist(CUSTOM_CATEGORIES_KEY, []);
    this.persist(SAVINGS_KEY, []);
  }

  private loadRates(): Record<string, number> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(RATES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // ============================================================
  // Suscripciones
  // ============================================================

  addSubscription(input: {
    cardId: string;
    description: string;
    currency: Currency;
    startDate: string;
    amount: number;
    surchargeMode?: SurchargeMode;
  }): Subscription {
    const sub: Subscription = {
      id: crypto.randomUUID(),
      cardId: input.cardId,
      description: input.description,
      currency: input.currency,
      startDate: input.startDate,
      priceHistory: [{ from: input.startDate, amount: input.amount }],
      surchargeMode: input.surchargeMode,
      createdAt: new Date().toISOString(),
    };
    this._subscriptions.update((list) => [sub, ...list]);
    this.persist(SUBS_KEY, this._subscriptions());
    return sub;
  }

  cancelSubscription(id: string, cancelDate: string): void {
    this._subscriptions.update((list) =>
      list.map((s) => (s.id === id ? { ...s, cancelDate } : s))
    );
    this.persist(SUBS_KEY, this._subscriptions());
  }

  reactivateSubscription(id: string): void {
    this._subscriptions.update((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const { cancelDate: _ignored, ...rest } = s;
        return rest;
      })
    );
    this.persist(SUBS_KEY, this._subscriptions());
  }

  /**
   * Agrega un nuevo precio al historial con su fecha de vigencia.
   * Cualquier entrada existente con la misma fecha se reemplaza.
   */
  addSubscriptionPrice(id: string, amount: number, from: string): void {
    this._subscriptions.update((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const filtered = s.priceHistory.filter((p) => p.from !== from);
        const next = [...filtered, { from, amount }].sort((a, b) =>
          a.from.localeCompare(b.from)
        );
        return { ...s, priceHistory: next };
      })
    );
    this.persist(SUBS_KEY, this._subscriptions());
  }

  /**
   * "Elimina" una suscripción del panel: la marca como archivada y, si todavía
   * estaba activa, le pone fecha de cancelación hoy. Los meses pasados en los
   * que estuvo activa siguen mostrando el cobro.
   */
  removeSubscription(id: string): void {
    const today = new Date().toISOString().slice(0, 10);
    this._subscriptions.update((list) =>
      list.map((s) =>
        s.id === id
          ? { ...s, archived: true, cancelDate: s.cancelDate ?? today }
          : s
      )
    );
    this.persist(SUBS_KEY, this._subscriptions());
  }

  /** Devuelve el precio vigente para una fecha (ISO yyyy-MM-dd). */
  priceForDate(sub: Subscription, date: string): number {
    let current = sub.priceHistory[0]?.amount ?? 0;
    for (const entry of sub.priceHistory) {
      if (entry.from <= date) current = entry.amount;
      else break;
    }
    return current;
  }

  /** Precio vigente "actual" (a hoy). Útil para listar. */
  currentPrice(sub: Subscription): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.priceForDate(sub, today);
  }

  /**
   * Cobros de suscripciones que aparecen en el resumen del mes M dado.
   *
   * Lógica:
   *  - El cobro mensual es siempre en el día `d` (derivado de startDate).
   *  - Con cierre `c`, si d < c el cobro aparece en el mes siguiente; si d >= c
   *    aparece dos meses después (mismo criterio que las compras con tarjeta).
   *  - El cobro de un mes X efectivamente ocurre si la suscripción ya empezó
   *    (startDate <= chargeDate_X) y no fue cancelada antes del chargeDate
   *    (cancelDate >= chargeDate_X o no existe).
   */
  subscriptionChargesForMonth(month: string): Array<{
    subscriptionId: string;
    description: string;
    cardLabel: string;
    amount: number;
    currency: Currency;
    chargeDate: string;
    closingDayForBill: number;
    surchargeMode?: SurchargeMode;
  }> {
    const result: Array<{
      subscriptionId: string;
      description: string;
      cardLabel: string;
      amount: number;
      currency: Currency;
      chargeDate: string;
      closingDayForBill: number;
      surchargeMode?: SurchargeMode;
    }> = [];

    for (const sub of this._subscriptions()) {
      const card = this._cards().find((c) => c.id === sub.cardId);
      if (!card) continue;

      const chargeDay = Number(sub.startDate.split('-')[2]);
      const closingDay = sub.closingDaySnapshot ?? card.closingDay;
      const [mY, mM] = month.split('-').map(Number);

      // Una suscripción puede aparecer en `month` desde dos meses fuente
      // distintos (M-1 con offset 1, ó M-2 con offset 2). Hay que evaluar
      // ambos por separado porque los días pueden clampearse en cada mes
      // (ej. cierre 30, febrero → 28).
      for (const offsetTry of [1, 2]) {
        const sourceDate = new Date(mY, mM - 1 - offsetTry, 1);
        const sY = sourceDate.getFullYear();
        const sM = sourceDate.getMonth() + 1; // 1-12

        const lastDay = new Date(sY, sM, 0).getDate();
        const effChargeDay = Math.min(chargeDay, lastDay);
        const effCloseDay = Math.min(closingDay, lastDay);

        // Offset real para este mes fuente, usando los días efectivos.
        const actualOffset = effChargeDay < effCloseDay ? 1 : 2;
        if (actualOffset !== offsetTry) continue;

        const chargeDate = `${sY}-${String(sM).padStart(2, '0')}-${String(effChargeDay).padStart(2, '0')}`;

        // ¿La suscripción está activa en chargeDate?
        if (chargeDate < sub.startDate) continue;
        if (sub.cancelDate && sub.cancelDate < chargeDate) continue;

        result.push({
          subscriptionId: sub.id,
          description: sub.description,
          cardLabel: this.cardLabel(card),
          amount: this.priceForDate(sub, chargeDate),
          currency: sub.currency,
          chargeDate,
          closingDayForBill: closingDay,
          surchargeMode: sub.surchargeMode,
        });
      }
    }

    return result;
  }

  // ============================================================
  // Misc
  // ============================================================

  setMonth(month: string): void {
    this._selectedMonth.set(month);
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private templateKey(
    type: TransactionType,
    description: string,
    category: Category
  ): string {
    return `${type}::${category}::${description.trim().toLowerCase()}`;
  }

  // ============================================================
  // Migración runtime: category nombre → ID
  // ============================================================

  /**
   * Idempotente. Recorre transactions/templates/purchases y, si la categoría
   * almacenada no es un ID conocido, intenta resolverla como nombre histórico
   * y la convierte al ID estable correspondiente.
   *
   * Cubre los siguientes escenarios:
   *  - Defaults pre-refactor: 'Alquiler' → 'cat-alquiler', etc.
   *  - Subscripciones auto-generadas viejas: 'Suscripciones' → 'cat-suscripciones'
   *  - Customs por nombre: matchea contra las customs existentes y usa su UUID
   *  - Categorías inválidas u orphanes: cae a 'cat-otros' (gastos) o
   *    'cat-otros-ingreso' (ingresos)
   */
  private migrateCategoryNamesToIds(): void {
    // Set de IDs conocidos (defaults + customs actuales)
    const knownIds = new Set<string>(
      DEFAULT_CATEGORIES.map((c) => c.id).concat(
        this._customCategories().map((c) => c.id)
      )
    );

    // Mapa nombre lowercase → ID
    const nameToId = new Map<string, string>();
    for (const def of DEFAULT_CATEGORIES) {
      nameToId.set(def.name.toLowerCase(), def.id);
    }
    for (const c of this._customCategories()) {
      nameToId.set(c.name.toLowerCase(), c.id);
    }

    /**
     * Contador de registros que no se pudieron resolver por nombre conocido
     * y terminaron asignados a UNKNOWN_CATEGORY_ID. Lo reportamos al final
     * para que el componente raíz informe al usuario.
     */
    let unknownCount = 0;

    const resolve = (val: string | undefined | null): string => {
      const s = (val ?? '').trim();
      if (s && knownIds.has(s)) return s; // ya es un ID conocido (no migra)
      const byName = nameToId.get(s.toLowerCase());
      if (byName) return byName;
      // No matchea nada → marcamos como Desconocido
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
      this.persist(STORAGE_KEY, newTxs);
    }

    // Templates
    let tplChanged = false;
    const newTpls = this._templates().map((t) => {
      const newCat = resolve(t.category);
      if (newCat !== t.category) {
        tplChanged = true;
        return { ...t, category: newCat };
      }
      return t;
    });
    if (tplChanged) {
      this._templates.set(newTpls);
      this.persist(TEMPLATES_KEY, newTpls);
    }

    // Purchases (siempre gastos)
    let purChanged = false;
    const newPurs = this._purchases().map((p) => {
      const newCat = resolve(p.category);
      if (newCat !== p.category) {
        purChanged = true;
        return { ...p, category: newCat };
      }
      return p;
    });
    if (purChanged) {
      this._purchases.set(newPurs);
      this.persist(PURCHASES_KEY, newPurs);
    }

    if (unknownCount > 0) {
      this._migrationReport.set({ unknownCount });
    }
  }

  // ============================================================
  // Persistencia
  // ============================================================

  private load<T = Transaction>(key: string): T[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private persist(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  }
}
