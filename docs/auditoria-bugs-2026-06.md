# Auditoría de bugs — Control de Gastos

**Fecha:** 2026-06-11
**Alcance:** cálculos, operaciones, lógica de negocio y UX/UI.
**Método:** lectura de los 14 services de `core/`, utils, modelos y todos los componentes de `pages/` + `shared/`. Cada hallazgo fue verificado contra el código real (se descartaron varios falsos positivos del barrido inicial: no hay división por cero en el preview de cuotas, ni race conditions en los formularios con signals, ni fugas de memoria reales en `month-selector`).

Modo: **reportar + proponer fix** (no se modificó código).

---

## Resumen

| # | Severidad | Área | Bug |
|---|-----------|------|-----|
| 1 | **Alta** | Suscripciones | Una suscripción puede contarse **dos veces** en un mes (cierre cerca de fin de mes + febrero) |
| 2 | Media | Tarjetas | El redondeo por cuota hace que la suma de cuotas ≠ total de la compra |
| 3 | Media | Simulador | El warning de "cuotas exceden horizonte" **dice lo contrario** de lo que calcula |
| 4 | Media | Simulador | Una compra "contado" con fecha pasada se ignora (contradice su propia doc) |
| 5 | Media | Análisis | El donut de categorías **no se dibuja** cuando hay una sola categoría (100%) |
| 6 | Media | Ahorros | Los retiros no validan saldo → saldo negativo silencioso |
| 7 | Baja | Global | Montos en ARS formateados con `currency:'USD'` sin locale es-AR |
| 8 | Baja | Fechas | `todayIso()` usa UTC → "hoy" se adelanta un día de noche (UTC-3) |
| 9 | Baja | Mes | Editar una transacción a "fijo" no genera plantilla (inconsistente con alta) |
| 10 | Baja | UX varios | Validaciones que permiten 0, campos que no resetean, filtro sin "servicio" |

---

## 1. Suscripción contada dos veces en un mes — **Alta**

**Archivo:** `src/app/core/services/subscriptions.service.ts` · `subscriptionChargesForMonth()` (líneas ~243-270)

El método prueba dos meses fuente (`offsetTry` 1 y 2) y hace `result.push(...)` **sin cortar el loop** después de un match. La intención es que cada mes-fuente mapee a un único mes destino, pero por el *clamp* de días en meses cortos (febrero) los dos `offsetTry` pueden matchear a la vez y empujar **dos cargos** de la misma suscripción en el mismo mes.

**Caso reproducible:** cierre de tarjeta `closingDay = 30`, suscripción con `chargeDay = 29`, mes mostrado = **Abril 2026**.

- `offsetTry = 1` → fuente Marzo (31 días): `29 < 30` → offset real 1 → carga el 2026-03-29 ✓ push
- `offsetTry = 2` → fuente Febrero (28 días): `min(29,28)=28`, `min(30,28)=28` → `28 < 28` es falso → offset real 2 → carga el 2026-02-28 ✓ push

Resultado: la suscripción aparece **dos veces** en Abril, inflando gastos del mes, el % de gastos fijos y el análisis.

> Nota: el simulador (`simulation.service.ts` → `suscripcionImpact`) usa la misma lógica pero hace `return` en el primer match, así que **no** duplica. Las dos implementaciones quedan inconsistentes entre sí; la correcta es la del simulador.

**Fix propuesto** — cortar tras el primer match (igual que el simulador):

```ts
for (const offsetTry of [1, 2]) {
  // ...cálculo de actualOffset...
  if (actualOffset !== offsetTry) continue;

  const chargeDate = `${sY}-${String(sM).padStart(2, '0')}-${String(effChargeDay).padStart(2, '0')}`;
  if (chargeDate < sub.startDate) continue;
  if (sub.cancelDate && sub.cancelDate < chargeDate) continue;

  result.push({ /* ... */ });
  break; // ⬅️ una suscripción aporta como máximo un cargo por mes
}
```

---

## 2. La suma de cuotas no coincide con el total de la compra — **Media**

**Archivo:** `src/app/core/services/cards.service.ts` · `installmentsForMonth()` (línea 200)

```ts
amount: roundMoney(p.totalAmount / p.installments),
```

Cada cuota se redondea por separado, así que la suma de las N cuotas puede diferir del total real. Ej.: `$100 / 3 = $33,33` → `33,33 × 3 = $99,99` (faltan $0,01). Con montos grandes y muchas cuotas la diferencia se nota en los totales mensuales y en el simulador.

**Fix propuesto** — que la última cuota absorba el residuo:

