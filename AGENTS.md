# Control de Gastos — AI Agent Skills

> **Single Source of Truth** — Este archivo es la referencia maestra para todos los asistentes de IA que trabajen con este proyecto.

App personal de finanzas hecha en Angular 21 (standalone, sin NgModule). Maneja transacciones manuales, tarjetas con cuotas virtuales, suscripciones con historial de precios, ahorros en ARS/USD, categorías custom con soft delete, y respaldo export/import vía JSON. Persistencia 100 % en `localStorage`.

---

## Stack

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Angular | 21 (standalone) | Framework, signals + computed + effect, control flow `@if`/`@for`/`@switch` |
| Tailwind CSS | v4 (via `@tailwindcss/postcss`) | Estilos. **Sin prefijo `tw-`**: clases puras (`flex`, `gap-4`). |
| TypeScript | strict | Tipos estrictos, sin `any`. |
| localStorage | nativo | Persistencia única (no SQLite, no IndexedDB todavía). |
| `fetch` | nativo | Sólo a `argentinadatos.com` para cotización USD oficial. |

No usamos: NgModule, RxJS más allá de lo imprescindible, Zod, librerías de UI propietarias, librerías de charts (charts son SVG inline).

---

## Arquitectura — Core / Shared / Pages

```
src/app/
├── app.component.{ts,html,scss}
├── app.config.ts
├── core/
│   ├── services/        ← Singletons inyectables (StorageService, TransactionsService, etc.)
│   ├── models/{entidad} ← Modelos de dominio (Transaction, CreditCard, Subscription...)
│   ├── constants/       ← STORAGE_KEYS, USD_RATE_API_BASE, defaults
│   ├── utils/           ← date.utils, currency.utils
│   └── tokens/          ← InjectionTokens si surgen
├── shared/
│   ├── components/      ← Reutilizables (confirm-host, info-tooltip, sidebar, etc.)
│   ├── pipes/           ← (vacío por ahora)
│   └── directives/      ← (vacío por ahora)
└── pages/
    ├── mes-page/
    ├── tarjetas-page/
    ├── suscripciones-page/
    ├── ahorros-page/
    ├── analisis-page/
    └── configuracion-page/
        ├── [page].component.{ts,html,scss}
        └── components/[hijo]/
```

### Reglas de la arquitectura

1. **Core** = código del dominio que vive una sola vez en toda la app. Servicios `providedIn: 'root'`, modelos, constantes, utilidades puras.
2. **Shared** = piezas de UI reutilizables entre páginas (no acopladas a una sección).
3. **Pages** = una carpeta por sección (`mes-page`, `tarjetas-page`...). Cada page tiene su `[page].component.*` que orquesta los hijos en `components/`. Los hijos de una page **no se reutilizan en otra page** (si pasa, mover a `shared/`).
4. **Standalone components**. Cada componente declara `standalone: true` explícito. No hay `NgModule` en el proyecto.
5. **Persistencia siempre vía `StorageService`**. Ningún consumidor toca `localStorage.*` directo.
6. **Sin barrels (`index.ts`)** hasta nuevo aviso — imports relativos directos.

---

## Convenciones de código

### Naming

- Clases de componentes con **sufijo `Component`**: `TransactionFormComponent`, no `TransactionForm`.
- Clases de servicios con **sufijo `Service`**: `TransactionsService`.
- Archivos: `transaction-form.component.{ts,html,scss}`, `transactions.service.ts`, `transaction.model.ts`.
- Identificadores en **inglés**: `addTransaction`, `monthlyExpenses`. La UI y los commits van en **español**.
- Variables booleanas con verbo: `isExpanded`, `hasArchived`, `shouldFetch`.

### Tailwind

```html
<!-- ✅ CORRECTO en este proyecto -->
<div class="flex items-center gap-4">

<!-- ❌ INCORRECTO (es el patrón de prevencion-pwa, no de este proyecto) -->
<div class="tw-flex tw-items-center tw-gap-4">
```

### Templates y estilos

- **Siempre archivos separados**: `templateUrl: './x.component.html'`, `styleUrls: ['./x.component.scss']`. No inline templates excepto el host trivial de un page (1-3 líneas).
- **`.scss` opcional**: si el componente no tiene CSS custom (sólo Tailwind), no agregar el archivo.
- **Control flow nuevo**: `@if`, `@for`, `@switch`. No usar `*ngIf`, `*ngFor`, `*ngSwitch`.

### Signals primero

- Estado del componente y del service: `signal<T>(initial)`.
- Derivados: `computed(() => ...)`.
- Side effects: `effect(() => ...)` con `untracked()` cuando hay que evitar re-trigger.
- Forms: `FormsModule` (`ngModel`) está bien para el tamaño actual. Si una vista crece, considerar Reactive Forms.

### Commits

- En **español**, **sin emojis ni iconos**.
- Formato conventional commits: `tipo(scope): descripción`.
- Tipos válidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.
- Ver skill `git-commits` para detalle completo.

---

## Persistencia en localStorage

Las claves usadas viven en `core/constants/storage-keys.ts`:

```typescript
STORAGE_KEYS = {
  transactions, templates, cards, purchases,
  subscriptions, rates, customCategories, savings,
}
```

**Regla de oro**: estas claves son un **contrato con los datos del usuario**. Nunca renombrarlas sin migración. Si necesitás cambiar el shape de los datos, escribí migración explícita (ver `migrateCategoryNamesToIds` en `TransactionsService` como ejemplo).

---

## 🤖 Instrucciones para el Agente

