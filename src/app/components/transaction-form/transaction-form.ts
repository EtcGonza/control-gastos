import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Currency, SurchargeMode } from '../../models/card-purchase.model';
import {
  Category,
  FALLBACK_EXPENSE_CATEGORY_ID,
  TransactionType,
} from '../../models/transaction.model';
import { CategoryView, TransactionsService } from '../../services/transactions.service';
import { InfoTooltip } from '../info-tooltip/info-tooltip';

type FormMode = TransactionType | 'tarjeta';

@Component({
  selector: 'app-transaction-form',
  imports: [CommonModule, FormsModule, InfoTooltip],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        Nueva operación
      </h2>

      <!-- Tabs -->
      <div class="grid grid-cols-3 gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
        <button type="button" (click)="setMode('ingreso')"
                class="py-2 rounded-lg text-xs font-semibold transition"
                [ngClass]="mode() === 'ingreso' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'">
          Ingreso
        </button>
        <button type="button" (click)="setMode('gasto')"
                class="py-2 rounded-lg text-xs font-semibold transition"
                [ngClass]="mode() === 'gasto' ? 'bg-white shadow text-rose-600' : 'text-slate-500'">
          Gasto
        </button>
        <button type="button" (click)="setMode('tarjeta')"
                class="py-2 rounded-lg text-xs font-semibold transition"
                [ngClass]="mode() === 'tarjeta' ? 'bg-white shadow text-purple-600' : 'text-slate-500'">
          Tarjeta
        </button>
      </div>

      @if (mode() !== 'tarjeta') {
        <!-- ====== Form normal (ingreso/gasto) ====== -->
        <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <input type="text" name="description" [(ngModel)]="description" required
                   placeholder="Ej: Alquiler, Sueldo, Supermercado..."
                   class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Monto</label>
              <input type="number" name="amount" min="0" step="0.01" [(ngModel)]="amount" required
                     class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input type="date" name="date" [(ngModel)]="date" required
                     class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
            <select name="category" [(ngModel)]="category" required
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              @for (cat of currentCategories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>

          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="fixed" [(ngModel)]="fixed"
                   class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
            <span class="text-sm text-slate-600 flex items-center">
              Es {{ mode() === 'ingreso' ? 'un ingreso' : 'un gasto' }} fijo mensual
              <app-info-tooltip>
                <p class="font-semibold mb-1">¿Qué significa "fijo"?</p>
                <p class="text-slate-300">
                  Es algo que se repite todos los meses (alquiler, sueldo, etc.).
                  Al marcarlo:
                </p>
                <ul class="text-slate-300 mt-1 pl-3 list-disc">
                  <li>Se guarda como <b>plantilla</b> en "Fijos guardados" para cargarlo rápido en otros meses.</li>
                  <li>Suma al porcentaje de <b>"Gastos fijos / ingresos"</b> del mes.</li>
                </ul>
              </app-info-tooltip>
            </span>
          </label>

          <button type="submit" [disabled]="!f.valid"
                  class="w-full mt-2 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50"
                  [ngClass]="mode() === 'ingreso' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'">
            Agregar {{ mode() === 'ingreso' ? 'ingreso' : 'gasto' }}
          </button>
        </form>
      } @else {
        <!-- ====== Form Tarjeta ====== -->
        @if (tx.cards().length === 0) {
          <div class="text-center py-6 text-slate-400">
            <p class="text-sm">Todavía no tenés tarjetas cargadas.</p>
            <p class="text-xs mt-1">Agregalas en la sección "Tarjetas".</p>
          </div>
        } @else {
          <form (ngSubmit)="submitPurchase()" #fc="ngForm" class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Tarjeta</label>
              <select name="cardId" [(ngModel)]="cardId" required
                      class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                @for (c of tx.cards(); track c.id) {
                  <option [value]="c.id">{{ tx.cardLabel(c) }}</option>
                }
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <input type="text" name="cdesc" [(ngModel)]="cDescription" required
                     placeholder="Ej: Nintendo Switch, vuelo, etc."
                     class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  Total a pagar
                  <app-info-tooltip>
                    <p class="font-semibold mb-1">Total a pagar</p>
                    <p class="text-slate-300">
                      Es el <b>monto total que te va a debitar la tarjeta</b>
                      (suma de todas las cuotas), incluyendo intereses si la
                      compra los tiene.
                    </p>
                    <p class="text-slate-300 mt-2">
                      <b>No ingreses sólo el precio del producto</b> si después
                      se le suman intereses: el sistema divide este monto en
                      cuotas iguales, así coincide con el resumen del banco.
                    </p>
                    <p class="text-slate-400 text-[11px] mt-2">
                      Ej.: Nintendo Switch a $80.000 en 18 cuotas con interés
                      total $103.500 → ingresá <b>103.500</b>.
                    </p>
                  </app-info-tooltip>
                </label>
                <input type="number" name="ctotal" min="0" step="0.01" [(ngModel)]="cTotalAmount" required
                       class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Cuotas</label>
                <input type="number" name="cinst" min="1" step="1" [(ngModel)]="cInstallments" required
                       class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  Fecha de compra
                  <app-info-tooltip>
                    <p class="font-semibold mb-1">Fecha de compra</p>
                    <p class="text-slate-300">
                      Es la fecha en que hiciste la compra. Junto con el
                      <b>día de cierre</b> de la tarjeta determina en qué mes
                      aparece la primera cuota:
                    </p>
                    <ul class="text-slate-300 mt-1 pl-3 list-disc">
                      <li>Si comprás <b>antes</b> del cierre → primera cuota en el mes siguiente.</li>
                      <li>Si comprás el día del cierre o después → primera cuota dos meses después.</li>
                    </ul>
                  </app-info-tooltip>
                </label>
                <input type="date" name="cdate" [(ngModel)]="cDate" required
                       class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
                <div class="flex bg-slate-100 p-1 rounded-xl">
                  <button type="button" (click)="cCurrency = 'ARS'"
                          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                          [ngClass]="cCurrency === 'ARS' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
                    ARS
                  </button>
                  <button type="button" (click)="cCurrency = 'USD'"
                          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                          [ngClass]="cCurrency === 'USD' ? 'bg-white shadow text-slate-700' : 'text-slate-500'">
                    USD
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
              <select name="ccat" [(ngModel)]="cCategory" required
                      class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                @for (cat of expenseCategories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>

            @if (cCurrency === 'USD') {
              <div>
                <label class="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  Tipo de gasto en USD
                  <app-info-tooltip>
                    <p class="font-semibold mb-1">¿Cómo se va a pagar?</p>
                    <p class="text-slate-300">
                      Define cómo se convierte (o no) a pesos en cada cuota:
                    </p>
                    <ul class="text-slate-300 mt-1 pl-3 list-disc">
                      <li><b>Compra normal</b>: oficial × cuota (sin recargo desde 2026). Productos físicos del exterior.</li>
                      <li><b>Servicio digital del exterior</b>: oficial × 1,21 (Steam, Netflix, Spotify, Adobe, AWS, etc.).</li>
                      <li><b>Servicio turístico en pesos</b>: oficial × 1,30 (vuelos/hoteles/paquetes Argentina).</li>
                      <li><b>Pago el resumen en USD</b>: no se convierte, queda como obligación en dólares.</li>
                    </ul>
                  </app-info-tooltip>
                </label>
                <div class="grid grid-cols-1 gap-1.5">
                  <button type="button" (click)="cSurchargeMode = 'auto'"
                          class="text-left p-2 rounded-lg border text-xs transition"
                          [ngClass]="cSurchargeMode === 'auto'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                    <b>Compra normal en USD</b>
                    <span class="block text-slate-400">Producto físico del exterior. Sin recargo desde Ene 2026.</span>
                  </button>
                  <button type="button" (click)="cSurchargeMode = 'digital-service'"
                          class="text-left p-2 rounded-lg border text-xs transition"
                          [ngClass]="cSurchargeMode === 'digital-service'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                    <b>Servicio digital del exterior (+21% IVA)</b>
                    <span class="block text-slate-400">Steam, Netflix, Spotify, Adobe, AWS, etc.</span>
                  </button>
                  <button type="button" (click)="cSurchargeMode = 'tourism'"
                          class="text-left p-2 rounded-lg border text-xs transition"
                          [ngClass]="cSurchargeMode === 'tourism'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                    <b>Servicio turístico (+30%)</b>
                    <span class="block text-slate-400">Vuelos / hoteles / paquetes en pesos.</span>
                  </button>
                  <button type="button" (click)="cSurchargeMode = 'usd-payment'"
                          class="text-left p-2 rounded-lg border text-xs transition"
                          [ngClass]="cSurchargeMode === 'usd-payment'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'">
                    <b>Voy a pagar el resumen en USD</b>
                    <span class="block text-slate-400">No se convierte a pesos. Queda como obligación USD.</span>
                  </button>
                </div>
              </div>
            }

            <!-- Preview cuota -->
            @if (cTotalAmount && cInstallments && cInstallments > 0) {
              <div class="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs text-purple-700">
                <p>
                  {{ cInstallments }} cuotas de
                  <b>{{ cCurrency === 'USD' ? 'US$' : '$' }}{{ (cTotalAmount / cInstallments) | number:'1.2-2' }}</b>
                </p>
              </div>
            }

            <button type="submit" [disabled]="!fc.valid"
                    class="w-full mt-2 py-2.5 rounded-xl text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50">
              Agregar compra
            </button>
          </form>
        }
      }
    </div>
  `,
})
export class TransactionForm {
  protected readonly tx = inject(TransactionsService);

  protected readonly mode = signal<FormMode>('gasto');

  // ----- form normal -----
  protected description = '';
  protected amount: number | null = null;
  protected date = new Date().toISOString().slice(0, 10);
  /** Almacenamos el ID, no el nombre. */
  protected category: Category = FALLBACK_EXPENSE_CATEGORY_ID;
  protected fixed = false;
  /** Categorías visibles según el tab activo. Reactivo si el usuario agrega custom. */
  protected readonly currentCategories = computed<CategoryView[]>(() =>
    this.mode() === 'ingreso'
      ? this.tx.allIncomeCategories()
      : this.tx.allExpenseCategories()
  );

  // ----- form tarjeta -----
  protected cardId = '';
  protected cDescription = '';
  protected cTotalAmount: number | null = null;
  protected cInstallments: number | null = null;
  protected cDate = new Date().toISOString().slice(0, 10);
  protected cCurrency: Currency = 'ARS';
  protected cSurchargeMode: SurchargeMode = 'auto';
  protected cCategory: Category = FALLBACK_EXPENSE_CATEGORY_ID;
  /** Para el tab Tarjeta — siempre categorías de gasto (defaults + custom). */
  protected readonly expenseCategories = this.tx.allExpenseCategories;

  setMode(m: FormMode): void {
    this.mode.set(m);
    if (m === 'ingreso') {
      this.category = 'cat-sueldo';
    } else if (m === 'gasto') {
      this.category = FALLBACK_EXPENSE_CATEGORY_ID;
    }
  }

  submit(): void {
    if (this.mode() === 'tarjeta') return;
    if (this.amount == null || this.amount <= 0 || !this.description.trim()) return;

    this.tx.add({
      type: this.mode() as TransactionType,
      description: this.description.trim(),
      amount: Number(this.amount),
      category: this.category,
      date: this.date,
      fixed: this.fixed,
    });

    this.description = '';
    this.amount = null;
    this.fixed = false;
  }

  submitPurchase(): void {
    if (!this.cardId || !this.cTotalAmount || !this.cInstallments || !this.cDescription.trim()) return;

    this.tx.addPurchase({
      cardId: this.cardId,
      description: this.cDescription.trim(),
      totalAmount: Number(this.cTotalAmount),
      installments: Number(this.cInstallments),
      purchaseDate: this.cDate,
      currency: this.cCurrency,
      category: this.cCategory,
      surchargeMode: this.cCurrency === 'USD' ? this.cSurchargeMode : undefined,
    });

    this.cDescription = '';
    this.cTotalAmount = null;
    this.cInstallments = null;
    this.cSurchargeMode = 'auto';
  }
}
