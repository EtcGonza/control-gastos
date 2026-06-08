---
plan: 2026-06-feat-modulo-servicios
tipo: feat
estado: backlog
prioridad: media
fecha-creacion: 2026-06-07
fecha-inicio: —
fecha-fin: —
modulo: src/app/pages/servicios-page
tags: [servicios, recurrente, proyeccion, mvp]
---

# Plan de Implementación — Módulo de Servicios

> **Objetivo**: agregar una sección dedicada para servicios públicos recurrentes (luz, gas, agua, internet, cable, etc.) que permita al usuario cargar cada factura recibida, ver el histórico, y obtener una proyección de la próxima factura (fecha estimada + monto estimado) que aparezca en el flujo mensual.

---

## 1. Resumen

- **Qué**: una entidad nueva `UtilityService` con su propio CRUD y sub-colección de facturas (`ServiceBill[]`). El sistema infiere el intervalo entre facturas a partir del histórico cargado por el usuario (no se declara "frecuencia") y proyecta la próxima.
- **Dónde**: `src/app/pages/servicios-page/` + `src/app/core/models/service/` + `src/app/core/services/services.service.ts`.
- **Persistencia**: nueva clave `STORAGE_KEYS.services`.
- **Integración**:
  - Los pagos previstos aparecen en `entriesForMonth(month)` con `source: 'service'`, suman a `monthlyFixedExpenses` y al `committedPct`.
  - El simulador los considera automáticamente (gratis vía `entriesForMonth`).
  - El backup los exporta/importa.
- **Widget en Mes-page**: "Próximas facturas de servicios" como entrada visible al módulo.

### Lo que NO incluye el MVP (queda para v2)

- Detección de estacionalidad para el estimado (ej. "luz de enero estima con enero del año pasado").
- Carga de medidores (kWh, m³) y costo por unidad.
- Recordatorios push / alertas previas al vencimiento.
- Adjuntar PDF de la factura.
- Distinguir "factura emitida" vs "cuota 1 de 2 de un bimestre". En el MVP, **cada pago es una factura** (atómico).
- Snapshot del `closingDay` por factura. Si el usuario cambia el cierre de la tarjeta, las facturas existentes recalculan su mes de cargo (mismo comportamiento que `purchases` con modo 'retroactive'). Si esto resulta limitante, en v1.1 agregamos `closingDaySnapshot` opcional en `ServiceBill`.

---

## 2. Estructura de archivos

```
src/app/
├── core/
│   ├── models/
│   │   └── service/
│   │       └── service.model.ts              (NUEVO)
│   ├── constants/
│   │   └── storage-keys.ts                   (MODIFICAR: agregar 'services')
│   └── services/
│       ├── services.service.ts               (NUEVO)
│       ├── backup.service.ts                 (MODIFICAR: export/import + counts)
│       └── transactions.service.ts           (MODIFICAR: entriesForMonth + delegate methods)
└── pages/
    ├── servicios-page/                        (NUEVO)
    │   ├── servicios-page.component.{ts,html}
    │   └── components/
    │       ├── service-card/
    │       │   └── service-card.component.{ts,html}
    │       ├── service-form/
    │       │   └── service-form.component.{ts,html}
    │       ├── bill-form/
    │       │   └── bill-form.component.{ts,html}
    │       └── bill-history/
    │           └── bill-history.component.{ts,html}
    └── mes-page/
        └── components/
            └── upcoming-services/             (NUEVO)
                └── upcoming-services.component.{ts,html}
```

Cambios laterales:

- `src/app/core/services/navigation.service.ts`: agregar `'servicios'` al type `NavSection`.
- `src/app/shared/components/sidebar/sidebar.component.{ts,html}`: agregar item (entre Suscripciones y Ahorros).
- `src/app/app.component.{ts,html}`: registrar `ServiciosPageComponent`, agregar `@case ('servicios')`, agregar labels.
- `src/app/pages/mes-page/mes-page.component.{ts,html}`: incluir `<app-upcoming-services>` antes del grid principal.

---

## 3. Modelos / interfaces nuevas

`src/app/core/models/service/service.model.ts`:

