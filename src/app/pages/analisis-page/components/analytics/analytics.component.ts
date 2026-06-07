import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Subscription } from '../../../../core/models/subscription/subscription.model';
import { TransactionsService } from '../../../../core/services/transactions.service';

interface MonthPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  balance: number;
}

interface CategorySlice {
  category: string;
  total: number;
  pct: number;
  color: string;
  startAngle: number;
  endAngle: number;
  arcPath: string;
}

interface SubPriceEvolution {
  sub: Subscription;
  currentPrice: number;
  initialPrice: number;
  changePct: number;
  sparklinePath: string;
  sparklineDots: Array<{ x: number; y: number; from: string; amount: number }>;
}

interface SubTotalRow {
  sub: Subscription;
  total: number;
  count: number;
  currency: 'ARS' | 'USD';
  arsEquivalent: number;
  pctOfMax: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent {
  protected readonly tx = inject(TransactionsService);

  private readonly EXPANDED_KEY = 'control-gastos:analytics-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());

  protected readonly hoverIdx = signal<number | null>(null);
  protected readonly hoverCat = signal<string | null>(null);

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.EXPANDED_KEY, String(this.expanded()));
    }
  }

  private loadExpanded(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const v = localStorage.getItem(this.EXPANDED_KEY);
    return v === null ? false : v === 'true';
  }

  // Trend mensual
  protected readonly trendW = 720;
  protected readonly trendH = 240;
  protected readonly trendPadL = 50;
  protected readonly trendPadR = 16;
  protected readonly trendPadT = 16;
  protected readonly trendPadB = 28;

  protected readonly monthlyTrend = computed<MonthPoint[]>(() => {
    const now = new Date();
    const points: MonthPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = this.shortMonthLabel(month);
      points.push({
        month,
        label,
        income: this.tx.incomeForMonth(month),
        expenses: this.tx.expensesForMonth(month),
        balance: this.tx.balanceForMonth(month),
      });
    }
    return points;
  });

  protected readonly hasAnyMonthlyData = computed(() =>
    this.monthlyTrend().some((p) => p.income > 0 || p.expenses > 0)
  );

  private readonly trendDomain = computed(() => {
    const all = this.monthlyTrend().flatMap((p) => [p.income, p.expenses, p.balance]);
    if (all.length === 0) return { min: 0, max: 1 };
    const min = Math.min(0, ...all);
    const max = Math.max(1, ...all);
    return { min, max };
  });

  protected trendHasNegative(): boolean {
    return this.trendDomain().min < 0;
  }

  trendX(i: number): number {
    const count = this.monthlyTrend().length;
    if (count <= 1) return this.trendPadL;
    const usable = this.trendW - this.trendPadL - this.trendPadR;
    return this.trendPadL + (usable * i) / (count - 1);
  }

  trendStep(): number {
    const count = this.monthlyTrend().length;
    if (count <= 1) return 1;
    const usable = this.trendW - this.trendPadL - this.trendPadR;
    return usable / (count - 1);
  }

  trendY(value: number): number {
    const { min, max } = this.trendDomain();
    const usable = this.trendH - this.trendPadT - this.trendPadB;
    if (max === min) return this.trendPadT + usable / 2;
    const ratio = (value - min) / (max - min);
    return this.trendH - this.trendPadB - ratio * usable;
  }

  trendZeroY(): number {
    return this.trendY(0);
  }

  protected trendGridY(): Array<{ y: number; value: number }> {
    const { min, max } = this.trendDomain();
    const ticks: Array<{ y: number; value: number }> = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const value = min + ((max - min) * i) / steps;
      ticks.push({ y: this.trendY(value), value });
    }
    return ticks;
  }

  trendLinePath(field: 'income' | 'expenses' | 'balance'): string {
    const points = this.monthlyTrend();
    if (points.length === 0) return '';
    return points
      .map((p, i) => {
        const x = this.trendX(i);
        const y = this.trendY(p[field]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  trendAreaPath(field: 'income' | 'expenses'): string {
    const points = this.monthlyTrend();
    if (points.length === 0) return '';
    const baseY = this.trendY(0);
    let path = `M${this.trendX(0).toFixed(1)} ${baseY.toFixed(1)}`;
    points.forEach((p, i) => {
      path += ` L${this.trendX(i).toFixed(1)} ${this.trendY(p[field]).toFixed(1)}`;
    });
    path += ` L${this.trendX(points.length - 1).toFixed(1)} ${baseY.toFixed(1)} Z`;
    return path;
  }

  // Donut categorías
  protected readonly categoryTotal = computed(() =>
    this.tx.expensesByCategory().reduce((acc, c) => acc + c.total, 0)
  );

  protected readonly categorySlices = computed<CategorySlice[]>(() => {
    const data = this.tx.expensesByCategory();
    const total = this.categoryTotal();
    if (total === 0) return [];

    const cx = 100, cy = 100, rOuter = 90, rInner = 48;
    let currentAngle = -Math.PI / 2;

    return data.map(({ category, total: catTotal }) => {
      const pct = (catTotal / total) * 100;
      const sliceAngle = (catTotal / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const x1 = cx + rOuter * Math.cos(startAngle);
      const y1 = cy + rOuter * Math.sin(startAngle);
      const x2 = cx + rOuter * Math.cos(endAngle);
      const y2 = cy + rOuter * Math.sin(endAngle);
      const x3 = cx + rInner * Math.cos(endAngle);
      const y3 = cy + rInner * Math.sin(endAngle);
      const x4 = cx + rInner * Math.cos(startAngle);
      const y4 = cy + rInner * Math.sin(startAngle);

      const arcPath = [
        `M${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        `L${x3.toFixed(2)} ${y3.toFixed(2)}`,
        `A${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
        'Z',
      ].join(' ');

      return {
        category,
        total: catTotal,
        pct,
        color: this.tx.colorForCategory(category),
        startAngle,
        endAngle,
        arcPath,
      };
    });
  });

  // Evolución de precios de subs
  protected readonly subEvolutions = computed<SubPriceEvolution[]>(() => {
    return this.tx.subscriptions().map((sub) => {
      const history = [...sub.priceHistory].sort((a, b) =>
        a.from.localeCompare(b.from)
      );
      const initial = history[0]?.amount ?? 0;
      const current = history[history.length - 1]?.amount ?? 0;
      const changePct = initial > 0 ? ((current - initial) / initial) * 100 : 0;

      const w = 200, h = 40, padX = 4, padY = 4;
      const amounts = history.map((p) => p.amount);
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      const range = max - min || 1;

      const dots = history.map((p, i) => {
        const x =
          history.length === 1
            ? w / 2
            : padX + ((w - padX * 2) * i) / (history.length - 1);
        const y = h - padY - ((p.amount - min) / range) * (h - padY * 2);
        return { x, y, from: p.from, amount: p.amount };
      });

      const sparklinePath = dots
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(2)} ${d.y.toFixed(2)}`)
        .join(' ');

      return {
        sub,
        initialPrice: initial,
        currentPrice: current,
        changePct,
        sparklinePath,
        sparklineDots: dots,
      };
    });
  });

  // Total acumulado por suscripción
  protected readonly subTotals = computed<SubTotalRow[]>(() => {
    const rows = this.tx.subscriptions().map((sub) => {
      const { total, count, currency } = this.tx.subscriptionTotalCost(sub);
      const arsEquivalent =
        currency === 'USD'
          ? total * (this.tx.latestRate()?.rate ?? 1)
          : total;
      return { sub, total, count, currency, arsEquivalent, pctOfMax: 0 };
    });

    if (rows.length === 0) return [];
    const max = Math.max(...rows.map((r) => r.arsEquivalent));
    return rows
      .map((r) => ({ ...r, pctOfMax: max > 0 ? (r.arsEquivalent / max) * 100 : 0 }))
      .sort((a, b) => b.arsEquivalent - a.arsEquivalent);
  });

  protected readonly subTotalsArsSum = computed(() =>
    this.subTotals()
      .filter((r) => r.currency === 'ARS')
      .reduce((a, r) => a + r.total, 0)
  );

  protected readonly subTotalsUsdSum = computed(() =>
    this.subTotals()
      .filter((r) => r.currency === 'USD')
      .reduce((a, r) => a + r.total, 0)
  );

  // Helpers de formato
  protected shortMonthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${names[m - 1]} ${String(y).slice(-2)}`;
  }

  protected longMonthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${names[m - 1]} ${y}`;
  }

  protected formatCompact(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(Math.round(n));
  }
}
