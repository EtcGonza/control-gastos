````skill
---
name: plan-bug-resolution
description: >
  Genera planes de resolución de bugs con diagnóstico de archivos involucrados,
  estado actual vs deseado, y tareas numeradas T0-Tn para corrección sistemática.
  Trigger: "corregir", "arreglar", "fix", "bug", "falla", "no funciona".
license: MIT
metadata:
  version: "2.0"
  author: "Control de Gastos"
  category: "planning"
  project: "control-gastos"
---

# Plan Bug Resolution

> Planes de resolución de bugs: diagnóstico preciso, estado actual vs deseado, tareas numeradas.

Este skill es delegado por `plan-orchestrator` cuando la tarea es de tipo **bug**.

---

## Context del Proyecto

| Aspecto | Valor |
|---------|-------|
| **Framework** | Angular 17.3.12 |
| **Estilos** | Tailwind CSS con prefijo `tw-` |
| **Validación** | Zod con ZodHelper |
| **Testing** | Angular Testing Library |
| **UI Library** | `@asociart/portal.fe.lib.ui-core-components` |
| **Módulos** | `src/app/pages/` |

---

## Cuándo Usar

### Activar este skill cuando:

- Algo funciona mal o diferente a lo esperado
- Se reporta un error o fallo
- Se necesita corregir un comportamiento incorrecto
- El usuario pide "arreglar", "corregir", "fix"
- Se agrega/modifica un campo en un formulario existente

### NO usar este skill cuando:

- Se crea funcionalidad completamente nueva → usar `plan-feature-creation`
- Se mejora código que funciona correctamente → usar template `PLAN-REFACTOR`
- Se mejora cobertura de tests → usar template `PLAN-TEST`
- El cambio es de 1 línea (typo, clase CSS) → hacer directamente, no necesita plan
- Incluir refactorizaciones en un plan de bug (usar tipo `refactor`)

---

## Convenciones

### Carpeta del plan

```
plans/YYYY-MM/YYYY-MM-bug-[descripcion-kebab].md
```

### Frontmatter YAML obligatorio

```yaml
---
plan: YYYY-MM-bug-[descripcion]
tipo: bug
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: [bug, formulario, sync, etc]
---
```

### Naming

- Archivos de plan: `YYYY-MM-bug-[descripcion-kebab].md`
- Tareas numeradas: T0 (análisis), T1, T2... Tn
- Secciones con títulos descriptivos, no solo números

---

## Patrones Específicos

### Patrón 1: Archivos Involucrados

Mapa completo de archivos afectados con su rol:

```markdown
## Archivos Involucrados

| # | Archivo | Tipo | Rol en el Bug |
|---|---------|------|---------------|
| 1 | `feature.component.ts` | Componente | Emite evento incorrecto |
| 2 | `feature.service.ts` | Servicio | No maneja error de API |
| 3 | `feature.model.ts` | Modelo | Campo faltante en fromJson |
| 4 | `feature.component.html` | Template | Binding incorrecto |
```

### Patrón 2: Estado Actual vs Deseado

**Siempre** incluir una comparación clara:

```markdown
## Estado Actual vs Deseado

### Estado Actual (❌)

```typescript
// feature.component.ts — línea ~45
onSave(): void {
  this.service.save(this.form.value); // No valida antes de enviar
}
```

**Problema**: No se ejecuta validación Zod antes de enviar.

### Estado Deseado (✅)

```typescript
// feature.component.ts — línea ~45
onSave(): void {
  const validation = ZodHelper.validate(FeatureSchema, this.form.value);
  if (!validation.success) {
    this.toastService.showError('Datos inválidos');
    return;
  }
  this.service.save(validation.data);
}
```

**Cambio**: Agregar validación Zod + manejo de error.
```

### Patrón 3: Matriz Resumen

Tabla compacta de todos los cambios:

```markdown
## Matriz de Cambios

| # | Archivo | Línea(s) | Cambio | Impacto |
|---|---------|----------|--------|---------|
| 1 | `component.ts` | ~45 | Agregar validación pre-save | Crítico |
| 2 | `service.ts` | ~30 | Manejar error 400 | Medio |
| 3 | `model.ts` | ~15 | Agregar campo `estado` | Bajo |
```

### Patrón 4: Tareas Numeradas T0-Tn

División del trabajo en tareas ordenadas con código real:

```markdown
## Tareas

### T0: Análisis y diagnóstico

- [ ] Confirmar el bug en entorno local
- [ ] Identificar archivos afectados
- [ ] Verificar si hay tests existentes que fallen

### T1: [Descripción del primer cambio]

**Archivo**: `src/app/pages/[modulo]/feature.component.ts`
**Línea(s)**: ~45

```typescript
// ANTES
onSave(): void {
  this.service.save(this.form.value);
}

