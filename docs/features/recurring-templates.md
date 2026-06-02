# Fijos guardados (recurring templates)

Plantillas de movimientos recurrentes (alquiler, sueldo, etc.) que se pueden cargar rápidamente cada mes sin reingresar todos los datos.

## Concepto

Un **fijo** es un movimiento que se repite todos los meses (alquiler, sueldo, suscripción a un gimnasio). Cargarlo a mano cada mes es repetitivo. La idea de las plantillas: guardar el movimiento la primera vez y "aplicarlo" con un click en los meses siguientes, con el monto pre-cargado.

Crucial: editar el monto de una plantilla NO modifica las transacciones ya creadas a partir de ella. Sólo cambia el monto sugerido para la próxima aplicación. Esto preserva el histórico real.

## Ubicación en la UI

- **Panel** `<app-recurring-templates>` colapsable en la columna derecha (arriba de la lista de movimientos).

Archivos:
- Modelo: `src/app/models/recurring-template.model.ts`
- Componente: `src/app/components/recurring-templates/`
- Servicio: `TransactionsService.upsertTemplate()`, `.updateTemplateAmount()`, `.removeTemplate()`, `.applyTemplateToSelectedMonth()` en `src/app/services/transactions.service.ts`

## Cómo se crean

Las plantillas se generan automáticamente cuando el usuario carga una transacción con el checkbox "Es un ingreso/gasto fijo mensual" marcado.

`upsertTemplate({ type, description, category, amount })`:

1. Calcula una clave única: `${type}::${category}::${description.trim().toLowerCase()}`.
2. Busca una plantilla con esa clave.
3. Si existe, actualiza `amount` y `updatedAt`.
4. Si no, crea una nueva con UUID.
5. Persiste en `localStorage` (`control-gastos:templates`).

Por eso si cargás dos veces "Alquiler" con monto distinto, NO se crean dos plantillas: la segunda actualiza la primera.

## Aplicar una plantilla

`applyTemplateToSelectedMonth(templateId)`:

1. Verifica que no haya ya una transacción aplicada de esta plantilla en el mes (ver "duplicados" más abajo).
2. Calcula la fecha de la nueva transacción:
   - Si el mes seleccionado es el actual → usa la fecha de hoy.
   - Si no → usa el día 1 del mes seleccionado.
3. Crea una nueva `Transaction` con el monto de la plantilla, `fixed: true`.
4. Persiste.

Una vez aplicada, la plantilla queda visible pero el botón "Cargar en mes" cambia a un indicador "Ya cargado este mes".

### Detección de duplicados

`isTemplateAppliedThisMonth(tpl)`: busca en `_transactions()` alguna que tenga el mismo `templateKey` y caiga en el mes seleccionado. Si existe, la plantilla se considera aplicada.

Esto previene aplicar dos veces el mismo alquiler en el mismo mes por accidente.

## Filtros del panel

El panel ofrece:

- **Tabs**: Todos / Gastos / Ingresos
- **Toggle "Ocultar los ya cargados este mes"** (persiste en `control-gastos:templates-hide-applied`)

Al lado del toggle se muestra cuántas plantillas están actualmente aplicadas en el mes activo.

## Editar el monto

Click en el monto de una plantilla → input inline. Enter para confirmar, Escape para cancelar. Llama a `updateTemplateAmount(id, newAmount)`, que sólo modifica `amount` y `updatedAt` de la plantilla. NO toca transacciones existentes.

## Eliminar

Botón de tachito → elimina la plantilla del array `_templates`. NO toca transacciones ya creadas a partir de ella (porque éstas son independientes una vez creadas).

## Diferencia con suscripciones

A primera vista, una plantilla parece similar a una suscripción. Pero hay diferencias importantes:

| | Plantilla | Suscripción |
|---|-----------|-------------|
| Carga | Manual (click "Cargar en mes") | Automática cada mes |
| Tarjeta | No usa | Asociada a una tarjeta |
| Día de cobro | Día de carga (variable) | Día fijo derivado de `startDate` |
| Conversión USD | No (sólo ARS) | Sí (puede ser USD con surcharge) |
| Historial de precios | No (un solo monto) | Sí (`priceHistory[]`) |
| Cancelación | Eliminar borra; transacciones quedan | Cancelar marca `cancelDate`; pasados quedan |

Usar plantillas para: alquiler, sueldo, expensas, prepaga (si pagás manual). Usar suscripciones para: Netflix, Spotify, Gym (cargo automático con tarjeta).
