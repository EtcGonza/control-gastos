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
  imports: [CommonModule],
  template: `
    <span class="info-wrapper">
      <button type="button"
              class="info-badge"
              [class.active]="visible()"
              (mouseenter)="hover.set(true)"
              (mouseleave)="hover.set(false)"
              (click)="togglePin($event)"
              aria-label="Más información">
        i
      </button>
      <span class="tooltip" [class.visible]="visible()">
        <ng-content></ng-content>
      </span>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      margin-left: 0.25rem;
      vertical-align: middle;
    }
    .info-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .info-badge {
      width: 16px;
      height: 16px;
      border-radius: 9999px;
      background: #e2e8f0;
      color: #64748b;
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: help;
      border: none;
      padding: 0;
      transition: background 150ms, color 150ms;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .info-badge:hover,
    .info-badge.active {
      background: #6366f1;
      color: white;
    }
    .tooltip {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(-4px);
      width: max-content;
      min-width: 220px;
      max-width: min(320px, calc(100vw - 32px));
      background: #0f172a;
      color: white;
      font-size: 12px;
      line-height: 1.5;
      padding: 10px 12px;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
      opacity: 0;
      visibility: hidden;
      transition: opacity 150ms ease, transform 150ms ease, visibility 150ms;
      pointer-events: none;
      z-index: 40;
      text-align: left;
      font-weight: normal;
      white-space: normal;
      letter-spacing: normal;
    }
    .tooltip.visible {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
    .tooltip::before {
      content: '';
      position: absolute;
      top: -5px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 10px;
      height: 10px;
      background: #0f172a;
      border-radius: 2px;
    }
    @media (max-width: 640px) {
      .tooltip {
        left: auto;
        right: -8px;
        transform: translateY(-4px);
      }
      .tooltip.visible {
        transform: translateY(0);
      }
      .tooltip::before {
        left: auto;
        right: 12px;
        transform: rotate(45deg);
      }
    }
  `],
})
export class InfoTooltip {
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
