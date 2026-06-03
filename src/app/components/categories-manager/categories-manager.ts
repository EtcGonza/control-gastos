import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomCategory, CustomCategoryType } from '../../models/custom-category.model';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '../../models/transaction.model';
import { ConfirmService } from '../../services/confirm.service';
import { TransactionsService } from '../../services/transactions.service';

const DEFAULT_COLOR_PALETTE = [
  '#a855f7', '#06b6d4', '#f472b6', '#84cc16', '#eab308',
  '#ef4444', '#0ea5e9', '#22c55e', '#f97316', '#8b5cf6',
];

@Component({
  selector: 'app-categories-manager',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </span>
          Categorías
        </h2>
        <span class="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
          {{ activeCustoms().length }}
        </span>
      </div>

      <!-- Tabs: Gastos / Ingresos -->
      <div class="flex gap-1 mb-3 bg-slate-100 p-1 rounded-xl text-xs font-medium">
        <button type="button" (click)="activeTab.set('expense')"
                class="flex-1 py-1.5 rounded-lg transition"
                [ngClass]="activeTab() === 'expense' ? 'bg-white shadow text-rose-600' : 'text-slate-500'">
          Gastos / Tarjeta
        </button>
        <button type="button" (click)="activeTab.set('income')"
                class="flex-1 py-1.5 rounded-lg transition"
                [ngClass]="activeTab() === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'">
          Ingresos
        </button>
      </div>

      <!-- Defaults + customs activas -->
      <div class="space-y-1.5 mb-3">
        @for (cat of defaultsForTab(); track cat.id) {
          <div class="flex items-center gap-2 px-2 py-1.5 text-xs">
            <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="cat.color"></span>
            <span class="flex-1 text-slate-700">{{ cat.name }}</span>
            <span class="text-[10px] text-slate-400 uppercase">Default</span>
          </div>
        }

        @for (cat of activeCustomsForTab(); track cat.id) {
          <div class="px-2 py-1.5">
            @if (editingId() === cat.id) {
              <!-- Modo edición inline -->
              <div class="flex items-center gap-2">
                <input type="color" [(ngModel)]="editColor" name="editColor-{{ cat.id }}"
                       class="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer flex-shrink-0">
                <input type="text" [(ngModel)]="editName" name="editName-{{ cat.id }}"
                       (keydown.enter)="saveEdit(cat.id)"
                       (keydown.escape)="cancelEdit()"
                       maxlength="30"
                       class="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                <button type="button" (click)="saveEdit(cat.id)"
                        class="px-2 py-1 rounded-lg bg-fuchsia-600 text-white text-xs font-semibold hover:bg-fuchsia-700">
                  ✓
                </button>
                <button type="button" (click)="cancelEdit()"
                        class="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">
                  ✕
                </button>
              </div>
              @if (editError()) {
                <p class="text-[11px] text-rose-600 mt-1 ml-9">{{ editError() }}</p>
              }
            } @else {
              <div class="flex items-center gap-2 text-xs group">
                <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="cat.color"></span>
                <span class="flex-1 text-slate-700">{{ cat.name }}</span>
                <button type="button" (click)="startEdit(cat)"
                        class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-fuchsia-600 transition p-0.5"
                        title="Editar nombre y color">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                </button>
                <button type="button" (click)="archive(cat)"
                        class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-600 transition p-0.5"
                        title="Archivar (los registros existentes mantienen la categoría)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8"/>
                    <rect x="1" y="3" width="22" height="5"/>
                    <line x1="10" y1="12" x2="14" y2="12"/>
                  </svg>
                </button>
              </div>
            }
          </div>
        }

        @if (activeCustomsForTab().length === 0 && archivedCustomsForTab().length === 0) {
          <p class="text-[11px] text-slate-400 italic px-2 py-1">
            No tenés categorías personalizadas en esta sección.
          </p>
        }
      </div>

      <!-- Toggle archivadas -->
      @if (archivedCustomsForTab().length > 0) {
        <button type="button" (click)="showArchived.update(v => !v)"
                class="w-full mb-3 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition flex items-center justify-center gap-1.5 py-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 transition-transform"
               [class.rotate-180]="showArchived()"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {{ showArchived() ? 'Ocultar' : 'Ver' }} archivadas ({{ archivedCustomsForTab().length }})
        </button>

        @if (showArchived()) {
          <div class="space-y-1.5 mb-3 bg-slate-50 rounded-xl p-2">
            @for (cat of archivedCustomsForTab(); track cat.id) {
              <div class="flex items-center gap-2 px-2 py-1.5 text-xs group">
                <span class="w-3 h-3 rounded-full flex-shrink-0 opacity-50" [style.background-color]="cat.color"></span>
                <span class="flex-1 text-slate-500 line-through">{{ cat.name }}</span>
                <button type="button" (click)="reactivate(cat)"
                        class="text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded px-2 py-0.5 transition">
                  Reactivar
                </button>
              </div>
            }
          </div>
        }
      }

      <!-- Form de alta inline -->
      <form (ngSubmit)="add()" #f="ngForm" class="border-t border-slate-100 pt-3 flex items-center gap-2">
        <input type="color" [(ngModel)]="newColor" name="color"
               class="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer flex-shrink-0"
               title="Color de la categoría">
        <input type="text" [(ngModel)]="newName" name="name" required
               maxlength="30"
               placeholder="Nombre de la categoría"
               class="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
        <button type="submit" [disabled]="!f.valid || !canAdd()"
                class="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-fuchsia-600 hover:bg-fuchsia-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
          Agregar
        </button>
      </form>

      @if (error()) {
        <p class="text-[11px] text-rose-600 mt-2">{{ error() }}</p>
      }

      <p class="text-[11px] text-slate-400 mt-3">
        Archivar una categoría la oculta del selector de nuevas operaciones pero <b>conserva todos los registros</b> que ya la referenciaban. La podés reactivar en cualquier momento.
      </p>
    </div>
  `,
})
export class CategoriesManager {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  protected readonly activeTab = signal<CustomCategoryType>('expense');
  protected readonly showArchived = signal<boolean>(false);

  // ---- form alta ----
  protected newName = '';
  protected newColor = DEFAULT_COLOR_PALETTE[0];
  protected readonly error = signal<string | null>(null);

  // ---- edit inline ----
  protected readonly editingId = signal<string | null>(null);
  protected editName = '';
  protected editColor = DEFAULT_COLOR_PALETTE[0];
  protected readonly editError = signal<string | null>(null);

  protected readonly defaultsForTab = computed(() =>
    this.activeTab() === 'expense'
      ? DEFAULT_EXPENSE_CATEGORIES
      : DEFAULT_INCOME_CATEGORIES
  );

  protected readonly activeCustoms = computed(() =>
    this.tx.customCategories().filter((c) => !c.archived)
  );

  protected readonly activeCustomsForTab = computed(() =>
    this.tx.customCategories().filter((c) => c.type === this.activeTab() && !c.archived)
  );

  protected readonly archivedCustomsForTab = computed(() =>
    this.tx.customCategories().filter((c) => c.type === this.activeTab() && c.archived)
  );

  protected canAdd(): boolean {
    return this.newName.trim().length > 0;
  }

  add(): void {
    this.error.set(null);
    const result = this.tx.addCustomCategory({
      name: this.newName,
      type: this.activeTab(),
      color: this.newColor,
    });
    if (!result) {
      this.error.set('Ya existe una categoría con ese nombre.');
      return;
    }
    this.newName = '';
    // Rotar color para la próxima
    const used = this.tx.customCategories().map((c) => c.color.toLowerCase());
    const next = DEFAULT_COLOR_PALETTE.find((c) => !used.includes(c.toLowerCase()));
    this.newColor = next ?? DEFAULT_COLOR_PALETTE[0];
  }

  startEdit(cat: CustomCategory): void {
    this.editingId.set(cat.id);
    this.editName = cat.name;
    this.editColor = cat.color;
    this.editError.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  saveEdit(id: string): void {
    this.editError.set(null);
    if (!this.editName.trim()) {
      this.editError.set('El nombre no puede estar vacío.');
      return;
    }
    const ok = this.tx.updateCustomCategory(id, {
      name: this.editName,
      color: this.editColor,
    });
    if (!ok) {
      this.editError.set('Ya existe otra categoría con ese nombre.');
      return;
    }
    this.editingId.set(null);
  }

  async archive(cat: CustomCategory): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Archivar categoría',
      message: `¿Archivar la categoría "${cat.name}"? Ya no va a aparecer en los selectores para nuevas operaciones, pero todos los registros que ya la usan la siguen mostrando normalmente. La podés reactivar más adelante.`,
      confirmText: 'Archivar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeCustomCategory(cat.id);
    }
  }

  reactivate(cat: CustomCategory): void {
    this.tx.reactivateCustomCategory(cat.id);
  }
}