```ts
const base = roundMoney(p.totalAmount / p.installments);
const isLast = diff + 1 === p.installments;
const amount = isLast
  ? roundMoney(p.totalAmount - base * (p.installments - 1))
  : base;
// ...usar `amount` en el push
```

---

## 3. El warning del simulador contradice lo que calcula — **Media**

**Archivo:** `src/app/core/services/simulation.service.ts` · `collectStructuralWarnings()` (línea 518)

El mensaje dice:

> "El total real **considera todas las cuotas**, pero la tabla sólo muestra las primeras."

Pero `totalRealArs` / `totalNominalArs` se acumulan **dentro de `horizon.map()`** (líneas 58-80), es decir solo sobre los meses del horizonte. Las cuotas que caen más allá del horizonte **no se suman al total**. De hecho el tooltip de `simulation-summary.component.html` (líneas 28-32) dice lo correcto ("ambos totales reflejan sólo lo que cae dentro del horizonte"). El que está mal es el warning.

**Fix propuesto** — alinear el texto con el cálculo:

```ts
message: `La compra es en ${item.installments} cuotas pero el horizonte es de ${config.horizonMonths} meses. Los totales reflejan sólo las cuotas que caen dentro del horizonte; ampliá el horizonte para ver el costo completo.`,
```

---

## 4. Una compra "contado" con fecha pasada se ignora — **Media**

**Archivo:** `src/app/core/services/simulation.service.ts` · `contadoImpact()` (líneas 310-320)

El comentario dice: *"Una sola incidencia en el mes del `purchaseDate` (**o el primer mes del horizonte si es anterior**)"*, pero el código no implementa ese fallback:

```ts
const purchaseMonth = item.purchaseDate.slice(0, 7);
if (purchaseMonth !== month) return { arsImpact: 0, arsImpactNominal: 0 };
```

Si `purchaseDate` es anterior al mes actual (inicio del horizonte), `purchaseMonth` no coincide con ningún mes del horizonte y la compra aporta **0** a toda la simulación, sin warning. El usuario ve la simulación "sin impacto" sin entender por qué.

**Fix propuesto** — imputar al primer mes del horizonte si la fecha quedó atrás:

```ts
const horizonStart = month; // ya iteramos por offset; el offset 0 es el primer mes
const purchaseMonth = item.purchaseDate.slice(0, 7);
const effectiveMonth = purchaseMonth < /* primer mes del horizonte */ firstHorizonMonth
  ? firstHorizonMonth
  : purchaseMonth;
if (effectiveMonth !== month) return { arsImpact: 0, arsImpactNominal: 0 };
```

(o, más simple: validar en el form que `purchaseDate` no sea anterior al mes actual y avisar al usuario).

---

## 5. El donut de categorías no se dibuja con una sola categoría — **Media**

**Archivo:** `src/app/pages/analisis-page/components/analytics/analytics.component.ts` · `categorySlices()` (líneas 186-210)

Cuando hay gasto en **una sola** categoría, `sliceAngle = 2π`. Los puntos de inicio y fin del arco caen en la **misma coordenada** (`cos/sin` de `startAngle` y `startAngle + 2π` son idénticos), así que el path `A ... ` es de longitud cero y **SVG no dibuja nada**: el donut aparece vacío aunque haya datos.

**Fix propuesto** — caso especial para un único slice ≥ 99.99% (dibujar un anillo completo con dos semicírculos):

```ts
if (data.length === 1) {
  // anillo completo: dos arcos de media vuelta
  const ringPath = [
    `M${cx} ${cy - rOuter}`,
    `A${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter}`,
    `A${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter}`,
    `M${cx} ${cy - rInner}`,
    `A${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner}`,
    `A${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner}`,
    'Z',
  ].join(' ');
  // ...devolver un slice con arcPath = ringPath y pct = 100
}
```

---

## 6. Los retiros de ahorro no validan el saldo — **Media**

**Archivos:**
`src/app/core/services/savings.service.ts` · `addSavingMovement()` (líneas 134-148)
`src/app/pages/ahorros-page/components/savings/savings.component.ts` · `addMovement()` (líneas 120-131)

Un retiro mayor al saldo deja el ahorro en negativo sin advertencia. El total general (`savingsTotalArs` / `savingsGrandTotalArs`) se contamina silenciosamente.

**Fix propuesto** — validar en el componente antes de registrar (mejor UX que bloquear en el service):

```ts
addMovement(savingId: string): void {
  if (this.movementAmount == null || this.movementAmount <= 0) return;
  if (this.movementDate > this.today) return;

  if (this.movementType === 'withdrawal') {
    const saving = this.tx.savings().find(s => s.id === savingId);
    if (saving && this.movementAmount > saving.amount) {
      // mostrar mensaje "El retiro supera el saldo disponible ($X)"
      return;
    }
  }
  // ...resto igual
}
```

