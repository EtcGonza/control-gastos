import { Injectable, signal } from '@angular/core';

export type ConfirmVariant = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState {
  options: ConfirmOptions;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _state = signal<ConfirmState | null>(null);
  readonly state = this._state.asReadonly();

  private resolver: ((v: boolean) => void) | null = null;

  /** Abre el modal. Devuelve una Promise que se resuelve cuando el usuario decide. */
  confirm(options: ConfirmOptions): Promise<boolean> {
    // Si ya había un modal abierto, lo cancelamos primero.
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this._state.set({ options });
    });
  }

  /** Cierra el modal con la respuesta indicada. Lo usa el host. */
  resolve(value: boolean): void {
    const r = this.resolver;
    this.resolver = null;
    this._state.set(null);
    if (r) r(value);
  }
}
