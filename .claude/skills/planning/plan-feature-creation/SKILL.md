````skill
---
name: plan-feature-creation
description: >
  Genera planes de implementación para features y módulos nuevos en control-gastos.
  Produce documentos con código real, checklist de fases y referencias a skills del proyecto.
  Trigger: "nueva funcionalidad", "módulo nuevo", "agregar sección", "nueva pantalla".
license: MIT
metadata:
  version: "2.0"
  author: "Control de Gastos"
  category: "planning"
  project: "control-gastos"
---

# Plan Feature Creation

> Crea planes de implementación detallados para features y módulos nuevos.

Este skill es delegado por `plan-orchestrator` cuando la tarea es de tipo **feat**.

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

- Se necesita crear un módulo o sección nueva
- Se planifica una funcionalidad con múltiples componentes
- Se necesita documentar la estructura de archivos antes de codear
- El usuario pide "crear un plan para X" donde X es una feature

### NO usar este skill cuando:

- Es una corrección de bug → usar `plan-bug-resolution`
- Es un refactoring de código existente → usar template `PLAN-REFACTOR`
- Es solo agregar un campo a un formulario → no necesita plan completo
- El cambio afecta <3 archivos → hacer directamente

---

## Convenciones

### Carpeta del plan

```
plans/YYYY-MM/YYYY-MM-feat-[descripcion-kebab].md
```

### Frontmatter YAML obligatorio

```yaml
---
plan: YYYY-MM-feat-[descripcion]
tipo: feat
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: [nueva-funcionalidad, offline, etc]
---
```

### Naming

- Archivos de plan: `YYYY-MM-feat-[descripcion-kebab].md`
- Secciones numeradas: `## 1. Resumen`, `## 2. Estructura`
- Tareas en checklist: `- [ ] Fase N: Descripción`

---

## Patrones Específicos

### Patrón 1: Resumen Ejecutivo

Todo plan de feature DEBE iniciar con un resumen que responda las 5 preguntas:

```markdown
## 1. Resumen

**¿Qué?** Crear [funcionalidad] en [módulo]
**¿Por qué?** [motivación / User Story]
**¿Dónde?** `src/app/pages/[modulo]/[feature]/`
**¿Cómo?** [enfoque técnico en 1-2 líneas]
**¿Cuánto?** [N] archivos nuevos, [M] modificados
```

### Patrón 2: Estructura de Archivos

Mapeo explícito de CADA archivo con su propósito:

```markdown
## 2. Estructura de Archivos

### Archivos Nuevos

| # | Archivo | Tipo | Propósito |
|---|---------|------|-----------|
| 1 | `feature.component.ts` | Componente | Componente principal |
| 2 | `feature.component.html` | Template | Vista con formulario |
| 3 | `feature.component.scss` | Estilos | Estilos (vacío, usa Tailwind) |
| 4 | `feature.module.ts` | Módulo | Declaraciones e imports |
| 5 | `models/feature.model.ts` | Modelo | Clase con fromJson |
| 6 | `schemas/feature.schema.ts` | Schema | Validación Zod |
| 7 | `services/feature.service.ts` | Servicio | Llamadas HTTP |

### Archivos Modificados

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `padre-routing.module.ts` | Agregar ruta lazy loaded |
| 2 | `padre.module.ts` | N/A si es lazy |
```

### Patrón 3: Integración con Componente Padre

Cuando la feature se integra dentro de un componente existente:

```markdown
## 3. Integración con Padre

### Componente Padre: `[nombre].component.ts`

**Ubicación**: `src/app/pages/[modulo]/[padre].component.ts`

Código a agregar en el padre:
- Tab/ruta/sección que apunte al nuevo componente
- Imports necesarios
```

### Patrón 4: Modelo de Datos

Incluir la definición completa del modelo con código real:

```markdown
## 4. Modelo de Datos

### Schema Zod

```typescript
// src/app/pages/[modulo]/models/schemas/feature.schema.ts
import { z } from 'zod';

