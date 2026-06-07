import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TransactionsService } from '../../../../core/services/transactions.service';

@Component({
  selector: 'app-usd-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usd-summary.component.html',
})
export class UsdSummaryComponent {
  protected readonly tx = inject(TransactionsService);

  latest() {
    return this.tx.latestRate();
  }
}
