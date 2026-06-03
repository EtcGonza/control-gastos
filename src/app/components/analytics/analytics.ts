import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Subscription } from '../../core/models/subscription/subscription.model';
import { TransactionsService } from '../../services/transactions.service';

interface MonthPoint {
  month: string;        // YYYY-MM
  label: string;        // ej. "May 26"
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
  arsEquivalent: number; // para ordenar y comparar
  pctOfMax: number;
}

@Component({
  selector: 'app-analytics',
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <button type="button" (click)="toggleExpanded()"
              class="w-full flex items-center justify-between text-left"
              [class.mb-4]="expanded()">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          Análisis
        </h2>
        <span class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform"
               [class.rotate-180]="expanded()"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>

      @if (expanded()) {
        <div class="space-y-8">

          <!-- ===== Trend mensual: ingresos / gastos / balance ===== -->
          <section>
            <h3 class="text-sm font-semibold text-slate-700 mb-3">
              Ingresos, gastos y balance · últimos 12 meses
            </h3>

            @if (hasAnyMonthlyData()) {
              <!-- Legend -->
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mb-3">
                <span class="flex items-center gap-1.5">
                  <span class="w-3 h-0.5 bg-emerald-500"></span> Ingresos
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="w-3 h-0.5 bg-rose-500"></span> Gastos
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="w-3 h-0.5 bg-indigo-500"></span> Balance
                </span>
              </div>

              <div class="overflow-x-auto">
                <svg [attr.viewBox]="'0 0 ' + trendW + ' ' + trendH"
                     class="w-full h-[280px] min-w-[640px]"
                     preserveAspectRatio="xMidYMid meet">
                  <!-- Grid horizontal -->
                  @for (gy of trendGridY(); track gy.y) {
                    <line [attr.x1]="trendPadL" [attr.x2]="trendW - trendPadR"
                          [attr.y1]="gy.y" [attr.y2]="gy.y"
                          stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2 3"/>
                    <text [attr.x]="trendPadL - 6" [attr.y]="gy.y + 3"
                          text-anchor="end" font-size="10" fill="#94a3b8">
                      {{ formatCompact(gy.value) }}
                    </text>
                  }

                  <!-- Línea de cero (resaltada si hay valores negativos) -->
                  @if (trendHasNegative()) {
                    <line [attr.x1]="trendPadL" [attr.x2]="trendW - trendPadR"
                          [attr.y1]="trendZeroY()" [attr.y2]="trendZeroY()"
                          stroke="#cbd5e1" stroke-width="1"/>
                  }

                  <!-- Eje X labels -->
                  @for (p of monthlyTrend(); track p.month; let i = $index) {
                    <text [attr.x]="trendX(i)" [attr.y]="trendH - 8"
                          text-anchor="middle" font-size="10" fill="#64748b">
                      {{ p.label }}
                    </text>
                  }

                  <!-- Gastos (área tenue + línea) -->
                  <path [attr.d]="trendAreaPath('expenses')"
                        fill="#fda4af" fill-opacity="0.15"/>
                  <path [attr.d]="trendLinePath('expenses')"
                        fill="none" stroke="#e11d48" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>

                  <!-- Ingresos -->
                  <path [attr.d]="trendAreaPath('income')"
                        fill="#86efac" fill-opacity="0.15"/>
                  <path [attr.d]="trendLinePath('income')"
                        fill="none" stroke="#059669" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>

                  <!-- Balance -->
                  <path [attr.d]="trendLinePath('balance')"
                        fill="none" stroke="#6366f1" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"
                        stroke-dasharray="4 3"/>

                  <!-- Dots -->
                  @for (p of monthlyTrend(); track p.month; let i = $index) {
                    <circle [attr.cx]="trendX(i)" [attr.cy]="trendY(p.income)"
                            r="3" fill="#059669"/>
                    <circle [attr.cx]="trendX(i)" [attr.cy]="trendY(p.expenses)"
                            r="3" fill="#e11d48"/>
                    <circle [attr.cx]="trendX(i)" [attr.cy]="trendY(p.balance)"
                            r="3" fill="#6366f1"/>
                  }

                  <!-- Hover overlay -->
                  @for (p of monthlyTrend(); track p.month; let i = $index) {
                    <g class="cursor-pointer">
                      <rect [attr.x]="trendX(i) - trendStep() / 2"
                            [attr.y]="trendPadT"
                            [attr.width]="trendStep()"
                            [attr.height]="trendH - trendPadT - trendPadB"
                            fill="transparent"
                            (mouseenter)="hoverIdx.set(i)"
                            (mouseleave)="hoverIdx.set(null)"/>
                    </g>
                  }

                  <!-- Vertical guide on hover -->
                  @if (hoverIdx() !== null) {
                    <line [attr.x1]="trendX(hoverIdx()!)" [attr.x2]="trendX(hoverIdx()!)"
                          [attr.y1]="trendPadT" [attr.y2]="trendH - trendPadB"
                          stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>
                  }
                </svg>
              </div>

              <!-- Detalle del mes hovered -->
              @if (hoverIdx() !== null && monthlyTrend()[hoverIdx()!]; as p) {
                <div class="mt-3 grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded-xl p-3">
                  <div>
                    <p class="text-slate-500">{{ p.label }}</p>
                    <p class="font-semibold text-slate-700">{{ longMonthLabel(p.month) }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-emerald-600">Ingresos {{ '$' }}{{ p.income | number:'1.0-0' }}</p>
                    <p class="text-rose-600">Gastos {{ '$' }}{{ p.expenses | number:'1.0-0' }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-slate-500">Balance</p>
                    <p class="font-semibold"
                       [ngClass]="p.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'">
                      {{ '$' }}{{ p.balance | number:'1.0-0' }}
                    </p>
                  </div>
                </div>
              }
            } @else {
              <p class="text-sm text-slate-400 py-6 text-center">
                Cargá movimientos para ver la evolución mensual.
              </p>
            }
          </section>

          <!-- ===== Donut categorías + Evolución precios subs ===== -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

            <!-- Donut -->
            <section>
              <h3 class="text-sm font-semibold text-slate-700 mb-3">
                Gastos por categoría · mes actual
              </h3>

              @if (categorySlices().length > 0) {
                <div class="flex items-center gap-4 flex-wrap">
                  <svg viewBox="0 0 200 200" class="w-44 h-44 flex-shrink-0">
                    <!-- Slices -->
                    @for (s of categorySlices(); track s.category) {
                      <path [attr.d]="s.arcPath"
                            [attr.fill]="s.color"
                            stroke="#ffffff" stroke-width="2"
                            (mouseenter)="hoverCat.set(s.category)"
                            (mouseleave)="hoverCat.set(null)"
                            class="cursor-pointer transition"
                            [class.opacity-80]="hoverCat() && hoverCat() !== s.category"/>
                    }
                    <!-- Hueco central -->
                    <circle cx="100" cy="100" r="48" fill="#ffffff"/>
                    <!-- Total al centro -->
                    <text x="100" y="95" text-anchor="middle" font-size="10" fill="#64748b">Total</text>
                    <text x="100" y="112" text-anchor="middle" font-size="14" font-weight="700" fill="#0f172a">
                      {{ '$' }}{{ categoryTotal() | number:'1.0-0' }}
                    </text>
                  </svg>

                  <!-- Legend -->
                  <ul class="flex-1 min-w-[180px] space-y-1 text-xs">
                    @for (s of categorySlices(); track s.category) {
                      <li class="flex items-center gap-2 cursor-pointer transition"
                          [class.opacity-50]="hoverCat() && hoverCat() !== s.category"
                          (mouseenter)="hoverCat.set(s.category)"
                          (mouseleave)="hoverCat.set(null)">
                        <span class="w-3 h-3 rounded-sm flex-shrink-0"
                              [style.background-color]="s.color"></span>
                        <span class="flex-1 truncate text-slate-700">{{ tx.nameForCategory(s.category) }}</span>
                        <span class="text-slate-500 font-medium">{{ s.pct | number:'1.0-1' }}%</span>
                      </li>
                    }
                  </ul>
                </div>
              } @else {
                <p class="text-sm text-slate-400 py-6 text-center">
                  No hay gastos en el mes actual.
                </p>
              }
            </section>

            <!-- Evolución de precios de subs -->
            <section>
              <h3 class="text-sm font-semibold text-slate-700 mb-3">
                Evolución del precio de tus suscripciones
              </h3>

              @if (subEvolutions().length > 0) {
                <ul class="space-y-2 max-h-72 overflow-y-auto pr-1">
                  @for (sub of subEvolutions(); track sub.sub.id) {
                    <li class="border border-slate-100 rounded-xl p-3">
                      <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="min-w-0">
                          <p class="text-sm font-semibold text-slate-800 truncate">
                            {{ sub.sub.description }}
                          </p>
                          <p class="text-[11px] text-slate-400">
                            {{ sub.sub.priceHistory.length }} {{ sub.sub.priceHistory.length === 1 ? 'precio' : 'cambios de precio' }}
                          </p>
                        </div>
                        <div class="text-right">
                          <p class="text-sm font-bold text-slate-800">
                            {{ sub.sub.currency === 'USD' ? 'US$' : '$' }}{{ sub.currentPrice | number:'1.2-2' }}
                          </p>
                          @if (sub.sub.priceHistory.length > 1) {
                            <p class="text-[11px] font-semibold"
                               [ngClass]="sub.changePct > 0 ? 'text-rose-600' : sub.changePct < 0 ? 'text-emerald-600' : 'text-slate-400'">
                              {{ sub.changePct > 0 ? '+' : '' }}{{ sub.changePct | number:'1.0-1' }}%
                            </p>
                          }
                        </div>
                      </div>

                      @if (sub.sub.priceHistory.length > 1) {
                        <svg viewBox="0 0 200 40" class="w-full h-10" preserveAspectRatio="none">
                          <path [attr.d]="sub.sparklinePath"
                                fill="none" stroke="#6366f1" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round"
                                vector-effect="non-scaling-stroke"/>
                          @for (d of sub.sparklineDots; track d.from) {
                            <circle [attr.cx]="d.x" [attr.cy]="d.y" r="2.5" fill="#6366f1"/>
                          }
                        </svg>
                      } @else {
                        <p class="text-[11px] text-slate-400 italic">
                          Sin variaciones de precio.
                        </p>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-slate-400 py-6 text-center">
                  Cargá suscripciones para ver la evolución de precios.
                </p>
              }
            </section>
          </div>

          <!-- ===== Total acumulado por suscripción ===== -->
          <section>
            <h3 class="text-sm font-semibold text-slate-700 mb-3">
              Cuánto te costó cada suscripción · acumulado desde el inicio
            </h3>

            @if (subTotals().length > 0) {
              <ul class="space-y-2">
                @for (row of subTotals(); track row.sub.id) {
                  <li>
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="flex items-center gap-2 text-slate-700 truncate">
                        <span class="font-medium">{{ row.sub.description }}</span>
                        <span class="text-slate-400">·</span>
                        <span class="text-slate-400">{{ row.count }} {{ row.count === 1 ? 'cobro' : 'cobros' }}</span>
                      </span>
                      <span class="font-semibold text-slate-700 whitespace-nowrap">
                        {{ row.currency === 'USD' ? 'US$' : '$' }}{{ row.total | number:'1.2-2' }}
                      </span>
                    </div>
                    <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all"
                           [style.width.%]="row.pctOfMax"></div>
                    </div>
                  </li>
                }
              </ul>

              <div class="mt-4 bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs">
                <p class="text-violet-700">
                  <b>Total acumulado en suscripciones</b>:
                  {{ '$' }}{{ subTotalsArsSum() | number:'1.0-0' }} en pesos
                  @if (subTotalsUsdSum() > 0) {
                    + US{{ '$' }}{{ subTotalsUsdSum() | number:'1.2-2' }}
                  }
                </p>
                <p class="text-violet-600/70 mt-1">
                  Se cuentan todos los cobros generados desde el inicio de cada suscripción hasta hoy (o hasta su cancelación).
                </p>
              </div>
            } @else {
              <p class="text-sm text-slate-400 py-6 text-center">
                No hay suscripciones cargadas.
              </p>
            }
          </section>
        </div>
      }
    </div>
  `,
})
export class Analytics {
  protected readonly tx = inject(TransactionsService);

  private readonly EXPANDED_KEY = 'control-gastos:analytics-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());

  // Hover state
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

  // ===================================================================
  // Trend mensual
  // ===================================================================

  // Dimensiones del SVG (viewBox)
  protected readonly trendW = 720;
  protected readonly trendH = 240;
  protected readonly trendPadL = 50;
  protected readonly trendPadR = 16;
  protected readonly trendPadT = 16;
  protected readonly trendPadB = 28;

  /** Datos de los últimos 12 meses (incluyendo el actual). */
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

  /** Min y max global del eje Y (considerando ingresos, gastos y balance). */
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

  // ===================================================================
  // Donut categorías
  // ===================================================================

  protected readonly categoryTotal = computed(() =>
    this.tx.expensesByCategory().reduce((acc, c) => acc + c.total, 0)
  );

  protected readonly categorySlices = computed<CategorySlice[]>(() => {
    const data = this.tx.expensesByCategory();
    const total = this.categoryTotal();
    if (total === 0) return [];

    const cx = 100, cy = 100, rOuter = 90, rInner = 48;
    let currentAngle = -Math.PI / 2; // arrancamos arriba

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

  // ===================================================================
  // Evolución de precios de subs
  // ===================================================================

  protected readonly subEvolutions = computed<SubPriceEvolution[]>(() => {
    return this.tx.subscriptions().map((sub) => {
      const history = [...sub.priceHistory].sort((a, b) =>
        a.from.localeCompare(b.from)
      );
      const initial = history[0]?.amount ?? 0;
      const current = history[history.length - 1]?.amount ?? 0;
      const changePct = initial > 0 ? ((current - initial) / initial) * 100 : 0;

      // Sparkline: viewBox 200x40, 4 padding
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

  // ===================================================================
  // Total acumulado por suscripción
  // ===================================================================

  protected readonly subTotals = computed<SubTotalRow[]>(() => {
    const rows = this.tx.subscriptions().map((sub) => {
      const { total, count, currency } = this.tx.subscriptionTotalCost(sub);
      // Para comparar con cuotas USD, usamos último TC conocido como proxy
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

  // ===================================================================
  // Helpers de formato
  // ===================================================================

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
