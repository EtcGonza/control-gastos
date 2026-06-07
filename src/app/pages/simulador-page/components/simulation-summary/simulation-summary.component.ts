import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SimulationResult } from '../../../../core/models/simulation/simulation.model';

@Component({
  selector: 'app-simulation-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './simulation-summary.component.html',
})
export class SimulationSummaryComponent {
  @Input() result: SimulationResult | null = null;
}
