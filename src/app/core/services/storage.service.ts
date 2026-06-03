import { Injectable } from '@angular/core';

/**
 * Punto único de acceso a `localStorage`.
 *
 * Centraliza:
 *  - el patrón `try/catch + JSON.parse` para lecturas.
 *  - el guard `typeof localStorage === 'undefined'` (SSR / tests sin DOM).
 *  - la serialización con `JSON.stringify` para escrituras.
 *
 * Los consumidores nunca tocan `localStorage` directo; van por este servicio.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  /**
   * Lee un valor de `localStorage` parseado como JSON.
   * Devuelve `fallback` si la clave no existe o el contenido no es JSON válido.
   */
  read<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Lee un array de `localStorage`. Si el contenido no es array, devuelve `[]`.
   * Útil para los signals de listas.
   */
  readArray<T>(key: string): T[] {
    const raw = this.read<unknown>(key, []);
    return Array.isArray(raw) ? (raw as T[]) : [];
  }

  /**
   * Lee un objeto (record) de `localStorage`. Si no es objeto, devuelve `{}`.
   * Útil para mapas como las cotizaciones por fecha.
   */
  readRecord<V>(key: string): Record<string, V> {
    const raw = this.read<unknown>(key, {});
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, V>;
    }
    return {};
  }

  /** Serializa y persiste un valor. No-op si no hay `localStorage`. */
  write(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded u otro error de cuota: silencio. El estado en memoria
      // sigue siendo válido, sólo se pierde persistencia para esa escritura.
    }
  }

  /** Elimina una clave. */
  remove(key: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  /** Borra todas las claves que empiezan con `prefix`. */
  clearByPrefix(prefix: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      for (const k of toRemove) localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
}
