import { Component } from '@angular/core';
import { AnalyticsComponent } from './components/analytics/analytics.component';

@Component({
  selector: 'app-analisis-page',
  standalone: true,
  imports: [AnalyticsComponent],
  template: '<app-analytics></app-analytics>',
})
export class AnalisisPageComponent {}
