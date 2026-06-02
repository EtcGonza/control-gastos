# Modelo de datos

Todas las entidades son interfaces TypeScript definidas en `src/app/models/`. Se persisten en `localStorage` como arrays JSON.

## `Transaction` (movimientos manuales)

Archivo: `models/transaction.model.ts`

```ts
interface Transaction {
  id: string;            // UUID generado con crypto.randomUUID()
  type: 'ingreso' | 'gasto';
  description: string;
  amount: number;        // siempre en ARS, positivo
  category: Category;    // depende del tipo
  date: string;          // ISO YYYY-MM-DD
  fixed: boolean;        // si es true, se guarda como plantilla en RecurringTemplate
}
```

Las categorías son strings finitos:

- **Gastos**: `'Alquiler' | 'Servicios' | 'Alimentos' | 'Transporte' | 'Salud' | 'Entretenimiento' | 'Suscripciones' | 'Otros'`
- **Ingresos**: `'Sueldo' | 'Horas extras' | 'Otros'`

Las categorías tienen colores asignados en `CATEGORY_COLORS` para los círculos visuales en la lista.

## `RecurringTemplate` (fijos guardados)

Archivo: `models/recurring-template.model.ts`

```ts
interface RecurringTemplate {
  id: string;
  type: 'ingreso' | 'gasto';
  description: string;
  category: Category;
  amount: number;        // monto sugerido / último usado
  updatedAt: string;     // ISO date
}
```

Se crea automáticamente cuando se carga una transacción con `fixed: true`. Si ya existe una con misma combinación de `type + category + description.toLowerCase()`, se actualiza el `amount`.

Editar el `amount` de una plantilla NO modifica las transacciones ya creadas a partir de ella; sólo cambia el monto sugerido para futuras aplicaciones.

## `CreditCard` (tarjetas)

Archivo: `models/credit-card.model.ts`

```ts
type CardBrand = 'Visa' | 'Mastercard';

interface CreditCard {
  id: string;
  brand: CardBrand;
  bank: string;
  closingDay: number;    // día del mes 1-31
  notes?: string;        // alias o info adicional (opcional)
  createdAt: string;
}
```

