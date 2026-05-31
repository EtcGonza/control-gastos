import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-host',
  imports: [CommonModule],
  template: `
    @if (service.state(); as s) {
      <div class="overlay" (click)="cancel()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="flex items-start gap-3 mb-5">
            <span class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  [ngClass]="s.options.variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-indigo-100 text-indigo-600'">
              @if (s.options.variant === 'danger') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              }
            </span>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-slate-800">{{ s.options.title }}</h3>
              <p class="text-sm text-slate-600 mt-1 whitespace-pre-line">{{ s.options.message }}</p>
            </div>
            <button type="button" (click)="cancel()"
                    class="text-slate-400 hover:text-slate-600 transition p-1 -mt-1 -mr-1"
                    aria-label="Cerrar">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" (click)="cancel()"
                    class="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
              {{ s.options.cancelText ?? 'Cancelar' }}
            </button>
            <button type="button" (click)="confirm()"
                    class="px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
                    [ngClass]="s.options.variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'">
              {{ s.options.confirmText ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: overlay-in 150ms ease-out;
    }
    .modal {
      background: white;
      border-radius: 1rem;
      padding: 1.5rem;
      width: 100%;
      max-width: 28rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      animation: modal-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modal-in {
      from { opacity: 0; transform: translateY(8px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
})
export class ConfirmHost {
  protected readonly service = inject(ConfirmService);

  constructor() {
    // Bloquea el scroll del body mientras el modal está abierto
    effect(() => {
      const open = !!this.service.state();
      if (typeof document === 'undefined') return;
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  confirm(): void {
    this.service.resolve(true);
  }

  cancel(): void {
    this.service.resolve(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (!this.service.state()) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.cancel();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      this.confirm();
    }
  }
}
