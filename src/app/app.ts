import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ConfirmService } from './services/confirm.service';
import { Analytics } from './components/analytics/analytics';
import { CardsManager } from './components/cards-manager/cards-manager';
import { CategoriesManager } from './components/categories-manager/categories-manager';
import { CategoryBreakdown } from './components/category-breakdown/category-breakdown';
import { ConfirmHost } from './components/confirm-host/confirm-host';
import { DataBackup } from './components/data-backup/data-backup';
import { MonthSelector } from './components/month-selector/month-selector';
import { RecurringTemplates } from './components/recurring-templates/recurring-templates';
import { Savings } from './components/savings/savings';
import { Sidebar } from './components/sidebar/sidebar';
// import { ThemePicker } from './components/theme-picker/theme-picker'; // deshabilitado temporalmente
import { SubscriptionsManager } from './components/subscriptions-manager/subscriptions-manager';
import { SummaryCards } from './components/summary-cards/summary-cards';
import { TransactionForm } from './components/transaction-form/transaction-form';
import { TransactionList } from './components/transaction-list/transaction-list';
import { UsdSummary } from './components/usd-summary/usd-summary';
import { NavigationService, NavSection } from './services/navigation.service';
import { TransactionsService } from './services/transactions.service';

const SECTION_LABELS: Record<NavSection, string> = {
  mes: 'Mes',
  tarjetas: 'Tarjetas',
  suscripciones: 'Suscripciones',
  ahorros: 'Ahorros',
  analisis: 'Análisis',
  configuracion: 'Configuración',
};

const SECTION_SUBTITLES: Record<NavSection, string> = {
  mes: 'Movimientos del mes seleccionado',
  tarjetas: 'Gestión de tarjetas de crédito',
  suscripciones: 'Suscripciones activas y canceladas',
  ahorros: 'Tus ahorros en pesos y dólares',
  analisis: 'Visualizaciones y tendencias',
  configuracion: 'Categorías y respaldo de datos',
};

/** Secciones donde el selector de mes tiene sentido. */
const SECTIONS_WITH_MONTH: NavSection[] = ['mes', 'analisis'];

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    Sidebar,
    SummaryCards,
    TransactionForm,
    TransactionList,
    CategoryBreakdown,
    MonthSelector,
    RecurringTemplates,
    CardsManager,
    SubscriptionsManager,
    UsdSummary,
    CategoriesManager,
    DataBackup,
    Analytics,
    Savings,
    ConfirmHost,
    // ThemePicker, // deshabilitado temporalmente
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly tx = inject(TransactionsService);
  protected readonly nav = inject(NavigationService);
  private readonly confirmSvc = inject(ConfirmService);

  constructor() {
    // Si la migración de categorías nombre → ID encontró registros que no se
    // pudieron resolver, mostramos un aviso UNA vez y limpiamos el report.
    effect(() => {
      const report = this.tx.migrationReport();
      if (!report || report.unknownCount === 0) return;
      const n = report.unknownCount;
      this.confirmSvc
        .alert({
          title: 'Categorías desconocidas detectadas',
          message:
            `Se encontraron ${n} ${n === 1 ? 'registro' : 'registros'} con una categoría que no pudo identificarse al migrar tus datos.\n\n` +
            'Estos registros quedaron asignados temporalmente a la categoría "Desconocido". ' +
            'Te recomendamos revisarlos en la sección Mes y editarlos para asignarles una categoría correcta.',
        })
        .then(() => this.tx.acknowledgeMigrationReport());
    });
  }

  protected readonly sectionLabel = computed(
    () => SECTION_LABELS[this.nav.section()]
  );

  protected readonly sectionSubtitle = computed(
    () => SECTION_SUBTITLES[this.nav.section()]
  );

  protected readonly showMonthSelector = computed(() =>
    SECTIONS_WITH_MONTH.includes(this.nav.section())
  );
}
