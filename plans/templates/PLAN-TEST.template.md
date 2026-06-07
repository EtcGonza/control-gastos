---
plan: YYYY-MM-test-[descripcion]
tipo: test
estado: backlog
prioridad: alta | media | baja
fecha-creacion: YYYY-MM-DD
fecha-inicio: —
fecha-fin: —
modulo: ruta/del/modulo
tags: []
---

# Plan de Testing — [Descripción]

> **Objetivo**: [Qué se quiere cubrir y por qué]

---

## Alcance

- **Service / componente bajo test**: [nombre]
- **Tipo de tests**: unit / integration / e2e
- **Cobertura objetivo**: [%]

---

## Casos a cubrir

| ID | Caso | Tipo | Prioridad |
|----|------|------|-----------|
| TC1 | [Happy path] | unit | alta |
| TC2 | [Edge case] | unit | media |
| TC3 | [Error handling] | unit | media |

---

## Tareas

### T0 — Setup de tests
**Archivos**: `karma.conf.js`, `tsconfig.spec.json`
- [ ] Verificar dependencias (Jasmine, Angular Testing Library).
- [ ] Configurar `jsdom` o `karma` según corresponda.

### T1 — Tests del service
**Archivos**: `transactions.service.spec.ts`
- [ ] Mockear `localStorage` (vía `StorageService` mock).
- [ ] Test happy path del CRUD.
- [ ] Test de la migración de categorías.

### T2 — Tests del componente
**Archivos**: `transaction-form.component.spec.ts`
- [ ] Setup con Angular Testing Library.
- [ ] Test interacción usuario.

---

## Mocks necesarios

| Dependencia | Estrategia |
|-------------|------------|
| `StorageService` | Mock in-memory |
| `fetch` (USD rate) | Stub |

---

## Verificación

- [ ] `npm run test` verde.
- [ ] Cobertura >= [% objetivo].
- [ ] Tests pasan en CI.

---

### Reglas

- ✅ **SIEMPRE** un test por caso, no un test mega que verifica todo.
- ✅ **SIEMPRE** mockear `localStorage` para no contaminar datos reales.
- ❌ **NUNCA** hacer fetch real en tests (usar stub).
