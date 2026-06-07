---
plan: 2026-06-feat-simulador-de-compras
tipo: feat
estado: backlog
prioridad: media
fecha-creacion: 2026-06-07
fecha-inicio: —
fecha-fin: —
modulo: src/app/pages/simulador-page
tags: [simulador, proyeccion, cuotas, what-if, mvp]
---

# Plan de Implementación — Simulador de compras

> **Objetivo**: dar al usuario una vista *what-if* de cómo una compra futura (al contado, en cuotas, o una suscripción nueva) impactaría en su balance mes-a-mes, sin tocar sus datos reales.

---

## 1. Resumen

- **Qué**: una página nueva donde el usuario carga una compra hipotética y ve la proyección de su flujo mensual con y sin esa compra, durante un horizonte configurable.
- **Dónde**: `src/app/pages/simulador-page/`.
- **Service de cálculo**: `src/app/core/services/simulation.service.ts` (pure functions sobre data existente, sin signals propios).
- **Persistencia**: ninguna (la simulación vive en memoria, se pierde al recargar). Persistencia opcional queda para v2.
- **Non-destructive**: la simulación nunca crea `CardPurchase` ni `Subscription` reales en la app.

### Tipos de compra cubiertos en el MVP

1. **Contado** (ARS o USD).
2. **Tarjeta con cuotas** (1..N cuotas, ARS o USD, todos los modos de recargo del proyecto).
3. **Suscripción nueva** (mensual recurrente, opcional fecha de cancelación tentativa).

### Lo que NO incluye el MVP (queda para v2)

- Comparar múltiples escenarios lado-a-lado (aunque el modelo se prepara para soportarlo).
- Guardado nombrado de escenarios.
- Botón "Convertir simulación en compra real" (materializar).
- Alertas tipo "esta compra te deja en rojo en 4 meses, considerá 24 cuotas".
- Simulación inversa ("¿qué podés comprar dado tu balance?").

---

## 2. Estructura de archivos

```
src/app/
├── core/
│   ├── models/
│   │   └── simulation/
│   │       └── simulation.model.ts          (NUEVO)
│   └── services/
│       └── simulation.service.ts            (NUEVO)
└── pages/
    └── simulador-page/                       (NUEVO)
        ├── simulador-page.component.{ts,html,scss}
        └── components/
            ├── simulation-form/
            │   └── simulation-form.component.{ts,html}
            ├── simulation-summary/
            │   └── simulation-summary.component.{ts,html}
            ├── projection-table/
            │   └── projection-table.component.{ts,html}
            └── projection-chart/
                └── projection-chart.component.{ts,html,scss}
```

Cambios laterales:
- `src/app/core/services/navigation.service.ts`: agregar `'simulador'` al type `NavSection`.
- `src/app/shared/components/sidebar/sidebar.component.{ts,html}`: agregar item de navegación (entre Análisis y Configuración).
- `src/app/app.component.{ts,html}`: registrar `SimuladorPageComponent`, agregar `@case ('simulador')`, agregar labels al `SECTION_LABELS` / `SECTION_SUBTITLES`.

---

## 3. Modelos / interfaces nuevas

`src/app/core/models/simulation/simulation.model.ts`:

```typescript
import { Currency, SurchargeMode } from '../credit-card/card-purchase.model';
import { Category } from '../transaction/transaction.model';

/** Tipo de compra a simular. */
export type SimulationItemType = 'contado' | 'cuotas' | 'suscripcion';

/**
 * Item simulado. El array `items: SimulationItem[]` permite simular varios a
 * la vez en el futuro; por ahora el MVP sólo expone uno en la UI.
 */
export interface SimulationItem {
  id: string;                              // uuid client-side
  type: SimulationItemType;
  description: string;                     // sólo display
  category?: Category;                     // sólo display y color
  currency: Currency;
  /** Monto total. En cuotas, suma de las N cuotas. En suscripción, monto mensual. */
  amount: number;
  surchargeMode?: SurchargeMode;           // sólo si currency === 'USD'

  /** Fecha tentativa de la compra (ISO YYYY-MM-DD). */
  purchaseDate: string;

  // -- Sólo si type === 'cuotas' --
  cardId?: string;                         // referencia a una tarjeta real
  installments?: number;                   // 1..N

  // -- Sólo si type === 'suscripcion' --
  /** Fecha del primer cobro. */
  startDate?: string;
  /** Fecha tentativa de cancelación, si la querés acotar dentro del horizonte. */
  cancelDate?: string;
  /** Tarjeta sobre la que se cobra la suscripción. */
  subscriptionCardId?: string;
}

/** Base sobre la que se proyectan los ingresos futuros. */
export type IncomeBaseMode = 'avg-3m' | 'last-month' | 'manual';

export interface SimulationConfig {
  /** Meses a proyectar (incluye el mes actual). */
  horizonMonths: 6 | 12 | 18 | 24;

  incomeBase: IncomeBaseMode;
  /** Sólo se usa si incomeBase === 'manual'. */
  manualIncomeArs?: number;

  /** % mensual de inflación aplicado a gastos fijos existentes. Default 0. */
  monthlyInflationPct: number;
  /** % mensual de devaluación aplicado al TC del último valor conocido. Default 0. */
  monthlyDevaluationPct: number;
}

/** Resumen del impacto para un mes concreto. */
export interface MonthProjection {
  month: string;                           // YYYY-MM
  label: string;                           // "Jul 26"

  // Income side
  projectedIncome: number;                 // ARS

  // Expense side
  existingFixedExpenses: number;           // cuotas + suscripciones + plantillas activas (ARS)
  simulationImpact: number;                // lo que aporta la compra simulada en ARS este mes
  totalFixedExpenses: number;              // existingFixedExpenses + simulationImpact

  // Derived
  projectedBalance: number;                // projectedIncome - totalFixedExpenses
  committedPct: number;                    // totalFixedExpenses / projectedIncome * 100

  // Same metrics SIN la simulación (para comparar)
  baselineBalance: number;
  baselineCommittedPct: number;

  // Flags de UX
  isOverCommitted: boolean;                // committedPct > 80
  isModerate: boolean;                     // 50 < committedPct <= 80
  isComfortable: boolean;                  // committedPct <= 50
  isNegative: boolean;                     // projectedBalance < 0

  // USD parallel (sólo si simulationImpactUsd > 0 ese mes)
  simulationImpactUsd?: number;            // suma de cuotas USD modo 'usd-payment' del mes
}

/** Resultado de calcular la proyección completa. */
export interface SimulationResult {
  months: MonthProjection[];

  // Totales agregados de la(s) compra(s) simulada(s)
  totalNominalArs: number;                 // monto cargado sin recargo (en su moneda original, convertido a ARS al TC actual)
  totalRealArs: number;                    // con recargos + TC proyectado mes-a-mes si la UI lo activó
  totalNominalUsd: number;                 // si hay items USD modo 'usd-payment'

  // Highlights
  peakCommittedPct: number;                // máximo committedPct dentro del horizonte
  monthsInRed: number;                     // count de meses con projectedBalance < 0
  monthsModerate: number;                  // count de meses con 50 < committedPct <= 80
  monthsOverCommitted: number;             // count de meses con committedPct > 80

  /** Advertencias para mostrar en el summary. */
  warnings: SimulationWarning[];
}

export type SimulationWarningCode =
  | 'cuotas-exceden-horizonte'             // installments > horizonMonths
  | 'sin-ingresos-base'                    // no se pudo determinar incomeBase (sin data)
  | 'sin-tarjeta'                          // type='cuotas' o 'suscripcion' sin tarjeta seleccionada
  | 'tc-no-disponible';                    // currency='USD' pero no hay TC conocido

export interface SimulationWarning {
  code: SimulationWarningCode;
  message: string;                         // texto para mostrar al usuario
}
```

---

## 4. Service: `SimulationService`

`src/app/core/services/simulation.service.ts`. Pure functions, **sin signals propios**.

