````skill
---
name: plan-orchestrator
description: >
  Orquesta la creación de planes de trabajo según el tipo de tarea (feat, bug, refactor, test, analisis).
  Clasifica la solicitud, determina el nivel de detalle y delega al skill especializado.
  Trigger: Cuando el usuario pide crear un plan, usa /plan, o necesita determinar qué tipo de plan aplicar.
license: MIT
metadata:
  version: "2.0"
  author: "Control de Gastos"
  category: "planning"
  type: orchestrator
  project: "control-gastos"
---

# Plan Orchestrator

> "Un buen plan hoy es mejor que un plan perfecto mañana."

Este skill **no implementa planes directamente**, sino que **coordina**
los skills de planificación especializados según el contexto de la tarea.

---

## Cuándo Usar

Activa este skill cuando:
- El usuario pide "crear un plan" sin especificar tipo
- Se necesita determinar qué tipo de plan aplicar
- La tarea involucra múltiples tipos de plan (feature + refactor)
- El usuario usa el comando `/plan`

**Este skill actúa como punto de entrada** y delega a skills más específicos.

---

## Filosofía del Orquestador

Todo plan en Control de Gastos debe ser:

- **Implementable**: Código real, no pseudocódigo ni "TODO"
- **Auto-contenido**: Toda la información necesaria en un solo documento
- **Verificable**: Checklist con pasos que se pueden marcar como completados
- **Trazable**: Referencia a módulos existentes y skills del proyecto
- **Con metadata**: Todo plan incluye frontmatter YAML obligatorio con estado y tipo

---

## Skills Coordinados

### Catálogo de Skills

| Skill | Propósito | Trigger |
|-------|-----------|---------|
| `plan-feature-creation` | Planes de features y módulos nuevos | "nueva funcionalidad", "módulo nuevo", "agregar sección" |
| `plan-bug-resolution` | Planes de corrección de bugs | "corregir", "arreglar", "fix", "bug", "falla" |

### Tipos de plan sin skill propio

Los siguientes tipos usan el template de `plans/templates/` directamente, no tienen skill dedicado:

| Tipo | Template | Cuándo |
|------|----------|--------|
| `refactor` | `plans/templates/PLAN-REFACTOR.template.md` | "refactorizar", "reorganizar", "mejorar código" |
| `test` | `plans/templates/PLAN-TEST.template.md` | "mejorar cobertura", "crear tests", "plan de testing" |
| `analisis` | `plans/templates/PLAN-ANALISIS.template.md` | "investigar", "evaluar opciones", "spike", "análisis" |

### Matriz de Delegación

```
Tarea del Usuario                          → Acción
────────────────────────────────────────────────────────────────
Crear módulo nuevo / feature completa      → Delegar a plan-feature-creation
Agregar sección con tabla + filtros        → Delegar a plan-feature-creation
Crear nuevo servicio HTTP                  → Delegar a plan-feature-creation
Corregir bug / error en componente         → Delegar a plan-bug-resolution
Agregar campo a formulario existente       → Delegar a plan-bug-resolution
Refactorizar componente / modal / servicio → Usar template PLAN-REFACTOR
Migrar patrón viejo a nuevo               → Usar template PLAN-REFACTOR
Reorganizar layout / mejorar UI            → Usar template PLAN-REFACTOR
Mejorar cobertura de tests                 → Usar template PLAN-TEST
Crear Test Cases                           → Usar template PLAN-TEST
Investigar viabilidad de opción            → Usar template PLAN-ANALISIS
Evaluar alternativas técnicas              → Usar template PLAN-ANALISIS
Feature + corrección de bugs               → AMBOS (feature primero, luego bug)
```

---

## Lógica de Orquestación

### Flujo Principal

```
1. Recibir solicitud del usuario
   │
2. ¿El usuario especificó el tipo de plan?
   ├── SÍ → Ir directamente al skill/template correspondiente
   └── NO → Analizar la solicitud (ver Clasificación Rápida)
       │
3. Clasificar la tarea → determinar tipo (feat/bug/refactor/test/analisis)
   │
4. Determinar nivel de detalle (básico/detallado/exhaustivo)
   │
5. ¿Tiene skill propio? (feat o bug)
   ├── SÍ → Cargar skill delegado
   └── NO → Usar template de plans/templates/
   │
6. Generar el plan con frontmatter YAML obligatorio
   │
7. Guardar en plans/YYYY-MM/YYYY-MM-[tipo]-[descripcion].md
   │
8. Validar el plan generado
```

### Árbol de Delegación

