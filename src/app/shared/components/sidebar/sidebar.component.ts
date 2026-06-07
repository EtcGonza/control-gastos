import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationService, NavSection } from '../../../core/services/navigation.service';

interface NavItem {
  id: NavSection;
  label: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  protected readonly nav = inject(NavigationService);

  protected readonly items: NavItem[] = [
    { id: 'mes', label: 'Mes' },
    { id: 'tarjetas', label: 'Tarjetas' },
    { id: 'suscripciones', label: 'Suscripciones' },
    { id: 'ahorros', label: 'Ahorros' },
    { id: 'analisis', label: 'Análisis' },
    { id: 'configuracion', label: 'Configuración' },
  ];

  select(id: NavSection): void {
    this.nav.setSection(id);
  }
}
