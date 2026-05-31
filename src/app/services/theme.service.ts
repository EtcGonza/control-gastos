import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'classic' | 'synthwave' | 'vaporwave' | 'popart';

export interface ThemeInfo {
  id: Theme;
  name: string;
  description: string;
  /** Cuatro colores representativos para mostrar como swatch en el picker. */
  swatch: [string, string, string, string];
}

export const AVAILABLE_THEMES: ThemeInfo[] = [
  {
    id: 'classic',
    name: 'Clásico',
    description: 'Diseño limpio y moderno por default.',
    swatch: ['#ffffff', '#eef2ff', '#6366f1', '#0f172a'],
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: '80s neón con grilla en perspectiva.',
    swatch: ['#0e0033', '#ff2bd6', '#00f0ff', '#b400ff'],
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    description: 'Pastel rosa, cian y lavanda con vibe 90s.',
    swatch: ['#ffe0f0', '#ff71ce', '#01cdfe', '#b967ff'],
  },
  {
    id: 'popart',
    name: 'Pop Art',
    description: 'Estilo comic book con bordes negros y halftones.',
    swatch: ['#ffe600', '#ff2d2d', '#0066cc', '#000000'],
  },
];

const STORAGE_KEY = 'control-gastos:theme';
const THEME_CLASSES: Theme[] = ['synthwave', 'vaporwave', 'popart'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.load());
  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      // Saca todas las clases de tema y aplica la actual (classic = ninguna)
      THEME_CLASSES.forEach((cls) => root.classList.remove(cls));
      if (t !== 'classic') root.classList.add(t);
    });
  }

  setTheme(t: Theme): void {
    this._theme.set(t);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, t);
    }
  }

  /** Avanza al siguiente tema (orden de declaración). Útil si alguna vez querés un cycle. */
  cycle(): void {
    const idx = AVAILABLE_THEMES.findIndex((t) => t.id === this._theme());
    const next = AVAILABLE_THEMES[(idx + 1) % AVAILABLE_THEMES.length];
    this.setTheme(next.id);
  }

  private load(): Theme {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && AVAILABLE_THEMES.some((t) => t.id === v)) return v as Theme;
      // Migración suave: si quedó 'dark' u otro valor viejo, lo ignoramos.
    }
    return 'classic';
  }
}