```typescript
import { Category } from '../transaction/transaction.model';

/** Forma de pago de un servicio. */
export type ServicePaymentMethod = 'card' | 'direct-debit' | 'other';

/** Servicio recurrente (luz, gas, agua, internet, etc.). */
export interface UtilityService {
  id: string;
  /** Nombre libre. Ej: "Edenor", "Camuzzi", "ABSA", "Telecentro". */
  name: string;
  /** Categoría con la que se imputa el gasto. Default `cat-servicios`. */
  category: Category;
  paymentMethod: ServicePaymentMethod;
  /** Sólo aplica si `paymentMethod === 'card'`. */
  cardId?: string;
  /** Histórico de facturas pagadas/cargadas. */
  bills: ServiceBill[];
  /** Soft delete: conserva el histórico pero no proyecta facturas nuevas. */
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Una factura individual pagada (o por pagar) de un servicio. */
export interface ServiceBill {
  id: string;
  /** Fecha de vencimiento o pago (ISO YYYY-MM-DD). */
  dueDate: string;
  /**
   * Monto en ARS. Puede ser negativo si la factura es un crédito o ajuste
   * a favor (ej. la luz devuelve $200 por algún reintegro).
   */
  amount: number;
  /** Número de comprobante / referencia del proveedor (opcional). */
  comprobante?: string;
  /** Nota libre (ej. "consumo de verano alto"). */
  notes?: string;
  createdAt: string;
}

// ---- Tipos derivados que devuelve el ServicesService ----

/** Pago previsto o real de un servicio en un mes dado. */
export interface ServiceCharge {
  serviceId: string;
  serviceName: string;
  category: Category;
  /** Fecha estimada o real de vencimiento (ISO YYYY-MM-DD). */
  dueDate: string;
  /** Monto: el de la factura cargada (si existe) o el estimado. */
  amount: number;
  /** True si la factura todavía no fue cargada y el monto viene de la proyección. */
  estimated: boolean;
  /** Id de la factura si ya fue cargada, undefined si es proyección. */
  billId?: string;
}

/** Resumen del estado de inferencia para mostrar próxima factura. */
export interface ServiceForecast {
  /** Fecha de la próxima factura estimada. */
  nextDueDate: string | null;
  /** Monto estimado de la próxima factura. */
  estimatedAmount: number | null;
  /** Días promedio entre facturas (inferido del histórico). */
  averageIntervalDays: number | null;
  /** Cuántas facturas se usaron para inferir. */
  basedOnBills: number;
}
```

---

## 4. Service: `ServicesService`

`src/app/core/services/services.service.ts`. Maneja signals + CRUD + cálculos de proyección.

```typescript
@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly storage = inject(StorageService);
  private readonly cards = inject(CardsService);

  private readonly _services = signal<UtilityService[]>(
    this.storage.readArray<UtilityService>(STORAGE_KEYS.services)
  );
  readonly services = this._services.asReadonly();

  // ---- CRUD ----
  addService(input: { name: string; category: Category; paymentMethod: ServicePaymentMethod; cardId?: string; }): UtilityService { ... }
  updateService(id: string, patch: Partial<Omit<UtilityService, 'id' | 'bills' | 'createdAt'>>): void { ... }
  archiveService(id: string): void { ... }            // soft delete
  reactivateService(id: string): void { ... }
  removeService(id: string): void { ... }             // hard delete (con confirmación)

  // ---- Facturas (sub-colección) ----
  addBill(serviceId: string, input: { dueDate: string; amount: number; comprobante?: string; notes?: string }): ServiceBill | null { ... }
  updateBill(serviceId: string, billId: string, patch: Partial<Pick<ServiceBill, 'dueDate' | 'amount' | 'comprobante' | 'notes'>>): void { ... }
  removeBill(serviceId: string, billId: string): void { ... }

  // ---- Inferencia y proyección ----

  /** Días promedio entre facturas consecutivas (usa últimas 6, mín 2). */
  averageIntervalDays(service: UtilityService): number | null { ... }

  /** Forecast completo para mostrar próxima factura en la UI. */
  forecastFor(service: UtilityService): ServiceForecast { ... }

  /**
   * Cargos de servicios que caen en un mes (YYYY-MM).
   *
   * **Imputación al mes según `paymentMethod`**:
   *  - 'card' + cardId → usa `cards.firstBillingMonth(dueDate, closingDay)`.
   *    El cargo aparece en el mes del resumen, no en el mes del `dueDate`.
   *    Misma lógica que las compras con tarjeta y suscripciones.
   *  - 'direct-debit' / 'other' → cae en el mes del `dueDate` directo.
   *
   * Para cada servicio activo:
   *  - Si tiene una factura cargada cuyo mes de cargo coincide con `month` →
   *    la devuelve (`estimated: false`).
   *  - Si no, pero la proyección de la próxima factura cae en `month` →
   *    devuelve estimado (`estimated: true`).
   *  - Si proyecta varias en serie y caen en el mismo mes, devuelve todas.
   */
  serviceChargesForMonth(month: string): ServiceCharge[] { ... }

  // ---- Import/export ----
  setServicesBulk(list: UtilityService[]): void { ... }
}
```

### Decisiones de cálculo

