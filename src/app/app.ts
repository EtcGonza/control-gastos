import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Analytics } from './components/analytics/analytics';
import { CardsManager } from './components/cards-manager/cards-manager';
import { CategoriesManager } from './components/categories-manager/categories-manager';
import { CategoryBreakdown } from './components/category-breakdown/category-breakdown';
import { ConfirmHost } from './components/confirm-host/confirm-host';
import { DataBackup } from './components/data-backup/data-backup';
import { MonthSelector } from './components/month-selector/month-selector';
import { RecurringTemplates } from './components/recurring-templates/recurring-templates';
// import { ThemePicker } from './components/theme-picker/theme-picker'; // deshabilitado temporalmente
import { SubscriptionsManager } from './components/subscriptions-manager/subscriptions-manager';
import { SummaryCards } from './components/summary-cards/summary-cards';
import { TransactionForm } from './components/transaction-form/transaction-form';
import { TransactionList } from './components/transaction-list/transaction-list';
import { UsdSummary } from './components/usd-summary/usd-summary';
import { TransactionsService } from './services/transactions.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
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
    ConfirmHost,
    // ThemePicker, // deshabilitado temporalmente
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly tx = inject(TransactionsService);
}
