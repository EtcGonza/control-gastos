---
name: git-commits
description: Crear mensajes de commit claros, consistentes y en español. Trigger: Al crear commits, después de completar cambios de código, cuando el usuario pide hacer commit.
license: MIT
metadata:
  version: "1.0"
  author: "Control de Gastos"
  category: "angular"
---

# Skill: Creación de Commits en Git

Este skill define el formato estándar para mensajes de commit en español siguiendo conventional commits.

## Reglas Críticas

### SIEMPRE

- ✅ Usar formato conventional-commits: `tipo(alcance): descripción`
- ✅ Mantener la primera línea bajo 72 caracteres
- ✅ Escribir en **español** y en **imperativo**
- ✅ Pedir confirmación al usuario antes de ejecutar el commit
- ✅ Verificar `git status` y `git diff --stat` antes de proponer el mensaje

### NUNCA

- ❌ Usar emojis ni iconos en los mensajes
- ❌ Agregar cuerpo con bullet points al commit (solo título)
- ❌ Ser demasiado específico (evitar conteos como "6 archivos", "3 validaciones")
- ❌ Incluir detalles de implementación en el título
- ❌ Usar `git push --force` o `git push -f` (destructivo, reescribe historial)
- ❌ Hacer commit sin confirmación explícita del usuario
- ❌ Ofrecer proactivamente hacer commit - esperar a que el usuario lo solicite
- ❌ Agregar `Co-Authored-By` ni ningún otro co-autor al mensaje de commit

---

## Formato del Mensaje de Commit

```
tipo(alcance): descripción concisa
```

Solo título. Sin cuerpo, sin bullet points. El detalle de los cambios se ve en el diff (`git show`), no se lista en el mensaje.

### Estructura

| Parte | Obligatorio | Descripción |
|-------|-------------|-------------|
| `tipo` | Sí | Categoría del cambio |
| `alcance` | No | Módulo o área afectada (omitir si múltiples) |
| `descripción` | Sí | Resumen breve, imperativo, < 72 caracteres |

---

## Tipos de Commit

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `chore` | Mantenimiento, dependencias, configs |
| `refactor` | Cambio de código sin feat/fix |
| `test` | Agregar o actualizar tests |
| `perf` | Mejora de rendimiento |
| `style` | Formateo, sin cambio de código |

---

## Alcances

| Alcance | Cuándo usar |
|---------|-------------|
| `core` | Cambios en core/ (helpers, guards, interceptors) |
| `shared` | Cambios en shared/ (componentes, pipes) |
| `models` | Cambios en modelos y schemas |
| `services` | Cambios en servicios HTTP |
| `modulo` | Nombre del módulo específico (ej: `visitas`, `asignaciones`) |
| `config` | Configuración del proyecto |
| `deps` | Dependencias |
| `tests` | Infraestructura de testing |
| *(omitir)* | Múltiples alcances o nivel raíz |

---

## Árbol de Decisiones

```
¿Múltiples alcances afectados?
├─ Sí → Omitir alcance: `feat: descripción`
└─ No → Incluir alcance: `feat(modulo): descripción`

¿Corrigiendo un bug?
├─ Bug visible al usuario → `fix(modulo): descripción`
└─ Bug interno/dev → `chore(modulo): corrige descripción`

¿Agregando documentación?
├─ Docs de código (JSDoc) → Parte del feat/fix
└─ Docs standalone → `docs:` o `docs(modulo):`
```

---

## Flujo de Trabajo del Agente

1. **Analizar cambios**
   ```bash
   git status
   git diff --stat HEAD
   git log -3 --oneline  # Ver estilo de commits recientes
   ```

2. **Redactar mensaje**
   - Elegir tipo y alcance apropiados
   - Escribir título conciso (< 72 caracteres)
   - No agregar cuerpo ni bullet points

3. **Presentar al usuario para confirmación**
   - Mostrar archivos a commitear
   - Mostrar mensaje propuesto
   - Esperar confirmación explícita

4. **Ejecutar commit**
   ```bash
   git add <archivos>
   git commit -m "tipo(alcance): descripción"
   ```

---

## Reglas de Escritura

### Descripción Corta (Primera Línea)

