import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TransactionsService } from '../../../../core/services/transactions.service';

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './summary-cards.component.html',
  styleUrls: ['./summary-cards.component.scss'],
})
export class SummaryCardsComponent {
  protected readonly tx = inject(TransactionsService);

  getCapped(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  barColor(pct: number): string {
    if (pct < 50) return 'bg-emerald-500';
    if (pct < 80) return 'bg-amber-500';
    return 'bg-rose-500';
  }
}
