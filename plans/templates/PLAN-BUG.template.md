---
plan: YYYY-MM-bug-[descripcion]
tipo: bug
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: []
---

# Plan de Corrección — [Descripción del Bug]

> **Síntoma**: [Qué ve el usuario]
> **Causa raíz**: [Por qué pasa, una vez investigado]

---

## Reproducción

1. [Paso 1]
2. [Paso 2]
3. [Resultado esperado vs obtenido]

---

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/app/pages/mes-page/components/transaction-list/transaction-list.component.html` | Template |
| `src/app/core/services/transactions.service.ts` | Lógica |

---

## Comportamiento actual vs esperado

| Aspecto | Estado actual | Cambio requerido |
|---------|---------------|------------------|
| [Aspecto] | ⚠️ [Qué pasa hoy] | [Qué debería pasar] |

---

## Tareas

### T0 — [Primera corrección]
**Archivos**: `archivo.ts`
**Contexto**: [Por qué se necesita]
- [ ] Paso 1
- [ ] Paso 2

### T1 — [Verificación]
- [ ] Reproducir el escenario y verificar que el bug ya no se da.

---

## Impacto

- **Funcionalidad afectada**: [qué partes están rotas]
- **Datos del usuario**: [si hay riesgo de perder datos]

---

## Verificación

- [ ] `npm run build` verde.
- [ ] Reproducción manual del bug ya no falla.
- [ ] Datos del usuario existentes siguen funcionando.

---

### Reglas

- ✅ **SIEMPRE** leer el código actual antes de planificar la corrección.
- ✅ **SIEMPRE** identificar la causa raíz, no sólo el síntoma.
- ❌ **NUNCA** parchear sin entender por qué falla.