- **`averageIntervalDays`**: ordena las bills por `dueDate` ascendente, toma diferencias consecutivas, devuelve promedio. Si hay menos de 2 facturas → `null`.
- **`estimatedNextAmount`**: monto de la **última** factura cargada (más reciente por `dueDate`). Si es negativo, lo respetamos (el usuario podría tener un ajuste a su favor recurrente).
- **`nextDueDate`**: `lastBill.dueDate + averageIntervalDays`. Implementación: parseo `dueDate` → suma días → reformato. Si no hay intervalo (menos de 2 bills) → `null`.
- **Proyecciones múltiples en el mismo mes**: si el intervalo es muy corto (ej. 15 días por algún caso raro), pueden caer 2 proyecciones en un mes. Las devolvemos todas — UX decide cómo agruparlas.
- **Servicio archivado**: no genera proyecciones futuras, pero sus facturas pasadas siguen apareciendo en el mes que les corresponde.
- **Imputación al mes según `paymentMethod`** (consistente con compras con tarjeta y suscripciones del proyecto):
  - Si `paymentMethod === 'card'` y hay `cardId`, el cargo de la factura aparece en el mes del **resumen** de la tarjeta, calculado con `cards.firstBillingMonth(bill.dueDate, card.closingDay)`. Si la factura vence el 10 de junio y la tarjeta cierra el 20 → la factura cae en julio.
  - Si `paymentMethod === 'direct-debit'` o `'other'`, el cargo cae directamente en el mes del `bill.dueDate` (sin lógica de cierre).
- **No snapshotear `closingDay`** en cada factura. Si el usuario cambia el cierre de la tarjeta, los meses de cargo de las facturas existentes recalculan automáticamente (comportamiento "retroactive" implícito). Esto difiere de `CardPurchase`/`Subscription` que sí soportan snapshot vía `closingDaySnapshot`. Decisión consciente para mantener el MVP simple. Si resulta limitante, en v1.1 agregamos el campo opcional.

---

## 5. Integración con `TransactionsService`

`entriesForMonth(month)` actualmente combina 3 fuentes: `transaction`, `installment`, `subscription`. Agregar la cuarta:

```typescript
// En transactions.service.ts
constructor() {
  // ... ya existente ...
  // Inyectamos ServicesService (ya viene en el módulo Core).
}

entriesForMonth(month: string): MonthlyEntry[] {
  // ... txEntries + instEntries + subEntries (sin cambios) ...

  const serviceCharges = this.servicesSvc.serviceChargesForMonth(month);
  const serviceEntries: MonthlyEntry[] = serviceCharges.map((s) => ({
    id: s.billId ? `bill-${s.billId}` : `bill-est-${s.serviceId}-${s.dueDate}`,
    source: 'service',                                // NUEVO source
    type: 'gasto',
    description: s.serviceName,
    amount: s.amount,
    category: s.category,
    date: s.dueDate,
    fixed: true,                                       // los servicios son fijos por definición
    currency: 'ARS',                                   // MVP: ARS only
    service: {
      serviceId: s.serviceId,
      billId: s.billId,
      estimated: s.estimated,
    },
  }));

  return [...txEntries, ...instEntries, ...subEntries, ...serviceEntries]
    .sort((a, b) => b.date.localeCompare(a.date));
}
```

Cambios derivados en `MonthlyEntry`:

```typescript
// transactions.service.ts → MonthlyEntry
export interface MonthlyEntry {
  // ... campos existentes ...
  source: 'transaction' | 'installment' | 'subscription' | 'service';
  service?: {
    serviceId: string;
    billId?: string;
    estimated: boolean;
  };
}
```

**Métodos delegate** que el orquestador agrega para mantener su API (siguiendo el patrón existente):

```typescript
// transactions.service.ts
readonly utilityServices = this.servicesSvc.services;
addService(...) { return this.servicesSvc.addService(...); }
updateService(...) { this.servicesSvc.updateService(...); }
archiveService(...) { this.servicesSvc.archiveService(...); }
reactivateService(...) { this.servicesSvc.reactivateService(...); }
removeService(...) { this.servicesSvc.removeService(...); }
addServiceBill(...) { return this.servicesSvc.addBill(...); }
updateServiceBill(...) { this.servicesSvc.updateBill(...); }
removeServiceBill(...) { this.servicesSvc.removeBill(...); }
forecastFor(...) { return this.servicesSvc.forecastFor(...); }
```

---

## 6. Integración con `BackupService`

`ExportFile.data` ahora incluye `services`:

```typescript
export interface ExportFile {
  app: 'control-gastos';
  schemaVersion: 2;                                    // BUMP DE VERSIÓN
  exportedAt: string;
  data: {
    transactions: Transaction[];
    templates: RecurringTemplate[];
    cards: CreditCard[];
    purchases: CardPurchase[];
    subscriptions: Subscription[];
    rates: Record<string, number>;
    customCategories?: CustomCategory[];
    savings?: Saving[];
    services?: UtilityService[];                       // NUEVO, opcional para retrocompat
  };
}
```

- **`schemaVersion: 2`**: bumpeamos. `validateImportFile` acepta versiones 1 y 2; los export schema 1 importan con `services = []`.
- `dataCounts()` agrega `services: this.services.services().length`.
- `formatCounts()` agrega `${c.services} servicios`.
- `exportData()` incluye el array. `importData()` llama `servicesSvc.setServicesBulk(d.services ?? [])`.
- `clearAllData()` llama `setServicesBulk([])`.