---

## 7. Montos en ARS formateados como USD sin locale — **Baja**

**Archivos:** `summary-cards.component.html` (líneas 13, 35, 60, 85) y otros templates que usan `| currency:'USD':'symbol':'1.2-2'`. `app.config.ts` no registra `LOCALE_ID`.

La app trabaja en pesos pero formatea con el código `'USD'` y locale por defecto `en-US`, por lo que los importes salen como `$1,234.56` (separadores anglosajones) en vez de `$1.234,56`. Si algún día se registra `es-AR`, el código `'USD'` mostraría `US$` sobre montos que son pesos.

**Fix propuesto** — registrar locale es-AR y usar el pipe `number` (o currency con código `ARS`):

```ts
// main.ts / app.config.ts
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
registerLocaleData(localeEsAr);
// providers: [{ provide: LOCALE_ID, useValue: 'es-AR' }]
```

```html
<!-- y en templates -->
{{ tx.monthlyIncome() | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
```

---

## 8. `todayIso()` usa UTC — **Baja**

**Archivo:** `src/app/core/utils/date.utils.ts` · `todayIso()` (líneas 8-10)

```ts
return new Date().toISOString().slice(0, 10);
```

`toISOString()` devuelve la fecha en **UTC**. En Argentina (UTC-3), entre las 21:00 y la medianoche el "hoy" calculado ya es el día siguiente. Afecta los defaults de fecha y las comparaciones `startDate > today` en suscripciones, ahorros y plantillas. El mismo patrón aparece inline en varios componentes (`new Date().toISOString().slice(0,10)`).

**Fix propuesto** — usar fecha local:

```ts
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

(y reemplazar los `new Date().toISOString().slice(0,10)` inline por `todayIso()`).

---

## 9. Editar una transacción a "fijo" no crea plantilla — **Baja**

**Archivos:** `transaction-list.component.ts` · `saveEditTx()` (líneas 56-67) → `transactions.service.ts` · `updateTransaction()` (líneas 431-447)

Al **dar de alta** una transacción con `fixed: true` se hace `upsertTemplate` (alta de plantilla). Pero al **editar** una transacción existente y marcarla como fija, `updateTransaction` no crea la plantilla. El usuario espera el mismo comportamiento en ambos flujos.

**Fix propuesto** — replicar el `upsertTemplate` en `updateTransaction` cuando el patch deja `fixed: true`.

---

## 10. Validaciones y UX menores — **Baja**

Bugs chicos verificados, agrupados:

- **Permiten valor 0:** `subscriptions-manager.savePrice()` (línea 117, `< 0` deja pasar precio $0) y `recurring-templates.confirmEdit()` (`>= 0` deja pasar plantilla en $0). Cambiar a `<= 0` / `> 0`.
- **Campos que no resetean tras submit:** `transaction-form` no resetea `cDate` ni `cCategory`/`cCurrency` en `submitPurchase()`, ni `category`/`date` en `submit()`. Quedan con el valor anterior y confunden al cargar la operación siguiente.
- **Filtro por origen incompleto:** en `transaction-list`, el tipo `SourceFilter` (línea 9) no incluye `'service'`, así que no se puede filtrar los cargos de servicios aunque aparezcan en la lista.
- **Mes con ingresos $0 se ve "cómodo":** en `simulation.service.ts` (líneas 85-92) y `summary-cards`, cuando los ingresos proyectados son 0, `committedPct = 0` → el mes se pinta verde ("holgado") aunque el balance sea negativo. Conviene marcarlo como crítico/rojo si hay gastos y no hay ingresos.
- **Análisis incluye suscripciones archivadas:** `subEvolutions` / `subTotals` iteran `subscriptions()` sin filtrar `archived`. Si era a propósito (mostrar histórico), ignorar; si no, filtrar.
- **Reuso de nombre de categoría archivada bloqueado:** `categories.service.nameExistsInType()` (líneas 159-174) no excluye archivadas, así que no podés crear una categoría nueva con el nombre de una que archivaste.

---

## Lo que está bien

Vale aclararlo: la lógica de cierre de tarjetas (`firstBillingMonth`), la conversión USD con recargos históricos (PAÍS/Ganancias/IVA), el soft-delete con snapshots de día de cierre, la migración idempotente de categorías y la validación del archivo de import están **sólidas y bien pensadas**. La mayoría de los bugs son de borde (febrero, importes en 0, fechas UTC) o de mensajes/UX, no de la mecánica central.