export const FeatureSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  // ... campos reales
});
```

### Clase Modelo

```typescript
// src/app/pages/[modulo]/models/feature.model.ts
import { FeatureSchema } from './schemas/feature.schema';

export class Feature {
  // propiedades
  
  static fromJson(json: unknown): Feature {
    const parsed = FeatureSchema.parse(json);
    // ...
  }
}
```
```

### Patrón 5: Componentes y Templates

HTML real con componentes ASO del proyecto:

```markdown
## 5. Componentes

### Template Principal
```html
<!-- Código HTML real con aso-grid, aso-button, etc. -->
<div class="tw-flex tw-flex-col tw-gap-4">
  <!-- ejemplo concreto -->
</div>
```
```

### Patrón 6: Checklist de Fases

División del trabajo en fases ordenadas:

```markdown
## Checklist de Implementación

- [ ] **Fase 1**: Crear estructura de archivos (módulo, routing, componente vacío)
- [ ] **Fase 2**: Implementar modelo y schema Zod
- [ ] **Fase 3**: Crear servicio HTTP
- [ ] **Fase 4**: Implementar componente con formulario/tabla
- [ ] **Fase 5**: Integrar con componente padre
- [ ] **Fase 6**: Agregar loader/toast/error handling
- [ ] **Fase 7**: Crear tests
- [ ] **Fase 8**: Verificar integración completa
```

### Patrón 7: Skills y Diagrama

Referenciar skills relevantes y un diagrama ASCII de flujo:

```markdown
## Skills Relevantes

| Skill | Uso en este plan |
|-------|-----------------|
| `module-creation` | Fase 1: Crear estructura |
| `model-creation` | Fase 2: Modelo con fromJson |
| `schema-creation` | Fase 2: Schema Zod |
| `http-service` | Fase 3: Servicio HTTP |
| `aso-grid-tables` | Fase 4: Tabla de datos |
| `testing-component-setup` | Fase 7: Tests ATL |

## Diagrama de Flujo

```
[Padre] → [Feature Module] → [Feature Component]
                                    │
                              ┌─────┼─────┐
                              │     │     │
                          [Modelo] [Schema] [Service]
```
```

---

## Referencias Locales

| Recurso | Ubicación |
|---------|-----------|
| Templates de plan | `plans/templates/PLAN-FEATURE.template.md` |
| Convenciones de planes | `plans/README.md` |
| Estructura de páginas | `src/app/pages/` |
| Modelos core | `src/app/core/models/` |
| Servicios HTTP | `src/app/core/services/` |

---

## Comandos Útiles

```bash
# Ver planes de features existentes
grep -rl "tipo: feat" plans/

# Buscar planes de un módulo específico
grep -rl "modulo: carga-constancia" plans/

# Listar plains del mes actual
ls plans/$(date +%Y-%m)/
```

---

## Integración con Otros Skills

| Fase del Plan | Skill a Cargar |
|---------------|----------------|
| Crear módulo | `module-creation` |
| Definir modelo | `model-creation`, `schema-creation` |
| Servicio HTTP | `http-service` |
| Formularios | `formgroup-initialization`, `form-html-templates` |
| Tablas | `aso-grid-tables`, `aso-pagination` |
| Modales | `aso-modal-service` |
| Testing | `testing-component-setup` |

---

## Árbol de Decisiones

### ¿Cuántas secciones incluir?

```
¿Solo 1-2 archivos nuevos + 1 modificado?
├── SÍ → Resumen + Archivos + Checklist (básico)
└── NO
    │
    ¿Tiene modelo de datos nuevo?
    ├── SÍ → Agregar sección Modelo de Datos
    └── NO → Omitir
    │
    ¿Se integra en componente padre?
    ├── SÍ → Agregar sección Integración con Padre
    └── NO → Omitir
    │
    ¿Tiene tabla/formulario/modal?
    ├── SÍ → Agregar sección Componentes con HTML real
    └── NO → Omitir
    │
    ¿Necesita servicio HTTP nuevo?
    ├── SÍ → Agregar sección Servicio HTTP
    └── NO → Omitir
```

### ¿Incluir diagrama?