---

## 7. Componentes nuevos

| Componente | Selector | Padre | Responsabilidad |
|------------|----------|-------|-----------------|
| `ServiciosPageComponent` | `app-servicios-page` | `app-root` | Host: lista de servicios + form de alta colapsable |
| `ServiceCardComponent` | `app-service-card` | servicios-page | Card de un servicio: header, próxima factura, acciones (cargar/expand/edit/archive) |
| `ServiceFormComponent` | `app-service-form` | servicios-page | Form de alta y edición (nombre, categoría, forma de pago, tarjeta) |
| `BillFormComponent` | `app-bill-form` | service-card (inline) | Mini-form para cargar una factura nueva (dueDate, monto, comprobante, nota) |
| `BillHistoryComponent` | `app-bill-history` | service-card (expandible) | Tabla de facturas pasadas + sparkline de variación + acciones por fila |
| `UpcomingServicesComponent` | `app-upcoming-services` | mes-page (widget) | Próximas N facturas estimadas con link a Servicios |

### Estados visuales del `ServiceCardComponent`

```
┌─ <ícono> Edenor ──────── [editar] [archivar] ─┐
│                                                │
│   Próxima factura estimada:                    │
│   ~ $11.257 el 21/05 (en 14 días)              │
│                                                │
│   [+ Cargar factura recibida]                  │
│   [Ver historial · 14 facturas]                │
└────────────────────────────────────────────────┘
```

Cuando se expande historial, debajo aparece `<app-bill-history>` con tabla + sparkline.
Cuando se hace click en "Cargar factura", aparece inline `<app-bill-form>` (cancelar/guardar).

### Empty state global

Si `services().length === 0`:

```
[icono]
Cargá tu primer servicio
Edenor, Camuzzi, ABSA, internet... lo que pagás todos los meses
en plata fija o variable.

[+ Agregar servicio]
```

---

## 8. Tareas

### T0 — Modelos
**Archivos**: `src/app/core/models/service/service.model.ts`
- [ ] Crear interfaces `UtilityService`, `ServiceBill`, `ServicePaymentMethod`, `ServiceCharge`, `ServiceForecast` según la sección 3.
- [ ] Build verde (`npx tsc --noEmit -p tsconfig.app.json`).

### T1 — Constants
**Archivos**: `src/app/core/constants/storage-keys.ts`
- [ ] Agregar `services: 'control-gastos:services'` al `STORAGE_KEYS`.
- [ ] Build verde.

### T2 — ServicesService
**Archivos**: `src/app/core/services/services.service.ts`
- [ ] Inyectar `StorageService` y `CardsService` (esta última para leer `closingDay` de tarjetas asociadas).
- [ ] Implementar CRUD de servicio (`addService`, `updateService`, `archiveService`, `reactivateService`, `removeService`).
- [ ] Implementar sub-CRUD de facturas (`addBill`, `updateBill`, `removeBill`).
- [ ] Implementar `averageIntervalDays`, `forecastFor`.
- [ ] Implementar `serviceChargesForMonth(month)` **respetando `paymentMethod`**:
  - Si `paymentMethod === 'card'` y hay `cardId` válido → calcular el mes de cargo con `cards.firstBillingMonth(bill.dueDate, card.closingDay)`.
  - Si `paymentMethod === 'direct-debit'` o `'other'` → el mes de cargo es `bill.dueDate.slice(0, 7)`.
  - La proyección de la próxima factura sigue la misma regla.
- [ ] Implementar `setServicesBulk` para import.
- [ ] **Persistencia**: cada mutación llama `storage.write(STORAGE_KEYS.services, ...)`.
- [ ] **Sin signals duplicados** con `TransactionsService` (la integración es por inyección, no por copia).
- [ ] Build verde.

### T3 — Extender `BackupService`
**Archivos**: `src/app/core/services/backup.service.ts`
- [ ] Inyectar `ServicesService`.
- [ ] Tipar `ExportFile.schemaVersion` como `1 | 2` y aceptar ambas en `validateImportFile`.
- [ ] `exportData()` incluye `services` con el schema v2.
- [ ] `importData()` lee `d.services ?? []` y llama `setServicesBulk`.
- [ ] `clearAllData()` resetea services.
- [ ] `dataCounts()` incluye `services: number`.
- [ ] `formatCounts()` agrega "${c.services} servicios" al string.
- [ ] Build verde.

### T4 — Integrar con `TransactionsService`
**Archivos**: `src/app/core/services/transactions.service.ts`
- [ ] Inyectar `ServicesService`.
- [ ] Extender `MonthlyEntry`: agregar `'service'` al union de `source` y campo opcional `service?: { serviceId, billId?, estimated }`.
- [ ] `entriesForMonth(month)`: incluir `serviceCharges` como una fuente más (ver sección 5).
- [ ] Agregar métodos delegate: `utilityServices`, `addService`, `updateService`, `archiveService`, `reactivateService`, `removeService`, `addServiceBill`, `updateServiceBill`, `removeServiceBill`, `forecastFor`.
- [ ] Build verde.

