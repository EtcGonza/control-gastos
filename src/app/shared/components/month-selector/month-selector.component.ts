import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { TransactionsService } from '../../../core/services/transactions.service';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month-selector.component.html',
})
export class MonthSelectorComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly months = MONTHS_ES;
  protected readonly open = signal(false);

  /** Año visible en el dropdown (puede diferir del seleccionado mientras se navega). */
  protected readonly viewYear = signal(this.parseYear(this.tx.selectedMonth()));

  protected readonly label = computed(() => {
    const [y, m] = this.tx.selectedMonth().split('-').map(Number);
    return `${MONTHS_ES[m - 1]} ${y}`;
  });

  protected readonly isCurrentMonth = computed(() => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.tx.selectedMonth() === cur;
  });

  toggleOpen(): void {
    if (!this.open()) {
      this.viewYear.set(this.parseYear(this.tx.selectedMonth()));
    }
    this.open.update((v) => !v);
  }

  prev(): void {
    this.shiftMonth(-1);
  }

  next(): void {
    this.shiftMonth(1);
  }

  prevYear(): void {
    this.viewYear.update((y) => y - 1);
  }

  nextYear(): void {
    this.viewYear.update((y) => y + 1);
  }

  selectMonth(index: number): void {
    const y = this.viewYear();
    this.tx.setMonth(`${y}-${String(index + 1).padStart(2, '0')}`);
    this.open.set(false);
  }

  goToday(): void {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.tx.setMonth(m);
    this.viewYear.set(now.getFullYear());
  }

  isSelected(index: number): boolean {
    const [y, m] = this.tx.selectedMonth().split('-').map(Number);
    return y === this.viewYear() && m === index + 1;
  }

  isCurrent(index: number): boolean {
    const now = new Date();
    return now.getFullYear() === this.viewYear() && now.getMonth() === index;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  private shiftMonth(delta: number): void {
    const [y, m] = this.tx.selectedMonth().split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.tx.setMonth(newMonth);
  }

  private parseYear(month: string): number {
    return Number(month.split('-')[0]);
  }
}