1. **Usar imperativo**: Escribir como si fuera una orden
   - Correcto: "agrega validación de formulario"
   - Incorrecto: "agregué validación" o "agregando validación"

2. **Iniciar en minúscula**: La descripción comienza con minúscula
   - Correcto: `feat(visitas): agrega filtro por fecha`
   - Incorrecto: `feat(visitas): Agrega filtro por fecha`

3. **Sin punto final**: No terminar con punto

4. **Máximo 72 caracteres**: Mantener la línea corta y legible

5. **Ser específico**: Evitar descripciones vagas
   - Correcto: `fix(visitas): corrige cálculo de días pendientes`
   - Incorrecto: `fix: arregla bug`

---

## Ejemplos Correctos vs Incorrectos

### Título

```bash
# CORRECTO - Conciso y claro
feat(visitas): agrega componente de filtros avanzados
fix(auth): corrige redirección al expirar sesión
chore(deps): actualiza Angular a v17.3.12
docs: actualiza guía de instalación

# INCORRECTO - Demasiado específico o verboso
feat(visitas): agrega componente de filtros avanzados con 3 campos y validación
chore(deps): actualiza 6 dependencias de Angular y corrige 3 warnings
fix(auth): arregla el bug en la línea 45 del componente login
```

---

## Ejemplos de Commits Completos

```
fix(asignaciones): corrige paginación en tabla de asignaciones
refactor(services): migra BaseService a nueva arquitectura
test(observaciones): agrega tests unitarios para ObservacionService
chore(deps): actualiza Angular a versión 17.3.12
```

### Breaking Change

Si el cambio rompe la API pública, agregar el indicador `!` en el tipo o usar la nota `BREAKING CHANGE:` en una sola línea adicional:

```
refactor(services)!: migra BaseService a nueva arquitectura
```

---

## Tabla de Errores Comunes

| Incorrecto | Problema | Correcto |
|------------|----------|----------|
| `fix: arreglé el bug` | Tiempo verbal incorrecto | `fix: corrige el bug de validación` |
| `feat: Nuevo componente` | Mayúscula inicial | `feat: agrega nuevo componente` |
| `cambios varios` | Sin tipo, vago | `refactor(core): reorganiza helpers` |
| `feat: 🚀 nueva feature` | Tiene emoji | `feat: agrega nueva funcionalidad` |
| `WIP` | No descriptivo | `wip(visitas): implementa filtro` |
| `fix bug.` | Vago, con punto | `fix(auth): corrige error de token` |
| `updated files` | En inglés, vago | `refactor(models): actualiza schemas` |

---

## Commits Atómicos

Cada commit debe representar **un solo cambio lógico**. Si necesita "y" para describirse, dividir en múltiples commits.

```bash
# Incorrecto - múltiples cambios
git commit -m "feat(visitas): agrega filtros y corrige paginación"

# Correcto - commits separados
git commit -m "feat(visitas): agrega componente de filtros"
git commit -m "fix(visitas): corrige cálculo de paginación"
```

---

## Comandos Útiles

```bash
# Commit simple (siempre así, solo título)
git commit -m "feat(visitas): agrega selector de fecha"

# Modificar último commit
git commit --amend -m "feat(visitas): agrega selector de rango de fechas"

# Ver estado antes de commit
git status && git diff --stat HEAD
```

---

## Situaciones Especiales

### Revert

```
revert: revierte "feat(visitas): agrega filtro por región"
```

### Hotfix

```
fix(auth): corrige vulnerabilidad en validación de token
```

### WIP (Trabajo en Progreso)

```
wip(modulo): descripción del progreso actual
```

---

## Checklist Pre-Commit

- [ ] Tipo correcto para el cambio
- [ ] Alcance refleja el módulo afectado
- [ ] Descripción en imperativo y minúscula
- [ ] Sin emojis ni iconos
- [ ] Mensaje en español
- [ ] Primera línea < 72 caracteres
- [ ] Commit representa un único cambio lógico
- [ ] Tests pasan (si aplica)

---

## Resumen

```
tipo(alcance): descripción en imperativo, minúscula, sin punto
```

**Tipos**: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`, `perf`

**Reglas clave**:
- Español, sin emojis
- Imperativo, minúscula inicial
- Máximo 72 caracteres
- Commits atómicos
- Confirmar con usuario antes de ejecutar

