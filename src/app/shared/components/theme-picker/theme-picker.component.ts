import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { AVAILABLE_THEMES, Theme, ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-picker.component.html',
})
export class ThemePickerComponent {
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
