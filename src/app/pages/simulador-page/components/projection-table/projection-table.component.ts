import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  MonthProjection,
  SimulationResult,
} from '../../../../core/models/simulation/simulation.model';

@Component({
  selector: 'app-projection-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projection-table.component.html',
})
export class ProjectionTableComponent {
  @Input() result: SimulationResult | null = null;

  rowClass(m: MonthProjection): string {
    if (m.isNegative) return 'bg-rose-50/50';
    if (m.isOverCommitted) return 'bg-rose-50/30';
    if (m.isModerate) return 'bg-amber-50/30';
    return '';
  }

  dotClass(m: MonthProjection): string {
    if (m.isNegative || m.isOverCommitted) return 'bg-rose-500';
    if (m.isModerate) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  badgeClass(m: MonthProjection): string {
    if (m.isOverCommitted) return 'bg-rose-100 text-rose-700';
    if (m.isModerate) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  }
}
