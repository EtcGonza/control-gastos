# Arquitectura técnica

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Angular 21 (standalone components) |
| Estilos | Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Reactividad | Angular Signals (`signal`, `computed`, `effect`) |
| Control flow | Nuevo (`@if`, `@for`, `@else if`) |
| Persistencia | `localStorage` |
| HTTP | `fetch` nativo |
| Fuentes externas | Google Fonts (vía `<link>` en `index.html`) |
| Build | Angular CLI (`@angular/build`) |

No hay backend, no hay base de datos, no hay autenticación. Todo el estado vive en el navegador del usuario.

## Estructura de carpetas

```
src/
├── app/
│   ├── components/
│   │   ├── cards-manager/         # Alta y edición de tarjetas
│   │   ├── category-breakdown/    # Desglose de gastos por categoría
│   │   ├── confirm-host/          # Modal de confirmación global
│   │   ├── data-backup/           # Export / import / borrar
│   │   ├── info-tooltip/          # Badge "i" con tooltip
│   │   ├── month-selector/        # Selector de mes (header)
│   │   ├── recurring-templates/   # Fijos guardados
│   │   ├── subscriptions-manager/ # Alta y gestión de suscripciones
│   │   ├── summary-cards/         # 4 tarjetas resumen del mes
│   │   ├── theme-picker/          # Dropdown de temas
│   │   ├── transaction-form/      # Form de alta (ingreso/gasto/tarjeta)
│   │   ├── transaction-list/      # Lista de movimientos del mes
│   │   └── usd-summary/           # Resumen USD
│   ├── models/
│   │   ├── card-purchase.model.ts
│   │   ├── credit-card.model.ts
│   │   ├── recurring-template.model.ts
│   │   ├── subscription.model.ts
│   │   └── transaction.model.ts
│   ├── services/
│   │   ├── confirm.service.ts     # Modal de confirmación
│   │   ├── theme.service.ts       # Tema actual + persistencia
│   │   └── transactions.service.ts # Núcleo: estado, cuentas, conversión
│   ├── app.config.ts
│   ├── app.css
│   ├── app.html
│   └── app.ts
├── styles.css                     # Tailwind + imports de temas
├── synthwave-theme.css
├── vaporwave-theme.css
├── popart-theme.css
└── index.html
```

## Patrones clave

### Standalone components

Cada componente declara sus dependencias directamente en `imports: [...]` del decorador `@Component`. No hay `NgModule`. Esto reduce código repetido y facilita el tree-shaking.

```ts
@Component({
  selector: 'app-summary-cards',
  imports: [CommonModule],
  template: `...`,
})
export class SummaryCards { ... }
```

### Signals para estado reactivo

Todo el estado mutable se modela con `signal<T>()`. Los derivados se calculan con `computed(() => ...)`. Los efectos (side effects al cambiar un signal) usan `effect()`.

```ts
private readonly _transactions = signal<Transaction[]>(this.load());
readonly transactions = this._transactions.asReadonly();

readonly monthlyExpenses = computed(() =>
  this.monthlyEntries().reduce((acc, t) => acc + t.amount, 0)
);
```

Los componentes leen los signals con `()` (sufijo de invocación). Angular detecta dependencias y rerenderiza sólo lo necesario.

### Servicios singleton

Servicios se proveen con `@Injectable({ providedIn: 'root' })`, así que hay UNA instancia global. Los componentes los inyectan con `inject(...)`.

```ts
protected readonly tx = inject(TransactionsService);
```

### Control flow nuevo

Se usa `@if`, `@for`, `@else` en lugar de `*ngIf` y `*ngFor`:

```html
@if (entries.length === 0) {
  <p>Vacío</p>
} @else {
  @for (e of entries; track e.id) {
    <li>{{ e.description }}</li>
  }
}
```

## Servicios principales

### `TransactionsService`

Único servicio que maneja toda la lógica de negocio. Mantiene seis signals primarios:

- `_transactions` – movimientos manuales (ingresos/gastos)
- `_templates` – plantillas de fijos
- `_cards` – tarjetas de crédito
- `_purchases` – compras con cuotas
- `_subscriptions` – suscripciones
- `_rates` – cache de cotizaciones del dólar (`Record<YYYY-MM-DD, number>`)
- `_selectedMonth` – mes activo (`YYYY-MM`)

Expone signals públicos derivados con `computed()`:

- `monthlyEntries` – lista unificada para la vista mensual (txs reales + cuotas virtuales + cargos de subs)
- `monthlyIncome`, `monthlyExpenses`, `monthlyFixedExpenses`, `monthlyBalance`
- `fixedExpensesPercentage`, `expensesPercentage`
- `expensesByCategory`
- `monthlyExpensesUSD`, `monthlyConvertedFromUSD`, `monthlyInstallmentsUSDCount`

Tiene un `effect()` en el constructor que dispara fetches de cotizaciones cuando cambian las entradas mensuales (sin loops infinitos: el effect lee `monthlyEntries`, los fetches actualizan `_rates`, que es otra dependencia distinta).

Ver detalles en [reglas de negocio](./business-logic.md) y los modelos en [modelo de datos](./data-model.md).

### `ThemeService`

Maneja el tema activo (`'classic' | 'synthwave' | 'vaporwave' | 'popart'`). Aplica la clase correspondiente en `<html>` mediante un `effect()`. Persiste en `localStorage` (`control-gastos:theme`).

### `ConfirmService`

API centralizada para mostrar diálogos de confirmación. Usa un `signal` interno para mantener el estado del modal abierto. Devuelve una `Promise<boolean>` que se resuelve cuando el usuario confirma o cancela. El componente `<app-confirm-host>` montado en el root de la app renderiza el modal cuando el state no es null.

## Flujo de datos

```
Usuario hace acción (click, input)
        │
        ▼
Componente llama método del servicio
        │
        ▼
Servicio muta signal interno + persist() a localStorage
        │
        ▼
Computed signals dependientes recalculan
        │
        ▼
Componentes que leen esos signals rerenderizan
```

Cualquier escritura sigue el patrón:

```ts
add(tx: Omit<Transaction, 'id'>): void {
  const newTx = { ...tx, id: crypto.randomUUID() };
  this._transactions.update((list) => [newTx, ...list]);
  this.persist(STORAGE_KEY, this._transactions());
}
```

## Build y serve

```bash
npm install
npm start            # Servidor de desarrollo en http://localhost:4200
npm run build        # Producción → dist/
```

Ver [desarrollo](./development.md) para más detalles.

## Decisiones de diseño relevantes

- **Sin librería de estado externa**: con signals de Angular alcanza.
- **Sin librería de routing**: la app es una sola página.
- **Sin librería de iconos**: SVG inline en cada componente.
- **Conversión USD reactiva**: las cuotas en USD se convierten on-the-fly cada vez que se renderiza, leyendo del cache de cotizaciones. No se persiste el monto convertido (sólo el original).
- **Cuotas virtuales**: cuando agregás una compra de N cuotas, NO se crean N transacciones en disco. Se guarda UNA compra y las cuotas se generan dinámicamente al consultar un mes (`installmentsForMonth`).
- **Recargos por fecha**: el % aplicado a una cuota USD depende de la fecha del cierre, no de la fecha de la compra. Eso garantiza consistencia con el comportamiento real del banco.
