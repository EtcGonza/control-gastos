# Reglas de negocio

Este documento centraliza la lógica más sutil del sistema. La mayoría de los cálculos viven en `TransactionsService`.

## Mes seleccionado

La app siempre opera sobre UN mes (formato `YYYY-MM`). Se controla desde `<app-month-selector>` en el header. Todas las métricas y listas se recalculan al cambiar el mes.

El mes por default es el actual del sistema. El usuario puede navegar a cualquier mes pasado o futuro.

## Día de cierre y clamping

### Definición

El **día de cierre** (`closingDay` en `CreditCard`) es el día del mes en que cierra el resumen de la tarjeta. Es un número entre 1 y 31.

### Clamping en meses cortos

Si el día de cierre no existe en un mes específico (ej. cierre 30 en febrero), el sistema lo clampea al **último día del mes**:

- Febrero (no bisiesto) con cierre 30 → cierre efectivo: 28
- Febrero (bisiesto) con cierre 30 → cierre efectivo: 29
- Abril con cierre 31 → cierre efectivo: 30

Esto coincide con el comportamiento real de los bancos argentinos.

### Cálculo del mes de facturación

La pregunta que responde `firstBillingMonth(purchaseDate, closingDay)`: "¿En qué mes del resumen aparece esta compra/cobro?"

Algoritmo:
1. Tomar el día del evento (`d`) y el mes/año.
2. Calcular el día efectivo de cierre en ese mes: `min(closingDay, lastDayOfMonth)`.
3. Si `d < effectiveClosingDay`, el evento entra en el resumen que cierra ese mes → se paga al mes siguiente → `offset = 1`.
4. Si `d >= effectiveClosingDay`, el evento pasa al período siguiente → se paga dos meses después → `offset = 2`.
5. Mes resultado: `mesDelEvento + offset`.

**Regla del borde**: una compra **el mismo día del cierre** (`d == effectiveClosingDay`) se considera del próximo período (`offset = 2`). Esto matchea con la mayoría de los bancos en Argentina.

**Ejemplo**: tarjeta cierre día 20, compra del 19 de mayo.
- d = 19, effectiveClosingDay = 20 (mayo tiene 31 días, no hay clamping).
- 19 < 20 → offset = 1 → primera cuota aparece en **junio**.

**Ejemplo edge case**: tarjeta cierre día 30, compra del 28 de febrero.
- d = 28, lastDayOfMonth = 28, effectiveClosingDay = min(30, 28) = 28.
- 28 < 28 = false → offset = 2 → primera cuota aparece en **abril** (febrero + 2).

### Snapshot del día de cierre

Cuando el usuario edita el día de cierre de una tarjeta que tiene compras o suscripciones, se le pregunta:

- **Aplicar retroactivamente** (default): se recalcula todo con el nuevo cierre. Se limpian los `closingDaySnapshot` existentes.
- **Aplicar sólo a futuro**: las compras y suscripciones ya cargadas conservan el cierre anterior en `closingDaySnapshot`. Sólo afecta a las nuevas.

