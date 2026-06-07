import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SimulationResult } from '../../../../core/models/simulation/simulation.model';

@Component({
  selector: 'app-projection-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projection-chart.component.html',
})
export class ProjectionChartComponent {
  @Input() result: SimulationResult | null = null;

  // Dimensiones del viewBox
  readonly W = 720;
  readonly H = 240;
  readonly padL = 50;
  readonly padR = 16;
  readonly padT = 16;
  readonly padB = 28;

  private maxValue(): number {
    const months = this.result?.months ?? [];
    if (months.length === 0) return 1;
    return Math.max(
      1,
      ...months.map((m) => Math.max(m.projectedIncome, m.totalFixedExpenses))
    );
  }

  yOf(value: number): number {
    const usable = this.H - this.padT - this.padB;
    const ratio = value / this.maxValue();
    return this.H - this.padB - ratio * usable;
  }

  barH(value: number): number {
    const usable = this.H - this.padT - this.padB;
    return (value / this.maxValue()) * usable;
  }

  private count(): number {
    return this.result?.months.length ?? 0;
  }

  private slotW(): number {
    const usable = this.W - this.padL - this.padR;
    return usable / Math.max(1, this.count());
  }

  barW(): number {
    return Math.max(2, this.slotW() * 0.6);
  }

  barX(i: number): number {
    const slot = this.slotW();
    return this.padL + i * slot + (slot - this.barW()) / 2;
  }

  centerX(i: number): number {
    const slot = this.slotW();
    return this.padL + i * slot + slot / 2;
  }

  incomeLinePath(): string {
    const months = this.result?.months ?? [];
    if (months.length === 0) return '';
    return months
      .map((m, i) => `${i === 0 ? 'M' : 'L'}${this.centerX(i).toFixed(1)} ${this.yOf(m.projectedIncome).toFixed(1)}`)
      .join(' ');
  }

  gridY(): Array<{ y: number; value: number }> {
    const max = this.maxValue();
    const ticks: Array<{ y: number; value: number }> = [];
    for (let i = 0; i <= 4; i++) {
      const value = (max * i) / 4;
      ticks.push({ y: this.yOf(value), value });
    }
    return ticks;
  }

  formatCompact(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(Math.round(n));
  }
}
