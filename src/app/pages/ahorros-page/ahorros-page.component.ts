import { Component } from '@angular/core';
import { SavingsComponent } from './components/savings/savings.component';

@Component({
  selector: 'app-ahorros-page',
  standalone: true,
  imports: [SavingsComponent],
  template: '<app-savings></app-savings>',
})
export class AhorrosPageComponent {}
