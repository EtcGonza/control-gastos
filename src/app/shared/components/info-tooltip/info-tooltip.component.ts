import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';

/**
 * Badge "i" con tooltip que se despliega al hacer hover o click.
 *
 * Uso:
 *   <label>
 *     Mi campo
 *     <app-info-tooltip>
 *       <p class="font-semibold mb-1">Título</p>
 *       <p>Explicación...</p>
 *     </app-info-tooltip>
 *   </label>
 */
@Component({
  selector: 'app-info-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-tooltip.component.html',
  styleUrls: ['./info-tooltip.component.scss'],
})
export class InfoTooltipComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly hover = signal(false);
  protected readonly pinned = signal(false);

  visible(): boolean {
    return this.hover() || this.pinned();
  }

  togglePin(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.pinned.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.pinned.set(false);
    }
  }
}