```typescript
@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly tx = inject(TransactionsService);
  private readonly usdRate = inject(UsdRateService);
  private readonly cards = inject(CardsService);

  /** Punto de entrada principal. Recibe input y devuelve resultado calculado. */
  run(items: SimulationItem[], config: SimulationConfig): SimulationResult { ... }

  /** Devuelve la lista de meses (YYYY-MM) del horizonte, empezando por el mes actual. */
  private buildHorizon(horizonMonths: number): string[] { ... }

  /** Ingresos base según `incomeBase` ('avg-3m' / 'last-month' / 'manual'). */
  private resolveIncomeBase(config: SimulationConfig): number { ... }

  /** Proyección de ingresos para un mes (base * (1 + inflación)^offset). */
  private projectedIncomeFor(month: string, base: number, config: SimulationConfig): number { ... }

  /**
   * Impacto en ARS de un SimulationItem para un mes dado.
   * Reusa la lógica que ya existe:
   *  - 'contado' → cae en el mes del purchaseDate (clamp al primer mes del horizonte si es anterior).
   *  - 'cuotas' → reusa `cards.firstBillingMonth(purchaseDate, closingDay)` + diff.
   *  - 'suscripcion' → reusa la regla de offset 1/2 según día de cobro vs cierre.
   * Para USD aplica `usdRate.buildConversion(closingDate, mode)` + `usdRate.convertToArs` con devaluación.
   */
  private itemImpactFor(item: SimulationItem, month: string, config: SimulationConfig): {
    arsImpact: number;
    usdDirect?: number;                    // si modo 'usd-payment'
  } { ... }

  /**
   * Gastos fijos existentes en un mes futuro.
   * Reusa `tx.expensesForMonth(month)` filtrando por sources 'installment'/'subscription'
   * + transacciones manuales fixed.
   * Aplica inflación opcional sobre el resultado (sólo a partir del mes 2).
   */
  private existingFixedFor(month: string, config: SimulationConfig): number { ... }

  /** TC proyectado para un mes (latestRate.rate * (1 + devaluación)^offset). */
  private projectedRateFor(month: string, config: SimulationConfig): number | null { ... }
}
```

**Decisiones de cálculo:**

- **Inflación**: aplica a `existingFixedExpenses`, NO a las cuotas/suscripciones simuladas (porque esas tienen monto nominal fijo por contrato).
- **Devaluación**: aplica al TC usado para convertir USD futuros. No afecta cuotas USD modo `usd-payment` (esas se reportan en USD nominal y se convierten al TC proyectado del mes sólo para el campo `simulationImpactUsd → ARS`).
- **Mes 0 (actual)**: inflación y devaluación se aplican como `(1 + pct)^offset` con `offset = monthsSinceNow`. Mes actual offset 0 → factor 1.
- **Cuotas que caen fuera del horizonte**: warning `cuotas-exceden-horizonte`, pero igual se cuenta el costo total real en `totalRealArs`.

---

## 5. Componentes nuevos

| Componente | Selector | Padre | Responsabilidad |
|------------|----------|-------|-----------------|
| `SimuladorPageComponent` | `app-simulador-page` | `app-root` | Host: orquesta form + summary + tabla + chart |
| `SimulationFormComponent` | `app-simulation-form` | simulador-page | Formulario de input + config, emite `simulate` con `{items, config}` |
| `SimulationSummaryComponent` | `app-simulation-summary` | simulador-page | Métricas agregadas: total real, pico %, meses en rojo, warnings |
| `ProjectionTableComponent` | `app-projection-table` | simulador-page | Tabla mes-a-mes con highlight por estado (rojo/ámbar/verde) |
| `ProjectionChartComponent` | `app-projection-chart` | simulador-page | SVG inline: barras apiladas (fijos actuales + impacto) + línea de ingresos |

**Flujo de datos:**

- `SimuladorPageComponent` mantiene dos signals propios: `currentItem: WritableSignal<SimulationItem | null>` y `config: WritableSignal<SimulationConfig>`.
- `SimulationFormComponent` recibe `[item]` `[config]` y emite `(itemChange)` `(configChange)`.
- `SimulationService.run(items, config)` se invoca en un `computed` del page → devuelve `SimulationResult`.
- Summary / Table / Chart reciben `[result]` como input y son puros (display).

**No hay signals globales para la simulación**, todo vive en el page.

---

## 6. Tareas

### T0 — Modelos
**Archivos**: `src/app/core/models/simulation/simulation.model.ts`
- [ ] Crear el modelo completo con todas las interfaces de la sección 3.
- [ ] Build verde (`npx tsc --noEmit -p tsconfig.app.json`).

### T1 — SimulationService
**Archivos**: `src/app/core/services/simulation.service.ts`
- [ ] Implementar `run(items, config)` y los métodos privados de la sección 4.
- [ ] Inyectar `TransactionsService`, `UsdRateService`, `CardsService`.
- [ ] Sin signals: el service es funcional, no maneja estado.
- [ ] Build verde.

