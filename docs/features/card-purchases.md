# Compras con tarjeta (cuotas)

Registro de compras pagadas con tarjeta de crédito que se cobran en N cuotas mensuales.

## Concepto

Una compra con tarjeta no es una transacción puntual: se cobra en N cuotas a lo largo de N meses consecutivos. Cargar manualmente cada cuota cada mes es repetitivo y propenso a errores. La idea: guardar la compra una sola vez con `totalAmount`, `installments` y `purchaseDate`, y dejar que el sistema **genere las cuotas virtualmente** mes a mes.

Cuotas virtuales = no se persisten. Se calculan en runtime cuando se consulta el mes.

## Ubicación en la UI

- **Form**: tab "Tarjeta" en `<app-transaction-form>`.
- **Lista**: las cuotas aparecen como filas en `<app-transaction-list>` con el badge "Cuota N/X".

Archivos:
- Modelo: `src/app/models/card-purchase.model.ts`
- Servicio: `TransactionsService.addPurchase()`, `.removePurchase()`, `.installmentsForMonth()`

## Datos que se piden

| Campo | Obligatorio |
|-------|-------------|
| Tarjeta | Sí (select de tarjetas dadas de alta) |
| Descripción | Sí |
| Total a pagar | Sí — la **suma de las cuotas**, no el precio del producto |
| Cantidad de cuotas | Sí |
| Fecha de compra | Sí |
| Moneda | Sí (ARS / USD) |
| Categoría | Sí (gastos) |
| Tipo de gasto USD | Sí si moneda = USD (ver [USD](./usd-conversion.md)) |

### "Total a pagar" vs "Precio del producto"

Tooltip aclara: si la compra tiene interés (CFT), tenés que cargar el **monto total que te va a debitar la tarjeta**, NO el precio del producto.

Ejemplo: Nintendo Switch a $80.000 en 18 cuotas con un CFT que lleva el total a $103.500 → cargar `totalAmount = 103500`, `installments = 18`. Cada cuota: $5.750.

Si la compra es "sin interés", el total = precio: `totalAmount = 80000`, cada cuota: $4.444,44.

Esto garantiza que las cuotas que genera el sistema coincidan con lo que efectivamente cobra el banco.

## Generación de cuotas

`installmentsForMonth(month: string): Installment[]` itera todas las `CardPurchase` y para cada una decide si tiene una cuota en el mes consultado:

```ts
for (const p of this._purchases()) {
  const card = this._cards().find((c) => c.id === p.cardId);
  if (!card) continue;
  const closingDay = p.closingDaySnapshot ?? card.closingDay;
  const firstMonth = this.firstBillingMonth(p.purchaseDate, closingDay);
  const diff = this.monthDiff(firstMonth, month);
  if (diff >= 0 && diff < p.installments) {
    result.push({
      purchase: p,
      cardLabel: this.cardLabel(card),
      number: diff + 1,
      total: p.installments,
      amount: this.roundMoney(p.totalAmount / p.installments),
      month,
      closingDayForBill: closingDay,
    });
  }
}
```

### `firstBillingMonth(purchaseDate, closingDay)`

Ver [reglas de negocio](../business-logic.md#cálculo-del-mes-de-facturación). Resumen:

- Si la compra es estrictamente antes del día efectivo de cierre del mes → primera cuota en mes+1.
- Si la compra es el mismo día o posterior → primera cuota en mes+2.

### Monto por cuota

`roundMoney(totalAmount / installments)`. Por simplicidad, todas las cuotas tienen el mismo monto (no se distribuyen los centavos). Esto puede divergir levemente del banco real, que ajusta la última cuota para que sumen exactamente el total. Para la mayoría de los casos prácticos no es relevante.

## Eliminación

Borrar una cuota desde la lista mensual elimina la `CardPurchase` entera (todas las cuotas pasadas y futuras), con confirmación modal.

No hay forma de "marcar como pagada" una cuota individualmente — el sistema asume que todas las cuotas se pagan a su debido tiempo.

## Compras en USD

Si la compra es en USD, además de los campos comunes se pide el "Tipo de gasto USD" para decidir cómo se convierte (o no) cada cuota a ARS:

- **Compra normal** (`auto`): aplica el recargo histórico según la fecha del cierre. Para fechas post Ene 2026 = sin recargo.
- **Servicio digital del exterior** (`digital-service`): +21% IVA sobre el oficial.
- **Servicio turístico** (`tourism`): +30%.
- **Pago el resumen en USD** (`usd-payment`): no se convierte, queda como obligación en USD.

Ver [USD y conversión](./usd-conversion.md) para detalle.

## Snapshot del día de cierre

Si la tarjeta editó su `closingDay` con la opción "sólo a futuro", la compra mantiene su `closingDaySnapshot` con el cierre anterior. Las cuotas siguen calculándose con ese snapshot. Ver [credit-cards](./credit-cards.md#aplicar-sólo-a-futuro).

## Display en la lista

Cada cuota aparece como una fila en la lista de movimientos con:

- Categoría a la izquierda (color)
- Descripción + badge "Cuota N/X"
- Si moneda USD: badge "USD" y badge "+XX%" si tiene surcharge
- Si es pago directo USD: badge "Pago USD"
- Categoría · Tarjeta (cardLabel)
- Monto en moneda original
- Si USD y no es pago directo: segundo renglón con equivalente ARS y TC usado

Click en eliminar (visible en hover) → elimina la compra completa.

## Métricas que afecta

Las cuotas suman en:

- `monthlyExpenses` (siempre, convertidas a ARS si son USD).
- `monthlyFixedExpenses` (siempre, porque tienen `fixed: true` implícito).
- `expensesByCategory`.
- `monthlyExpensesUSD` (sólo si son pago directo USD).
- `monthlyConvertedFromUSD` (sólo si son USD convertidas).

El resultado: el % de gastos fijos sobre ingresos del mes incluye las cuotas. Esto es realista — una cuota de tarjeta es una obligación que no podés evitar ese mes.
