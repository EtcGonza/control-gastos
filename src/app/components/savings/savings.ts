import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency } from '../../models/card-purchase.model';
import { Saving, SavingMovement, SavingMovementType } from '../../models/saving.model';
import { ConfirmService } from '../../services/confirm.service';
import { TransactionsService } from '../../services/transactions.service';

interface MovementRow extends SavingMovement {
  balanceAfter: number;
}

@Component({
  selector: 'app-savings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- ===== Tarjetas resumen ===== -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-slate-500 text-sm font-medium">Ahorros en pesos</span>
            <span class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
          </div>
          <p class="text-2xl font-bold text-slate-800">
            {{ '$' }}{{ tx.savingsTotalArs() | number:'1.2-2' }}
          </p>
          <p class="text-[11px] text-slate-400 mt-1">
            {{ countArs() }} {{ countArs() === 1 ? 'ahorro' : 'ahorros' }}
          </p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-slate-500 text-sm font-medium">Ahorros en USD</span>
            <span class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
          </div>
          <p class="text-2xl font-bold text-slate-800">
            US{{ '$' }} {{ tx.savingsTotalUsd() | number:'1.2-2' }}
          </p>
          <p class="text-[11px] text-slate-400 mt-1">
            {{ countUsd() }} {{ countUsd() === 1 ? 'ahorro' : 'ahorros' }}
          </p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-slate-500 text-sm font-medium">USD en pesos</span>
            <span class="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 1l4 4-4 4"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 23l-4-4 4-4"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </span>
          </div>
          <p class="text-2xl font-bold text-amber-700">
            ≈ {{ '$' }}{{ tx.savingsTotalUsdInArs() | number:'1.2-2' }}
          </p>
          @if (tx.latestRate(); as r) {
            <p class="text-[11px] text-slate-400 mt-1">
              TC {{ '$' }}{{ r.rate | number:'1.2-2' }} del {{ r.date | date:'dd/MM' }}
            </p>
          } @else {
            <p class="text-[11px] text-slate-400 mt-1">Cargando cotización…</p>
          }
        </div>

        <div class="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-indigo-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-indigo-700 text-sm font-semibold">Total en pesos</span>
            <span class="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="20" x2="12" y2="10"/>
                <line x1="18" y1="20" x2="18" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="16"/>
              </svg>
            </span>
          </div>
          <p class="text-2xl font-bold text-indigo-900">
            {{ '$' }}{{ tx.savingsGrandTotalArs() | number:'1.2-2' }}
          </p>
          <p class="text-[11px] text-indigo-600/70 mt-1">
            ARS directos + USD convertidos
          </p>
        </div>
      </div>

      <!-- ===== Form de alta ===== -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </span>
          Agregar ahorro
        </h3>
        <form #f="ngForm" (ngSubmit)="add()" class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-5">
            <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <input type="text" name="description" [(ngModel)]="newDescription" required
                   placeholder="Ej: Caja de ahorro BBVA, Plazo fijo, Dólares MEP..."
                   class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
          <div class="md:col-span-3">
            <label class="block text-xs font-medium text-slate-600 mb-1">Monto inicial</label>
            <input type="number" name="amount" min="0" step="0.01" [(ngModel)]="newAmount" required
                   class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
            <div class="flex bg-slate-100 p-1 rounded-xl">
              <button type="button" (click)="newCurrency = 'ARS'"
                      class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                      [ngClass]="newCurrency === 'ARS' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
                ARS
              </button>
              <button type="button" (click)="newCurrency = 'USD'"
                      class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                      [ngClass]="newCurrency === 'USD' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
                USD
              </button>
            </div>
          </div>
          <div class="md:col-span-2 flex items-end">
            <button type="submit" [disabled]="!f.valid"
                    class="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
              Agregar
            </button>
          </div>
        </form>
      </div>

      <!-- ===== Lista ===== -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-800">Mis ahorros</h3>
          <span class="text-xs text-slate-400">{{ tx.savings().length }} registros</span>
        </div>

        @if (tx.savings().length === 0) {
          <div class="text-center py-10 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <circle cx="12" cy="12" r="2"/>
              <path d="M6 12h.01M18 12h.01"/>
            </svg>
            <p class="text-sm">No tenés ahorros cargados todavía.</p>
            <p class="text-xs">Usá el formulario de arriba para agregar el primero.</p>
          </div>
        } @else {
          <ul class="divide-y divide-slate-100 -mx-2">
            @for (s of tx.savings(); track s.id) {
              <li class="px-2 py-3">
                <!-- ===== Fila principal ===== -->
                <div class="flex items-center gap-3">
                  <span class="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                        [ngClass]="s.currency === 'USD' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'">
                    {{ s.currency === 'USD' ? 'US$' : '$' }}
                  </span>

                  <div class="flex-1 min-w-0">
                    @if (editingId() === s.id) {
                      <input type="text" [(ngModel)]="editDescription"
                             (keydown.enter)="saveEdit(s.id)"
                             (keydown.escape)="cancelEdit()"
                             class="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    } @else {
                      <p class="font-medium text-slate-800 truncate">{{ s.description }}</p>
                      <p class="text-[11px] text-slate-400">
                        {{ (s.movements?.length ?? 0) }} {{ (s.movements?.length ?? 0) === 1 ? 'movimiento' : 'movimientos' }}
                        · actualizado {{ s.updatedAt | date:'dd MMM yy' }}
                      </p>
                    }
                  </div>

                  <div class="text-right whitespace-nowrap">
                    <p class="font-semibold text-slate-800">
                      {{ s.currency === 'USD' ? 'US$' : '$' }}{{ s.amount | number:'1.2-2' }}
                    </p>
                    @if (s.currency === 'USD' && tx.latestRate(); as r) {
                      <p class="text-[11px] text-slate-400">
                        ≈ {{ '$' }}{{ s.amount * r.rate | number:'1.0-0' }} ARS
                      </p>
                    }
                  </div>

                  <div class="flex items-center gap-0.5 flex-shrink-0">
                    @if (editingId() === s.id) {
                      <button type="button" (click)="saveEdit(s.id)"
                              class="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                              title="Guardar">✓</button>
                      <button type="button" (click)="cancelEdit()"
                              class="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition"
                              title="Cancelar">✕</button>
                    } @else {
                      <button type="button" (click)="toggleExpanded(s.id)"
                              class="text-slate-400 hover:text-indigo-600 transition p-1.5"
                              [title]="expandedId() === s.id ? 'Ocultar movimientos' : 'Ver movimientos'">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform"
                             [class.rotate-180]="expandedId() === s.id"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      <button type="button" (click)="startEdit(s)"
                              class="text-slate-400 hover:text-indigo-600 transition p-1.5"
                              title="Editar descripción">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
                        </svg>
                      </button>
                      <button type="button" (click)="remove(s)"
                              class="text-slate-300 hover:text-rose-500 transition p-1.5"
                              title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    }
                  </div>
                </div>

                <!-- ===== Panel expandido: movimientos ===== -->
                @if (expandedId() === s.id) {
                  <div class="mt-3 pt-3 border-t border-slate-100 ml-12 space-y-4">

                    <!-- Lista de movimientos -->
                    <div>
                      <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Historial de movimientos
                      </h4>
                      @if (movementsOf(s).length === 0) {
                        <p class="text-xs text-slate-400 py-2">
                          Sin movimientos registrados todavía.
                        </p>
                      } @else {
                        <ul class="space-y-1.5">
                          @for (m of movementsOf(s); track m.id) {
                            <li class="flex items-center gap-2 text-xs py-1 group">
                              <span class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                    [ngClass]="m.type === 'deposit'
                                      ? 'bg-emerald-100 text-emerald-600'
                                      : 'bg-rose-100 text-rose-600'">
                                @if (m.type === 'deposit') {
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                                } @else {
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                                }
                              </span>
                              <span class="text-slate-400 font-medium tabular-nums whitespace-nowrap">
                                {{ m.date | date:'dd/MM/yy' }}
                              </span>
                              <span class="font-semibold whitespace-nowrap"
                                    [ngClass]="m.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'">
                                {{ m.type === 'deposit' ? '+' : '-' }}{{ s.currency === 'USD' ? 'US$' : '$' }}{{ m.amount | number:'1.2-2' }}
                              </span>
                              @if (m.description) {
                                <span class="text-slate-500 truncate">· {{ m.description }}</span>
                              }
                              <span class="ml-auto text-slate-400 whitespace-nowrap">
                                saldo: {{ s.currency === 'USD' ? 'US$' : '$' }}{{ m.balanceAfter | number:'1.2-2' }}
                              </span>
                              <button type="button" (click)="removeMovement(s, m)"
                                      class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition p-0.5"
                                      title="Eliminar movimiento">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </li>
                          }
                        </ul>
                      }
                    </div>

                    <!-- Form para agregar movimiento -->
                    <div class="bg-slate-50 rounded-xl p-3">
                      <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Agregar movimiento
                      </h4>
                      <form #mf="ngForm" (ngSubmit)="addMovement(s.id)" class="grid grid-cols-12 gap-2">
                        <div class="col-span-12 sm:col-span-3">
                          <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Fecha</label>
                          <input type="date" name="mDate" [(ngModel)]="movementDate" required
                                 [max]="today"
                                 class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div class="col-span-12 sm:col-span-3">
                          <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Tipo</label>
                          <div class="flex bg-white p-0.5 rounded-lg border border-slate-200">
                            <button type="button" (click)="movementType = 'deposit'"
                                    class="flex-1 py-1 rounded-md text-[11px] font-semibold transition"
                                    [ngClass]="movementType === 'deposit' ? 'bg-emerald-600 text-white' : 'text-slate-500'">
                              Depósito
                            </button>
                            <button type="button" (click)="movementType = 'withdrawal'"
                                    class="flex-1 py-1 rounded-md text-[11px] font-semibold transition"
                                    [ngClass]="movementType === 'withdrawal' ? 'bg-rose-600 text-white' : 'text-slate-500'">
                              Retiro
                            </button>
                          </div>
                        </div>
                        <div class="col-span-6 sm:col-span-2">
                          <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Monto</label>
                          <input type="number" name="mAmount" min="0.01" step="0.01" [(ngModel)]="movementAmount" required
                                 class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div class="col-span-12 sm:col-span-3">
                          <label class="block text-[10px] font-medium text-slate-500 mb-0.5">Descripción <span class="text-slate-400">(opcional)</span></label>
                          <input type="text" name="mDesc" [(ngModel)]="movementDescription"
                                 placeholder="Ej: gasto urgente"
                                 class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div class="col-span-6 sm:col-span-1 flex items-end">
                          <button type="submit" [disabled]="!mf.valid"
                                  class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-50">
                            Agregar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class Savings {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  protected readonly today = new Date().toISOString().slice(0, 10);

  // ----- form de alta del ahorro -----
  protected newDescription = '';
  protected newAmount: number | null = null;
  protected newCurrency: Currency = 'ARS';

  // ----- edición de descripción del ahorro -----
  protected readonly editingId = signal<string | null>(null);
  protected editDescription = '';

  // ----- expansión de movimientos -----
  protected readonly expandedId = signal<string | null>(null);

  // ----- form de movimiento -----
  protected movementType: SavingMovementType = 'withdrawal';
  protected movementAmount: number | null = null;
  protected movementDate = this.today;
  protected movementDescription = '';

  protected readonly countArs = computed(
    () => this.tx.savings().filter((s) => s.currency === 'ARS').length
  );
  protected readonly countUsd = computed(
    () => this.tx.savings().filter((s) => s.currency === 'USD').length
  );

  /** Movimientos de un ahorro con saldo acumulado, ordenados de más nuevo a más viejo. */
  movementsOf(s: Saving): MovementRow[] {
    const raw = s.movements ?? [];
    // Ordenamos cronológicamente ascendente para acumular saldo
    const sorted = [...raw].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt)
    );
    let balance = 0;
    const withBalance: MovementRow[] = sorted.map((m) => {
      balance += m.type === 'deposit' ? m.amount : -m.amount;
      return { ...m, balanceAfter: balance };
    });
    // Devolvemos descendente (más nuevo arriba)
    return withBalance.reverse();
  }

  // ============ Alta de ahorro ============

  add(): void {
    if (!this.newDescription.trim() || this.newAmount == null || this.newAmount < 0) return;
    this.tx.addSaving({
      description: this.newDescription,
      amount: Number(this.newAmount),
      currency: this.newCurrency,
    });
    this.newDescription = '';
    this.newAmount = null;
    this.newCurrency = 'ARS';
  }

  // ============ Edición de descripción ============

  startEdit(s: Saving): void {
    this.editingId.set(s.id);
    this.editDescription = s.description;
    // Si está en modo edición, cerramos el panel expandido
    this.expandedId.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(id: string): void {
    if (!this.editDescription.trim()) return;
    this.tx.updateSaving(id, { description: this.editDescription });
    this.editingId.set(null);
  }

  async remove(s: Saving): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar ahorro',
      message: `¿Eliminar "${s.description}" y todo su historial de movimientos? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) this.tx.removeSaving(s.id);
  }

  // ============ Expansión + movimientos ============

  toggleExpanded(id: string): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
    // Si estamos editando otro, salimos del modo edición
    if (this.editingId() !== null) this.editingId.set(null);
    // Reset del form de movimiento al abrir
    this.movementType = 'withdrawal';
    this.movementAmount = null;
    this.movementDate = this.today;
    this.movementDescription = '';
  }

  addMovement(savingId: string): void {
    if (this.movementAmount == null || this.movementAmount <= 0) return;
    if (this.movementDate > this.today) return;
    this.tx.addSavingMovement(savingId, {
      type: this.movementType,
      amount: Number(this.movementAmount),
      date: this.movementDate,
      description: this.movementDescription,
    });
    // Reset
    this.movementAmount = null;
    this.movementDescription = '';
  }

  async removeMovement(s: Saving, m: SavingMovement): Promise<void> {
    const action = m.type === 'deposit' ? 'depósito' : 'retiro';
    const sign = m.type === 'deposit' ? '+' : '-';
    const curSym = s.currency === 'USD' ? 'US$' : '$';
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar movimiento',
      message: `¿Eliminar el ${action} de ${sign}${curSym}${m.amount.toFixed(2)} del ${new Date(m.date + 'T00:00').toLocaleDateString('es-AR')}? El saldo se ajusta automáticamente.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) this.tx.removeSavingMovement(s.id, m.id);
  }
}
