# Conversión USD ↔ ARS

Las compras con tarjeta y suscripciones pueden ser en USD. La app convierte automáticamente a ARS usando el dólar oficial vendedor y aplica el recargo correspondiente según la fecha del cierre y el tipo de gasto.

## ¿Por qué importa?

Los bancos argentinos cobran las compras en USD convirtiéndolas a pesos al cierre del resumen. La cotización usada es el **dólar oficial vendedor del día del cierre** (NO del día de la compra). Sobre ese valor se aplican recargos según el tipo de gasto y la fecha. Mostrar sólo el USD desnudo es engañoso: el usuario quiere saber "cuánto me va a debitar".

## Cotización del dólar

Se usa el endpoint público de [api.argentinadatos.com](https://argentinadatos.com).

### Endpoint puntual

`GET https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/{YYYY}/{MM}/{DD}`

Devuelve algo como:

```json
{
  "fecha": "2026-05-30",
  "compra": 1490,
  "venta": 1516.9,
  "casa": "oficial"
}
```

Se toma el campo `venta` (oficial vendedor).

### Fallback

Si el endpoint puntual falla (feriado, fin de semana sin cotización, error de red), se cae al endpoint general:

`GET https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial`

Devuelve un array con TODAS las cotizaciones históricas. Se busca la más cercana anterior o igual a la fecha pedida.

### Cache

Las cotizaciones se cachean en `localStorage` (`control-gastos:rates`) como `Record<YYYY-MM-DD, number>`. Una vez obtenida una fecha, no se vuelve a pedir.

Esto es seguro porque las cotizaciones del oficial son **inmutables**: una vez publicada, no cambia.

### Auto-fetch reactivo

`TransactionsService` tiene un `effect()` en el constructor que observa `monthlyEntries()`. Cada vez que cambia (porque el usuario cambió de mes, o agregó/borró movimientos), el effect:

1. Recolecta las fechas de cierre de todas las cuotas USD del mes.
2. Por cada fecha que no esté en cache y no se haya pedido antes, llama a `ensureRate(date)` (async, dispara fetch).
3. También pide el TC de hoy como referencia visible.

Las cotizaciones obtenidas actualizan `_rates`, lo que dispara la recomputación de los métricos que dependen de la conversión.

### Estimación con fallback

Si una fecha exacta no se puede obtener (ej. cuota futura cuyo cierre todavía no pasó), `convertEntryToArs` usa `latestRate()` (el TC más reciente conocido) y marca el resultado como `estimated: true`. La UI muestra un símbolo `≈` y la nota "TC estimado".

## Modos de surcharge (`SurchargeMode`)

```ts
type SurchargeMode =
  | 'auto'             // se infiere por fecha
  | 'none'             // sin recargo (override manual)
  | 'digital-service'  // +21% IVA Servicios Digitales
  | 'tourism'          // +30% servicios turísticos pagados en pesos
  | 'usd-payment';     // no se convierte, queda como obligación USD
```

### `surchargeForDate(date, mode)`

| Modo | Recargo |
|------|---------|
| `usd-payment` / `none` | 0 |
| `digital-service` | 0.21 |
| `tourism` | 0.30 |
| `auto` con cierre < 2024-12-01 | 0.60 (PAIS 30% + Ganancias 30%) |
| `auto` con cierre 2024-12-01 a 2026-01-02 | 0.30 (sólo Ganancias) |
| `auto` con cierre >= 2026-01-02 | 0 |

El recargo se calcula sobre el cierre, NO sobre la fecha de la compra. Eso garantiza que una compra USD pre-Dic 2024 con muchas cuotas vea cómo los % bajan a lo largo del tiempo según corresponde.

## Cálculo de la conversión

```ts
arsAmount = round(usdAmount × officialRate × (1 + surchargePct))
```

Donde `officialRate` es el TC oficial vendedor del día del cierre.

`convertEntryToArs(entry)` devuelve un `ArsConversionResult`:

```ts
interface ArsConversionResult {
  arsAmount: number;
  rate: number;        // TC usado
  surchargePct: number;
  estimated: boolean;  // true si se usó fallback
  rateDate: string;    // fecha del TC usado
}
```

Si la entrada es ARS o `usd-payment`, devuelve `null`.

## Cuándo aplicar cada modo

- **Compra normal (`auto`)**: producto físico del exterior, ej. compras en Amazon, AliExpress, eBay. Post Ene 2026 = sin recargo. Antes = el % histórico que aplicaba en ese momento.
- **Servicio digital del exterior (`digital-service`)**: Steam, Netflix, Spotify, Adobe, AWS, GitHub, etc. SIEMPRE aplica el 21% de IVA Servicios Digitales — fue uno de los pocos impuestos que NO se eliminó en 2026.
- **Servicio turístico (`tourism`)**: vuelos internacionales, hoteles, paquetes turísticos pagados en pesos a una agencia argentina. Sigue teniendo 30% de recargo en 2026.
- **Pago el resumen en USD (`usd-payment`)**: si decidís pagar el resumen directamente con tus dólares MEP/CCL/billete, no hay conversión. La cuota queda como obligación USD y aparece en el panel "A pagar directamente en USD". Útil si tenés dólares ahorrados y querés ahorrarte cualquier recargo y diferencia cambiaria.

## Panel USD

`<app-usd-summary>` aparece debajo de las tarjetas resumen cuando hay actividad en USD. Muestra hasta dos cards:

### "Cuotas USD convertidas a pesos"

Aparece si hay cuotas USD que se convierten (no son `usd-payment`). Muestra:

- Total en ARS estimado del mes.
- Última cotización conocida con fecha (referencia).

### "A pagar directamente en USD"

Aparece si hay cuotas con `usd-payment`. Muestra:

- Total en USD que el usuario va a pagar en dólares.
- Cantidad de cuotas.

## Override manual de TC

`setManualRate(date, rate)` permite forzar un valor de cotización para una fecha. Útil si:

- El usuario sabe el TC real con el que el banco le facturó.
- El endpoint falló y se quiere fijar manualmente.

Actualmente NO hay UI para esto, pero el método existe en el servicio. Se podría agregar en una próxima iteración (ej. click en el TC mostrado en la lista → input editable).

## Diferencias con calculadoras externas (Steamcito, etc.)

Las extensiones tipo Steamcito muestran el monto incluyendo el IVA Servicios Digitales (21%). Nuestra app coincide con ese cálculo cuando seleccionás "Servicio digital del exterior".

Para compras normales (`auto`) post Ene 2026, no aplica ningún recargo, por lo que el monto convertido será sólo `usd × oficial`. Si Steamcito muestra otro valor, probablemente sea porque la categoría que está calculando es servicios digitales.

Otros recargos que NO modelamos:
- **Ingresos Brutos provincial** (1.5-5.5% según provincia para servicios digitales). Se decidió no modelarlo para mantener la app simple y porque varía mucho por jurisdicción. Si tu provincia te aplica IIBB, considerar que el monto real será algo mayor que el que mostramos.