```
¿Más de 5 archivos involucrados?
├── SÍ → Incluir diagrama ASCII
└── NO → Omitir (el plan es suficientemente simple)
```

---

## Ejemplos

### ❌ Incorrecto

```markdown
## Plan: Nueva pantalla

Crear una pantalla nueva con una tabla.

### Pasos:
1. Crear componente
2. Agregar ruta
3. Implementar tabla
```

**Problemas**: Sin frontmatter, sin código real, sin archivos específicos, sin fases.

### ✅ Correcto

```yaml
---
plan: 2026-03-feat-bandeja-descargas-offline
tipo: feat
estado: backlog
prioridad: alta
fecha-creacion: 2026-03-15
fecha-inicio: —
fecha-fin: —
modulo: descargas-page
tags: [tabla, filtros, offline]
---
```

```markdown
# Plan: Bandeja de Descargas Offline

## 1. Resumen

**¿Qué?** Crear bandeja de descargas offline en módulo descargas
**¿Por qué?** US#1234 - Permitir ver descargas sin conexión
**¿Dónde?** `src/app/pages/descargas-page/`
**¿Cómo?** Componente con aso-grid + servicio de BD local
**¿Cuánto?** 8 archivos nuevos, 2 modificados

## 2. Estructura de Archivos

| # | Archivo | Tipo | Propósito |
|---|---------|------|-----------|
| 1 | `bandeja-descargas.component.ts` | Componente | Vista principal |
| ... | ... | ... | ... |

## Checklist de Implementación

- [ ] **Fase 1**: Crear estructura (módulo, routing, componente vacío)
- [ ] **Fase 2**: Modelo DescargaOffline + schema Zod
- [ ] **Fase 3**: Repositorio SQLite
- [ ] **Fase 4**: Componente con aso-grid
- [ ] **Fase 5**: Integrar en módulo padre
- [ ] **Fase 6**: Loader + error handling
- [ ] **Fase 7**: Tests
- [ ] **Fase 8**: Verificación final
```

---

## Comportamiento del Agente

### SIEMPRE

1. Incluir frontmatter YAML con `tipo: feat` y todos los campos obligatorios
2. Mapear CADA archivo nuevo/modificado con su propósito
3. Incluir código TypeScript/HTML REAL (no pseudocódigo)
4. Referenciar skills del proyecto para cada fase
5. Dividir en fases con checklist
6. Referenciar componentes ASO reales (aso-grid, aso-button, etc.)
7. Incluir sección de Resumen con las 5 preguntas
8. Usar rutas reales del proyecto (no inventar rutas)
9. Agregar diagrama ASCII si >5 archivos
10. Guardar en `plans/YYYY-MM/` con convención de nombre

### NUNCA

1. Crear un plan sin frontmatter YAML
2. Usar pseudocódigo en las secciones de código
3. Omitir el mapeo de archivos
4. Crear planes de bug en formato de feature
5. Incluir rutas de archivos que no existen en el proyecto
6. Guardar el plan fuera de `plans/`
7. Crear un plan para cambios de <3 archivos

### Checklist de Calidad

Antes de entregar el plan, verificar:

- [ ] ¿Tiene frontmatter YAML completo con `tipo: feat`?
- [ ] ¿El resumen responde las 5 preguntas?
- [ ] ¿Cada archivo tiene su propósito definido?
- [ ] ¿El código es TypeScript/HTML real del proyecto?
- [ ] ¿Las fases están numeradas con checklist?
- [ ] ¿Se referencian skills del proyecto?
- [ ] ¿Las rutas de archivos son reales?
- [ ] ¿El nombre del archivo sigue la convención `YYYY-MM-feat-[desc].md`?
- [ ] ¿Está guardado en `plans/YYYY-MM/`?

---

## Recursos

- **Template completo**: `plans/templates/PLAN-FEATURE.template.md`
- **Convenciones de planes**: `plans/README.md`
- **Orquestador**: `.github/skills/planning/plan-orchestrator/SKILL.md`
- **Plan de bugs**: `.github/skills/planning/plan-bug-resolution/SKILL.md`
````
