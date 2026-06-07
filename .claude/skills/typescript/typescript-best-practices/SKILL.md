---
name: typescript-best-practices
description: >
  
license: MIT
metadata:
  version: "1.0"
  author: "Control de Gastos"
  category: "angular"
---

# TypeScript Best Practices

> "El tipo `any` es la puerta de salida del sistema de tipos. No la uses."

## Cuándo Usar

Activa este skill cuando:
- Escribas código TypeScript nuevo
- Definas interfaces, types o enums
- Trabajes con datos de origen desconocido (API responses)
- Crees funciones con parámetros o callbacks
- Necesites decidir entre enum vs union type
- Refactorices código con `any` o strings literales

**No usar cuando:**
- El código es JavaScript puro (no TypeScript)
- Se trabaja con librerías externas que requieren `any` (documentar excepción)

---

## Árbol de Decisiones

### ¿Cómo reemplazar `any`?

```
¿Conozco la estructura del dato?
├── SÍ → Crear interface/type específico
└── NO → ¿Viene de fuente externa (API, usuario)?
    ├── SÍ → Usar `unknown` + type guard
    └── NO → ¿Necesito flexibilidad de tipos?
        ├── SÍ → Usar Generics <T>
        └── NO → Revisar diseño, probablemente necesitas interface
```

### ¿Enum o Union Type?

```
¿Necesito valores numéricos o reverse mapping?
├── SÍ → Usar Enum
└── NO → ¿Se comparte con backend/necesita serialización especial?
    ├── SÍ → Usar Enum con valores string
    └── NO → Usar Union Type (más simple)
```

---

## Patrones Críticos

### Patrón 1: Usar `unknown` en lugar de `any`

**Descripción**: Para datos de origen desconocido, `unknown` obliga a validar antes de usar.

```typescript
// ✅ CORRECTO: Usar unknown y validar
function parse(input: unknown): User {
  if (isUser(input)) return input;
  throw new Error("Invalid input");
}

function handleApiResponse(data: unknown): void {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    // Ahora TypeScript sabe que data tiene 'id'
  }
}
```

### Patrón 2: Generics para Flexibilidad Tipada

**Descripción**: Cuando necesitas flexibilidad pero quieres mantener el tipado.

```typescript
// ✅ CORRECTO: Genéricos para flexibilidad con tipo seguro
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn);
}

// ✅ CORRECTO: Constrained generics
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Patrón 3: Type Guards para Narrowing

**Descripción**: Función que valida y estrecha el tipo en runtime.

```typescript
// ✅ CORRECTO: Type guard para validar tipos
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

// Uso:
function processData(data: unknown): void {
  if (isUser(data)) {
    console.log(data.name); // TypeScript sabe que es User
  }
}
```

### Patrón 4: Interfaces Planas (Flat Interfaces)

**Descripción**: Las interfaces deben tener **un solo nivel de profundidad**. Objetos anidados se extraen a interfaces dedicadas.

```typescript
// ✅ CORRECTO: Interfaces planas con referencias
interface UserAddress {
  street: string;
  city: string;
  zipCode: string;
}

interface UserContact {
  email: string;
  phone: string;
}

interface User {
  id: string;
  name: string;
  address: UserAddress;    // Referencia a interface separada
  contact: UserContact;    // Referencia a interface separada
}

// ✅ CORRECTO: Extensión de interfaces
interface Admin extends User {
  permissions: string[];
  department: string;
}
```

### Patrón 5: Tipos Estrictos en Funciones

**Descripción**: Siempre declarar tipos explícitos en parámetros y retorno.

```typescript
// ✅ CORRECTO: Tipos explícitos en parámetros y retorno
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ CORRECTO: Callbacks tipados
function processItems<T>(
  items: T[],
  callback: (item: T, index: number) => void
): void {
  items.forEach(callback);
}
```

### Patrón 6: Union Types y Enums para Estados

**Descripción**: NUNCA usar strings literales sueltos. Siempre crear union type o enum.

```typescript
// ✅ PREFERIDO: Union types para strings simples
type UserStatus = 'activo' | 'inactivo' | 'pendiente';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// ✅ USAR ENUM cuando necesitas valores especiales
enum TipoDocumento {
  DNI = 'dni',
  PASAPORTE = 'pasaporte',
  LICENCIA = 'licencia',
  CUIL = 'cuil'
}

