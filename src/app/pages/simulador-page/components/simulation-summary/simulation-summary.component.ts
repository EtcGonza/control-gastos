import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SimulationResult } from '../../../../core/models/simulation/simulation.model';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  selector: 'app-simulation-summary',
  standalone: true,
  imports: [CommonModule, InfoTooltipComponent],
  templateUrl: './simulation-summary.component.html',
})
export class SimulationSummaryComponent {
  @Input() result: SimulationResult | null = null;
}