### T5 — Habilitar sección Servicios en navegación
**Archivos**:
- `src/app/core/services/navigation.service.ts` → agregar `'servicios'` al type `NavSection` y al array `VALID_SECTIONS`.
- `src/app/shared/components/sidebar/sidebar.component.ts` → agregar item en `items` (entre Suscripciones y Ahorros).
- `src/app/shared/components/sidebar/sidebar.component.html` → agregar `@case ('servicios')` con ícono (rayo, bombilla, o factura).
- `src/app/app.component.ts` → agregar entrada en `SECTION_LABELS` ("Servicios") y `SECTION_SUBTITLES` ("Luz, gas, agua y demás servicios recurrentes"). **NO** agregar al `SECTIONS_WITH_MONTH`.
- [ ] Build verde.

### T6 — `ServiciosPageComponent` + estructura básica
**Archivos**: `src/app/pages/servicios-page/servicios-page.component.{ts,html}`
- [ ] Crear page host. Layout simple: lista de cards apilados.
- [ ] Empty state cuando `services().length === 0` con CTA "+ Agregar servicio".
- [ ] Botón global "+ Agregar servicio" que abre `<app-service-form>` en modo alta.
- [ ] Registrar `ServiciosPageComponent` en `app.component.ts` imports + `@case ('servicios') { <app-servicios-page /> }`.
- [ ] Por ahora muestra placeholder de cada servicio (sin la card real, sólo `<li>{{ s.name }}</li>`). La card va en T8.
- [ ] Build verde + verificación manual: navegar a Servicios desde el sidebar.

### T7 — `ServiceFormComponent`
**Archivos**: `src/app/pages/servicios-page/components/service-form/service-form.component.{ts,html}`
- [ ] Inputs: nombre (text, required), categoría (select reusa `tx.allExpenseCategories()`), forma de pago (3 botones), tarjeta (sólo si método === 'card', select de `tx.cards()`).
- [ ] Modo alta: dispara `addService`, devuelve evento de éxito al padre.
- [ ] Modo edición: recibe `[service]` Input, dispara `updateService`.
- [ ] Validaciones: nombre no vacío; si paymentMethod === 'card' y hay tarjetas → cardId obligatorio (si no hay tarjetas, sólo aviso).
- [ ] Botones: Cancelar / Guardar.

### T8 — `ServiceCardComponent`
**Archivos**: `src/app/pages/servicios-page/components/service-card/service-card.component.{ts,html}`
- [ ] Recibe `[service]: UtilityService`.
- [ ] Header: ícono según categoría (color del `tx.colorForCategory`), nombre, badge "Archivado" si corresponde.
- [ ] Bloque "Próxima factura estimada": usa `tx.forecastFor(service)`. Si `nextDueDate` y `estimatedAmount` están disponibles, mostrar "~ ${amount} el {dueDate} (en N días)". Si no, mostrar "Cargá al menos 2 facturas para que estimemos la próxima".
- [ ] Acciones:
  - `+ Cargar factura recibida` → toggle de `<app-bill-form>`.
  - `Ver historial · N facturas` → toggle de `<app-bill-history>`.
  - Edit (lápiz) → toggle modo edición con `<app-service-form>` embebido.
  - Archive / Reactivate (según `archived`).
- [ ] Si `archived === true`: card en opacity reducida, sin proyección, sólo historial.

### T9 — `BillFormComponent` + `BillHistoryComponent`
**Archivos**:
- `src/app/pages/servicios-page/components/bill-form/bill-form.component.{ts,html}`
- `src/app/pages/servicios-page/components/bill-history/bill-history.component.{ts,html}`

**BillForm**:
- [ ] Inputs: fecha de vencimiento (default sugerido `forecast.nextDueDate` si existe), monto (number, step 0.01, permite negativo), comprobante (text opcional), nota (text opcional).
- [ ] Botones: Cancelar / Guardar.
- [ ] Emite `(submit)` con el bill creado.

**BillHistory**:
- [ ] Recibe `[service]: UtilityService`.
- [ ] Tabla con columnas: Vencimiento / Monto / Comprobante / Acciones (editar / eliminar).
- [ ] Sparkline SVG sobre los montos de las últimas N facturas (reusa patrón del Analytics: `viewBox 200x40`, line + dots).
- [ ] Click en editar abre modo edición inline para esa factura.
- [ ] Click en eliminar pide confirmación vía `ConfirmService`.

