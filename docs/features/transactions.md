# Transacciones manuales

Carga manual de ingresos y gastos puntuales del mes.

## Ubicación en la UI

- **Form**: `<app-transaction-form>` en la columna izquierda. Tabs **Ingreso / Gasto / Tarjeta**.
- **Lista**: `<app-transaction-list>` en la columna derecha.

Archivos:
- Modelo: `src/app/models/transaction.model.ts`
- Componentes: `src/app/components/transaction-form/`, `src/app/components/transaction-list/`
- Servicio: `TransactionsService.add()` / `.remove()` / `.clearAll()` en `src/app/services/transactions.service.ts`

## Flujo de alta

1. Usuario elige tab Ingreso o Gasto.
2. Llena descripción, monto, fecha (default = hoy), categoría.
3. Opcionalmente marca "Es un ingreso/gasto fijo mensual".
4. Click en "Agregar".

El servicio:
- Genera UUID con `crypto.randomUUID()`.
- Inserta al inicio del array `_transactions`.
- Persiste en `localStorage` (`control-gastos:transactions`).
- Si `fixed === true`, llama a `upsertTemplate(...)` para guardar/actualizar la plantilla en [Fijos guardados](./recurring-templates.md).

## Categorías

Definidas en `transaction.model.ts`:

```ts
const EXPENSE_CATEGORIES = [
  'Alquiler', 'Servicios', 'Alimentos', 'Transporte',
  'Salud', 'Entretenimiento', 'Suscripciones', 'Otros',
];

const INCOME_CATEGORIES = ['Sueldo', 'Horas extras', 'Otros'];
```

Cada categoría tiene un color en `CATEGORY_COLORS` que se usa como background del círculo a la izquierda de la fila en la lista.

## Campo "fijo"

El checkbox "Es un ingreso/gasto fijo mensual" tiene tres efectos:

1. La transacción queda marcada con `fixed: true`.
2. Se crea o actualiza una `RecurringTemplate` para esta combinación de `(type, description, category)` con el monto actual.
3. Esa transacción suma al cálculo de `monthlyFixedExpenses` y por lo tanto al **% Gastos fijos / ingresos** del mes.

Si una transacción NO es fija, no aporta al porcentaje de fijos pero sí al total de gastos.

## Lista mensual

`<app-transaction-list>` consume `tx.monthlyEntries()`. Esta lista incluye:

- Transacciones reales del mes seleccionado.
- Cuotas virtuales generadas por compras con tarjeta (ver [card-purchases](./card-purchases.md)).
- Cobros de suscripciones del mes (ver [subscriptions](./subscriptions.md)).

Cada fila muestra:
- Círculo con la inicial de la categoría (color según `CATEGORY_COLORS`).
- Descripción + badges contextuales (`Fijo`, `Cuota N/X`, `Suscripción`, `USD`, `+21%`, etc.).
- Categoría + fecha (o info contextual como nombre de la tarjeta para cuotas).
- Monto.
- Si la moneda es USD y no es pago directo, segundo renglón con el equivalente ARS y el TC usado.
- Botón de eliminar (sólo aparece al hacer hover).

### Eliminación

- Transacciones reales: borran del array `_transactions` y del localStorage.
- Cuotas virtuales: eliminan la `CardPurchase` entera (con confirmación), borrando todas las cuotas de esa compra.
- Cobros de suscripciones: NO se pueden eliminar individualmente desde la lista. Se cancela la sub completa desde su panel.

## Filtros disponibles

La lista expone:

- **Tipo**: Todos / Ingresos / Gastos
- **Origen**: Todos / Manuales / Cuotas / Suscripciones
- **Categoría**: dropdown poblado con las categorías presentes en el mes
- **Orden**: Fecha (más nuevo / más viejo) / Monto (mayor / menor)

Si hay algún filtro activo el contador del header muestra "X de Y" (filtrado vs total).

Ver [monthly-view](./monthly-view.md) para más detalle.

## Validaciones

- Descripción no puede ser vacía (HTML5 `required`).
- Monto debe ser número > 0.
- Fecha en formato `YYYY-MM-DD`. El input `type="date"` valida automáticamente.
- Categoría debe ser una de las definidas (el select sólo ofrece esas opciones).

No hay límite superior para el monto. Se acepta hasta el límite de `Number` en JavaScript (`Number.MAX_SAFE_INTEGER ≈ 9 × 10^15`).
