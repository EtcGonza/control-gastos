import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TransactionsService } from '../../../../core/services/transactions.service';

@Component({
  selector: 'app-category-breakdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-breakdown.component.html',
})
export class CategoryBreakdownComponent {
  protected readonly tx = inject(TransactionsService);

  color(cat: string): string {
    return this.tx.colorForCategory(cat);
  }

  percentage(amount: number): number {
    const total = this.tx.monthlyExpenses();
    if (total === 0) return 0;
    return (amount / total) * 100;
  }
}