### T2 — Habilitar la sección "Simulador" en la navegación
**Archivos**:
- `src/app/core/services/navigation.service.ts` → agregar `'simulador'` al type `NavSection`.
- `src/app/shared/components/sidebar/sidebar.component.ts` → agregar item al array `items` (entre Análisis y Configuración).
- `src/app/shared/components/sidebar/sidebar.component.html` → agregar `@case ('simulador')` con un ícono (calculadora o gráfico de barras).
- `src/app/app.component.ts` → agregar entrada en `SECTION_LABELS` ("Simulador") y `SECTION_SUBTITLES` ("Proyectá el impacto de una compra futura"). Confirmar que `SECTIONS_WITH_MONTH` NO incluya 'simulador' (la proyección es relativa a hoy, no a un mes seleccionado).
- [ ] Build verde.

### T3 — SimuladorPageComponent host vacío
**Archivos**: `src/app/pages/simulador-page/simulador-page.component.{ts,html,scss}`
- [ ] Crear host standalone con placeholder visible (`<p>Próximamente</p>`).
- [ ] Registrar en `app.component.ts` imports + `@case ('simulador') { <app-simulador-page /> }`.
- [ ] Build verde + verificar manualmente que al click en sidebar aparece la sección.

### T4 — SimulationFormComponent
**Archivos**: `src/app/pages/simulador-page/components/simulation-form/simulation-form.component.{ts,html}`
- [ ] Tabs: Contado / Cuotas / Suscripción.
- [ ] Inputs comunes: descripción, monto, moneda (ARS/USD), fecha tentativa, categoría (select reusa `tx.allExpenseCategories()`).
- [ ] Inputs condicionales según tab:
  - Cuotas: select de tarjeta (reusa `tx.cards()`), input cuotas (1..N).
  - Suscripción: select de tarjeta, fecha de inicio, fecha de cancelación opcional.
- [ ] Si moneda USD: selector de modo de recargo (auto / digital-service / tourism / usd-payment) — reusar UX del `transaction-form` actual.
- [ ] Sección "Configuración de la proyección" colapsable:
  - Horizonte (slider o segmented: 6/12/18/24).
  - Base de ingresos (radio: promedio 3m / último mes / manual).
  - Si manual: input numérico.
  - Inflación mensual % (default 0).
  - Devaluación mensual % (default 0).
- [ ] Reactiviness: cada cambio dispara emit `(simulate)` con el `SimulationItem` y `SimulationConfig` actualizados.
- [ ] Validaciones inline: monto > 0, cuotas > 0, tarjeta requerida en tabs cuotas/suscripción, etc.

### T5 — SimulationSummaryComponent
**Archivos**: `src/app/pages/simulador-page/components/simulation-summary/simulation-summary.component.{ts,html}`
- [ ] Recibe `[result]: SimulationResult`.
- [ ] 4 tarjetas tipo `summary-cards`:
  - Costo total real (ARS, incluido recargo USD y conversión).
  - Pico de % comprometido (con color por umbral).
  - Meses en rojo (count + alerta si > 0).
  - Costo nominal vs real (delta absoluto y %).
- [ ] Si hay warnings: lista visible con ícono según severidad.

### T6 — ProjectionTableComponent
**Archivos**: `src/app/pages/simulador-page/components/projection-table/projection-table.component.{ts,html}`
- [ ] Recibe `[result]: SimulationResult`.
- [ ] Tabla con columnas: Mes / Ingresos proyectados / Gastos fijos actuales / Impacto compra / Total gastos / Balance / % comprometido.
- [ ] Highlight por fila:
  - Verde claro: balance > 0 y committedPct <= 50.
  - Ámbar: 50 < committedPct <= 80.
  - Rojo: balance < 0 o committedPct > 80.
- [ ] Columna extra "vs sin simulación" mostrando el delta del balance.
- [ ] Responsive: en mobile colapsa a cards apiladas.

### T7 — ProjectionChartComponent
**Archivos**: `src/app/pages/simulador-page/components/projection-chart/projection-chart.component.{ts,html,scss}`
- [ ] Recibe `[result]: SimulationResult`.
- [ ] SVG inline. Barras apiladas por mes:
  - Segmento 1 (base): gastos fijos actuales (color slate).
  - Segmento 2: impacto de la simulación (color violeta/pink, como Analytics).
- [ ] Línea horizontal o suave: ingresos proyectados (verde).
- [ ] Eje X: labels de mes (Ene 26, Feb 26, ...). Eje Y: ARS con formato compacto.
- [ ] Hover por columna → tooltip con detalle del mes (reusar patrón de `analytics`).
- [ ] Sin librerías de chart; SVG manual (consistente con el resto del proyecto).

