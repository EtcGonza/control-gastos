---
plan: 2026-06-refactor-arquitectura-core-shared-pages
tipo: refactor
estado: backlog
prioridad: alta
fecha-creacion: 2026-06-02
fecha-inicio: —
fecha-fin: —
modulo: src/app/**
tags: [arquitectura, angular21, standalone, core, shared, pages, naming, skills, agents]
---

# Plan de Refactorización — Arquitectura Core / Shared / Pages + convenciones Angular

> **Objetivo**: Alinear todo el código fuente de `Control de Gastos` con las convenciones estándar de Angular y con la estructura modular (Core / Shared / Pages) usada en el proyecto de referencia `prevencion-pwa`, **manteniendo standalone components** (sin `NgModule`). Adicionalmente, importar las skills relevantes de `prevencion-pwa` y crear `AGENTS.md` y `CLAUDE.md` propios.

---

## Motivación

La app fue creciendo orgánicamente y arrastra deuda arquitectónica que dificulta mantenimiento y lectura del código:

1. **Naming no estándar**: las clases se llaman `TransactionForm`, `Sidebar`, `Analytics`, etc., sin el sufijo `Component`. Los archivos son `transaction-form.ts` en lugar de `transaction-form.component.ts`. Esto rompe con la convención oficial de Angular y dificulta distinguir un componente de un servicio o utilidad al leer el árbol de archivos.
2. **No hay `standalone: true` explícito**: aunque Angular 21 lo asume por default, declararlo explícitamente vuelve el contrato del componente auto-documentado y previene problemas si se llegara a tocar la config de aplicación.
3. **Templates inline**: el 100% de los componentes tiene el HTML embebido en el `.ts` mediante template literals. Esto produce archivos `.ts` de 600+ líneas, dificulta el formato, mata el highlighting de los IDEs sobre Angular templates, y mezcla lógica de presentación con lógica del componente.
4. **Carpeta plana `components/`**: todos los componentes viven al mismo nivel sin distinguir entre piezas reutilizables (sidebar, info-tooltip, confirm-host), composiciones de sección (analytics, cards-manager, savings) y pantallas completas. Tampoco hay separación clara entre _building blocks_ y _pages_.
5. **God service**: `TransactionsService` concentra cotizaciones USD, transacciones, tarjetas/cuotas, suscripciones, ahorros, categorías custom, plantillas, migración, persistencia y filtros del mes. Es un único archivo de >1.000 líneas que toca todos los dominios del producto.
6. **Sin convenciones de AI agents**: el proyecto no tiene `AGENTS.md`, `CLAUDE.md` ni skills. `prevencion-pwa` ya invirtió en este tooling y muchas de sus skills aplican casi sin modificación (`clean-code-principles`, `git-commits`, `typescript-best-practices`, `plan-*`).

Este refactor no agrega features. Es **puro mantenimiento estructural**.

---

## Archivos involucrados

A altísimo nivel, todo `src/app/**` y la raíz del repo. Detalle por área en las tareas T0..Tn.

| Archivo | Rol | Cambio |
|---------|-----|--------|
| `src/app/components/**/*.ts` | Componentes (18) | Renombrar + split a `.ts` / `.html` / `.scss` + mover a Core/Shared/Pages |
| `src/app/services/transactions.service.ts` | God service | Dividir en servicios por dominio |
| `src/app/services/{confirm,navigation,theme}.service.ts` | Servicios singleton | Mover a `core/services/` |
| `src/app/models/*.model.ts` | Modelos de dominio | Mover a `core/models/{entidad}/` |
| `src/app/app.{ts,html,css,config.ts}` | Root component | Renombrar a `app.component.*` |
| `AGENTS.md` (raíz) | — | Crear |
| `CLAUDE.md` (raíz) | — | Crear (symlink o copia de AGENTS.md) |
| `.claude/skills/**` | — | Crear, copiar skills seleccionadas |
| `plans/README.md`, `plans/templates/*` | — | Crear (basado en prevencion-pwa) |

---

## Estado actual vs estado deseado

### Naming de componentes

| Aspecto | Estado actual | Estado deseado |
|---------|---------------|----------------|
| Clase | `export class TransactionForm` | `export class TransactionFormComponent` |
| Archivo `.ts` | `transaction-form.ts` | `transaction-form.component.ts` |
| Template | Inline en `template:` | Externo en `transaction-form.component.html` con `templateUrl` |
| Estilos | Tailwind inline + sin `.scss` | Tailwind inline + `transaction-form.component.scss` solo si hace falta CSS custom |
| Standalone | Implícito (default Angular 21) | `standalone: true` explícito |
| Selector | `app-transaction-form` | Sin cambios (ya está bien) |

### Estructura de carpetas

**Antes:**
```
src/app/
├── components/        ← 18 componentes planos, sin separación
│   ├── analytics/analytics.ts
│   ├── cards-manager/cards-manager.ts
│   ├── ...
├── services/          ← god service + helpers
│   ├── transactions.service.ts   (>1000 líneas)
│   ├── confirm.service.ts
│   ├── navigation.service.ts
│   └── theme.service.ts
├── models/            ← todos los modelos al mismo nivel
├── app.ts, app.html, app.config.ts, app.css
```

**Después:**
```
src/app/
├── core/
│   ├── services/
│   │   ├── navigation.service.ts
│   │   ├── theme.service.ts            (sigue disabled, pero vive acá)
│   │   ├── confirm.service.ts
│   │   ├── storage.service.ts          (NUEVO - abstrae localStorage)
│   │   ├── usd-rate.service.ts         (NUEVO - cotizaciones + cache)
│   │   ├── categories.service.ts       (NUEVO - defaults + custom + migración)
│   │   ├── transactions.service.ts     (slim, sólo transacciones del mes)
│   │   ├── cards.service.ts            (NUEVO - tarjetas + cuotas virtuales)
│   │   ├── subscriptions.service.ts    (NUEVO - suscripciones + historial)
│   │   ├── savings.service.ts          (NUEVO - ahorros + movimientos)
│   │   ├── recurring-templates.service.ts (NUEVO - fijos guardados)
│   │   └── backup.service.ts           (NUEVO - export/import/clear)
│   ├── models/
│   │   ├── transaction/transaction.model.ts
│   │   ├── credit-card/credit-card.model.ts
│   │   ├── credit-card/card-purchase.model.ts
│   │   ├── subscription/subscription.model.ts
│   │   ├── saving/saving.model.ts
│   │   ├── saving/saving-movement.model.ts
│   │   ├── category/custom-category.model.ts
│   │   └── recurring-template/recurring-template.model.ts
│   ├── constants/
│   │   ├── default-categories.ts
│   │   ├── storage-keys.ts
│   │   └── usd-rate.constants.ts
│   ├── tokens/
│   │   └── window.token.ts             (opcional para localStorage SSR-safe)
│   └── utils/
│       ├── date.utils.ts               (clamping mes corto, monthKey, etc.)
│       └── currency.utils.ts           (formato y conversión)
├── shared/
│   ├── components/
│   │   ├── confirm-host/confirm-host.component.{ts,html,scss}
│   │   ├── info-tooltip/info-tooltip.component.{ts,html,scss}
│   │   ├── month-selector/month-selector.component.{ts,html,scss}
│   │   ├── sidebar/sidebar.component.{ts,html,scss}
│   │   └── theme-picker/theme-picker.component.{ts,html,scss}  (deshabilitado)
│   ├── pipes/                          (si surge alguna, vacío por ahora)
│   └── directives/                     (vacío por ahora)
├── pages/
│   ├── mes-page/
│   │   ├── mes-page.component.{ts,html,scss}
│   │   └── components/
│   │       ├── summary-cards/summary-cards.component.{ts,html,scss}
│   │       ├── usd-summary/usd-summary.component.{ts,html,scss}
│   │       ├── transaction-form/transaction-form.component.{ts,html,scss}
│   │       ├── transaction-list/transaction-list.component.{ts,html,scss}
│   │       ├── recurring-templates/recurring-templates.component.{ts,html,scss}
│   │       └── category-breakdown/category-breakdown.component.{ts,html,scss}
│   ├── tarjetas-page/
│   │   ├── tarjetas-page.component.{ts,html,scss}
│   │   └── components/
│   │       └── cards-manager/cards-manager.component.{ts,html,scss}
│   ├── suscripciones-page/
│   │   ├── suscripciones-page.component.{ts,html,scss}
│   │   └── components/
│   │       └── subscriptions-manager/subscriptions-manager.component.{ts,html,scss}
│   ├── ahorros-page/
│   │   ├── ahorros-page.component.{ts,html,scss}
│   │   └── components/
│   │       └── savings/savings.component.{ts,html,scss}
│   ├── analisis-page/
│   │   ├── analisis-page.component.{ts,html,scss}
│   │   └── components/
│   │       └── analytics/analytics.component.{ts,html,scss}
│   └── configuracion-page/
│       ├── configuracion-page.component.{ts,html,scss}
│       └── components/
│           ├── categories-manager/categories-manager.component.{ts,html,scss}
│           └── data-backup/data-backup.component.{ts,html,scss}
├── app.component.ts
├── app.component.html
├── app.component.scss
├── app.config.ts
└── app.routes.ts                       (NUEVO - reemplaza switch de NavigationService por rutas)
```

> **Decisión clave**: aunque `prevencion-pwa` usa `NgModule`, nosotros mantenemos **standalone components**. La estructura de carpetas se replica; lo que cambia es que cada componente importa lo suyo y no existen archivos `*.module.ts`.

### Servicios — split del god service

| Servicio actual | Responsabilidades | Servicios resultantes |
|-----------------|-------------------|-----------------------|
| `TransactionsService` | tx + plantillas + tarjetas + cuotas + suscripciones + ahorros + USD + categorías + migración + backup + persistencia | 9 servicios pequeños (ver "Estructura de carpetas") |

Cada servicio nuevo:
- Inyecta `StorageService` (no toca `localStorage` directo).
- Expone signals de su dominio (`templates()`, `cards()`, etc.).
- Sus computeds del mes seleccionado dependen del signal `selectedMonth` que vive en un nuevo `MonthService` o sigue centralizado en `TransactionsService` (TBD en T0).

---

## Tareas de refactorización

> Numeración tipo prevencion-pwa: `T0..Tn`. Cada tarea es atómica y debe compilar al cerrarse.

### T0 — Crear estructura de carpetas vacía
**Archivos**: `src/app/{core,shared,pages}/**`
**Contexto**: armar el esqueleto antes de mover nada, así los siguientes commits sólo agregan archivos a carpetas existentes.
- [ ] Crear `src/app/core/{services,models,constants,utils,tokens}/`
- [ ] Crear `src/app/shared/{components,pipes,directives}/`
- [ ] Crear `src/app/pages/{mes-page,tarjetas-page,suscripciones-page,ahorros-page,analisis-page,configuracion-page}/components/`
- [ ] Agregar `.gitkeep` en las carpetas vacías para que git las trackee

### T1 — Renombrar AppComponent y separar plantilla
**Archivos**: `src/app/app.ts`, `app.html`, `app.css`, `app.config.ts`
**Contexto**: el root es el primer ejemplo de la convención; debe estar bien para inspirar al resto.
- [ ] Renombrar `app.ts` → `app.component.ts`, `app.html` → `app.component.html`, `app.css` → `app.component.scss`
- [ ] Clase `App` → `AppComponent`
- [ ] Decorator usa `templateUrl` y `styleUrls`
- [ ] Agregar `standalone: true` explícito
- [ ] Actualizar referencia en `main.ts` / bootstrap
- [ ] Build verde

### T2 — Migrar modelos a `core/models/{entidad}/`
**Archivos**: `src/app/models/*.model.ts` → `src/app/core/models/{entidad}/*.model.ts`
**Contexto**: los modelos son el cimiento; moverlos primero permite ajustar imports una sola vez en cada componente cuando se mude.
- [ ] `transaction.model.ts` → `core/models/transaction/transaction.model.ts`
- [ ] `credit-card.model.ts` + `card-purchase.model.ts` → `core/models/credit-card/`
- [ ] `subscription.model.ts` → `core/models/subscription/`
- [ ] `saving.model.ts` (+ `SavingMovement` interno) → `core/models/saving/`
- [ ] `custom-category.model.ts` → `core/models/category/`
- [ ] `recurring-template.model.ts` → `core/models/recurring-template/`
- [ ] Buscar/reemplazar imports masivamente (`from '../../models/...'` → `from '../../../core/models/...'`)
- [ ] Build verde

### T3 — Extraer constantes y utilidades
**Archivos**: `src/app/core/constants/*`, `src/app/core/utils/*`
**Contexto**: dejan el servicio mucho más chico antes del split.
- [ ] `default-categories.ts`: array de categorías default (id, name, color) extraído del servicio
- [ ] `storage-keys.ts`: enum/const con todas las claves de localStorage centralizadas
- [ ] `usd-rate.constants.ts`: URL del endpoint, TTL del cache, claves
- [ ] `date.utils.ts`: `clampDayInMonth`, `monthKey`, `parseMonthKey`, `monthName`
- [ ] `currency.utils.ts`: helpers de formato si los hay (o dejar pipe)
- [ ] Build verde

### T4 — Crear `StorageService`
**Archivos**: `src/app/core/services/storage.service.ts`
**Contexto**: punto único de acceso a `localStorage`. Permite SSR-safety, mockear en tests, y unifica el patrón `try/catch + JSON.parse`.
- [ ] API: `get<T>(key)`, `set(key, value)`, `remove(key)`, `clear(prefix?)`, `getAllByPrefix(prefix)`
- [ ] Guardar la clave raíz `control-gastos:` como const
- [ ] Build verde

### T5 — Crear `UsdRateService`
**Archivos**: `src/app/core/services/usd-rate.service.ts`
**Contexto**: aislar la lógica de cotizaciones (cache, fetch, conversión, recargo, IVA digital).
- [ ] Extraer del god service: `rateForMonth()`, `fetchRate(month)`, cache map, effect de auto-fetch
- [ ] Extraer `convertUsdToArs(amount, mode)` con todos los modos (manual, oficial, oficial+recargo, servicio digital)
- [ ] El service inyecta `StorageService` para persistir cache
- [ ] Tests manuales: cambiar de mes y verificar que la cotización aparece
- [ ] Build verde

### T6 — Crear `CategoriesService`
**Archivos**: `src/app/core/services/categories.service.ts`
**Contexto**: contiene defaults + custom + soft delete + migración. Hoy es la sección más entrelazada del god service.
- [ ] Extraer: signal `customCategories()`, signal `categoryMigrationReport()`
- [ ] Métodos: `addCustomCategory`, `archiveCategory`, `reactivateCategory`, `updateCustomCategory`, `nameForCategory`, `colorForCategory`, `allActiveCategories()`
- [ ] Mover la migración a método `runCategoryMigration()` invocado por constructor
- [ ] Build verde + verificar que el modal de migración sigue disparándose

### T7 — Crear `TransactionsService` (slim) + `MonthService`
**Archivos**: `src/app/core/services/transactions.service.ts`, `src/app/core/services/month.service.ts`
**Contexto**: dejar `TransactionsService` con sólo lo suyo (CRUD de transacciones, filtros del mes, totales). `MonthService` expone `selectedMonth` signal compartido.
- [ ] `MonthService.selectedMonth: WritableSignal<string>` (formato `YYYY-MM`)
- [ ] `MonthService.setMonth(month)`, `next()`, `prev()`
- [ ] `TransactionsService` inyecta `MonthService`, `CategoriesService`, `UsdRateService`, `StorageService`
- [ ] Mantener: CRUD transacciones, computeds `monthlyTransactions`, `monthlyIncome`, `monthlyExpenses`, `expensesByCategory`, `transactionsFiltered` (filtros + orden), `addTransaction`, `removeTransaction`, `updateTransaction`
- [ ] Quitar: tarjetas, suscripciones, ahorros, plantillas, USD, categorías, backup
- [ ] Build verde

### T8 — Crear `CardsService`
**Archivos**: `src/app/core/services/cards.service.ts`
**Contexto**: tarjetas + compras + cuotas virtuales. Las cuotas virtuales son transacciones derivadas computadas, no se persisten.
- [ ] Extraer signals `cards()`, `cardPurchases()` y métodos CRUD
- [ ] Computed `installmentsForMonth(month)` que arma las cuotas virtuales de un mes
- [ ] Inyecta `UsdRateService` para conversión USD→ARS y `MonthService` para mes actual
- [ ] Build verde

### T9 — Crear `SubscriptionsService`
**Archivos**: `src/app/core/services/subscriptions.service.ts`
- [ ] Signals `subscriptions()` (activas y archivadas)
- [ ] Historial de precios preservado en soft delete
- [ ] Computed `subscriptionsForMonth(month)` armando las virtuales del mes
- [ ] Build verde

### T10 — Crear `SavingsService`
**Archivos**: `src/app/core/services/savings.service.ts`
- [ ] Signals `savings()`, movimientos por ahorro
- [ ] CRUD y agregación de balance
- [ ] Build verde

### T11 — Crear `RecurringTemplatesService`
**Archivos**: `src/app/core/services/recurring-templates.service.ts`
- [ ] Signal `templates()`
- [ ] `applyTemplateToSelectedMonth(id)`, `isTemplateAppliedThisMonth(t)`, `updateTemplateAmount`, `removeTemplate`
- [ ] Inyecta `TransactionsService` para crear la tx al aplicar
- [ ] Build verde

### T12 — Crear `BackupService`
**Archivos**: `src/app/core/services/backup.service.ts`
- [ ] `exportAll()`, `importAll(json)`, `clearAll()`
- [ ] Inyecta todos los services anteriores para volcar/restaurar
- [ ] Build verde

### T13 — Mover servicios singleton existentes a `core/services/`
**Archivos**: `confirm.service.ts`, `navigation.service.ts`, `theme.service.ts`
- [ ] `mv` a `src/app/core/services/`
- [ ] Build verde

### T14 — Migrar componentes Shared
**Archivos**: `confirm-host`, `info-tooltip`, `month-selector`, `sidebar`, `theme-picker`
**Contexto**: piezas reutilizables que no son una "página". Se mueven primero porque tienen poco contenido y sirven de práctica del nuevo formato.
- [ ] Por cada componente:
  - [ ] Renombrar archivo a `*.component.ts`
  - [ ] Renombrar clase a `*Component`
  - [ ] Extraer `template:` a `*.component.html` con `templateUrl`
  - [ ] Crear `*.component.scss` si hay CSS custom; si no, no agregarlo
  - [ ] Agregar `standalone: true` explícito
  - [ ] Mover a `src/app/shared/components/{nombre}/`
  - [ ] Actualizar imports en los consumidores
- [ ] Build verde después de **cada** componente movido (no bigbang)

### T15 — Migrar componentes de Page: Mes
**Archivos**: `summary-cards`, `usd-summary`, `transaction-form`, `transaction-list`, `recurring-templates`, `category-breakdown`
- [ ] Mismo procedimiento que T14, mover a `src/app/pages/mes-page/components/`
- [ ] Crear `mes-page.component.{ts,html,scss}` que orqueste estos 6 hijos (lo que hoy hace `app.component.html` en su rama "mes")
- [ ] Build verde tras cada componente

### T16 — Migrar componentes de Page: Tarjetas
**Archivos**: `cards-manager`
- [ ] Mover a `src/app/pages/tarjetas-page/components/cards-manager/`
- [ ] Crear `tarjetas-page.component.*` host
- [ ] Build verde

### T17 — Migrar componentes de Page: Suscripciones
**Archivos**: `subscriptions-manager`
- [ ] Mover a `src/app/pages/suscripciones-page/components/`
- [ ] Crear `suscripciones-page.component.*` host
- [ ] Build verde

### T18 — Migrar componentes de Page: Ahorros
**Archivos**: `savings`
- [ ] Mover a `src/app/pages/ahorros-page/components/`
- [ ] Crear `ahorros-page.component.*` host
- [ ] Build verde

### T19 — Migrar componentes de Page: Análisis
**Archivos**: `analytics`
- [ ] Mover a `src/app/pages/analisis-page/components/`
- [ ] Crear `analisis-page.component.*` host
- [ ] Build verde

### T20 — Migrar componentes de Page: Configuración
**Archivos**: `categories-manager`, `data-backup`
- [ ] Mover a `src/app/pages/configuracion-page/components/`
- [ ] Crear `configuracion-page.component.*` host
- [ ] Build verde

### T21 — Limpieza final de la carpeta legacy
**Archivos**: `src/app/components/`, `src/app/models/`, `src/app/services/`
- [ ] Verificar que están vacías
- [ ] `rmdir`
- [ ] Build verde

### T22 — (Opcional) Migrar de NavigationService a Angular Router
**Archivos**: `app.config.ts`, `app.routes.ts`, `app.component.html`
**Contexto**: hoy `NavigationService` es un signal `currentSection` y `app.component.html` hace `@switch`. Con la estructura por páginas, podemos pasar a rutas reales y usar `routerLink` en el sidebar.
- [ ] Crear `app.routes.ts` con rutas a cada `*-page.component`
- [ ] `provideRouter` en `app.config.ts`
- [ ] Sidebar usa `routerLink` y `routerLinkActive`
- [ ] Quitar `NavigationService` (o mantenerlo si decidimos no rutar, marcar como descartado en este plan)
- [ ] **Esta tarea puede diferirse a un plan separado.** Decidir al cerrar T21.

### T23 — Crear `plans/` con README y templates
**Archivos**: `plans/README.md`, `plans/templates/PLAN-{FEATURE,BUG,REFACTOR,TEST,ANALISIS}.template.md`
**Contexto**: copiar el sistema de planes de `prevencion-pwa` (frontmatter YAML, agrupación mensual, 5 tipos).
- [ ] Copiar `plans/README.md` y `plans/templates/*` desde prevencion-pwa
- [ ] Ajustar referencias del proyecto (nombre, módulos)
- [ ] Este mismo plan vive en `plans/2026-06/`

### T24 — Importar skills relevantes de prevencion-pwa
**Archivos**: `.claude/skills/**`
**Contexto**: ver sección "Skills a importar" más abajo para la lista filtrada.
- [ ] Crear `.claude/skills/`
- [ ] Copiar cada skill seleccionado (no symlink: el proyecto no comparte repo con prevencion-pwa)
- [ ] Adaptar ejemplos que mencionan ASO/Zod/SQLite (omitir o reemplazar con el stack real: signals, localStorage, Tailwind sin prefijo `tw-`)
- [ ] Por skill: revisar `SKILL.md`, quitar referencias a librerías que no usamos

### T25 — Crear `AGENTS.md` y `CLAUDE.md`
**Archivos**: `AGENTS.md`, `CLAUDE.md` (raíz)
**Contexto**: documento maestro de convenciones para agentes IA. Basado en `AGENTS.md` de prevencion-pwa pero adaptado al stack real de Control de Gastos.
- [ ] Stack: Angular 21 standalone, Tailwind v4, **sin prefijo `tw-`**, signals/computed/effect, localStorage, sin Zod, sin SQLite, sin librería ASO
- [ ] Sección "Convenciones": Component suffix, standalone explícito, templateUrl/styleUrls, idioma español para naming de dominio, commits en español sin emojis
- [ ] Sección "Arquitectura": Core / Shared / Pages, qué va en cada uno
- [ ] Sección "Skills disponibles": tabla con las skills importadas en T24
- [ ] Sección "Triggers automáticos": tabla "Cuando hago X → cargar skill Y"
- [ ] `CLAUDE.md` = copia o symlink de `AGENTS.md`

### T26 — Verificación final
**Archivos**: todo
- [ ] `npm run build` verde
- [ ] App levantada en dev: navegar por las 6 secciones y verificar que todo funciona
- [ ] Cargar/editar/borrar una transacción manual
- [ ] Cargar una compra de tarjeta y ver cuotas en mes siguiente
- [ ] Aplicar una plantilla recurrente
- [ ] Export + clear + import para verificar backup
- [ ] Verificar que el modal de migración de categorías no rompió
- [ ] Confirmar que no quedan referencias a `src/app/components` ni `src/app/services/transactions.service.ts` en el `git grep`

---

## Skills de prevencion-pwa a importar

De las ~135 skills de prevencion-pwa, la mayoría son específicas de ese proyecto (ASO, Zod, Azure DevOps, SQLite). Filtrando por lo que aplica a Control de Gastos:

### Aplicables directo (copiar y ajustar)

| Skill | Carpeta destino | Por qué |
|-------|-----------------|---------|
| `clean-code-principles` | `.claude/skills/clean-code/` | Principios SOLID, naming, early returns. Universal. |
| `typescript-best-practices` | `.claude/skills/typescript/` | No-any, strict types, interfaces planas. |
| `typescript-utility-types` | `.claude/skills/typescript/` | Pick, Omit, Partial, Record. |
| `typescript-path-aliases` | `.claude/skills/typescript/` | Configurar `@core`, `@shared`, `@pages`. |
| `git-commits` | `.claude/skills/git-workflow/` | Mensajes en español sin emojis. |
| `plan-orchestrator` | `.claude/skills/planning/` | Clasifica en 5 tipos y delega. |
| `plan-feature-creation` | `.claude/skills/planning/` | Template feature con 13 secciones. |
| `plan-bug-resolution` | `.claude/skills/planning/` | Template bug con T0..Tn. |

### Adaptables (reescribir parcialmente)

| Skill | Carpeta destino | Adaptación |
|-------|-----------------|------------|
| `module-creation` | `.claude/skills/components/` | Reescribir como `page-creation` o `standalone-component-creation`. Quitar referencias a NgModule. |
| `angular-route-definition` | `.claude/skills/navigation/` | Adaptar a `provideRouter` + standalone routes. Sólo si hacemos T22. |
| `angular-navigation` | `.claude/skills/navigation/` | `router.navigate()` con standalone. |
| `app-routes-constants` | `.claude/skills/navigation/` | Centralizar rutas en `app.routes.ts`. |
| `app-routes-constants` (idea) | `.claude/skills/navigation/` | Constantes de rutas. |
| `model-creation` | `.claude/skills/models/` | Sin Zod. Mantener convención `fromJson`/`toJson` opcional, pero principalmente interfaces TS. |
| `model-naming-conventions` | `.claude/skills/models/` | `.model.ts` por archivo, carpeta por entidad. |
| `core-doc-index`, `shared-doc-index` | `.claude/skills/documentation/` | Patrón para `doc/core/README.md` y `doc/shared/README.md`. |

### Descartar (no aplican)

| Familia | Por qué |
|---------|---------|
| `aso-*` (17 skills) | UI library propietaria de Asociart. No la usamos. |
| `azure-devops-*` (11 skills) | Este proyecto vive en GitHub. |
| `forms/*`, `params/*`, `http-services/*` (~25 skills) | No usamos Reactive Forms ni HTTP propio (sólo un fetch puntual a argentinadatos). |
| `database/*` (27 skills) | No usamos SQLite. Persistencia es localStorage. |
| `modals/*` (12 skills) | Ya tenemos `ConfirmService` propio y no usamos bsmodal/AsoModal. |
| `filtros-menu-lateral/*` (10 skills) | Patrón específico de prevencion-pwa. |
| `module-imports-hierarchy`, `shared-module-usage` | Asume `NgModule`. No aplica con standalone. |
| `zod-validation`, `schema-creation` | Sin Zod en este proyecto. |
| `testing/*` (9 skills) | Útiles a largo plazo, pero importarlos sin tests escritos no aporta. Postponer. |

### Skills nuevos propios a crear (más adelante, no en este plan)

- `signals-patterns` — convenciones de `signal`, `computed`, `effect`, `WritableSignal`.
- `localstorage-persistence` — patrón con `StorageService` y `effect` para auto-save.
- `usd-rate-conversion` — modos de conversión, IVA digital, cache.
- `category-migration` — patrón para migrar categorías string → id con modal.

---

## Compatibilidad y dependencias

### Funcionalidad del usuario
- [ ] **No requiere cambios funcionales.** Es refactor puro.
- [ ] La persistencia en localStorage **mantiene las mismas claves** (`storage-keys.ts` debe enumerar las actuales sin renombrarlas) para que datos existentes del usuario sigan funcionando tras el deploy.

### Servicios consumidores (componentes)
- Cada componente migrará sus imports en su tarea correspondiente (T14–T20). Mientras tanto, los servicios pueden re-exportarse desde un barrel temporal `src/app/services/index.ts` que apunte a `core/services/*` para no romper compilación intermedia. Eliminar barrel al cerrar T21.

### Tests
- No hay tests automatizados todavía. Verificación es manual (T26).

---

## Impacto

- **Funcionalidad afectada**: ninguna (refactor puro).
- **Tiempo estimado**: 8–12 sesiones de trabajo (cada T = ~30–60 min).
- **Riesgo principal**: romper el modal de migración de categorías al partir `CategoriesService` y `TransactionsService`. Verificar explícitamente en T6 y T26.
- **Reversibilidad**: alta. Cada tarea es un commit independiente con build verde, así que cualquier paso se puede `git revert`.

---

## Orden de implementación sugerido

1. **T0** → Esqueleto de carpetas vacías.
2. **T1** → AppComponent renombrado (ejemplo del patrón nuevo).
3. **T2, T3, T4** → Modelos + constantes + StorageService (base).
4. **T5–T12** → Split del god service (uno por commit, con build verde en cada paso).
5. **T13** → Mover servicios singleton existentes.
6. **T14** → Componentes Shared.
7. **T15–T20** → Componentes de cada Page (en orden de complejidad ascendente).
8. **T21** → Limpieza de carpetas legacy.
9. **T23** → Crear sistema `plans/` y mover este plan a `plans/2026-06/`.
10. **T24** → Importar skills filtrados.
11. **T25** → `AGENTS.md` + `CLAUDE.md`.
12. **T26** → Verificación end-to-end.
13. **T22** → (Opcional, decidir al cerrar T21) Migración a Angular Router.

---

## Notas adicionales

- **Tailwind sin prefijo `tw-`**: Control de Gastos usa Tailwind v4 con clases puras (`flex`, `gap-4`). `AGENTS.md` debe documentar esto explícitamente para que no se aplique automáticamente la regla de prevencion-pwa.
- **Standalone vs Modules**: confirmado, mantenemos standalone. Toda referencia a NgModule en skills importados se debe reescribir o eliminar.
- **Idioma**: español para nombres de dominio (`agregarTransaccion`? — TBD), inglés para términos técnicos (`signal`, `computed`). Considerar dejar el código actual en inglés y sólo aplicar español a comentarios y commits, ya que el código actual está mayormente en inglés.
- **No hacer split y rename en el mismo commit**. Renombrar primero (T1, T14), después dividir lógica (T5–T12). Commits chicos y atómicos.
- **No tocar features durante este plan**. Si surge un bug, abrir plan separado en `plans/2026-06/2026-06-bug-*.md`.

---

### Reglas

- ✅ **SIEMPRE** dejar build verde al cerrar cada tarea T.
- ✅ **SIEMPRE** verificar que la app levanta y navega entre las 6 secciones después de mover un componente.
- ✅ **SIEMPRE** mantener las claves de localStorage existentes para no romper datos del usuario.
- ✅ **SIEMPRE** un commit por tarea T.
- ❌ **NUNCA** combinar refactor con cambios funcionales.
- ❌ **NUNCA** hacer "big bang": cada paso debe ser revertible.
- ❌ **NUNCA** importar una skill de prevencion-pwa sin adaptar sus ejemplos al stack real (sin ASO, sin Zod, sin SQLite, sin `tw-`).
