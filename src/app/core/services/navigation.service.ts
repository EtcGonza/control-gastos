import { Injectable, signal } from '@angular/core';

export type NavSection =
  | 'mes'
  | 'tarjetas'
  | 'suscripciones'
  | 'ahorros'
  | 'analisis'
  | 'configuracion';

const STORAGE_KEY = 'control-gastos:nav-section';
const VALID_SECTIONS: NavSection[] = [
  'mes',
  'tarjetas',
  'suscripciones',
  'ahorros',
  'analisis',
  'configuracion',
];

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly _section = signal<NavSection>(this.loadSection());
  readonly section = this._section.asReadonly();

  private readonly _mobileMenuOpen = signal<boolean>(false);
  readonly mobileMenuOpen = this._mobileMenuOpen.asReadonly();

  setSection(s: NavSection): void {
    this._section.set(s);
    this.closeMobileMenu();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, s);
    }
  }

  toggleMobileMenu(): void {
    this._mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this._mobileMenuOpen.set(false);
  }

  private loadSection(): NavSection {
    if (typeof localStorage === 'undefined') return 'mes';
    const v = localStorage.getItem(STORAGE_KEY);
    return v && VALID_SECTIONS.includes(v as NavSection)
      ? (v as NavSection)
      : 'mes';
  }
}
