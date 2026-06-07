import { Component } from '@angular/core';
import { CardsManagerComponent } from './components/cards-manager/cards-manager.component';

/** Página de gestión de tarjetas de crédito. */
@Component({
  selector: 'app-tarjetas-page',
  standalone: true,
  imports: [CardsManagerComponent],
  template: '<app-cards-manager></app-cards-manager>',
})
export class TarjetasPageComponent {}
