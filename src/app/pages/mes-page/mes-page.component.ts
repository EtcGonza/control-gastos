import { Component } from '@angular/core';
import { CategoryBreakdownComponent } from './components/category-breakdown/category-breakdown.component';
import { RecurringTemplatesComponent } from './components/recurring-templates/recurring-templates.component';
import { SummaryCardsComponent } from './components/summary-cards/summary-cards.component';
import { TransactionFormComponent } from './components/transaction-form/transaction-form.component';
import { TransactionListComponent } from './components/transaction-list/transaction-list.component';
import { UsdSummaryComponent } from './components/usd-summary/usd-summary.component';

/**
 * Vista de la sección "Mes": resumen, movimientos del mes seleccionado y
 * formulario para cargar transacciones / compras de tarjeta nuevas.
 */
@Component({
  selector: 'app-mes-page',
  standalone: true,
  imports: [
    SummaryCardsComponent,
    UsdSummaryComponent,
    TransactionFormComponent,
    CategoryBreakdownComponent,
    RecurringTemplatesComponent,
    TransactionListComponent,
  ],
  templateUrl: './mes-page.component.html',
})
export class MesPageComponent {}