### T10 — Widget `UpcomingServicesComponent` en Mes-page
**Archivos**: `src/app/pages/mes-page/components/upcoming-services/upcoming-services.component.{ts,html}`
- [ ] Recibe el mes actual (vía signal `tx.selectedMonth()`) y computa los próximos cargos: itera `services()` activos, llama `forecastFor`, filtra los que tienen `nextDueDate` dentro del mes actual + el siguiente.
- [ ] Muestra hasta 5 entradas: nombre + monto estimado + fecha + días hasta el vencimiento (chip "vence en 5 días", "vencida hace 2 días" en rojo).
- [ ] Total estimado al pie.
- [ ] Si `services().length === 0`: mensaje "Cargá tus servicios para ver las próximas facturas → Servicios" con link que dispara `nav.setSection('servicios')`.
- [ ] Integrar en `mes-page.component.html` entre `usd-summary` y el grid principal.

### T11 — Verificación end-to-end
- [ ] `npm run build` verde.
- [ ] Smoke test manual:
  - Crear servicio "Edenor" con paymentMethod 'card' + tarjeta seleccionada.
  - Cargar 3 facturas con vencimientos consecutivos (ej. 21/02, 21/03, 21/04). Verificar que `nextDueDate` arroja ~21/05 y `estimatedAmount` el último monto.
  - Crear servicio "Camuzzi" con paymentMethod 'other'. Cargar las facturas de 2 cuotas que mostró el usuario en el chat (5 pagos consecutivos mensuales del gas). Verificar que el intervalo inferido es ~30 días.
  - Crear servicio "ABSA" con paymentMethod 'direct-debit'. Cargar una factura con monto negativo (ajuste). Verificar que se guarda y se muestra con signo.
  - Ir a Mes y verificar que aparecen las próximas facturas en `<app-upcoming-services>`.
  - Ir a Mes y verificar que las facturas previstas aparecen también en "Movimientos del mes" con su badge.
  - Verificar que `monthlyFixedExpenses` y `committedPct` aumentaron al cargar servicios.
  - **Crítico — lógica de cierre con tarjeta**: crear servicio "Edenor (tarjeta)" con `paymentMethod: 'card'` apuntando a una tarjeta que cierra el día 20. Cargar una factura con `dueDate: 2026-06-10`. Verificar que aparece en el mes de **julio** en `<upcoming-services>` y en la lista del Mes (no en junio).
  - **Crítico — fecha posterior al cierre**: misma tarjeta (cierre 20). Cargar una factura con `dueDate: 2026-06-25`. Verificar que aparece en **agosto** (dos meses después).
  - **Crítico — pago directo**: crear servicio "Camuzzi (débito)" con `paymentMethod: 'direct-debit'`. Cargar factura con `dueDate: 2026-06-10`. Verificar que aparece en **junio** (cae directo, sin lógica de cierre).
  - Ir a Simulador y verificar que la simulación incluye los servicios en `existingFixedFor(month)`.
  - Editar una factura → cambios se reflejan en proyección.
  - Eliminar una factura → recalcula intervalo.
  - Archivar un servicio → desaparece de proyecciones futuras pero sus pagos pasados siguen en el histórico mensual.
  - Reactivar → vuelve a proyectar.
  - Exportar respaldo → JSON incluye `services` y `schemaVersion: 2`.
  - Borrar todo + importar el JSON → servicios vuelven con sus facturas.
  - Importar un JSON viejo (schemaVersion 1, sin `services`) → no rompe, services queda vacío.

---

## 9. Persistencia (localStorage)

- **Nueva clave**: `STORAGE_KEYS.services = 'control-gastos:services'`.
- **Migración**: no necesaria. Al cargar por primera vez, `services` arranca en `[]`.
- **Schema bump del backup**: `schemaVersion` pasa de 1 a 2. Imports v1 son retrocompatibles (`services` se omite y queda vacío).

---

## 10. UI / UX

- **Sidebar**: agregar item "Servicios" entre Suscripciones y Ahorros.
- **Selector de mes**: la página Servicios NO usa el selector del header (es una vista global, no mensual).
- **Modal de confirmación**: requerido para eliminar facturas y para `removeService` (hard delete). Archive/reactivate sin confirmación.
- **Categorías**: el form usa el selector reusable de `tx.allExpenseCategories`. Default `cat-servicios` al crear.
- **Idioma**: identificadores en inglés (`UtilityService`, `ServiceBill`, `ServicesService`). UI 100% en español ("Próxima factura", "Cargar factura recibida", "Pagado el", etc.).
- **Iconografía**: ícono propio por servicio (basado en color de categoría); ícono general de "rayo" o "factura" en sidebar.
- **Imputación al mes**: cuando el servicio se paga con tarjeta, la factura aparece en el mes del resumen siguiendo el cierre de la tarjeta (consistente con compras con tarjeta y suscripciones del proyecto). Si se paga por débito automático o efectivo, cae en el mes del `dueDate`. Esto se refleja en `<app-upcoming-services>` y en la lista del Mes.
- **Mostrar el mes de cargo en el `ServiceCard`**: cuando la próxima factura está estimada y el servicio se paga con tarjeta, agregar una nota tipo "se debita en julio" si el mes de cargo es distinto al del vencimiento. Evita que el usuario se confunda al ver "vence el 10/06" pero la entrada cae en julio.