```
¿Qué tipo de tarea es?
│
├── FEATURE NUEVA (código que NO existe)
│   ├── Módulo/sección nueva → plan-feature-creation
│   ├── Componente completamente nuevo → plan-feature-creation
│   └── Servicio HTTP nuevo → plan-feature-creation
│
├── BUG (algo funciona MAL)
│   ├── Corrección de error → plan-bug-resolution
│   ├── Algo falla / no funciona → plan-bug-resolution
│   └── Comportamiento inesperado → plan-bug-resolution
│
├── REFACTOR (mejorar código EXISTENTE que funciona)
│   ├── Refactorización de componente → template PLAN-REFACTOR
│   ├── Mejora de layout → template PLAN-REFACTOR
│   ├── Migración de patrón → template PLAN-REFACTOR
│   └── Reorganización de estructura → template PLAN-REFACTOR
│
├── TEST (mejorar cobertura o crear TCs)
│   ├── Plan de testing de módulo → template PLAN-TEST
│   ├── Crear mock factories → template PLAN-TEST
│   └── Test Cases en Azure DevOps → template PLAN-TEST
│
├── ANALISIS (investigar o evaluar)
│   ├── Spike técnico → template PLAN-ANALISIS
│   ├── Evaluación de opciones → template PLAN-ANALISIS
│   └── Investigación de viabilidad → template PLAN-ANALISIS
│
├── MIXTO (Feature + Bug/Refactor)
│   ├── Crear plan de feature PRIMERO
│   └── Luego plan de bug/refactor para ajustes
│
└── NO ESTÁ CLARO
    └── Preguntar al usuario con opciones concretas
```

---

## Clasificación Rápida

### Señales de Feature (`feat`)

- "nuevo módulo", "nueva sección", "agregar pantalla"
- "crear componente", "implementar funcionalidad"
- "tabla con filtros", "nueva tabla"
- "datos mockeados", "sin API aún"
- "agregar pestaña", "nueva vista"

### Señales de Bug (`bug`)

- "corregir", "arreglar", "fix", "bug"
- "no funciona", "falla", "error"
- "el grid no muestra", "la paginación falla"
- "comportamiento inesperado"

### Señales de Refactor (`refactor`)

- "refactorizar", "reorganizar", "mejorar"
- "ajustar layout", "cambiar disposición"
- "migrar de X a Y", "reemplazar patrón"
- "actualizar lógica", "limpiar código"
- "extraer a servicio", "separar componentes"

### Señales de Test (`test`)

- "mejorar cobertura", "crear tests"
- "mock factory", "plan de testing"
- "test cases", "TCs"
- "estrategia de testing"

### Señales de Análisis (`analisis`)

- "investigar", "evaluar", "spike"
- "¿conviene X o Y?", "análisis técnico"
- "viabilidad", "comparar opciones"
- "explorar alternativas"

---

## Ubicación de Planes

### Regla única para TODOS los tipos

```
plans/YYYY-MM/YYYY-MM-[tipo]-[descripcion-kebab].md
```

### Ejemplos

| Tipo | Archivo |
|------|---------|
| Feature | `plans/2026-03/2026-03-feat-nueva-constancia-offline.md` |
| Bug | `plans/2026-03/2026-03-bug-sync-pendiente-falla.md` |
| Refactor | `plans/2026-03/2026-03-refactor-migracion-campos-variables.md` |
| Test | `plans/2026-03/2026-03-test-cobertura-carga-constancia.md` |
| Análisis | `plans/2026-03/2026-03-analisis-performance-sqlite.md` |

### Frontmatter YAML obligatorio

Todo plan DEBE iniciar con este bloque:

```yaml
---
plan: YYYY-MM-[tipo]-[descripcion]
tipo: feat | bug | refactor | test | analisis
estado: backlog | en-curso | completado | descartado | bloqueado
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: []
---
```

---

## Niveles de Detalle

| Nivel | Cuándo usar | Archivos afectados | Secciones |
|-------|-------------|:------------------:|-----------|
| **Básico** | Tarea pequeña | 1-3 | Objetivo + Archivos + Tareas |
| **Detallado** | Funcionalidad mediana | 4-10 | Todas las secciones del template |
| **Exhaustivo** | Módulo completo | >10 | Template completo + diagramas + riesgos |

### Heurística de Nivel

```
¿Cuántos archivos se crean/modifican?
├── 1-3 archivos → Nivel BÁSICO
├── 4-10 archivos → Nivel DETALLADO
└── >10 archivos → Nivel EXHAUSTIVO
```

---

## Quick Wins (Acciones Inmediatas)

### No Necesita Plan (Hacer Directamente)

- Cambio de 1 línea (fix de typo, ajuste de clase CSS)
- Agregar un `@Input` o `@Output` a un componente existente
- Corregir un import incorrecto
- Ajustar un valor hardcodeado

### Necesita Plan Básico

- Agregar un campo a un formulario existente
- Cambiar la configuración de columnas de un grid
- Modificar la lógica de un servicio existente

### Necesita Plan Completo

- Cualquier tarea que involucre >3 archivos
- Crear componentes o servicios nuevos
- Cambios que afectan múltiples variantes/casos

---

## Ejemplo de Orquestación

### Escenario 1: Feature

**Usuario**: "Necesito planificar un módulo de descarga masiva con tabla, filtros y paginación"

