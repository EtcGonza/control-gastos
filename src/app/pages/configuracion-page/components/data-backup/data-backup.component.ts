import { CommonModule } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ExportFile, TransactionsService } from '../../../../core/services/transactions.service';

@Component({
  selector: 'app-data-backup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-backup.component.html',
})
export class DataBackupComponent {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  protected readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private readonly EXPANDED_KEY = 'control-gastos:backup-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());

  protected readonly summaryText = computed(() => {
    const c = this.tx.dataCounts();
    return this.formatCounts(c);
  });

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.EXPANDED_KEY, String(this.expanded()));
    }
  }

  private loadExpanded(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const v = localStorage.getItem(this.EXPANDED_KEY);
    return v === null ? false : v === 'true';
  }

  // ============ Export ============

  exportData(): void {
    const file = this.tx.exportData();
    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `control-gastos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============ Import ============

  triggerImport(): void {
    this.fileInput().nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    let raw: unknown;
    try {
      const text = await file.text();
      raw = JSON.parse(text);
    } catch {
      await this.confirmSvc.alert({
        title: 'Archivo inválido',
        message: 'El archivo no es un JSON válido.',
        variant: 'danger',
      });
      input.value = '';
      return;
    }

    const result = this.tx.validateImportFile(raw);
    if (!result.ok) {
      await this.confirmSvc.alert({
        title: 'Archivo inválido',
        message: result.error,
        variant: 'danger',
      });
      input.value = '';
      return;
    }

    const counts = this.countsFromFile(result.file);
    const ok = await this.confirmSvc.confirm({
      title: 'Importar respaldo',
      message:
        `El archivo contiene:\n${this.formatCounts(counts)}\n\n` +
        'Importarlo reemplaza por completo tus datos actuales. Esta acción no se puede deshacer.',
      confirmText: 'Importar y reemplazar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (ok) {
      this.tx.importData(result.file);
    }
    input.value = '';
  }

  // ============ Clear ============

  async clearAll(): Promise<void> {
    const first = await this.confirmSvc.confirm({
      title: 'Borrar todos los datos',
      message:
        'Vas a eliminar todas las transacciones, plantillas, tarjetas, compras, suscripciones y cotizaciones cacheadas. ¿Querés continuar?',
      confirmText: 'Sí, continuar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!first) return;

    const second = await this.confirmSvc.confirm({
      title: '¿Estás seguro?',
      message:
        'Esta acción no se puede deshacer. Te recomendamos exportar un respaldo antes de seguir. ¿Borrar todo definitivamente?',
      confirmText: 'Borrar todo',
      cancelText: 'No, cancelar',
      variant: 'danger',
    });
    if (!second) return;

    this.tx.clearAllData();
  }

  // ============ helpers ============

  private countsFromFile(file: ExportFile) {
    const d = file.data;
    return {
      transactions: Array.isArray(d.transactions) ? d.transactions.length : 0,
      templates: Array.isArray(d.templates) ? d.templates.length : 0,
      cards: Array.isArray(d.cards) ? d.cards.length : 0,
      purchases: Array.isArray(d.purchases) ? d.purchases.length : 0,
      subscriptions: Array.isArray(d.subscriptions) ? d.subscriptions.length : 0,
      rates: d.rates && typeof d.rates === 'object' ? Object.keys(d.rates).length : 0,
      customCategories: Array.isArray(d.customCategories) ? d.customCategories.length : 0,
      savings: Array.isArray(d.savings) ? d.savings.length : 0,
    };
  }

  private formatCounts(c: {
    transactions: number;
    templates: number;
    cards: number;
    purchases: number;
    subscriptions: number;
    rates: number;
    customCategories: number;
    savings: number;
  }): string {
    return [
      `${c.transactions} movimientos manuales`,
      `${c.templates} plantillas de fijos`,
      `${c.cards} tarjetas`,
      `${c.purchases} compras con cuotas`,
      `${c.subscriptions} suscripciones`,
      `${c.savings} ahorros`,
      `${c.customCategories} categorías custom`,
      `${c.rates} cotizaciones cacheadas`,
    ].join(' · ');
  }
}
