---
plan: YYYY-MM-refactor-[descripcion]
tipo: refactor
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: []
---

# Plan de Refactorización — [Descripción]

> **Objetivo**: [Qué se quiere mejorar y por qué]

---

## Motivación

[¿Por qué es necesario este refactor? ¿Qué problema de mantenibilidad/legibilidad resuelve?]

---

## Archivos involucrados

| Archivo | Rol | Cambio |
|---------|-----|--------|
| `ruta/componente.html` | Template | Modificar |
| `ruta/componente.ts` | Lógica | Modificar |
| `ruta/nuevo-servicio.ts` | Servicio | Crear |

---

## Estado actual vs estado deseado

| Aspecto | Estado actual | Estado deseado |
|---------|---------------|----------------|
| [Aspecto] | [Cómo es hoy] | [Cómo debería quedar] |

---

## Tareas de refactorización

### T0 — [Primera tarea]
**Archivos**: `archivo1.ts`
**Contexto**: [Por qué se necesita]
- [ ] Paso 1
- [ ] Paso 2

### T1 — [Segunda tarea]
...

---

## Compatibilidad y dependencias

- **Funcionalidad afectada**: ninguna (refactor puro) / [descripción]
- **Datos del usuario**: ¿se mantienen las mismas claves de `localStorage`? [Sí / No → migración necesaria]
- **Tests a actualizar**: sí → [lista] / no

---

## Impacto

- **Reversibilidad**: alta / media / baja
- **Riesgo principal**: [qué puede romper]

---

## Orden de implementación sugerido

1. **T0** → [breve]
2. **T1** → [breve]

---

## Verificación

- [ ] `npm run build` verde después de cada tarea T.
- [ ] Las 6 secciones de la app levantan y funcionan igual que antes.
- [ ] Datos del usuario existentes siguen siendo legibles.

---

### Reglas

- ✅ **SIEMPRE** dejar build verde al cerrar cada tarea T.
- ✅ **SIEMPRE** mantener las claves de `localStorage` existentes para no romper datos.
- ❌ **NUNCA** combinar refactor con cambios funcionales.
- ❌ **NUNCA** hacer "big bang": cada paso debe ser revertible.
