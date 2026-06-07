import { Component } from '@angular/core';
import { SubscriptionsManagerComponent } from './components/subscriptions-manager/subscriptions-manager.component';

@Component({
  selector: 'app-suscripciones-page',
  standalone: true,
  imports: [SubscriptionsManagerComponent],
  template: '<app-subscriptions-manager></app-subscriptions-manager>',
})
export class SuscripcionesPageComponent {}