---

## 11. Convenciones a respetar

- [ ] Componente con sufijo `Component`, archivos `.ts/.html/.scss` separados (scss opcional).
- [ ] `standalone: true` explícito.
- [ ] `templateUrl` y `styleUrls`.
- [ ] Tailwind sin prefijo `tw-`.
- [ ] Signals para estado, `computed` para derivados, `effect` sólo si hace falta side effects.
- [ ] Persistencia siempre vía `StorageService`.
- [ ] Naming en inglés para identificadores, español para UI y commits.
- [ ] Commits: `feat(core): ...`, `feat(servicios): ...`, etc.

---

## 12. Impacto y riesgos

### Funcionalidad afectada

- `MonthlyEntry` gana un nuevo `source: 'service'` y un campo opcional `service?: {...}`. **Componentes que iteran `monthlyEntries` y hacen `switch` sobre source deben agregar el caso 'service'** o caer al default. A revisar: `transaction-list` y `analytics`. Si no manejan el nuevo source, las entries van a aparecer pero sin badge específico (no es crítico, sólo cosmético — se puede refinar después).
- `ExportFile` sube de schemaVersion 1 a 2. Cualquier export viejo sigue importando bien.

### Datos del usuario

- **Cero impacto en datos existentes**. Es una entidad nueva en su propia clave.

### Rollback

- Borrar la entidad y los componentes; revertir el campo `service` en `MonthlyEntry`; bajar de vuelta `schemaVersion` a 1. Trivial mientras no haya usuarios con datos cargados.

### Riesgos técnicos

1. **Inferencia ruidosa con pocas facturas**: con menos de 3 facturas el intervalo es poco confiable. **Mitigación**: en la UI, mientras haya menos de 2 facturas, no mostrar proyección — sólo mensaje "Cargá al menos 2 facturas para estimar la próxima".
2. **Outliers en el intervalo**: si el usuario carga una factura con fecha errónea, el promedio se distorsiona. **Mitigación v2**: detectar outliers (descartar valores fuera de 1.5× la mediana). MVP: dejar promedio simple, el usuario puede editar/eliminar la factura ruidosa.
3. **Mes con 2 facturas de un mismo servicio**: si el intervalo es corto, dos facturas pueden caer en el mismo mes (ej. un ajuste extra). El UX en `transaction-list` puede confundir. **Mitigación**: que la `id` de la entry sea única (`bill-{billId}` para reales, `bill-est-{serviceId}-{dueDate}` para estimadas) — esto ya está cubierto.
4. **Categoría compartida `cat-servicios`**: si todos los servicios usan la misma categoría, el donut de `analytics` no distingue luz de gas. **Mitigación**: el usuario puede crear categorías custom (Luz, Gas, Agua) y asignarlas en el form del servicio. MVP no fuerza nada, queda a discreción.
5. **Confusión entre `dueDate` y mes de cargo cuando paga con tarjeta**: el usuario podría no entender por qué la factura aparece en julio si la cargó con vencimiento en junio. **Mitigación**: en `ServiceCardComponent` mostrar ambas fechas cuando difieren ("vence 10/06 · se debita en julio"). En el widget de upcoming-services, ordenar por mes de cargo, no por `dueDate`.
6. **Cambio de tarjeta o de `closingDay` afecta proyecciones existentes**: al ser sin snapshot, cambiar el cierre de la tarjeta recalcula el mes de todas las facturas históricas del servicio. **Mitigación**: documentado en el plan; si surge necesidad real, se agrega `closingDaySnapshot` opcional como en `CardPurchase`.

---

## 13. Orden de implementación sugerido

1. **T0** → Modelos (base).
2. **T1** → Storage key (chiquito, prerequisito de T2).
3. **T2** → ServicesService completo.
4. **T3** → BackupService extendido (testeable vía export/import).
5. **T4** → TransactionsService integrado (acá el simulador y la lista del mes ya empiezan a mostrar servicios).
6. **T5** → Navegación habilitada.
7. **T6** → Page host vacío (verifica navegación end-to-end).
8. **T7** → ServiceForm (alta).
9. **T8** → ServiceCard (display).
10. **T9** → BillForm + BillHistory.
11. **T10** → Widget de próximas facturas.
12. **T11** → Verificación final.

Después de T4 ya se puede crear servicios manualmente desde la consola del browser (`tx.addService({...})`) y ver el efecto en el simulador y en la lista del mes, antes incluso de tener la UI.

---

## 14. Verificación