### Comportamiento general

1. **Antes de escribir código nuevo**, verifica si existe una skill relevante en este archivo.

2. **🚨 CHECKLIST OBLIGATORIO** (antes de implementar):
   - [ ] ¿Existe una skill para esta tarea? (revisar tabla de triggers más abajo)
   - [ ] ¿Cargué la skill correspondiente antes de actuar?
   - [ ] ¿Estoy siguiendo los patrones del proyecto?

3. **🚨 CHECKLIST DE CALIDAD** (antes de finalizar):
   - [ ] ¿El componente tiene sufijo `Component` y archivos `.ts/.html/.scss` separados?
   - [ ] ¿Está marcado como `standalone: true` explícito?
   - [ ] ¿Tailwind sin prefijo `tw-`?
   - [ ] ¿La persistencia pasa por `StorageService` (no `localStorage` directo)?
   - [ ] ¿Los commits son en español sin emojis?
   - [ ] ¿`npm run build` pasa verde?

### Cómo cargar una skill

```
read_file(".claude/skills/{categoria}/{nombre-skill}/SKILL.md")
```

Ejemplo:
```
read_file(".claude/skills/clean-code/clean-code-principles/SKILL.md")
```

---

## Skills disponibles

### Clean Code (`clean-code/`)

| Skill | Descripción |
|-------|-------------|
| `clean-code-principles` | Principios SOLID adaptados, naming, early returns, evitar sobreingeniería |

### TypeScript (`typescript/`)

| Skill | Descripción |
|-------|-------------|
| `typescript-best-practices` | No `any`, interfaces planas, strict types, enums |
| `typescript-utility-types` | Pick, Omit, Partial, Record, etc. |
| `typescript-path-aliases` | Configurar `@core`, `@shared`, `@pages` (si decidimos usarlos) |

### Git (`git-workflow/`)

| Skill | Descripción |
|-------|-------------|
| `git-commits` | Mensajes de commit en español, sin emojis, conventional commits |

### Planning (`planning/`)

| Skill | Descripción |
|-------|-------------|
| `plan-orchestrator` | Clasifica una tarea en 5 tipos (feat/bug/refactor/test/analisis) y delega |
| `plan-feature-creation` | Plan estructurado para features y módulos nuevos |
| `plan-bug-resolution` | Plan estructurado para resolución de bugs (T0..Tn) |

---

## 🎯 Triggers automáticos (Auto-invoke skills)

Cuando hagas estas acciones, **carga la skill correspondiente PRIMERO**:

| Contexto / Acción | Skill | Qué hacer |
|-------------------|-------|-----------|
| Hacer commit | `git-commits` | Formato español, sin emojis, conventional commits |
| Refactorizar código existente | `clean-code-principles` | Aplicar SOLID, naming, early returns |
| Escribir TypeScript | `typescript-best-practices` | No `any`, strict types |
| Usar utility types (Pick, Omit, Partial...) | `typescript-utility-types` | Revisar referencia |
| Configurar path aliases | `typescript-path-aliases` | Setup de `@core`, `@shared`, `@pages` |
| Crear plan de trabajo (general) | `plan-orchestrator` | Clasifica en 5 tipos y delega |
| Planificar feature nueva | `plan-feature-creation` | Plan estructurado en `plans/YYYY-MM/` |
| Planificar corrección de bug | `plan-bug-resolution` | Plan con tareas T0..Tn |
| Planificar refactor | `plan-orchestrator` | Usa `plans/templates/PLAN-REFACTOR.template.md` |
| Planificar testing | `plan-orchestrator` | Usa `plans/templates/PLAN-TEST.template.md` |
| Planificar análisis / investigación | `plan-orchestrator` | Usa `plans/templates/PLAN-ANALISIS.template.md` |

---

## Skills propias todavía no escritas (TODO)

Cuando aparezca repetidamente uno de estos patrones, escribir su skill:

- `signals-patterns` — convenciones de `signal`, `computed`, `effect`, `WritableSignal`.
- `localstorage-persistence` — patrón con `StorageService` y `effect` para auto-save.
- `usd-rate-conversion` — modos de conversión, IVA digital, cache.
- `category-migration` — patrón para migrar categorías string → ID con modal.
- `standalone-component-creation` — esqueleto de un componente standalone Angular 21.
- `page-creation` — crear una nueva sección dentro de `pages/`.

---

## Plans (`plans/`)

Los planes de trabajo se guardan en `plans/YYYY-MM/` con frontmatter YAML obligatorio. Cinco tipos: `feat`, `bug`, `refactor`, `test`, `analisis`. Ver `plans/README.md` para detalle.

Templates en `plans/templates/`:
- `PLAN-FEATURE.template.md`
- `PLAN-BUG.template.md`
- `PLAN-REFACTOR.template.md`
- `PLAN-TEST.template.md`
- `PLAN-ANALISIS.template.md`

---

## ⚙️ Configuración por herramienta

### Claude Code

| Ubicación | Archivo |
|-----------|---------|
| Instrucciones | `CLAUDE.md` (raíz, symlink o copia de `AGENTS.md`) |
| Skills | `.claude/skills/` |

### Cursor / GitHub Copilot / Otros

Apuntar a `AGENTS.md` como punto de entrada y leer las skills desde `.claude/skills/`.

---

## 📋 Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-07 | Refactor T0–T26: arquitectura Core/Shared/Pages, componentes con sufijo `Component`, templates separados, split del god service en 9 services, creación de `plans/` y de este `AGENTS.md` |