// DESPUÉS
onSave(): void {
  const validation = ZodHelper.validate(FeatureSchema, this.form.value);
  if (!validation.success) {
    this.toastService.showError('Datos inválidos');
    return;
  }
  this.service.save(validation.data);
}
```

- [ ] Implementar cambio en `feature.component.ts`
- [ ] Verificar que el componente compila

### T2: [Descripción del segundo cambio]

...

### Tn: Tests y verificación

- [ ] Ejecutar tests existentes → deben pasar
- [ ] Agregar test para el caso corregido
- [ ] Verificar manualmente el flujo completo
```

### Patrón 5: Check de Compatibilidad

Verificar que el fix no rompe nada:

```markdown
## Compatibilidad

### Afecta a otros componentes/módulos?

| Módulo/Componente | ¿Afectado? | Motivo |
|-------------------|:----------:|--------|
| `carga-constancia` | ✅ | Comparte el mismo servicio |
| `bandeja-visitas` | ❌ | Usa servicio independiente |
| `detalle-obra-preventor` | ❌ | No relacionado |

### Tests existentes que podrían fallar

| Test | Archivo | Riesgo |
|------|---------|--------|
| `should save form` | `feature.component.spec.ts` | ⚠️ Alto - cambia lógica de save |
| `should load data` | `feature.component.spec.ts` | ✅ Ninguno |
```

### Patrón 6: Diagrama Visual (para bugs complejos)

```markdown
## Flujo del Bug

```
Usuario hace click en "Guardar"
        │
        ▼
[Component.onSave()]
        │
        ├── ACTUAL: envía sin validar ──→ API retorna 400 ──→ Error no manejado
        │
        └── DESEADO: valida con Zod
                │
                ├── Inválido → Toast de error → FIN
                │
                └── Válido → Envía a API
                        │
                        ├── OK → Toast success → FIN
                        └── Error → Maneja con catchError → Toast error
```
```

### Patrón 7: Tareas Tachadas (para seguimiento)

Cuando el plan se está ejecutando, tachar tareas completadas:

```markdown
### ~~T1: Agregar validación pre-save~~ ✅

(completada 2026-03-15)

### T2: Manejar error de API (EN CURSO)

...
```

---

## Referencias Locales

| Recurso | Ubicación |
|---------|-----------|
| Templates de plan | `plans/templates/PLAN-BUG.template.md` |
| Convenciones de planes | `plans/README.md` |
| Estructura de páginas | `src/app/pages/` |
| Modelos core | `src/app/core/models/` |
| Servicios HTTP | `src/app/core/services/` |

---

## Comandos Útiles

```bash
# Ver planes de bugs existentes
grep -rl "tipo: bug" plans/

# Buscar planes de un módulo
grep -rl "modulo: carga-constancia" plans/

# Ver planes en curso
grep -rl "estado: en-curso" plans/
```

---

## Integración con Otros Skills

| Contexto del Bug | Skill a Consultar |
|-------------------|-------------------|
| Bug en formulario | `formgroup-initialization`, `form-error-handling` |
| Bug en tabla/grid | `aso-grid-tables`, `aso-pagination` |
| Bug en modal | `aso-modal-service`, `modal-comunicacion-patterns` |
| Bug en servicio HTTP | `http-service`, `http-error-handling` |
| Bug en modelo/schema | `model-creation`, `zod-validation` |
| Bug en navegación | `angular-navigation`, `angular-route-guards` |
| Agregar tests al fix | `testing-component-setup`, `testing-form-helper` |

---

## Árbol de Decisiones

### ¿Qué nivel de detalle?

```
¿Cuántos archivos están involucrados?
├── 1-2 archivos → Plan BÁSICO
│   └── Archivos + Estado actual/deseado + 2-3 tareas
│
├── 3-6 archivos → Plan DETALLADO
│   └── Todo lo básico + Matriz resumen + Compatibilidad
│
└── >6 archivos → Plan EXHAUSTIVO
    └── Todo lo detallado + Diagrama visual + Tests detallados
```

### ¿Incluir check de compatibilidad?

```
¿El archivo modificado es un servicio compartido?
├── SÍ → SIEMPRE incluir check de compatibilidad
└── NO
    │
    ¿El archivo es usado por más de un componente?
    ├── SÍ → Incluir check de compatibilidad
    └── NO → Omitir (impacto localizado)
```

### ¿Es realmente un bug o un refactor?

```
¿El código actual funciona pero es "feo" o "ineficiente"?
├── SÍ → Es REFACTOR, no bug → usar template PLAN-REFACTOR
└── NO
    │
    ¿El código produce un resultado incorrecto?
    ├── SÍ → Es BUG → usar este skill
    └── NO → Clarificar con el usuario
```

---

## Proceso de Creación

### Paso 1: Diagnóstico

1. Leer el código actual del componente/servicio afectado
2. Identificar TODOS los archivos involucrados
3. Reproducir mentalmente el flujo del bug

### Paso 2: Documentar Estado Actual