- [ ] `npm run build` verde.
- [ ] `npx ng build --configuration=development` verde.
- [ ] Las 8 secciones del sidebar (Mes, Tarjetas, Suscripciones, **Servicios**, Ahorros, Análisis, Simulador, Configuración) navegan correctamente.
- [ ] Datos del usuario existentes intactos después de agregar el módulo (suscripciones, tarjetas, etc. siguen funcionando).
- [ ] Export → wipe → import recupera los servicios sin pérdida.
- [ ] El simulador refleja los servicios en `existingFixedFor(month)` sin código nuevo (el cambio es transparente).

---

## 15. Notas adicionales

### Decisiones tomadas en la fase de diseño

- **Entidad nueva en lugar de reusar `Subscription`**: confirmamos por semántica distinta (precio decidido por proveedor vs por suscripción), forma de pago más flexible y evolución futura distinta.
- **Sin "frecuencia declarada"**: el sistema infiere el intervalo del histórico. Justificación: las facturas en Argentina siguen patrones irregulares (bimestral pagado en 2 cuotas mensuales, ajustes mid-cycle, etc.) y declarar "es bimestral" no agrega información útil — lo que importa es el ritmo real observado.
- **`dueDate` único en lugar de issueDate + dueDate**: simplificación del MVP. Lo que importa al usuario es cuándo sale plata; la fecha de emisión la puede poner en `notes` si necesita.
- **Monto negativo permitido**: vimos en los datos reales un crédito de $-26.835 en agua. El modelo debe contemplarlo.
- **MVP respeta `paymentMethod` para imputación al mes**: los pagos con tarjeta caen en el mes del resumen (siguiendo `closingDay` vía `cards.firstBillingMonth`). Los pagos por débito automático u otros medios caen en el mes del `dueDate`. Decisión revisada respecto al borrador inicial del plan: la simplicidad de "siempre en el mes del `dueDate`" rompía la proyección para servicios con tarjeta (la plata sale un mes después que lo que mostraba el balance). Mantenemos consistencia con `CardPurchase` y `Subscription`.
- **No snapshotear `closingDay` por factura**: si el usuario cambia el cierre de la tarjeta, las facturas existentes recalculan su mes de cargo (comportamiento implícito "retroactive"). Si resulta limitante, en v1.1 agregamos `closingDaySnapshot` opcional como en `purchases` y `subscriptions`.
- **Sub-colección dentro del agregado**: las `bills` viven adentro de `UtilityService` (como `movements` en `Saving`, `priceHistory` en `Subscription`). Una sola escritura en localStorage por update.

### Cosas a NO hacer durante la implementación

- No mezclar la carga de servicios con `TransactionForm` ("Nueva operación"). Tiene su propio módulo (decisión confirmada con el usuario).
- No persistir nada nuevo en `localStorage` fuera de la clave `services` (todas las escrituras pasan por `ServicesService`).
- No declarar frecuencia. El sistema la infiere.
- No reimplementar lógica de cierre dentro del `ServicesService`: reusar `CardsService.firstBillingMonth` (es el mismo método que ya usan compras con tarjeta).
- No snapshotear `closingDay` por factura en el MVP. Si lo necesitamos, lo agregamos en v1.1.

### Cosas a hacer SÍ durante la implementación

- Aprovechar el patrón del `SubscriptionsService` (es el más parecido conceptualmente).
- **Reusar `CardsService.firstBillingMonth`** para la lógica de imputación al mes cuando `paymentMethod === 'card'`.
- Mantener el `ServicesService` testeable: signals + funciones puras, sin DOM ni dependencias raras.
- En el widget de Mes-page, evitar duplicar info que ya está en "Movimientos del mes". El widget debe ser un teaser (5 próximas con CTA), no un panel completo.
- Reusar el componente de sparkline / la lógica de SVG line del `analytics` para la variación de montos.
- En `ServiceCardComponent`, cuando el `paymentMethod === 'card'` y el mes de cargo difiere del mes del `dueDate`, mostrar ambos: "vence 10/06 · se debita en julio". Esto le anticipa al usuario por qué la factura aparece en otro mes.

---

### Reglas

- ✅ **SIEMPRE** dejar build verde al cerrar cada tarea T.
- ✅ **SIEMPRE** verificar que los datos existentes no se rompen al introducir `schemaVersion: 2`.
- ✅ **SIEMPRE** validar el `dueDate` como ISO YYYY-MM-DD en el form (no aceptar strings raros).
- ✅ **SIEMPRE** aplicar la lógica de cierre cuando `paymentMethod === 'card'` (vía `cards.firstBillingMonth`). Es consistente con el resto del producto.
- ❌ **NUNCA** declarar la frecuencia del servicio en el modelo — la inferencia es por diseño.
- ❌ **NUNCA** mezclar la carga de servicios con `TransactionForm`.
- ❌ **NUNCA** persistir directamente en `localStorage` sin pasar por `StorageService`.
- ❌ **NUNCA** reimplementar la lógica de imputación al resumen: reusar el método de `CardsService`.
