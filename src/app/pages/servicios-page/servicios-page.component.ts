import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { UtilityService } from '../../core/models/service/service.model';
import { NavigationService } from '../../core/services/navigation.service';
import { TransactionsService } from '../../core/services/transactions.service';
import { ServiceCardComponent } from './components/service-card/service-card.component';
import { ServiceFormComponent } from './components/service-form/service-form.component';

/**
 * Página de servicios públicos recurrentes.
 *
 * Muestra la lista de servicios cargados (cada uno con su próxima factura
 * estimada y acciones inline) y permite agregar nuevos servicios.
 */
@Component({
  selector: 'app-servicios-page',
  standalone: true,
  imports: [CommonModule, ServiceFormComponent, ServiceCardComponent],
  templateUrl: './servicios-page.component.html',
})
export class ServiciosPageComponent {
  protected readonly tx = inject(TransactionsService);
  protected readonly nav = inject(NavigationService);

  protected readonly showAddForm = signal<boolean>(false);

  /** Servicios activos (no archivados) ordenados por nombre. */
  protected readonly activeServices = computed(() =>
    [...this.tx.utilityServices()]
      .filter((s) => !s.archived)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  /** Servicios archivados, ordenados por updatedAt descendente. */
  protected readonly archivedServices = computed(() =>
    [...this.tx.utilityServices()]
      .filter((s) => s.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );

  protected readonly showArchived = signal<boolean>(false);

  onServiceAdded(service: UtilityService | null): void {
    if (service) this.showAddForm.set(false);
  }
}
