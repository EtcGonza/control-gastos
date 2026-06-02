# Persistencia

Todo el estado de la app se guarda en `localStorage` del navegador. No hay backend, no hay sincronización entre dispositivos, no hay backups automáticos.

## Claves utilizadas

### Datos de la app

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `control-gastos:transactions` | `Transaction[]` | Movimientos manuales (ingresos/gastos) |
| `control-gastos:templates` | `RecurringTemplate[]` | Plantillas de fijos |
| `control-gastos:cards` | `CreditCard[]` | Tarjetas de crédito dadas de alta |
| `control-gastos:purchases` | `CardPurchase[]` | Compras con cuotas |
| `control-gastos:subscriptions` | `Subscription[]` | Suscripciones |
| `control-gastos:rates` | `Record<string, number>` | Cache de cotizaciones del dólar (clave = `YYYY-MM-DD`) |

### Preferencias de UI

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `control-gastos:theme` | `'classic' \| 'synthwave' \| 'vaporwave' \| 'popart'` | Tema activo |
| `control-gastos:cards-expanded` | `'true' \| 'false'` | Panel de tarjetas abierto/cerrado |
| `control-gastos:subs-expanded` | `'true' \| 'false'` | Panel de suscripciones abierto/cerrado |
| `control-gastos:templates-expanded` | `'true' \| 'false'` | Panel de fijos guardados abierto/cerrado |
| `control-gastos:templates-hide-applied` | `'true' \| 'false'` | Filtro "ocultar ya cargados" activo |
| `control-gastos:backup-expanded` | `'true' \| 'false'` | Panel de datos/respaldo abierto/cerrado |

## Cómo funciona la persistencia interna

`TransactionsService` mantiene los datos en signals y los persiste cada vez que mutan, usando el método helper:

```ts
private persist(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
```

Al inicializar el servicio (singleton), carga los datos con:

```ts
private load<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

Tolera datos corruptos: si el JSON falla, vuelve a array vacío sin romper la app.

## Tamaño aproximado

LocalStorage tiene un límite de ~5–10 MB por dominio. Datos típicos:

- 100 transacciones manuales: ~15 KB
- 12 plantillas: ~2 KB
- 3 tarjetas: ~500 B
- 20 compras con cuotas: ~5 KB
- 8 suscripciones (con historial): ~3 KB
- Cache de 365 cotizaciones: ~15 KB
- Preferencias UI: < 1 KB

Total típico: bajo 50 KB. Tenés años de uso antes de acercarte al límite.

## Lo que NO se persiste

- **Estado runtime**: `_selectedMonth`, `_fetchedRates` (set de fetches en curso), `_ratesReady` (signal de bootstrap).
- **Montos USD convertidos**: la conversión se calcula on-the-fly leyendo del cache de cotizaciones. Sólo se guarda el monto original en USD.
- **Cuotas individuales**: se generan dinámicamente desde la `CardPurchase`. Si cambia el día de cierre o el `surchargeMode`, se recomputa todo.

## Migraciones y versiones

El formato del export (ver [data-backup](./features/data-backup.md)) incluye un campo `schemaVersion` actualmente en `1`. Si en el futuro cambia el shape de las entidades, este campo permitiría detectar y migrar archivos viejos.

Por ahora **no hay lógica de migración**: si se carga un export con `schemaVersion > 1`, la importación se rechaza con un error visible al usuario.

## Borrado manual

Desde DevTools del navegador (`Application` → `Local Storage`) el usuario puede borrar claves específicas o todas. Desde la app, el botón "Borrar todos los datos" en el panel de Datos/Respaldo limpia las 6 claves de datos (no toca las preferencias de UI).

## Comportamiento entre navegadores y dispositivos

`localStorage` está aislado por:
- Origen (protocolo + dominio + puerto)
- Navegador
- Perfil del usuario en el navegador

Esto significa que **NO** hay sincronización entre:
- Chrome y Firefox en la misma máquina
- Modo normal y modo incógnito
- El mismo navegador en distintas computadoras
- Mobile y desktop

La única forma de mover datos entre dispositivos es **exportar el JSON en uno e importarlo en el otro**.

## Limpieza accidental

Si el usuario limpia los datos del navegador (cookies + storage), se pierde TODO. Por eso es importante exportar periódicamente como respaldo (ver [data-backup](./features/data-backup.md)).
