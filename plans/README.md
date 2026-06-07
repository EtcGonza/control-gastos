# Planes de Trabajo

> Carpeta centralizada para todos los planes de trabajo creados con asistentes de IA.
> Los planes se agrupan mensualmente y su estado se gestiona vía metadata interna (frontmatter YAML).

---

## Convenciones

### Nombre de archivo

```
YYYY-MM-[tipo]-[descripcion-kebab].md
```

### Tipos válidos

| Tipo | Cuándo usar | Ejemplo |
|------|-------------|---------|
| `feat` | Feature nueva, funcionalidad nueva | `2026-06-feat-export-csv.md` |
| `bug` | Corrección de un error | `2026-06-bug-paginacion-desaparece.md` |
| `refactor` | Mejora de código sin cambiar funcionalidad | `2026-06-refactor-arquitectura-core-shared-pages.md` |
| `test` | Plan de testing: cobertura, estrategia | `2026-06-test-cobertura-transactions-service.md` |
| `analisis` | Investigación, evaluación de opciones | `2026-06-analisis-pwa-vs-app-nativa.md` |

### Nombre de la descripción

- **kebab-case** (minúsculas separadas por guiones)
- Máximo **6 palabras**
- Suficientemente descriptivo para entender el plan sin abrirlo

---

## Metadata (frontmatter)

Todo plan DEBE iniciar con este bloque YAML:

```yaml
---
plan: YYYY-MM-[tipo]-[descripcion]
tipo: feat | bug | refactor | test | analisis
estado: backlog | en-curso | completado | descartado | bloqueado
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: YYYY-MM-DD | —
fecha-fin: YYYY-MM-DD | —
modulo: ruta/del/modulo-afectado
tags: [tag1, tag2]
---
```

### Estados

| Estado | Significado | Transiciones válidas |
|--------|-------------|----------------------|
| `backlog` | Creado, pendiente de iniciar | → `en-curso`, `descartado` |
| `en-curso` | Activamente en ejecución | → `completado`, `bloqueado`, `descartado` |
| `completado` | Finalizado exitosamente | Estado final |
| `descartado` | No se ejecutará | Estado final |
| `bloqueado` | Detenido por dependencia externa | → `en-curso`, `descartado` |

---

## Estructura de carpetas

```
plans/
├── README.md              ← Este archivo
├── templates/             ← Templates por tipo de plan
│   ├── PLAN-FEATURE.template.md
│   ├── PLAN-BUG.template.md
│   ├── PLAN-REFACTOR.template.md
│   ├── PLAN-TEST.template.md
│   └── PLAN-ANALISIS.template.md
├── 2026-06/               ← Agrupación mensual
│   └── 2026-06-refactor-arquitectura-core-shared-pages.md
└── ...
```

### Reglas

1. **Todo plan va en `plans/`** — nunca en `docs/`.
2. **Los planes se agrupan en carpetas mensuales** (`YYYY-MM/`).
3. **Un plan nunca se mueve de carpeta** — el estado se gestiona dentro del archivo.
4. **Cada plan inicia con frontmatter YAML obligatorio**.

---

## Sin plan (hacer directamente)

No hace falta crear plan para:

- Cambio de 1 línea (typo, clase CSS).
- Agregar un `@Input` o `@Output`.
- Corregir un import.
- Ajustar un valor hardcodeado.

---

## Comandos útiles

```bash
# Planes en curso
grep -rl "estado: en-curso" plans/

# Planes por tipo
grep -rl "tipo: feat" plans/

# Planes de un módulo
grep -rl "modulo: src/app/pages/mes-page" plans/

# Planes de un mes
ls plans/2026-06/

# Contar por estado
grep -rl "estado: completado" plans/ | wc -l
```