enum HttpStatusCode {
  OK = 200,
  NOT_FOUND = 404,
  SERVER_ERROR = 500
}
```

---

## Ejemplos de Código

### ❌ Antipatrón: Uso de `any`

**Problema**: Desactiva el sistema de tipos, errores en runtime.

```typescript
// MAL - No hacer esto
function parse(input: any): any { }
function first(arr: any[]): any { return arr[0]; }
```

### ✅ Patrón Correcto: Alternativas a `any`

**Solución**: Usar `unknown`, generics o interfaces específicas.

```typescript
// BIEN - Hacer esto
function parse(input: unknown): User { /* validar */ }
function first<T>(arr: T[]): T | undefined { return arr[0]; }
```

### ❌ Antipatrón: Interfaces Anidadas

**Problema**: Difícil reutilizar, mantener y testear.

```typescript
// MAL - Objetos anidados inline
interface User {
  id: string;
  address: { street: string; city: string };  // ¡NO!
}
```

### ✅ Patrón Correcto: Interfaces Planas

**Solución**: Extraer objetos anidados a interfaces separadas.

```typescript
// BIEN - Interfaces planas
interface UserAddress { street: string; city: string; }
interface User { id: string; address: UserAddress; }
```

### ❌ Antipatrón: Strings Literales Sueltos

**Problema**: Typos no detectados, sin autocompletado.

```typescript
// MAL - Strings sueltos
user.status = 'pndiente';  // Typo no detectado
function update(status: string) { }
```

### ✅ Patrón Correcto: Union Type o Enum

**Solución**: Crear tipo explícito.

```typescript
// BIEN - Union type
type UserStatus = 'activo' | 'inactivo' | 'pendiente';
user.status = 'pndiente';  // ❌ Error de compilación
```

### ❌ Antipatrón: Funciones sin Tipos

**Problema**: TypeScript infiere `any` implícito.

```typescript
// MAL - Tipos implícitos
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### ✅ Patrón Correcto: Tipos Explícitos

**Solución**: Declarar tipos en parámetros y retorno.

```typescript
// BIEN - Tipos explícitos
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

---

## Tabla de Referencia Rápida

| Escenario | Acción | Ejemplo |
|-----------|--------|---------|
| Dato desconocido | Usar `unknown` + type guard | `function parse(x: unknown): User` |
| Función genérica | Usar generics | `function first<T>(arr: T[]): T` |
| Objeto anidado | Extraer a interface | `address: UserAddress` |
| Estado/tipo fijo | Union type o enum | `type Status = 'a' \| 'b'` |
| Valores numéricos | Enum numérico | `enum Code { OK = 200 }` |
| Callback | Tipar parámetros | `(item: T) => void` |

### Cuándo Usar Enum vs Union Type

| Uso | Recomendación |
|-----|---------------|
| Estados simples | Union type: `type Status = 'a' \| 'b'` |
| Valores que necesitan label/display | Enum con valor string |
| Valores numéricos | Enum numérico |
| Necesita reverse mapping | Enum |
| Compartir con backend | Enum o const object |

---

## Utility Types

TypeScript provee utility types para transformar tipos. Ver skill `typescript-utility-types` para referencia completa.

Resumen rápido:
- `Pick<T, K>` - Seleccionar campos
- `Omit<T, K>` - Excluir campos  
- `Partial<T>` - Todos opcionales
- `Required<T>` - Todos requeridos
- `Readonly<T>` - Todos inmutables
- `Record<K, V>` - Objeto tipado

---

## Comportamiento del Agente

Cuando trabajes con este skill:

1. **Primero**: Detectar si el código tiene `any`, interfaces anidadas o strings literales
2. **Validar**: Verificar que los tipos propuestos sean correctos y específicos
3. **Aplicar**: Usar el árbol de decisiones para elegir la solución correcta
4. **Reportar**: Explicar por qué se eligió esa alternativa al usuario

### Notas Importantes

- **No uses `any` bajo ninguna circunstancia** sin documentar la excepción
- **Prefiere union types sobre enums** para casos simples
- **Siempre extrae interfaces anidadas** a tipos separados
- Cuando refactorices, verifica que los tests sigan pasando

---

## Checklist de Revisión

Antes de hacer commit, verificar:

- [ ] No hay uso de `any` en el código
- [ ] Todas las interfaces son planas (un nivel de profundidad)
- [ ] Objetos anidados extraídos a interfaces separadas
- [ ] Funciones tienen tipos explícitos de parámetros y retorno
- [ ] No hay strings literales para estados/valores - usar enum o union type
- [ ] Type guards implementados para datos de origen desconocido

---

## Skills Relacionadas

- `typescript-utility-types` - Referencia completa de utility types
- `typescript-path-aliases` - Path aliases para imports limpios
- `clean-code-principles` - Principios de código limpio

---

## Recursos

- **Documentación oficial**: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
