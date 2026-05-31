import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { TransactionsService } from '../../services/transactions.service';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-month-selector',
  imports: [CommonModule],
  template: `
    <div class="relative flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
      <!-- Anterior -->
      <button type="button" (click)="prev()"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
              title="Mes anterior">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>

      <!-- Display / trigger dropdown -->
      <button type="button" (click)="toggleOpen()"
              class="px-3 h-8 rounded-lg flex items-center gap-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition min-w-[140px] justify-center">
        <span>{{ label() }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-400 transition" [class.rotate-180]="open()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      <!-- Siguiente -->
      <button type="button" (click)="next()"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
              title="Mes siguiente">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      <!-- Hoy -->
      @if (!isCurrentMonth()) {
        <button type="button" (click)="goToday()"
                class="ml-1 px-2.5 h-8 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition"
                title="Ir al mes actual">
          Hoy
        </button>
      }

      <!-- Dropdown panel -->
      @if (open()) {
        <div class="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-20">
          <!-- Año -->
          <div class="flex items-center justify-between mb-3">
            <button type="button" (click)="prevYear()"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="font-bold text-slate-800">{{ viewYear() }}</span>
            <button type="button" (click)="nextYear()"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Grid de meses -->
          <div class="grid grid-cols-3 gap-1.5">
            @for (m of months; track $index) {
              <button type="button" (click)="selectMonth($index)"
                      class="py-2 rounded-lg text-xs font-medium transition"
                      [ngClass]="isSelected($index)
                        ? 'bg-indigo-600 text-white shadow'
                        : isCurrent($index)
                          ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          : 'text-slate-600 hover:bg-slate-100'">
                {{ m.slice(0, 3) }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class MonthSelector {
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
