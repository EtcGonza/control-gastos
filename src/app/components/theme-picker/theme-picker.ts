import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { AVAILABLE_THEMES, Theme, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-picker',
  imports: [CommonModule],
  template: `
    <div class="theme-picker relative inline-block">
      <button type="button"
              class="theme-picker-btn w-9 h-9 rounded-xl flex items-center justify-center border transition bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-indigo-600"
              (click)="toggleOpen()"
              [attr.aria-label]="'Cambiar tema (actual: ' + currentTheme().name + ')'"
              [title]="'Tema: ' + currentTheme().name">
        <!-- Paleta de pintor -->
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r="1.5"/>
          <circle cx="17.5" cy="10.5" r="1.5"/>
          <circle cx="8.5" cy="7.5" r="1.5"/>
          <circle cx="6.5" cy="12.5" r="1.5"/>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
        </svg>
      </button>

      @if (open()) {
        <div class="theme-picker-panel absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-30 w-72">
          @for (theme of themes; track theme.id) {
            <button type="button"
                    (click)="select(theme.id)"
                    class="theme-option w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-slate-50 transition">
              <!-- Swatch de 4 cuadritos -->
              <span class="flex gap-0.5 flex-shrink-0">
                @for (c of theme.swatch; track $index) {
                  <span class="w-2.5 h-6 rounded-sm border border-slate-200/60"
                        [style.background-color]="c"></span>
                }
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-800">{{ theme.name }}</p>
                <p class="text-[11px] text-slate-500 truncate">{{ theme.description }}</p>
              </div>
              @if (theme.id === currentTheme().id) {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ThemePicker {
  private readonly themeSvc = inject(ThemeService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly themes = AVAILABLE_THEMES;
  protected readonly open = signal(false);

  protected readonly currentTheme = computed(() => {
    const id = this.themeSvc.theme();
    return AVAILABLE_THEMES.find((t) => t.id === id) ?? AVAILABLE_THEMES[0];
  });

  toggleOpen(): void {
    this.open.update((v) => !v);
  }

  select(id: Theme): void {
    this.themeSvc.setTheme(id);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
