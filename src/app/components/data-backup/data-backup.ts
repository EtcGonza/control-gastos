import { CommonModule } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';
import { ExportFile, TransactionsService } from '../../services/transactions.service';

@Component({
  selector: 'app-data-backup',
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <button type="button" (click)="toggleExpanded()"
              class="w-full flex items-center justify-between text-left"
              [class.mb-4]="expanded()">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
              <path d="M3 12a9 3 0 0 0 18 0"/>
            </svg>
          </span>
          Datos / Respaldo
        </h2>
        <span class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform"
               [class.rotate-180]="expanded()"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>

      @if (expanded()) {
        <div class="space-y-3">
          <!-- Resumen de datos actuales -->
          <div class="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
            <p class="font-semibold text-slate-700 mb-1">Datos actuales</p>
            <p>{{ summaryText() }}</p>
          </div>

          <!-- Exportar -->
          <button type="button" (click)="exportData()"
                  class="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition group">
            <span class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </span>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-semibold text-slate-800">Exportar respaldo</p>
              <p class="text-xs text-slate-500">Descarga un archivo JSON con todos tus datos.</p>
            </div>
          </button>

          <!-- Importar -->
          <button type="button" (click)="triggerImport()"
                  class="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition group">
            <span class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </span>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-semibold text-slate-800">Importar respaldo</p>
              <p class="text-xs text-slate-500">Reemplaza los datos actuales con los de un archivo JSON.</p>
            </div>
          </button>

          <!-- Borrar todo -->
          <button type="button" (click)="clearAll()"
                  class="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 transition group">
            <span class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </span>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-semibold text-slate-800">Borrar todos los datos</p>
              <p class="text-xs text-slate-500">Resetea la app a cero. Requiere doble confirmación.</p>
            </div>
          </button>

          <input #fileInput type="file" accept="application/json,.json" hidden
                 (change)="onFileSelected($event)">
        </div>
      }
    </div>
  `,
})
export class DataBackup {
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