### T8 — Ensamblar todo en SimuladorPageComponent
**Archivos**: `src/app/pages/simulador-page/simulador-page.component.{ts,html}`
- [ ] Layout: form a la izquierda (col-span-1), resultados a la derecha (col-span-2).
- [ ] Signals locales: `item`, `config`, `result = computed(() => svc.run([item()], config()))`.
- [ ] Estado vacío: si `item() === null`, mostrar un illustration + texto "Cargá una compra para ver la proyección".
- [ ] Pasar `[result]` a Summary / Table / Chart.

### T9 — Verificación end-to-end
- [ ] `npm run build` verde.
- [ ] Smoke test manual:
  - Cargar contado en ARS → balance baja en un solo mes.
  - Cargar 12 cuotas en ARS → balance baja en 12 meses consecutivos.
  - Cargar 12 cuotas en USD modo auto → conversión a ARS aplicada, ver costo real > nominal.
  - Cargar suscripción mensual ARS → balance baja todos los meses del horizonte.
  - Activar inflación 5% → gastos fijos crecen mes a mes, simulación no.
  - Activar devaluación 10% → cuotas USD crecen en ARS mes a mes.
  - Cambiar horizonte 6 → 24 → tabla y chart se redimensionan.
  - Sin ingresos cargados → warning `sin-ingresos-base` visible.
  - 18 cuotas con horizonte 12 → warning `cuotas-exceden-horizonte` visible.
- [ ] Verificar que **no se crea ninguna compra real** en `tx.purchases()` o `tx.subscriptions()` durante la simulación.
- [ ] Verificar que `localStorage` no recibe escrituras nuevas durante la simulación.

---

## 7. Persistencia (localStorage)

- **¿Nuevas claves?** No, el MVP no persiste nada.
- **¿Migración necesaria?** No.

En v2 se agregaría `STORAGE_KEYS.simulations` con un array de `{ id, name, item, config, savedAt }`.

---

## 8. UI / UX

- **Sidebar**: agregar item "Simulador" entre Análisis y Configuración.
- **Selector de mes**: la página de Simulador NO usa el selector del header (la proyección arranca desde el mes actual, fijo). Confirmar que `SECTIONS_WITH_MONTH` no la incluya.
- **Modal de confirmación**: no se necesita en el MVP (la simulación es pura, no hay acciones destructivas).
- **Categorías**: el simulador NO crea categorías. Sólo las usa para display (selectores reusables del proyecto).
- **Idioma**: identificadores en inglés (`SimulationService`, `MonthProjection`), UI 100% en español ("Pico de % comprometido", "Meses en rojo", etc.).

---

## 9. Convenciones a respetar

- [ ] Cada componente con sufijo `Component`, archivos `.ts/.html/.scss` (scss opcional si no hay CSS custom).
- [ ] `standalone: true` explícito.
- [ ] `templateUrl` y `styleUrls` (sin templates inline).
- [ ] Tailwind sin prefijo `tw-`.
- [ ] Signals/`computed` antes que `Subject`/RxJS.
- [ ] `SimulationService.run` es **pura**: misma entrada → misma salida.
- [ ] El service NO toca `localStorage`, NO modifica los signals de `TransactionsService` ni de los services hijos.
- [ ] Cero acoplamiento con `NavigationService` desde el service de cálculo.
- [ ] Commits en español, conventional commits (`feat(simulador): ...`, `feat(core): ...`).

---

## 10. Impacto y riesgos

### Funcionalidad afectada

- **Ninguna**. Es una página nueva, aislada. No modifica services existentes ni toca persistencia.
- Sí toca `navigation.service.ts` (un tipo + label) y `sidebar.component` (un item), cambios triviales y aditivos.

### Datos del usuario

- **Cero impacto**. La simulación es non-destructive.

### Rollback

- Triviales: borrar la carpeta `pages/simulador-page/`, el service, el modelo, y revertir 3 líneas en `navigation.service.ts`, `sidebar.component.*` y `app.component.*`.

### Riesgos técnicos

