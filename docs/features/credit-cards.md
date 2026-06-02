# Tarjetas de crédito

Alta, edición y baja de tarjetas que después se usan para registrar compras en cuotas y suscripciones.

## Ubicación en la UI

- **Panel** `<app-cards-manager>` colapsable en la columna izquierda.

Archivos:
- Modelo: `src/app/models/credit-card.model.ts`
- Componente: `src/app/components/cards-manager/`
- Servicio: `TransactionsService.addCard()`, `.updateCard()`, `.removeCard()`, `.cardLabel()`, `.cardHasEntries()`

## Datos que se piden

| Campo | Obligatorio | Validación |
|-------|-------------|------------|
| Marca | Sí | `'Visa' \| 'Mastercard'` (toggle de dos botones) |
| Banco | Sí | Texto libre |
| Día de cierre | Sí | Entero 1-31 |
| Alias / notas | No | Texto libre |

El alias se concatena al label de la tarjeta cuando se muestra en otros lugares: `${brand} · ${bank} · ${notes}` (si notes existe), sino `${brand} · ${bank}`.

## Día de cierre

Es el día del mes en que cierra el resumen de la tarjeta (NO confundir con el día de vencimiento/pago). Se usa para calcular en qué mes aparece cada compra o cargo de suscripción.

Comportamiento de clamping: si elegís 30 o 31, en meses cortos (febrero, abril, etc.) el cierre real se aplica el último día del mes. Ver [reglas de negocio](../business-logic.md#día-de-cierre-y-clamping).

## Editar tarjeta

Click en el lápiz de una tarjeta → la fila se transforma en formulario inline pre-llenado.

### Modo de aplicación cuando cambia el día de cierre

Si el usuario cambia el `closingDay` y la tarjeta ya tiene compras o suscripciones asociadas, aparece un panel que ofrece dos opciones:

#### Aplicar retroactivamente

Recalcula todos los meses (pasados y futuros) con el nuevo cierre.

Implementación: limpia `closingDaySnapshot` en todas las `CardPurchase` y `Subscription` de la tarjeta. Las compras/subs usan el nuevo `closingDay` para sus cálculos.

Útil cuando se cargó mal el cierre desde el principio y se quiere corregir todo el histórico.

#### Aplicar sólo a futuro

Las compras y suscripciones ya cargadas conservan el cierre anterior.

Implementación: en cada `CardPurchase` y `Subscription` que **no tenga** `closingDaySnapshot`, se setea con el viejo `closingDay`. Luego se actualiza el `closingDay` de la tarjeta. Los movimientos nuevos van a usar el nuevo cierre, los viejos siguen con el snapshot.

Útil cuando la tarjeta efectivamente cambió de cierre y los meses pasados son históricamente correctos.

Si la tarjeta no tiene movimientos asociados, no se muestra el panel — el cambio se aplica directamente sin preguntar.

## Eliminar tarjeta

Click en el tachito → confirmación modal. Si se confirma:

1. Se eliminan todas las `CardPurchase` de esa tarjeta.
2. Se eliminan todas las `Subscription` de esa tarjeta.
3. Se elimina la `CreditCard`.

**Esto sí pierde historial** (a diferencia de archivar una suscripción individualmente). Si querés conservar histórico, no borres la tarjeta; en todo caso, dejá de cargar movimientos nuevos en ella.

## Helper `cardLabel(card)`

```ts
cardLabel(c: CreditCard): string {
  const main = `${c.brand} · ${c.bank}`;
  return c.notes ? `${main} · ${c.notes}` : main;
}
```

Se usa en muchos lugares: select de tarjeta en el form, lista de cuotas, panel de subs, etc.

## Helper `cardHasEntries(cardId)`

```ts
cardHasEntries(id: string): boolean {
  return this._purchases().some((p) => p.cardId === id) ||
         this._subscriptions().some((s) => s.cardId === id);
}
```

Lo usa el cards-manager para decidir si mostrar el panel de retroactivo/futuro al editar el día de cierre.