1. Copiar el código relevante con líneas aproximadas
2. Explicar qué hace actualmente (comportamiento erróneo)
3. Identificar la causa raíz

### Paso 3: Definir Estado Deseado

1. Escribir el código corregido (TypeScript real)
2. Explicar qué debería hacer
3. Verificar que sigue los patrones del proyecto

### Paso 4: Crear Tareas

1. T0 siempre es análisis/diagnóstico
2. T1...Tn son los cambios en orden lógico
3. Última tarea siempre es tests y verificación

### Paso 5: Validar

1. ¿Todos los archivos están mapeados?
2. ¿El código es real y compila?
3. ¿Las tareas son ejecutables?

---

## Ejemplos

### ❌ Incorrecto

```markdown
## Bug: La sync no funciona

Hay un error en la sincronización. 
Revisar el servicio y corregir.

### Pasos:
1. Debuggear
2. Corregir
3. Testear
```

**Problemas**: Sin frontmatter, sin archivos específicos, sin código real, sin estado actual/deseado.

### ✅ Correcto

```yaml
---
plan: 2026-03-bug-sync-reconexion-falla
tipo: bug
estado: backlog
prioridad: alta
fecha-creacion: 2026-03-15
fecha-inicio: —
fecha-fin: —
modulo: carga-constancia-page
tags: [bug, sync, offline, reconexión]
---
```

```markdown
# Bug: Sync falla al reconectar después de modo offline

## Archivos Involucrados

| # | Archivo | Tipo | Rol en el Bug |
|---|---------|------|---------------|
| 1 | `sync.service.ts` | Servicio | No reintenta tras reconexión |
| 2 | `constancia.repository.ts` | Repositorio | Query devuelve registros ya sincronizados |

## Estado Actual vs Deseado

### Estado Actual (❌)
```typescript
// sync.service.ts — línea ~78
syncPendientes(): Observable<void> {
  return this.repository.getPendientes().pipe(
    switchMap(items => this.api.syncBatch(items))
  );
}
```
**Problema**: No filtra items ya sincronizados, causa duplicados.

### Estado Deseado (✅)
```typescript
// sync.service.ts — línea ~78
syncPendientes(): Observable<void> {
  return this.repository.getPendientes().pipe(
    map(items => items.filter(i => !i.sincronizado)),
    switchMap(items => items.length > 0 
      ? this.api.syncBatch(items)
      : of(void 0)
    )
  );
}
```

## Tareas

### T0: Análisis
- [ ] Confirmar duplicados en tabla de sync

### T1: Filtrar items ya sincronizados
**Archivo**: `src/app/pages/carga-constancia-page/services/sync.service.ts`
- [ ] Agregar filtro pre-envío

### T2: Tests
- [ ] Crear test para sync con items mixtos
```

---

## Comportamiento del Agente

### SIEMPRE

1. Incluir frontmatter YAML con `tipo: bug` y todos los campos obligatorios
2. Listar TODOS los archivos involucrados con su rol
3. Incluir código REAL del estado actual (copiado del proyecto)
4. Escribir código REAL del estado deseado (que compile)
5. Numerar tareas como T0, T1, T2... Tn
6. T0 siempre es análisis/diagnóstico
7. Última tarea siempre incluye tests
8. Incluir referencia a líneas aproximadas del código
9. Guardar en `plans/YYYY-MM/` con formato `YYYY-MM-bug-[desc].md`
10. Verificar compatibilidad si afecta servicios compartidos

### NUNCA

1. Crear un plan de bug sin estado actual vs deseado
2. Usar pseudocódigo en vez de TypeScript real
3. Omitir el diagnóstico (T0)
4. Omitir la tarea de tests (Tn)
5. Incluir refactorizaciones en un plan de bug (usar tipo `refactor`)
6. Crear un plan de bug para funcionalidad nueva (usar tipo `feat`)
7. Guardar el plan fuera de `plans/`

### Checklist de Calidad

Antes de entregar el plan, verificar:

- [ ] ¿Tiene frontmatter YAML completo con `tipo: bug`?
- [ ] ¿Todos los archivos involucrados están listados?
- [ ] ¿Se incluyó estado actual con código real?
- [ ] ¿Se incluyó estado deseado con código que compila?
- [ ] ¿Las tareas están numeradas T0-Tn?
- [ ] ¿T0 es diagnóstico y Tn incluye tests?
- [ ] ¿Se verificó compatibilidad si aplica?
- [ ] ¿El nombre sigue la convención `YYYY-MM-bug-[desc].md`?
- [ ] ¿Está guardado en `plans/YYYY-MM/`?

---

## Recursos

- **Template completo**: `plans/templates/PLAN-BUG.template.md`
- **Convenciones de planes**: `plans/README.md`
- **Orquestador**: `.github/skills/planning/plan-orchestrator/SKILL.md`
- **Plan de features**: `.github/skills/planning/plan-feature-creation/SKILL.md`
````
