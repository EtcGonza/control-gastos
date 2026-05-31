import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { CardsManager } from './components/cards-manager/cards-manager';
import { CategoryBreakdown } from './components/category-breakdown/category-breakdown';
import { ConfirmHost } from './components/confirm-host/confirm-host';
import { MonthSelector } from './components/month-selector/month-selector';
import { RecurringTemplates } from './components/recurring-templates/recurring-templates';
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
    ConfirmHost,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly tx = inject(TransactionsService);
}
