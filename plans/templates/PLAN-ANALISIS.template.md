---
plan: YYYY-MM-analisis-[descripcion]
tipo: analisis
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: []
---

# Análisis — [Descripción]

> **Pregunta**: [¿Qué se quiere responder o decidir?]

---

## Contexto

[¿Por qué surge esta investigación? ¿Qué disparó la duda?]

---

## Opciones a evaluar

### Opción A: [Nombre]
- **Pros**: [Lista]
- **Contras**: [Lista]
- **Costo**: [Tiempo / esfuerzo / dependencias]

### Opción B: [Nombre]
- **Pros**: [Lista]
- **Contras**: [Lista]
- **Costo**: [Tiempo / esfuerzo / dependencias]

### Opción C: No hacer nada
- **Pros**: [Lista]
- **Contras**: [Lista]

---

## Criterios de decisión

| Criterio | Peso | A | B | C |
|----------|:----:|:-:|:-:|:-:|
| Mantenibilidad | alto | ✅ | ⚠️ | ❌ |
| Performance | medio | ⚠️ | ✅ | ✅ |
| Tiempo de implementación | medio | ❌ | ✅ | ✅ |

---

## Investigación a realizar

- [ ] Probar opción A en un branch.
- [ ] Leer documentación de [librería].
- [ ] Consultar a [persona].
- [ ] Medir performance con [herramienta].

---

## Recomendación

[Espacio para volcar la conclusión una vez completada la investigación.]

---

## Próximos pasos

- Si A → abrir plan `feat-*`.
- Si B → abrir plan `refactor-*`.
- Si C → marcar este análisis como `descartado`.

---

### Reglas

- ✅ Volcar **datos concretos**, no opiniones.
- ✅ **Cerrar el análisis con una recomendación** clara.
- ❌ No dejar el análisis abierto sin conclusión.
