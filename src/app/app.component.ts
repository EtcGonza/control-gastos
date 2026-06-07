import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ConfirmService } from './core/services/confirm.service';
import { NavigationService, NavSection } from './core/services/navigation.service';
import { TransactionsService } from './core/services/transactions.service';
import { AhorrosPageComponent } from './pages/ahorros-page/ahorros-page.component';
import { AnalisisPageComponent } from './pages/analisis-page/analisis-page.component';
import { ConfiguracionPageComponent } from './pages/configuracion-page/configuracion-page.component';
import { MesPageComponent } from './pages/mes-page/mes-page.component';
import { SimuladorPageComponent } from './pages/simulador-page/simulador-page.component';
import { SuscripcionesPageComponent } from './pages/suscripciones-page/suscripciones-page.component';
import { TarjetasPageComponent } from './pages/tarjetas-page/tarjetas-page.component';
import { ConfirmHostComponent } from './shared/components/confirm-host/confirm-host.component';
import { MonthSelectorComponent } from './shared/components/month-selector/month-selector.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
// import { ThemePickerComponent } from './shared/components/theme-picker/theme-picker.component'; // deshabilitado temporalmente

const SECTION_LABELS: Record<NavSection, string> = {
  mes: 'Mes',
  tarjetas: 'Tarjetas',
  suscripciones: 'Suscripciones',
  ahorros: 'Ahorros',
  analisis: 'Análisis',
  simulador: 'Simulador',
  configuracion: 'Configuración',
};

const SECTION_SUBTITLES: Record<NavSection, string> = {
  mes: 'Movimientos del mes seleccionado',
  tarjetas: 'Gestión de tarjetas de crédito',
  suscripciones: 'Suscripciones activas y canceladas',
  ahorros: 'Tus ahorros en pesos y dólares',
  analisis: 'Visualizaciones y tendencias',
  simulador: 'Proyectá el impacto de una compra futura',
  configuracion: 'Categorías y respaldo de datos',
};

/** Secciones donde el selector de mes tiene sentido. */
const SECTIONS_WITH_MONTH: NavSection[] = ['mes', 'analisis'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    MonthSelectorComponent,
    ConfirmHostComponent,
    MesPageComponent,
    TarjetasPageComponent,
    SuscripcionesPageComponent,
    AhorrosPageComponent,
    AnalisisPageComponent,
    SimuladorPageComponent,
    ConfiguracionPageComponent,
    // ThemePickerComponent, // deshabilitado temporalmente
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  protected readonly tx = inject(TransactionsService);
  protected readonly nav = inject(NavigationService);
  private readonly confirmSvc = inject(ConfirmService);

  constructor() {
    // Si la migración de categorías nombre → ID encontró registros que no se
    // pudieron resolver, mostramos un aviso UNA vez y limpiamos el report.
    effect(() => {
      const report = this.tx.migrationReport();
      if (!report || report.unknownCount === 0) return;
      const n = report.unknownCount;
      this.confirmSvc
        .alert({
          title: 'Categorías desconocidas detectadas',
          message:
            `Se encontraron ${n} ${n === 1 ? 'registro' : 'registros'} con una categoría que no pudo identificarse al migrar tus datos.\n\n` +
            'Estos registros quedaron asignados temporalmente a la categoría "Desconocido". ' +
            'Te recomendamos revisarlos en la sección Mes y editarlos para asignarles una categoría correcta.',
        })
        .then(() => this.tx.acknowledgeMigrationReport());
    });
  }

  protected readonly sectionLabel = computed(
    () => SECTION_LABELS[this.nav.section()]
  );

  protected readonly sectionSubtitle = computed(
    () => SECTION_SUBTITLES[this.nav.section()]
  );

  protected readonly showMonthSelector = computed(() =>
    SECTIONS_WITH_MONTH.includes(this.nav.section())
  );
}
