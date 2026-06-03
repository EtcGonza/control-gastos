import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardBrand, CreditCard } from '../../core/models/credit-card/credit-card.model';
import { ConfirmService } from '../../services/confirm.service';
import { TransactionsService } from '../../services/transactions.service';
import { InfoTooltip } from '../info-tooltip/info-tooltip';

@Component({
  selector: 'app-cards-manager',
  imports: [CommonModule, FormsModule, InfoTooltip],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <button type="button" (click)="toggleExpanded()"
              class="w-full flex items-center justify-between text-left"
              [class.mb-4]="expanded()">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </span>
          Tarjetas
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {{ tx.cards().length }}
          </span>
          <span class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform"
                 [class.rotate-180]="expanded()"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </button>

      @if (expanded()) {
        <!-- Lista de tarjetas -->
        @if (tx.cards().length > 0) {
          <ul class="space-y-2 mb-3">
            @for (c of tx.cards(); track c.id) {
              <li class="border border-slate-100 rounded-xl p-3 hover:border-purple-200 transition">
                @if (editingId() === c.id) {
                  <!-- ========= Edit Form ========= -->
                  @if (showConflictPanel()) {
                    <!-- Panel de elección retroactivo / sólo futuro -->
                    <div class="space-y-3">
                      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p class="text-sm font-semibold text-amber-900 mb-1">
                          Cambiaste el día de cierre
                        </p>
                        <p class="text-xs text-amber-800">
                          La tarjeta tiene compras o suscripciones cargadas.
                          ¿Cómo querés aplicar el nuevo cierre?
                        </p>
                      </div>
                      <div class="space-y-2">
                        <button type="button" (click)="confirmEdit(c, 'retroactive')"
                                class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition">
                          <p class="text-sm font-semibold text-slate-800">Aplicar retroactivamente</p>
                          <p class="text-xs text-slate-500 mt-0.5">
                            Recomputa todos los meses (pasados y futuros) con el nuevo cierre.
                            Útil si cargaste mal el cierre desde el principio.
                          </p>
                        </button>
                        <button type="button" (click)="confirmEdit(c, 'future')"
                                class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition">
                          <p class="text-sm font-semibold text-slate-800">Aplicar sólo a futuro</p>
                          <p class="text-xs text-slate-500 mt-0.5">
                            Las compras y suscripciones ya cargadas conservan el cierre anterior
                            ({{ originalClosingDay() }}). El nuevo cierre aplica sólo a movimientos nuevos.
                          </p>
                        </button>
                        <button type="button" (click)="cancelConflict()"
                                class="w-full py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
                          Volver
                        </button>
                      </div>
                    </div>
                  } @else {
                    <form #ef="ngForm" (ngSubmit)="saveEdit(c)" class="space-y-3">
                      <div class="grid grid-cols-2 gap-2">
                        <button type="button" (click)="editBrand = 'Visa'"
                                class="py-2 rounded-lg text-xs font-bold transition border"
                                [ngClass]="editBrand === 'Visa'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'">
                          VISA
                        </button>
                        <button type="button" (click)="editBrand = 'Mastercard'"
                                class="py-2 rounded-lg text-xs font-bold transition border"
                                [ngClass]="editBrand === 'Mastercard'
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'">
                          MASTERCARD
                        </button>
                      </div>

                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Banco</label>
                        <input type="text" name="ebank" [(ngModel)]="editBank" required
                               class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      </div>

                      <div>
                        <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                          Día de cierre
                          <app-info-tooltip>
                            <p class="font-semibold mb-1">Día de cierre</p>
                            <p class="text-slate-300">
                              Cambiar este valor afecta en qué mes aparecen las cuotas
                              y suscripciones. Si la tarjeta tiene movimientos, te vamos
                              a preguntar si aplicar el cambio retroactivamente o sólo a
                              partir de futuros movimientos.
                            </p>
                          </app-info-tooltip>
                        </label>
                        <input type="number" name="eclose" [(ngModel)]="editClosingDay" required min="1" max="31"
                               class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      </div>

                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">
                          Alias / notas <span class="text-slate-400">(opcional)</span>
                        </label>
                        <input type="text" name="enotes" [(ngModel)]="editNotes"
                               class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      </div>

                      <div class="flex gap-2">
                        <button type="button" (click)="cancelEdit()"
                                class="flex-1 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
                          Cancelar
                        </button>
                        <button type="submit" [disabled]="!ef.valid"
                                class="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
                          Guardar cambios
                        </button>
                      </div>
                    </form>
                  }
                } @else {
                  <!-- ========= Vista normal ========= -->
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-xl text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                          [ngClass]="c.brand === 'Visa' ? 'bg-blue-600' : 'bg-orange-500'">
                      {{ c.brand === 'Visa' ? 'VISA' : 'MC' }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-slate-800 text-sm truncate">{{ c.bank }}</p>
                      <p class="text-[11px] text-slate-400 truncate">
                        Cierra día {{ c.closingDay }}
                        @if (c.notes) { · {{ c.notes }} }
                      </p>
                    </div>
                    <button type="button" (click)="startEdit(c)"
                            class="text-slate-400 hover:text-purple-600 transition p-1.5"
                            title="Editar">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button type="button" (click)="remove(c.id)"
                            class="text-slate-300 hover:text-rose-500 transition p-1.5"
                            title="Eliminar tarjeta (también borra sus compras y suscripciones)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                }
              </li>
            }
          </ul>
        }

        <!-- Form alta -->
        @if (showForm()) {
          <form #f="ngForm" (ngSubmit)="submit()" class="border-t border-slate-100 pt-3 space-y-3">
            <div class="grid grid-cols-2 gap-2">
              <button type="button" (click)="brand = 'Visa'"
                      class="py-2 rounded-lg text-xs font-bold transition border"
                      [ngClass]="brand === 'Visa'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'">
                VISA
              </button>
              <button type="button" (click)="brand = 'Mastercard'"
                      class="py-2 rounded-lg text-xs font-bold transition border"
                      [ngClass]="brand === 'Mastercard'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'">
                MASTERCARD
              </button>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Banco</label>
              <input type="text" name="bank" [(ngModel)]="bank" required
                     placeholder="Ej: Galicia, Santander..."
                     class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>

            <div>
              <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                Día de cierre
                <app-info-tooltip>
                  <p class="font-semibold mb-1">Día de cierre</p>
                  <p class="text-slate-300">
                    Es el día del mes en que <b>cierra el resumen</b> de la tarjeta
                    (no confundir con el día de vencimiento o pago).
                  </p>
                  <p class="text-slate-300 mt-2">
                    Sirve para saber en qué mes va a aparecer cada compra:
                    compras anteriores al cierre entran en ese resumen, las
                    posteriores pasan al siguiente período.
                  </p>
                  <p class="text-slate-400 text-[11px] mt-2">
                    Ej.: si la tarjeta cierra el 20 y comprás el 19 de mayo,
                    la cuota aparece en junio.
                  </p>
                </app-info-tooltip>
              </label>
              <input type="number" name="closingDay" [(ngModel)]="closingDay" required min="1" max="31"
                     class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                Alias / notas <span class="text-slate-400">(opcional)</span>
              </label>
              <input type="text" name="notes" [(ngModel)]="notes"
                     placeholder="Ej: terminada en 4521, mi visa personal..."
                     class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>

            <div class="flex gap-2">
              <button type="button" (click)="cancel()"
                      class="flex-1 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
                Cancelar
              </button>
              <button type="submit" [disabled]="!f.valid"
                      class="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
                Guardar
              </button>
            </div>
          </form>
        } @else if (!editingId()) {
          <button type="button" (click)="openAddForm()"
                  class="w-full py-2.5 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition flex items-center justify-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar tarjeta
          </button>
        }
      }
    </div>
  `,
})
export class CardsManager {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  private readonly EXPANDED_KEY = 'control-gastos:cards-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());
  protected readonly showForm = signal<boolean>(false);

  // ---- form alta ----
  protected brand: CardBrand = 'Visa';
  protected bank = '';
  protected closingDay: number | null = null;
  protected notes = '';

  // ---- form edición ----
  protected readonly editingId = signal<string | null>(null);
  protected readonly showConflictPanel = signal<boolean>(false);
  protected readonly originalClosingDay = signal<number | null>(null);
  protected editBrand: CardBrand = 'Visa';
  protected editBank = '';
  protected editClosingDay: number | null = null;
  protected editNotes = '';

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

  // ============ Alta ============

  openAddForm(): void {
    this.cancelEdit();
    this.showForm.set(true);
  }

  submit(): void {
    if (!this.bank.trim() || !this.closingDay) return;
    this.tx.addCard({
      brand: this.brand,
      bank: this.bank.trim(),
      closingDay: Number(this.closingDay),
      notes: this.notes.trim() || undefined,
    });
    this.resetAdd();
    this.showForm.set(false);
  }

  cancel(): void {
    this.resetAdd();
    this.showForm.set(false);
  }

  private resetAdd(): void {
    this.brand = 'Visa';
    this.bank = '';
    this.closingDay = null;
    this.notes = '';
  }

  // ============ Edición ============

  startEdit(card: CreditCard): void {
    this.showForm.set(false);
    this.editingId.set(card.id);
    this.showConflictPanel.set(false);
    this.editBrand = card.brand;
    this.editBank = card.bank;
    this.editClosingDay = card.closingDay;
    this.editNotes = card.notes ?? '';
    this.originalClosingDay.set(card.closingDay);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.showConflictPanel.set(false);
    this.originalClosingDay.set(null);
  }

  cancelConflict(): void {
    this.showConflictPanel.set(false);
  }

  saveEdit(card: CreditCard): void {
    if (!this.editBank.trim() || !this.editClosingDay) return;
    const newClosingDay = Number(this.editClosingDay);
    const closingDayChanged = newClosingDay !== card.closingDay;
    const hasData = this.tx.cardHasEntries(card.id);

    if (closingDayChanged && hasData) {
      this.showConflictPanel.set(true);
      return;
    }

    // sin conflicto: guardar directo (modo no afecta porque no hay data o
    // no cambió el cierre)
    this.confirmEdit(card, 'retroactive');
  }

  confirmEdit(card: CreditCard, mode: 'retroactive' | 'future'): void {
    this.tx.updateCard(
      card.id,
      {
        brand: this.editBrand,
        bank: this.editBank.trim(),
        closingDay: Number(this.editClosingDay),
        notes: this.editNotes.trim() || undefined,
      },
      mode
    );
    this.cancelEdit();
  }

  async remove(id: string): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar tarjeta',
      message:
        'Al eliminar esta tarjeta también se borran todas las compras y suscripciones asociadas. ¿Querés continuar?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeCard(id);
    }
  }
}