El `closingDay` es nominal. Si el día no existe en un mes específico (ej. 30 en febrero), el sistema lo clampea al último día del mes en los cálculos de facturación. Ver [reglas de negocio](./business-logic.md#día-de-cierre-y-clamping).

## `CardPurchase` (compras con cuotas)

Archivo: `models/card-purchase.model.ts`

```ts
type Currency = 'ARS' | 'USD';

type SurchargeMode =
  | 'auto'             // se infiere por fecha del cierre
  | 'none'             // sin recargo
  | 'digital-service'  // +21% IVA (Steam, Netflix, etc.)
  | 'tourism'          // +30% (vuelos, hoteles)
  | 'usd-payment';     // no se convierte a ARS

interface CardPurchase {
  id: string;
  cardId: string;             // FK → CreditCard.id
  description: string;
  totalAmount: number;        // total a debitar (suma de las N cuotas)
  installments: number;       // cantidad de cuotas (N)
  purchaseDate: string;       // ISO YYYY-MM-DD
  currency: Currency;
  category: Category;
  surchargeMode?: SurchargeMode; // sólo aplica si currency === 'USD'
  closingDaySnapshot?: number;   // freeze del cierre si se editó con "sólo a futuro"
  createdAt: string;
}
```

Las cuotas no se persisten individualmente: se calculan en runtime desde el `purchaseDate`, `installments`, y el día de cierre de la tarjeta (o el snapshot si existe).

### `Installment` (cuota virtual, no se persiste)

```ts
interface Installment {
  purchase: CardPurchase;
  cardLabel: string;
  number: number;       // 1..N
  total: number;        // N
  amount: number;       // totalAmount / installments, redondeado
  month: string;        // YYYY-MM en que se cobra
  closingDayForBill: number;
}
```

## `Subscription` (suscripciones recurrentes)

Archivo: `models/subscription.model.ts`

```ts
interface PriceEntry {
  from: string;    // ISO YYYY-MM-DD - desde cuándo aplica este precio
  amount: number;
}

interface Subscription {
  id: string;
  cardId: string;             // FK → CreditCard.id
  description: string;        // ej. "Netflix"
  currency: Currency;
  startDate: string;          // ISO - fecha del primer cobro (define el día de cobro mensual)
  cancelDate?: string;        // ISO - si está cancelada
  priceHistory: PriceEntry[]; // siempre ≥ 1 entry, ordenado por `from` asc
  archived?: boolean;         // soft delete: se oculta pero conserva historial
  closingDaySnapshot?: number;
  surchargeMode?: SurchargeMode;
  createdAt: string;
}
```

El día del mes de la fecha `startDate` se convierte en el día de cobro mensual (clampeado al último día del mes si no existe).

`priceHistory` mantiene los precios con su fecha de vigencia. Al renderizar un cobro, se usa el precio activo a la fecha de ese cobro específico.

Cuando se "elimina" una suscripción, en realidad se marca `archived: true` y se setea `cancelDate` a hoy. Esto la oculta del panel pero conserva los cargos pasados en los meses donde estuvo activa.

## `MonthlyEntry` (entrada unificada para la vista mensual)

Definido en `services/transactions.service.ts`. NO se persiste — es el shape común que devuelve `monthlyEntries()`:

```ts
interface MonthlyEntry {
  id: string;
  source: 'transaction' | 'installment' | 'subscription';
  type: 'ingreso' | 'gasto';
  description: string;
  amount: number;           // en la moneda original (ARS o USD)
  category: Category;
  date: string;
  fixed: boolean;
  currency: Currency;
  conversion?: UsdConversion; // sólo si currency === 'USD'
  installment?: {            // sólo si source === 'installment'
    number: number;
    total: number;
    cardLabel: string;
    purchaseId: string;
  };
  subscription?: {           // sólo si source === 'subscription'
    cardLabel: string;
    subscriptionId: string;
  };
}

interface UsdConversion {
  closingDate: string;     // ISO - fecha del cierre del resumen donde se convierte
  surchargePct: number;    // 0, 0.21, 0.30 o 0.60
  usdDirect: boolean;      // true si el modo es 'usd-payment'
}
```

`MonthlyEntry` unifica las tres fuentes (transacciones reales, cuotas virtuales, cargos de suscripción) bajo un solo shape, lo que permite que componentes como `transaction-list` y los computeds de métricas las procesen uniformemente.

## `ExportFile` (formato de backup)

Definido en `services/transactions.service.ts`. Es el formato del JSON descargado por el botón "Exportar":

```ts
interface ExportFile {
  app: 'control-gastos';
  schemaVersion: number;   // actual: 1
  exportedAt: string;      // ISO timestamp
  data: {
    transactions: Transaction[];
    templates: RecurringTemplate[];
    cards: CreditCard[];
    purchases: CardPurchase[];
    subscriptions: Subscription[];
    rates: Record<string, number>;
  };
}
```

Ver [feature de backup](./features/data-backup.md).

## Relaciones entre entidades

```
┌─────────────────┐
│   CreditCard    │
└────────┬────────┘
         │ id
         ├───────────┐
         │           │
   ┌─────▼─────┐  ┌──▼──────────────┐
   │CardPurchase│  │ Subscription   │
   └───────────┘  └─────────────────┘
         │              │
         │ (genera)     │ (genera)
         ▼              ▼
   ┌──────────────────────────┐
   │      Installment          │
   │  (virtual, no persistido) │
   └──────────────────────────┘

┌──────────────┐         ┌───────────────────┐
│ Transaction  │────────▶│ RecurringTemplate │
│ (fixed=true) │  upsert │  (auto-creada)    │
└──────────────┘         └───────────────────┘
```

- Una tarjeta tiene N compras y N suscripciones.
- Borrar una tarjeta borra sus compras y archiva sus suscripciones.
- Una transacción manual con `fixed=true` upserta automáticamente una plantilla.
- Las plantillas viven independientes; aplicar una plantilla crea una nueva transacción.

## IDs

Todos los IDs son UUIDs generados con `crypto.randomUUID()`. Garantizan unicidad sin coordinación, perfecto para almacenamiento local.
