import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  SimulationConfig,
  SimulationItem,
  SimulationResult,
} from '../../core/models/simulation/simulation.model';
import { SimulationService } from '../../core/services/simulation.service';
import { ProjectionChartComponent } from './components/projection-chart/projection-chart.component';
import { ProjectionTableComponent } from './components/projection-table/projection-table.component';
import { SimulationFormComponent } from './components/simulation-form/simulation-form.component';
import { SimulationSummaryComponent } from './components/simulation-summary/simulation-summary.component';

/**
 * Página del simulador de compras.
 *
 * Orquesta el formulario de input + tres vistas de output (summary, chart, tabla)
 * conectadas vía un `computed` que invoca `SimulationService.run` con el item
 * y config actuales. Si el item todavía no es válido (`null`) muestra empty state.
 */
@Component({
  selector: 'app-simulador-page',
  standalone: true,
  imports: [
    CommonModule,
    SimulationFormComponent,
    SimulationSummaryComponent,
    ProjectionChartComponent,
    ProjectionTableComponent,
  ],
  templateUrl: './simulador-page.component.html',
})
export class SimuladorPageComponent {
  private readonly svc = inject(SimulationService);

  protected readonly item = signal<SimulationItem | null>(null);
  protected readonly config = signal<SimulationConfig>({
    horizonMonths: 12,
    incomeBase: 'avg-3m',
    monthlyInflationPct: 0,
    monthlyDevaluationPct: 0,
  });

  /**
   * Recalcula la proyección cada vez que cambia el item o la config.
   * Es `computed`, así que sólo se ejecuta cuando un consumidor lee `result()`.
   */
  protected readonly result = computed<SimulationResult | null>(() => {
    const i = this.item();
    if (!i) return null;
    return this.svc.run([i], this.config());
  });
}