Ver [feature de tarjetas](./features/credit-cards.md#editar-tarjeta).

## Compras con cuotas

Una compra de N cuotas no crea N transacciones en disco. Se guarda UNA `CardPurchase` con `totalAmount`, `installments` y `purchaseDate`. Las cuotas se generan dinámicamente.

### Generación de cuotas

`installmentsForMonth(month)`:

1. Para cada `CardPurchase`, busca su tarjeta y obtiene el `closingDay` (o el snapshot).
2. Calcula `firstBillingMonth(purchase.purchaseDate, closingDay)` → el mes de la cuota 1.
3. Calcula la diferencia de meses entre `firstBillingMonth` y el mes consultado.
4. Si `0 <= diff < installments`, esa cuota cae en el mes consultado.
5. Monto por cuota: `roundMoney(totalAmount / installments)` = redondeo a 2 decimales.

### Total a pagar

El campo "Total a pagar" es la **suma de las cuotas**, no el precio del producto. Si hay intereses, se incluyen en el total. El sistema divide ese total en cuotas iguales.

**Ejemplo**: Nintendo Switch a $80.000 financiada en 18 cuotas con CFT que lleva el total a $103.500. Se debe cargar `totalAmount = 103500`, `installments = 18`. Cada cuota: $5.750.

## Suscripciones

### Día de cobro

El día del mes en que se cobra una suscripción se deriva de `startDate`. Si `startDate = 2026-05-15`, el cobro se produce todos los 15 de cada mes.

Si el día no existe en un mes (15 existe siempre; 31 sólo en algunos), se clampea al último día del mes con `Math.min(chargeDay, lastDay)`.

### Cargos por mes – algoritmo

`subscriptionChargesForMonth(month)`:

Para cada suscripción, se evalúan dos meses fuente candidatos (M-1 con offset 1, M-2 con offset 2). Esto es necesario porque por el clamping una sub puede aparecer en M con offset 1 o con offset 2 desde diferentes meses fuente.

```ts
for (const offsetTry of [1, 2]) {
  const sourceMonth = month - offsetTry;
  const lastDayOfSource = lastDayOf(sourceMonth);
  const effChargeDay = min(chargeDay, lastDayOfSource);
  const effCloseDay = min(closingDay, lastDayOfSource);

  // Offset real para ese mes fuente, usando días efectivos
  const actualOffset = effChargeDay < effCloseDay ? 1 : 2;
  if (actualOffset !== offsetTry) continue;

  // Match: la sub cobra en sourceMonth el día effChargeDay y se factura en month
  registrar({ chargeDate, amount: priceForDate(sub, chargeDate) });
}
```

### Caso especial: dos cargos del mismo sub en un mismo mes

Cuando hay clamping, una misma suscripción puede aparecer **dos veces** legítimamente en un mismo mes. Ejemplo:

Sub cobra día 28, tarjeta cierre día 30.
- Febrero: cobro Feb 28, cierre Feb 28 (clampeado). Mismo día → pasa al período siguiente → bill cierre 30 marzo → paga en abril.
- Marzo: cobro Mar 28, cierre Mar 30. 28 < 30 → paga en abril.

Resultado: en abril aparecen DOS cargos de la misma sub (uno por la cuota de feb, otro por la de mar). El ID de cada `MonthlyEntry` incluye el `chargeDate` para evitar colisiones.

### Cancelación

`cancelSubscription(id, cancelDate)` setea `cancelDate`. La regla para qué cobros ocurren:

- Si `cancelDate < chargeDate` → ese cobro NO ocurre.
- Si `cancelDate >= chargeDate` → ese cobro SÍ ocurre.

**Ejemplo**: Netflix cobra los 15. Cancelo el 10 de mayo → mayo NO se cobra. Cancelo el 20 de mayo → mayo SÍ se cobra (ya me lo debitaron).

### Reactivación

`reactivateSubscription(id)` elimina el `cancelDate`. Los meses entre la baja y la reactivación NO se cobran (la regla anterior aplicó durante ese período).

### Eliminación

"Eliminar" una suscripción la marca como `archived: true` y le setea `cancelDate = hoy` si no estaba cancelada. Sigue contribuyendo a los meses pasados donde estuvo activa, pero no aparece en el panel de gestión ni genera cobros futuros.

### Historial de precios

`priceHistory` es una lista ordenada de `{from, amount}`. Para obtener el precio vigente en una fecha, se busca la última entrada con `from <= fecha`.

Cambios de precio:
- `addSubscriptionPrice(id, amount, from)`: agrega una nueva entry. Si ya existe una con la misma fecha, la reemplaza.
- Los meses pasados siguen mostrando el precio que tenían cuando estaban vigentes.

## Conversión USD → ARS

### Cotización

Se usa el **dólar oficial vendedor** del Banco Nación, consultado vía [api.argentinadatos.com](https://argentinadatos.com).

Endpoint puntual: `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/{YYYY}/{MM}/{DD}`. Si la fecha no tiene datos (feriado, fin de semana), fallback al endpoint general `/v1/cotizaciones/dolares/oficial` y se busca la cotización más cercana anterior o igual.

Las cotizaciones se cachean en localStorage (`control-gastos:rates`) bajo `Record<YYYY-MM-DD, number>`.

### Fecha de conversión

La conversión usa el TC del **día de cierre del resumen** en que aparece la cuota, NO el día de la compra original. Esto matchea con el comportamiento real del banco.

Para una cuota visible en el mes M, la fecha del cierre es: `M-1, día closingDay` (clampeado al último día si no existe). Esto se calcula en `billingClosingDate(month, closingDay)`.

### Recargo (`surchargePct`)

Sobre el oficial se suma un % según el modo (`SurchargeMode`) y la fecha:

| Modo | Recargo |
|------|---------|
| `usd-payment` | 0% (no se convierte) |
| `none` | 0% |
| `digital-service` | 21% (IVA Servicios Digitales) |
| `tourism` | 30% (servicios turísticos en pesos) |
| `auto` y cierre < 2024-12-01 | 60% (PAIS + Ganancias) |
| `auto` y cierre 2024-12-01 a 2026-01-02 | 30% (sólo Ganancias) |
| `auto` y cierre >= 2026-01-02 | 0% (sin recargo) |

La función `surchargeForDate(date, mode)` resuelve el %.

### Cálculo final

```
arsAmount = usdAmount × oficialRate × (1 + surchargePct)
```

Si no hay TC para la fecha exacta, se usa el TC más reciente conocido (`latestRate()`) y se marca como **estimado** (`estimated: true` en el `ArsConversionResult`).

### Cuotas en USD que se pagan en USD

Cuando una compra/sub tiene `surchargeMode === 'usd-payment'`, NO se convierte. La cuota se acumula en `monthlyExpensesUSD` y aparece en el panel "A pagar directamente en USD". No contribuye al balance ARS.

### Auto-fetch de cotizaciones

Un `effect()` en el constructor del servicio observa `monthlyEntries()` y dispara `ensureRate(date)` para cada `closingDate` de las cuotas USD del mes activo. También pide el TC de hoy como referencia. Las cotizaciones ya pedidas se trackean en un `Set` para no reintentar.

El effect no genera loops infinitos porque `monthlyEntries` no depende de `_rates` (la conversión se hace en helpers, no en el computed mismo).

## Cálculo de métricas mensuales

Las cuatro tarjetas superiores del dashboard usan estos computeds:

### Ingresos del mes (`monthlyIncome`)

Suma de `amount` de los `MonthlyEntry` con `type === 'ingreso'` y `currency === 'ARS'`. Las suscripciones e installments no son ingresos.

### Gastos del mes (`monthlyExpenses`)

Suma de `entryArsAmount(t)` para cada gasto. La función `entryArsAmount`:

- Si ARS, retorna `amount`.
- Si USD y `conversion.usdDirect`, retorna 0 (no impacta ARS).
- Si USD y se puede convertir, retorna `arsAmount` calculado.
- Si USD y no hay TC ni fallback, retorna 0.

### Balance (`monthlyBalance`)

`monthlyIncome - monthlyExpenses`. Positivo = sobra plata; negativo = se gastó más de lo ingresado.

### % de gastos fijos sobre ingresos (`fixedExpensesPercentage`)

```
monthlyFixedExpenses / monthlyIncome × 100
```

Donde `monthlyFixedExpenses` suma sólo gastos con `fixed === true`. Las cuotas de tarjeta y los cobros de suscripciones tienen `fixed: true` por default (cuentan como fijos del mes).

Si `monthlyIncome === 0`, el porcentaje es 0.

### Desglose por categoría (`expensesByCategory`)

Mapa de `categoría → total ARS`, ordenado desc por total. Sólo gastos. Incluye conversiones USD.

## Filtros y ordenamiento de la lista mensual

La lista de movimientos del mes (`<app-transaction-list>`) tiene filtros locales (no afectan las métricas globales):

- **Tipo**: `'all' | 'ingreso' | 'gasto'`
- **Origen**: `'all' | 'transaction' | 'installment' | 'subscription'`
- **Categoría**: dropdown poblado con las categorías presentes en el mes
- **Orden**: `'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'`

Para ordenar por monto, se compara el equivalente en ARS (usa `convertEntryToArs()` o estima con `latestRate()`). Así una cuota USD se compara correctamente con una transacción ARS.
