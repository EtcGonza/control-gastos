---
plan: YYYY-MM-feat-[descripcion]
tipo: feat
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: []
---

# Plan de Implementación — [Nombre Feature]

> **Objetivo**: [Descripción clara y concisa]

---

## 1. Resumen

- **Qué**: [Qué se va a construir]
- **Dónde**: `src/app/pages/[page]/` o `src/app/core/services/`, etc.
- **Archivos a crear / modificar**: [N archivos]

---

## 2. Estructura de archivos

```
src/app/pages/[page]/
├── [page].component.{ts,html,scss}
└── components/
    └── [nombre]/
        ├── [nombre].component.ts
        ├── [nombre].component.html
        └── [nombre].component.scss
```

---

## 3. Modelos / interfaces nuevas

```typescript
// src/app/core/models/[entidad]/[entidad].model.ts
export interface MyModel {
  id: string;
  ...
}
```

---

## 4. Services involucrados

| Service | Rol | Cambios |
|---------|-----|---------|
| `TransactionsService` | Orquestador | Agregar método X |
| `StorageService` | Persistencia | (sin cambios) |

---

## 5. Componentes nuevos

| Componente | Selector | Padre | Responsabilidad |
|------------|----------|-------|-----------------|
| `MyFeatureComponent` | `app-my-feature` | `mes-page` | [breve] |

---

## 6. Tareas

### T0 — [Primera tarea]
**Archivos**: `archivo.ts`
- [ ] Paso 1
- [ ] Paso 2

### T1 — [Segunda tarea]
...

---

## 7. Persistencia (localStorage)

- **¿Nuevas claves?** Sí / No → si sí, agregarlas a `STORAGE_KEYS` en `core/constants/storage-keys.ts`.
- **¿Migración necesaria?** Sí / No → describir.

---

## 8. UI / UX

- **Sidebar**: ¿hay que agregar item de navegación?
- **Selector de mes**: ¿esta sección lo usa?
- **Modal de confirmación**: ¿qué acciones lo requieren?

---

## 9. Convenciones a respetar

- [ ] Componente con sufijo `Component` y archivos `.ts/.html/.scss` separados.
- [ ] `standalone: true` explícito.
- [ ] Tailwind sin prefijo `tw-`.
- [ ] Signals/`computed`/`effect` antes que `Subject`/RxJS.
- [ ] Persistencia siempre vía `StorageService` (no tocar `localStorage` directo).
- [ ] Naming en inglés para identificadores, español para UI y commits.

---

## 10. Impacto y riesgos

- **Funcionalidad afectada**: [qué partes pueden romperse]
- **Datos del usuario**: [si modifica algo en localStorage]
- **Rollback**: [cómo revertir si algo sale mal]

---

## 11. Orden de implementación sugerido

1. T0 → [breve]
2. T1 → [breve]

---

## 12. Verificación

- [ ] `npm run build` verde.
- [ ] Smoke test manual de la sección.
- [ ] Datos del usuario existentes siguen funcionando (sin perder localStorage).

---

## 13. Notas adicionales

- [Decisiones técnicas, alternativas descartadas, links a discusiones]