**Orquestador**:
1. **Clasificación**: Feature nueva → tipo `feat`
2. **Nivel**: Exhaustivo (>10 archivos)
3. **Skill delegado**: `plan-feature-creation`
4. **Acción**: `read_file(".github/skills/planning/plan-feature-creation/SKILL.md")`
5. **Ubicación**: `plans/2026-03/2026-03-feat-descarga-masiva.md`
6. **Resultado**: Plan con frontmatter + 13 secciones, código real, checklist de 8 fases

### Escenario 2: Bug

**Usuario**: "La sincronización de constancias falla cuando no hay conexión y vuelve"

**Orquestador**:
1. **Clasificación**: Bug → tipo `bug`
2. **Nivel**: Detallado (4-6 archivos)
3. **Skill delegado**: `plan-bug-resolution`
4. **Acción**: `read_file(".github/skills/planning/plan-bug-resolution/SKILL.md")`
5. **Ubicación**: `plans/2026-03/2026-03-bug-sync-reconexion.md`
6. **Resultado**: Plan con frontmatter + archivos involucrados + estado actual vs deseado + tareas T0, T1...

### Escenario 3: Refactor (sin skill propio)

**Usuario**: "Quiero migrar los campos variables de establecimiento al nuevo patrón"

**Orquestador**:
1. **Clasificación**: Refactor → tipo `refactor`
2. **Nivel**: Detallado (4-8 archivos)
3. **Template**: `plans/templates/PLAN-REFACTOR.template.md`
4. **Ubicación**: `plans/2026-03/2026-03-refactor-campos-variables-establecimiento.md`
5. **Resultado**: Plan con frontmatter + motivación + estado actual vs deseado + tareas T0, T1...

### Escenario 4: Test

**Usuario**: "Necesito mejorar la cobertura de tests del módulo carga-constancia"

**Orquestador**:
1. **Clasificación**: Test → tipo `test`
2. **Template**: `plans/templates/PLAN-TEST.template.md`
3. **Ubicación**: `plans/2026-03/2026-03-test-cobertura-carga-constancia.md`
4. **Resultado**: Plan con frontmatter + alcance + mock factories + fases de implementación

### Escenario 5: Mixto

**Usuario**: "Quiero agregar una sección de notas offline Y corregir la sincronización"

**Orquestador**:
1. **Clasificación**: Mixto (feat + bug)
2. **Acción**: Crear 2 planes separados
3. **Plan 1**: `plans/2026-03/2026-03-feat-notas-offline.md` (feature primero)
4. **Plan 2**: `plans/2026-03/2026-03-bug-sincronizacion.md` (bug después)

---

## Comportamiento del Agente

### Mentalidad

**HACER:**
- Clasificar rápidamente y delegar al skill/template correcto
- Sugerir el nivel de detalle apropiado
- Incluir siempre frontmatter YAML en el plan generado
- Validar el plan generado antes de entregarlo
- Proponer omitir plan para cambios triviales
- Guardar en `plans/YYYY-MM/` con la convención de nombre correcta

**NO HACER:**
- Generar un plan sin cargar el skill específico (si tiene skill propio)
- Mezclar formato de feature con formato de bugfix
- Crear planes excesivos para cambios simples
- Saltar la clasificación y asumir el tipo
- Guardar planes en `doc/` o en cualquier lugar fuera de `plans/`
- Generar un plan sin frontmatter YAML

### Protocolo de Orquestación

1. **Clasificar** la solicitud → tipo (`feat`/`bug`/`refactor`/`test`/`analisis`)
2. **Determinar** nivel de detalle (básico / detallado / exhaustivo)
3. **Cargar** el skill delegado (si existe) o el template de `plans/templates/`
4. **Generar** el plan con frontmatter YAML obligatorio
5. **Guardar** en `plans/YYYY-MM/YYYY-MM-[tipo]-[desc].md`
6. **Validar** el plan generado

### Formato de Reporte

```markdown
✅ **Plan creado**: `plans/YYYY-MM/YYYY-MM-[tipo]-[desc].md`

📋 **Resumen**:
- **Tipo**: [feat/bug/refactor/test/analisis]
- **Nivel**: [básico/detallado/exhaustivo]
- **Skill/Template**: [skill o template usado]
- **Archivos afectados**: [N]
```

---

## Interacción con Otros Skills

Cuando cargues un skill delegado:

1. **Leer el skill completo**: `read_file(".github/skills/planning/plan-[tipo]/SKILL.md")`
2. **Seguir sus instrucciones**: El skill delegado toma control temporal
3. **Volver al orquestador**: Para validar ubicación y frontmatter
4. **No mezclar reglas**: Cada skill tiene su dominio

---

## Referencia

- **Convenciones de planes**: `plans/README.md`
- **Templates**: `plans/templates/`
- **Plan de feature**: `.github/skills/planning/plan-feature-creation/SKILL.md`
- **Plan de bug**: `.github/skills/planning/plan-bug-resolution/SKILL.md`
- **Metodología general**: `.github/sesion-planificacion/README.md`
````
