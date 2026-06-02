# Vista mensual

El dashboard principal está siempre filtrado por un mes. Esta sección documenta las cuatro tarjetas resumen, los filtros de la lista y el desglose por categoría.

## Selector de mes

`<app-month-selector>` en el header. Permite:

- **Flechas ‹ / ›**: navegar al mes anterior o siguiente.
- **Click en el mes**: abre un dropdown con grilla de 12 meses y navegación de año.
- **Botón "Hoy"**: aparece si el mes seleccionado no es el actual, lleva de vuelta al mes corriente.

El mes seleccionado se mantiene en `TransactionsService._selectedMonth` (signal). Todos los computeds dependientes recalculan al cambiar.

Por default se inicializa con el mes del sistema. Si la app se carga al final de mayo, arranca en mayo.

## Tarjetas resumen

`<app-summary-cards>` muestra cuatro tarjetas arriba del dashboard. Cada una tiene un badge "i" hover con tooltip explicativo.

### 1. Ingresos del mes

Suma de `MonthlyEntry` con `type === 'ingreso'` y `currency === 'ARS'`. Los cobros de suscripciones e installments no son ingresos.

### 2. Gastos del mes

Suma de `entryArsAmount(t)` para cada `MonthlyEntry` con `type === 'gasto'`. Incluye:

- Transacciones manuales en ARS.
- Cuotas en ARS.
- Cuotas en USD convertidas a ARS (excepto `usd-payment`).
- Cobros de suscripciones en ARS y USD convertidos.

### 3. Queda a fin de mes (balance)

`monthlyIncome - monthlyExpenses`. Es la plata que sobra después de pagar todo. Positivo = sobra. Negativo = se gastó más de lo que entró.

### 4. Gastos fijos / ingresos (%)

```
monthlyFixedExpenses / monthlyIncome × 100
```

Donde `monthlyFixedExpenses` suma sólo los `MonthlyEntry` con `fixed === true`:

- Transacciones manuales marcadas como fijas.
- Todas las cuotas de tarjeta (siempre `fixed: true`).
- Todos los cobros de suscripciones (siempre `fixed: true`).

Barra de progreso con color según %:
- < 50% → verde
- 50-80% → ámbar
- > 80% → rojo

## Lista de movimientos

`<app-transaction-list>` consume `tx.monthlyEntries()` y permite filtrar y ordenar.

### Filtros

- **Tipo**: Todos / Ingresos / Gastos (pills horizontales)
- **Origen**: Todos / Manuales / Cuotas / Suscripciones
- **Categoría**: dropdown con sólo las categorías presentes en el mes
- **Orden**: dropdown — Fecha (desc / asc) / Monto (mayor / menor)

### Ordenamiento por monto con monedas mezcladas

Para comparar consistentemente, se usa el equivalente en ARS:

```ts
private comparableAmount(e: MonthlyEntry): number {
  if (e.currency === 'ARS') return e.amount;
  const conv = this.tx.convertEntryToArs(e);
  if (conv) return conv.arsAmount;
  // usd-payment o sin TC: estimar con último TC conocido
  const latest = this.tx.latestRate();
  return latest ? e.amount * latest.rate : e.amount;
}
```

### Contador

Si no hay filtros activos: "N registros".
Si hay filtros: "X de Y" (donde X = filtrados, Y = total).

Aparece botón "✕ Limpiar filtros" cuando cualquier filtro está activo.

### Estado vacío

- Sin movimientos en el mes: ícono + mensaje "Empezá agregando un ingreso o un gasto".
- Con movimientos pero filtros que no matchean: "No hay movimientos que coincidan con los filtros" + atajo para limpiar.

## Desglose por categoría

`<app-category-breakdown>` muestra cuántos pesos se gastaron en cada categoría del mes, ordenado de mayor a menor, con barras de progreso proporcional.

Sólo gastos. Los ingresos no se desglosan acá.

```ts
readonly expensesByCategory = computed(() => {
  const map = new Map<string, number>();
  this.monthlyEntries()
    .filter((t) => t.type === 'gasto')
    .forEach((t) => {
      const arsValue = this.entryArsAmount(t);
      if (arsValue > 0) {
        map.set(t.category, (map.get(t.category) ?? 0) + arsValue);
      }
    });
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
});
```

Las cuotas y subs cuentan en sus respectivas categorías. Las suscripciones siempre van a "Suscripciones".

## Resumen USD

`<app-usd-summary>` aparece debajo de las tarjetas resumen sólo si hay actividad en USD. Ver [usd-conversion](./usd-conversion.md).

## Métricas que se recomputan

Todos estos `computed()`s en `TransactionsService` dependen del mes seleccionado y se recalculan automáticamente al cambiar de mes o al agregar/borrar movimientos:

- `monthlyEntries`
- `monthlyIncome`
- `monthlyExpenses`
- `monthlyFixedExpenses`
- `monthlyBalance`
- `fixedExpensesPercentage`
- `expensesPercentage`
- `expensesByCategory`
- `monthlyExpensesUSD`
- `monthlyConvertedFromUSD`
- `monthlyInstallmentsUSDCount`