1. **Performance**: el `computed` que llama `simulationService.run` se recalcula con cada keystroke del form. Si el horizonte es 24 meses y el service llama internamente 24 veces a `tx.expensesForMonth`, podría ralentizarse con muchos datos. **Mitigación**: cachear el resultado de `existingFixedFor(month)` dentro de una sola corrida de `run()`. Si igual hay lag, debouncar el form 200ms antes de disparar el cómputo.
2. **TC no disponible al arrancar**: si el usuario simula USD el mismo segundo que abre la app, puede no haber TC cacheado. **Mitigación**: el effect global de fetch ya pide TC del día al iniciar; mostrar warning `tc-no-disponible` mientras tanto.
3. **Confusión sobre "fijos actuales"**: el usuario podría confundir "gastos fijos actuales" con todos los gastos. **Mitigación**: tooltip en la columna explicando que cubre cuotas + suscripciones + plantillas marcadas como fijas (no incluye gastos variables del mes actual).

---

## 11. Orden de implementación sugerido

1. **T0** → Modelos (sin riesgo, base de todo).
2. **T1** → Service (lógica pura, testeable manualmente desde consola).
3. **T2** → Habilitar sección en sidebar (sin contenido real, sólo navegación).
4. **T3** → Host placeholder (verifica que la navegación funcione end-to-end).
5. **T4** → Form (lo más complejo de UI; una vez funciona, el resto consume su output).
6. **T5** → Summary (chiquito, valida que el service devuelve lo que se espera).
7. **T6** → Tabla (output crudo del service, fácil de debuggear).
8. **T7** → Chart (gating final, requiere que la data ya esté correcta).
9. **T8** → Ensamblaje + polish.
10. **T9** → Verificación final.

---

## 12. Verificación

- [ ] `npm run build` verde.
- [ ] `npx ng build --configuration=development` verde.
- [ ] Las 7 secciones del sidebar (Mes, Tarjetas, Suscripciones, Ahorros, Análisis, **Simulador**, Configuración) navegan correctamente.
- [ ] Datos del usuario existentes en localStorage siguen intactos después de simular.
- [ ] Cargar y borrar simulaciones repetidamente no genera fugas de memoria visibles.
- [ ] Performance: form responde sin lag perceptible con un horizonte de 24 meses.

---

## 13. Notas adicionales

### Decisiones tomadas en la fase de diseño

- **Persistencia A (sesión)** en lugar de B (guardado nombrado): para no inflar el MVP. Cuando aparezca la necesidad real de comparar escenarios, se agrega.
- **No incluir "Convertir simulación en compra real"** en MVP: feature valiosa pero ortogonal. Se puede agregar en v1.1 sin tocar el modelo (es sólo un botón que llama a `tx.addPurchase()` con los datos del item).
- **Inflación y devaluación como % mensual fijo**: la alternativa era una curva (proyección por escenario optimista/pesimista). Más simple así, el usuario puede iterar.
- **Tipo `cuotas` siempre requiere `cardId`**: para reusar el `closingDay` real de la tarjeta. Alternativa descartada: pedir el cierre manualmente en el form (más fricción).
- **Suscripción simulada también requiere `subscriptionCardId`**: misma razón.

### Cosas a NO hacer durante la implementación

- No introducir signals globales para la simulación. Todo en el page component.
- No tocar `TransactionsService` ni los services de Core. La simulación es 100% read-only sobre ellos.
- No guardar nada en `localStorage` (lo dijimos en MVP, repito porque es tentador).
- No reusar `analytics.component.ts` como base — son charts distintos. Sí inspirarse en sus utilidades de SVG (`trendX`, `trendY`, `formatCompact`).

### Cosas a hacer SÍ durante la implementación

- Aprovechar al máximo los métodos existentes del `TransactionsService` (`incomeForMonth`, `expensesForMonth`, `installmentsForMonth`, `subscriptionChargesForMonth`, `convertEntryToArs`).
- Mantener el `SimulationService` testeable: sin dependencias del DOM, sin signals.
- Documentar en JSDoc por qué la inflación NO se aplica a las cuotas simuladas.
- Asegurarse que cada componente puede recibir `result = null` (mientras el form aún no es válido) sin crashear.

---

### Reglas

- ✅ **SIEMPRE** dejar build verde al cerrar cada tarea T.
- ✅ **SIEMPRE** verificar que no se crean compras / suscripciones reales en el proceso.
- ❌ **NUNCA** modificar el estado de `TransactionsService` desde el simulador.
- ❌ **NUNCA** persistir simulaciones en `localStorage` en el MVP.
