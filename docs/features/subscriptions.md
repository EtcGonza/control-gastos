# Suscripciones

Cargos recurrentes mensuales con tarjeta de crédito (Netflix, Spotify, gimnasio, etc.), con historial de precios y baja/reactivación.

## Concepto

A diferencia de las compras con cuotas (que tienen un número fijo de cobros), una suscripción se cobra **indefinidamente** todos los meses hasta que el usuario la cancela. El sistema genera automáticamente los cargos para cada mes consultado.

Para preservar la realidad financiera:
- Los cargos pasados quedan registrados con el precio que tenían en ese momento.
- Cancelar una suscripción no borra los meses donde estuvo activa.
- Eliminar una suscripción la archiva (la oculta del panel) pero sigue contribuyendo al histórico.

## Ubicación en la UI

- **Panel** `<app-subscriptions-manager>` colapsable en la columna izquierda.
- Los cobros aparecen en la lista de movimientos con badge "Suscripción".

Archivos:
- Modelo: `src/app/models/subscription.model.ts`
- Componente: `src/app/components/subscriptions-manager/`
- Servicio: `addSubscription()`, `cancelSubscription()`, `reactivateSubscription()`, `addSubscriptionPrice()`, `removeSubscription()`, `subscriptionChargesForMonth()`, `priceForDate()`, `currentPrice()`

## Alta

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| Tarjeta | Sí | Select de tarjetas dadas de alta |
| Nombre | Sí | Ej. "Netflix" |
| Monto mensual | Sí | El precio actual |
| Moneda | Sí | ARS o USD |
| Tipo de gasto USD | Sí si USD | Default: `digital-service` (porque las suscripciones digitales son lo más común) |
| Fecha del primer cobro | Sí | El día de esa fecha será el día de cobro mensual. Max: hoy (no se permiten fechas futuras) |

Al crear, `priceHistory` se inicializa con una sola entrada: `{ from: startDate, amount: montoMensual }`.

## Día de cobro mensual

Se deriva de `startDate`. Si `startDate = 2026-05-15`, todos los meses se cobra el 15. En meses que no tienen ese día (`30` o `31` en febrero), se clampea al último día del mes.

## Generación de cargos por mes

`subscriptionChargesForMonth(month: string)` itera todas las suscripciones (incluyendo las archivadas, para preservar historial). Para cada una:

1. Considera los dos meses fuente posibles que podrían generar un cargo en `month`:
   - Mes M-1 con offset 1 (cobro antes del cierre del mes anterior).
   - Mes M-2 con offset 2 (cobro el mismo día o después del cierre, pasa al período siguiente).
2. Para cada candidato, calcula los días efectivos (clampeados) y verifica si el offset matchea.
3. Si matchea, genera el `chargeDate` y verifica que la sub esté activa en esa fecha.
4. Agrega el cargo con el precio vigente a `chargeDate`.

Ver [reglas de negocio](../business-logic.md#cargos-por-mes--algoritmo) para más detalle.

### Doble cargo en un mes

Por el clamping, una misma suscripción puede legítimamente aparecer **dos veces** en un mismo mes. Ver el ejemplo en [reglas de negocio](../business-logic.md#caso-especial-dos-cargos-del-mismo-sub-en-un-mismo-mes).

El ID de `MonthlyEntry` para subs incluye el `chargeDate` (`sub-${subscriptionId}-${chargeDate}`) para evitar colisiones.

## Historial de precios

`priceHistory: PriceEntry[]` es una lista ordenada por `from` ascendente. Cada entrada: `{ from: 'YYYY-MM-DD', amount: number }`.

`priceForDate(sub, date)` devuelve el precio vigente en `date`: la última entry con `from <= date`.

### Actualizar precio

`addSubscriptionPrice(id, amount, from)`:

1. Filtra cualquier entry existente con la misma fecha `from`.
2. Agrega `{ from, amount }`.
3. Reordena por `from`.

Esto permite cambiar el precio sin perder el histórico:
- Netflix arrancó a $1000 desde feb 2026.
- En jun 2026 subió a $1200 → agregás `{ from: '2026-06-01', amount: 1200 }`.
- Meses feb-may siguen mostrando $1000.
- Meses jun en adelante muestran $1200.

### Visualización del historial

Botón "Historial (N)" en cada suscripción del panel (sólo si N > 1) muestra una lista expandible con cada precio y su fecha de vigencia.

## Cancelación

`cancelSubscription(id, cancelDate)` setea el `cancelDate`. Ver [reglas de negocio](../business-logic.md#cancelación) para la regla fina del borde.

Regla rápida: si cancelaste **antes** del día del cobro de un mes → ese mes no se cobra. Si cancelaste el **mismo día o después** → ese mes sí se cobra (ya te lo debitaron).

## Reactivación

`reactivateSubscription(id)` elimina el `cancelDate`. Los meses entre la baja y la reactivación NO se cobran (la regla anterior aplicó durante ese período).

## Eliminación

`removeSubscription(id)` marca la suscripción como `archived: true` y le setea `cancelDate = hoy` si no estaba cancelada.

- El panel ya no la muestra.
- Pero `subscriptionChargesForMonth` sigue iterando sobre ella, así que los meses pasados donde estuvo activa siguen mostrando el cargo.

No hay "borrado real" desde la UI. Si querés purgar realmente una suscripción del archivo de datos, hay que editar el JSON exportado y reimportarlo.

## Modos de surcharge para suscripciones

A diferencia de las compras (que ofrecen 4 modos), las suscripciones tienen 3:

- **Servicio digital del exterior** (`digital-service`) – default para USD. +21% IVA. Para Netflix, Spotify, etc.
- **Compra normal** (`auto`) – sin recargo. Raro para subs, pero existe.
- **Pago el resumen en USD** (`usd-payment`) – no se convierte.

No se ofrece `tourism` porque los servicios turísticos no son típicamente recurrentes.

## Filtros del panel

- Tabs: Todos / Gastos / Ingresos (las subs siempre son gastos, pero el filtro es para consistencia con plantillas)
- Contador: `activas/total` (donde "activas" = no canceladas, "total" = no archivadas)
- Acciones por sub: Actualizar precio, Cancelar, Reactivar, Historial, Eliminar

## Validaciones

- Fecha del primer cobro: `max = hoy` (no se permite futuro).
- Fecha de cancelación: `min = startDate`, `max = hoy`.
- Monto: > 0.
