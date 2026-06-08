import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NavigationService } from '../../../../core/services/navigation.service';
import { TransactionsService } from '../../../../core/services/transactions.service';
import { formatMonthLabel } from '../../../../core/utils/date.utils';

interface UpcomingEntry {
  id: string;
  serviceName: string;
  dueDate: string;
  amount: number;
  color: string;
  estimated: boolean;
  chargeMonthLabel: string | null;
  daysUntilLabel: string;
  daysUntil: number;
}

/**
 * Widget para Mes-page que muestra las próximas facturas previstas de
 * servicios cargados. Si no hay servicios todavía, muestra CTA para ir a la
 * sección Servicios.
 */
@Component({
  selector: 'app-upcoming-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upcoming-services.component.html',
})
export class UpcomingServicesComponent {
  private readonly tx = inject(TransactionsService);
  private readonly nav = inject(NavigationService);

  protected readonly hasAnyService = computed(
    () => this.tx.utilityServices().some((s) => !s.archived)
  );

  /** Próximas 5 facturas previstas dentro de los próximos 2 meses. */
  protected readonly upcomingEntries = computed<UpcomingEntry[]>(() => {
    const services = this.tx.utilityServices().filter((s) => !s.archived);
    if (services.length === 0) return [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizonDate = new Date(now);
    horizonDate.setDate(horizonDate.getDate() + 60);

    const entries: UpcomingEntry[] = [];

    for (const service of services) {
      const fc = this.tx.forecastFor(service);
      // Si no hay forecast (menos de 2 facturas), usamos la última factura
      // cargada como referencia.
      let nextDate: string | null = null;
      let nextAmount: number | null = null;
      let isEstimated = false;
      let billId: string | undefined;

      if (fc.nextDueDate && fc.estimatedAmount != null) {
        nextDate = fc.nextDueDate;
        nextAmount = fc.estimatedAmount;
        isEstimated = true;
      } else if (service.bills.length > 0) {
        // Tomamos la última factura cargada si es futura.
        const sorted = [...service.bills].sort((a, b) =>
          b.dueDate.localeCompare(a.dueDate)
        );
        const last = sorted[0];
        const lastDate = new Date(last.dueDate + 'T00:00:00');
        if (lastDate >= now) {
          nextDate = last.dueDate;
          nextAmount = last.amount;
          isEstimated = false;
          billId = last.id;
        }
      }

      if (!nextDate || nextAmount == null) continue;
      const dueDateObj = new Date(nextDate + 'T00:00:00');
      if (dueDateObj < now || dueDateObj > horizonDate) continue;

      const diffDays = Math.round(
        (dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const dueMonth = nextDate.slice(0, 7);
      const chargeMonth = this.tx.chargeMonthFor(service, nextDate);

      entries.push({
        id: billId ? `bill-${billId}` : `est-${service.id}`,
        serviceName: service.name,
        dueDate: nextDate,
        amount: nextAmount,
        color: this.tx.colorForCategory(service.category),
        estimated: isEstimated,
        chargeMonthLabel:
          chargeMonth !== dueMonth ? formatMonthLabel(chargeMonth) : null,
        daysUntilLabel: this.formatDaysUntil(diffDays),
        daysUntil: diffDays,
      });
    }

    return entries
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  });

  protected readonly totalEstimated = computed(() =>
    this.upcomingEntries().reduce((acc, e) => acc + e.amount, 0)
  );

  protected goToServicios(): void {
    this.nav.setSection('servicios');
  }

  private formatDaysUntil(diff: number): string {
    if (diff === 0) return 'vence hoy';
    if (diff > 0) return `en ${diff} ${diff === 1 ? 'día' : 'días'}`;
    return `vencida hace ${-diff} ${-diff === 1 ? 'día' : 'días'}`;
  }
}
