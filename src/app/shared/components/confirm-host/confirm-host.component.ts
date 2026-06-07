import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-host.component.html',
  styleUrls: ['./confirm-host.component.scss'],
})
export class ConfirmHostComponent {
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
