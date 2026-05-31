import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency, SurchargeMode } from '../../models/card-purchase.model';
import { Subscription } from '../../models/subscription.model';
import { ConfirmService } from '../../services/confirm.service';
import { TransactionsService } from '../../services/transactions.service';
import { InfoTooltip } from '../info-tooltip/info-tooltip';

@Component({
  selector: 'app-subscriptions-manager',
  imports: [CommonModule, FormsModule, InfoTooltip],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <button type="button" (click)="toggleExpanded()"
              class="w-full flex items-center justify-between text-left"
              [class.mb-4]="expanded()">
        <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </span>
          Suscripciones
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {{ activeCount() }}/{{ visibleSubs().length }}
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
        @if (visibleSubs().length === 0) {
          <p class="text-sm text-slate-400 text-center py-4">
            No tenés suscripciones cargadas todavía.
          </p>
        }

        <!-- Lista -->
        @if (visibleSubs().length > 0) {
          <ul class="space-y-2 mb-3">
            @for (s of visibleSubs(); track s.id) {
              <li class="border border-slate-100 rounded-xl p-3 hover:border-pink-200 transition">
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {{ s.description[0]?.toUpperCase() }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-medium text-slate-800 text-sm truncate">{{ s.description }}</p>
                      @if (s.cancelDate) {
                        <span class="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full uppercase">Cancelada</span>
                      } @else {
                        <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase">Activa</span>
                      }
                      @if (s.currency === 'USD') {
                        <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase">USD</span>
                      }
                    </div>
                    <p class="text-[11px] text-slate-400 truncate">
                      {{ cardLabel(s.cardId) }} · día {{ chargeDay(s) }} ·
                      desde {{ s.startDate | date:'dd/MM/yy' }}
                      @if (s.cancelDate) { · cancelada {{ s.cancelDate | date:'dd/MM/yy' }} }
                    </p>
                  </div>
                  <p class="font-semibold text-sm text-rose-600 whitespace-nowrap">
                    {{ s.currency === 'USD' ? 'US$' : '$' }}{{ tx.currentPrice(s) | number:'1.2-2' }}
                  </p>
                </div>

                <!-- Acciones inline -->
                <div class="flex gap-1 mt-2 flex-wrap">
                  <!-- Update price -->
                  @if (priceEditId() === s.id) {
                    <div class="w-full flex items-center gap-2 bg-slate-50 rounded-lg p-2 flex-wrap">
                      <input type="number" min="0" step="0.01"
                             [(ngModel)]="newPriceAmount"
                             placeholder="Nuevo monto"
                             class="flex-1 min-w-[100px] rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                      <span class="flex items-center text-[11px] text-slate-500">
                        desde
                        <app-info-tooltip>
                          <p class="font-semibold mb-1">¿Desde qué fecha?</p>
                          <p class="text-slate-300">
                            Es la fecha desde la cual aplica el nuevo precio
                            <b>en adelante</b>.
                          </p>
                          <p class="text-slate-300 mt-2">
                            Los meses anteriores siguen mostrando el precio que
                            tenían cuando estaban vigentes (el histórico no se
                            toca).
                          </p>
                        </app-info-tooltip>
                      </span>
                      <input type="date"
                             [(ngModel)]="newPriceFrom"
                             class="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                      <button type="button" (click)="savePrice(s.id)"
                              class="px-3 py-1 rounded-lg bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700">
                        Guardar
                      </button>
                      <button type="button" (click)="cancelPriceEdit()"
                              class="px-3 py-1 rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-300">
                        Cancelar
                      </button>
                    </div>
                  } @else if (cancelId() === s.id) {
                    <div class="w-full flex items-center gap-2 bg-slate-50 rounded-lg p-2 flex-wrap">
                      <span class="text-xs text-slate-500 flex items-center">
                        Fecha de cancelación:
                        <app-info-tooltip>
                          <p class="font-semibold mb-1">Fecha de cancelación</p>
                          <p class="text-slate-300">
                            Día efectivo en que diste de baja la suscripción.
                          </p>
                          <p class="text-slate-300 mt-2">
                            Regla: si la cancelación es <b>anterior</b> al día
                            de cobro de ese mes, ese mes no se cobra.
                            Si es <b>el mismo día o posterior</b>, ese mes sí
                            se cobra (ya te lo debitaron).
                          </p>
                          <p class="text-slate-400 text-[11px] mt-2">
                            Ej.: Netflix cobra los 15. Cancelás el 10/05 → mayo no se cobra.
                            Cancelás el 20/05 → mayo sí se cobra.
                          </p>
                        </app-info-tooltip>
                      </span>
                      <input type="date"
                             [(ngModel)]="cancelDateInput"
                             [max]="today"
                             [min]="s.startDate"
                             class="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                      <button type="button" (click)="confirmCancel(s.id)"
                              class="px-3 py-1 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800">
                        Cancelar suscripción
                      </button>
                      <button type="button" (click)="cancelCancel()"
                              class="px-3 py-1 rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-300">
                        Volver
                      </button>
                    </div>
                  } @else {
                    <button type="button" (click)="startPriceEdit(s)"
                            class="text-[11px] font-semibold text-pink-600 hover:bg-pink-50 rounded-lg px-2 py-1 transition">
                      Actualizar precio
                    </button>
                    @if (s.cancelDate) {
                      <button type="button" (click)="reactivate(s.id)"
                              class="text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg px-2 py-1 transition">
                        Reactivar
                      </button>
                    } @else {
                      <button type="button" (click)="startCancel(s)"
                              class="text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1 transition">
                        Cancelar
                      </button>
                    }
                    @if (s.priceHistory.length > 1) {
                      <button type="button" (click)="toggleHistory(s.id)"
                              class="text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1 transition">
                        Historial ({{ s.priceHistory.length }})
                      </button>
                    }
                    <button type="button" (click)="remove(s.id)"
                            class="ml-auto text-slate-300 hover:text-rose-500 transition p-1"
                            title="Eliminar suscripción">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  }
                </div>

                @if (historyId() === s.id) {
                  <ul class="mt-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 space-y-1">
                    @for (p of s.priceHistory; track p.from) {
                      <li class="flex justify-between">
                        <span>desde {{ p.from | date:'dd/MM/yy' }}</span>
                        <span class="font-semibold">
                          {{ s.currency === 'USD' ? 'US$' : '$' }}{{ p.amount | number:'1.2-2' }}
                        </span>
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ul>
        }

        <!-- Form alta -->
        @if (showForm()) {
          @if (tx.cards().length === 0) {
            <p class="text-sm text-slate-400 text-center py-4">
              Primero agregá una tarjeta en la sección "Tarjetas".
            </p>
            <button type="button" (click)="showForm.set(false)"
                    class="w-full py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">
              Cerrar
            </button>
          } @else {
            <form #f="ngForm" (ngSubmit)="submit()" class="border-t border-slate-100 pt-3 space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Tarjeta</label>
                <select name="cardId" [(ngModel)]="cardId" required
                        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500">
                  @for (c of tx.cards(); track c.id) {
                    <option [value]="c.id">{{ tx.cardLabel(c) }}</option>
                  }
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                <input type="text" name="desc" [(ngModel)]="description" required
                       placeholder="Ej: Netflix, Spotify, Gimnasio..."
                       class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Monto mensual</label>
                  <input type="number" name="amount" min="0" step="0.01" [(ngModel)]="amount" required
                         class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
                  <div class="flex bg-slate-100 p-1 rounded-xl">
                    <button type="button" (click)="currency = 'ARS'"
                            class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                            [ngClass]="currency === 'ARS' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
                      ARS
                    </button>
                    <button type="button" (click)="currency = 'USD'"
                            class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                            [ngClass]="currency === 'USD' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
                      USD
                    </button>
                  </div>
                </div>
              </div>

              @if (currency === 'USD') {
                <div>
                  <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                    Tipo de gasto USD
                    <app-info-tooltip>
                      <p class="font-semibold mb-1">Tipo de gasto</p>
                      <p class="text-slate-300">
                        Las suscripciones a Netflix, Spotify, Adobe, etc.
                        son <b>servicios digitales del exterior</b> y tienen
                        un 21% de IVA Servicios Digitales sobre el oficial.
                      </p>
                      <p class="text-slate-300 mt-2">
                        Si vas a pagar el resumen directamente en USD, elegí
                        la otra opción y no se convierte a pesos.
                      </p>
                    </app-info-tooltip>
                  </label>
                  <div class="space-y-1">
                    <button type="button" (click)="surchargeMode = 'digital-service'"
                            class="w-full text-left p-2 rounded-lg border text-xs transition"
                            [ngClass]="surchargeMode === 'digital-service'
                              ? 'border-pink-500 bg-pink-50 text-pink-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                      <b>Servicio digital del exterior (+21% IVA)</b>
                      <span class="block text-slate-400">Netflix, Spotify, Adobe, etc. Lo más común.</span>
                    </button>
                    <button type="button" (click)="surchargeMode = 'auto'"
                            class="w-full text-left p-2 rounded-lg border text-xs transition"
                            [ngClass]="surchargeMode === 'auto'
                              ? 'border-pink-500 bg-pink-50 text-pink-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                      <b>Compra normal (sin IVA)</b>
                      <span class="block text-slate-400">Convierte al oficial sin recargo.</span>
                    </button>
                    <button type="button" (click)="surchargeMode = 'usd-payment'"
                            class="w-full text-left p-2 rounded-lg border text-xs transition"
                            [ngClass]="surchargeMode === 'usd-payment'
                              ? 'border-pink-500 bg-pink-50 text-pink-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                      <b>Pago el resumen en USD</b>
                      <span class="block text-slate-400">No se convierte a pesos.</span>
                    </button>
                  </div>
                </div>
              }

              <div>
                <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  Fecha del primer cobro
                  <app-info-tooltip>
                    <p class="font-semibold mb-1">Fecha del primer cobro</p>
                    <p class="text-slate-300">
                      El <b>día</b> de esta fecha (ej. 15) se convierte en el
                      día fijo de cobro de todos los meses siguientes.
                    </p>
                    <p class="text-slate-300 mt-2">
                      Junto con el cierre de la tarjeta define en qué mes del
                      resumen aparece cada cobro recurrente.
                    </p>
                    <p class="text-slate-400 text-[11px] mt-2">
                      Ej.: fecha 15/05/2026 + cierre 20 → primer cobro aparece
                      en el resumen de junio y se repite cada mes.
                    </p>
                  </app-info-tooltip>
                </label>
                <input type="date" name="start" [(ngModel)]="startDate" required
                       [max]="today"
                       class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
              </div>

              <div class="flex gap-2">
                <button type="button" (click)="cancelAdd()"
                        class="flex-1 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
                  Cancelar
                </button>
                <button type="submit" [disabled]="!f.valid"
                        class="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-pink-600 hover:bg-pink-700 transition disabled:opacity-50">
                  Guardar
                </button>
              </div>
            </form>
          }
        } @else {
          <button type="button" (click)="showForm.set(true)"
                  class="w-full py-2.5 rounded-xl text-sm font-semibold text-pink-600 bg-pink-50 hover:bg-pink-100 transition flex items-center justify-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar suscripción
          </button>
        }
      }
    </div>
  `,
})
export class SubscriptionsManager {
  protected readonly tx = inject(TransactionsService);
  private readonly confirmSvc = inject(ConfirmService);

  private readonly EXPANDED_KEY = 'control-gastos:subs-expanded';
  protected readonly expanded = signal<boolean>(this.loadExpanded());
  protected readonly showForm = signal<boolean>(false);

  protected readonly priceEditId = signal<string | null>(null);
  protected readonly cancelId = signal<string | null>(null);
  protected readonly historyId = signal<string | null>(null);

  protected readonly today = new Date().toISOString().slice(0, 10);

  /** Suscripciones visibles (no archivadas). Las archivadas siguen contando en meses pasados. */
  protected readonly visibleSubs = computed(() =>
    this.tx.subscriptions().filter((s) => !s.archived)
  );

  protected readonly activeCount = computed(
    () => this.visibleSubs().filter((s) => !s.cancelDate).length
  );

  // form alta
  protected cardId = '';
  protected description = '';
  protected amount: number | null = null;
  protected currency: Currency = 'ARS';
  /** Default: 'digital-service' porque la mayoría de las suscripciones USD lo son. */
  protected surchargeMode: SurchargeMode = 'digital-service';
  protected startDate = new Date().toISOString().slice(0, 10);

  // form acciones
  protected newPriceAmount: number | null = null;
  protected newPriceFrom = new Date().toISOString().slice(0, 10);
  protected cancelDateInput = new Date().toISOString().slice(0, 10);

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

  cardLabel(cardId: string): string {
    const c = this.tx.cards().find((x) => x.id === cardId);
    return c ? this.tx.cardLabel(c) : '—';
  }

  chargeDay(s: Subscription): number {
    return Number(s.startDate.split('-')[2]);
  }

  submit(): void {
    if (!this.cardId || !this.description.trim() || !this.amount) return;
    if (this.startDate > this.today) return; // doble validación
    this.tx.addSubscription({
      cardId: this.cardId,
      description: this.description.trim(),
      amount: Number(this.amount),
      currency: this.currency,
      startDate: this.startDate,
      surchargeMode: this.currency === 'USD' ? this.surchargeMode : undefined,
    });
    this.resetForm();
    this.showForm.set(false);
  }

  cancelAdd(): void {
    this.resetForm();
    this.showForm.set(false);
  }

  private resetForm(): void {
    this.cardId = '';
    this.description = '';
    this.amount = null;
    this.currency = 'ARS';
    this.surchargeMode = 'digital-service';
    this.startDate = new Date().toISOString().slice(0, 10);
  }

  startPriceEdit(s: Subscription): void {
    this.priceEditId.set(s.id);
    this.cancelId.set(null);
    this.newPriceAmount = this.tx.currentPrice(s);
    this.newPriceFrom = new Date().toISOString().slice(0, 10);
  }

  cancelPriceEdit(): void {
    this.priceEditId.set(null);
  }

  savePrice(id: string): void {
    if (this.newPriceAmount == null || this.newPriceAmount < 0) return;
    this.tx.addSubscriptionPrice(id, Number(this.newPriceAmount), this.newPriceFrom);
    this.priceEditId.set(null);
  }

  startCancel(s: Subscription): void {
    this.cancelId.set(s.id);
    this.priceEditId.set(null);
    this.cancelDateInput = new Date().toISOString().slice(0, 10);
  }

  cancelCancel(): void {
    this.cancelId.set(null);
  }

  confirmCancel(id: string): void {
    if (this.cancelDateInput > this.today) return; // doble validación
    this.tx.cancelSubscription(id, this.cancelDateInput);
    this.cancelId.set(null);
  }

  reactivate(id: string): void {
    this.tx.reactivateSubscription(id);
  }

  async remove(id: string): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Eliminar suscripción',
      message:
        'Los meses pasados en los que estuvo activa siguen quedando registrados. Sólo se oculta de este panel y deja de generar cobros futuros.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (ok) {
      this.tx.removeSubscription(id);
    }
  }

  toggleHistory(id: string): void {
    this.historyId.update((current) => (current === id ? null : id));
  }
}
