---
name: typescript-utility-types
description: >
  
license: MIT
metadata:
  version: "1.0"
  author: "Control de Gastos"
  category: "angular"
---

# TypeScript Utility Types

> "No crees tipos manualmente si TypeScript puede derivarlos por ti."

## Cuándo Usar

Activa este skill cuando:
- Necesites un subconjunto de campos de una interface (`Pick`, `Omit`)
- Quieras hacer campos opcionales o requeridos (`Partial`, `Required`)
- Necesites crear objetos con claves tipadas (`Record`)
- Trabajes con union types y filtros (`Extract`, `Exclude`)
- Quieras inferir tipos de funciones (`ReturnType`, `Parameters`)
- Necesites remover null/undefined de un tipo (`NonNullable`)

**No usar cuando:**
- El tipo es completamente nuevo y no deriva de otro
- La transformación es más compleja que el tipo manual resultante
- Necesitas documentación inline en cada campo

---

## Árbol de Decisiones

```
¿Qué necesitas hacer con el tipo?
├── Seleccionar algunos campos → Pick<T, K>
├── Excluir algunos campos → Omit<T, K>
├── Hacer campos opcionales → Partial<T>
├── Hacer campos requeridos → Required<T>
├── Hacer campos inmutables → Readonly<T>
├── Crear objeto key-value → Record<K, V>
├── Filtrar union type:
│   ├── Mantener algunos → Extract<T, U>
│   └── Excluir algunos → Exclude<T, U>
├── Remover null/undefined → NonNullable<T>
└── Inferir de función:
    ├── Tipo de retorno → ReturnType<T>
    └── Tipos de parámetros → Parameters<T>
```

---

## Patrones Críticos

### Patrón 1: Pick - Seleccionar Campos

**Descripción**: Crea un tipo con solo los campos especificados.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// ✅ CORRECTO: Tipo con solo algunos campos
type UserBasic = Pick<User, 'id' | 'name'>;
// Result: { id: string; name: string; }

// Ejemplo práctico: DTO para listados
type UserListItem = Pick<User, 'id' | 'name' | 'email'>;
```

### Patrón 2: Omit - Excluir Campos

**Descripción**: Crea un tipo excluyendo los campos especificados.

```typescript
// ✅ CORRECTO: Excluir campos auto-generados
type UserCreate = Omit<User, 'id' | 'createdAt'>;
// Result: { name: string; email: string; }

// Ejemplo práctico: Formulario de creación
interface UserFormData extends Omit<User, 'id' | 'createdAt'> {
  password: string;  // Campo adicional
}
```

### Patrón 3: Partial - Todos Opcionales

**Descripción**: Hace todos los campos opcionales. Ideal para updates parciales.

```typescript
// ✅ CORRECTO: Actualización parcial
type UserUpdate = Partial<User>;
// Result: { id?: string; name?: string; email?: string; createdAt?: Date; }

function updateUser(id: string, updates: Partial<User>): void {
  // updates puede tener cualquier subconjunto de campos
}

updateUser('123', { name: 'Nuevo Nombre' }); // ✅ Válido
```

### Patrón 4: Required - Todos Requeridos

**Descripción**: Hace todos los campos requeridos. Útil para validar configuraciones.

```typescript
interface Config {
  host?: string;
  port?: number;
  timeout?: number;
}

// ✅ CORRECTO: Configuración validada
type RequiredConfig = Required<Config>;
// Result: { host: string; port: number; timeout: number; }

function initializeApp(config: Required<Config>): void {
  // Todos los campos garantizados
}
```

### Patrón 5: Readonly - Todos Inmutables

**Descripción**: Hace todos los campos de solo lectura.

```typescript
// ✅ CORRECTO: Estado inmutable
type UserReadonly = Readonly<User>;

const user: UserReadonly = { id: '1', name: 'Juan', email: 'j@e.com', createdAt: new Date() };
user.name = 'Pedro'; // ❌ Error: Cannot assign to 'name'
```

### Patrón 6: Record - Objeto Tipado

**Descripción**: Crea un tipo de objeto con claves y valores específicos.

```typescript
// ✅ CORRECTO: Labels para estados
type UserStatus = 'activo' | 'inactivo' | 'pendiente';

const statusLabels: Record<UserStatus, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  pendiente: 'Pendiente'
};

// ✅ CORRECTO: Iconos por tipo
type DocumentType = 'pdf' | 'image' | 'excel';

const documentIcons: Record<DocumentType, string> = {
  pdf: 'fa-file-pdf',
  image: 'fa-file-image',
  excel: 'fa-file-excel'
};
```

### Patrón 7: Extract y Exclude - Filtrar Unions

**Descripción**: Filtrar valores de un union type.

```typescript
type Status = 'active' | 'inactive' | 'pending' | 'deleted';

// ✅ Extract: Mantener solo algunos
type EditableStatus = Extract<Status, 'active' | 'inactive' | 'pending'>;
// Result: 'active' | 'inactive' | 'pending'

// ✅ Exclude: Excluir algunos
type VisibleStatus = Exclude<Status, 'deleted'>;
// Result: 'active' | 'inactive' | 'pending'
```

### Patrón 8: NonNullable - Remover Nulls

**Descripción**: Remueve `null` y `undefined` de un tipo.

```typescript
type MaybeUser = User | null | undefined;

// ✅ CORRECTO: Tipo sin nulls
type DefiniteUser = NonNullable<MaybeUser>;
// Result: User

function processUser(user: User | null): void {
  if (!user) return;
  const validUser: NonNullable<typeof user> = user;
}
```

### Patrón 9: ReturnType y Parameters - Inferir de Funciones

**Descripción**: Obtener tipos de retorno o parámetros de funciones.

```typescript
function createUser(name: string): User {
  return { id: '1', name, email: '', createdAt: new Date() };
}

// ✅ ReturnType: Obtener tipo de retorno
type CreateUserReturn = ReturnType<typeof createUser>;
// Result: User

// ✅ Parameters: Obtener tipos de parámetros
function searchUsers(query: string, limit: number): User[] { return []; }

type SearchParams = Parameters<typeof searchUsers>;
// Result: [query: string, limit: number]
```

---

## Ejemplos de Código

### ❌ Antipatrón: Duplicar Tipos Manualmente

**Problema**: Duplicación, falta de sincronización, más código que mantener.

```typescript
// MAL - Duplicar campos manualmente
interface User {
  id: string;
  name: string;
  email: string;
}

interface UserBasic {
  id: string;    // Duplicado
  name: string;  // Duplicado
}
```

### ✅ Patrón Correcto: Derivar con Utility Types

**Solución**: Derivar del tipo original para mantener sincronización.

```typescript
// BIEN - Derivar del original
interface User {
  id: string;
  name: string;
  email: string;
}

type UserBasic = Pick<User, 'id' | 'name'>;
```

### ❌ Antipatrón: Interfaces Separadas para Create/Update

**Problema**: Mantener múltiples interfaces sincronizadas.

```typescript
// MAL - Interfaces separadas
interface UserCreate {
  name: string;
  email: string;
}

interface UserUpdate {
  name?: string;
  email?: string;
}
```

### ✅ Patrón Correcto: Derivar Create y Update

**Solución**: Usar Omit y Partial para derivar.

```typescript
// BIEN - Derivar de User
type UserCreate = Omit<User, 'id' | 'createdAt'>;
type UserUpdate = Partial<UserCreate>;
```

---

## Tabla de Referencia Rápida

| Necesidad | Utility Type | Ejemplo |
|-----------|--------------|---------|
| Subconjunto de campos | `Pick<T, K>` | `Pick<User, 'id' \| 'name'>` |
| Excluir campos | `Omit<T, K>` | `Omit<User, 'id'>` |
| Campos opcionales | `Partial<T>` | `Partial<User>` |
| Campos requeridos | `Required<T>` | `Required<Config>` |
| Campos inmutables | `Readonly<T>` | `Readonly<User>` |
| Objeto key-value | `Record<K, V>` | `Record<Status, string>` |
| Filtrar unión (mantener) | `Extract<T, U>` | `Extract<Status, 'a' \| 'b'>` |
| Filtrar unión (excluir) | `Exclude<T, U>` | `Exclude<Status, 'deleted'>` |
| Quitar null/undefined | `NonNullable<T>` | `NonNullable<User \| null>` |
| Tipo de retorno | `ReturnType<T>` | `ReturnType<typeof fn>` |
| Tipos de parámetros | `Parameters<T>` | `Parameters<typeof fn>` |

---

## Combinaciones Útiles

### Partial + Pick: Algunos Campos Opcionales

```typescript
type UserOptionalContact = Pick<User, 'id' | 'name'> & Partial<Pick<User, 'email'>>;
// Result: { id: string; name: string; email?: string; }
```

### Omit + Required: Excluir y Requerir Resto

```typescript
type RequiredFormConfig = Required<Omit<FormConfig, 'disabled'>> & Pick<FormConfig, 'disabled'>;
// disabled sigue opcional, resto requerido
```

### Record + Partial: Mapa con Valores Parciales

```typescript
type UserDrafts = Record<string, Partial<User>>;

const drafts: UserDrafts = {
  'draft-1': { name: 'Borrador 1' },
  'draft-2': { name: 'Borrador 2', email: 'b@e.com' }
};
```

---

## Comportamiento del Agente

Cuando trabajes con este skill:

1. **Primero**: Identificar si el tipo nuevo deriva de uno existente
2. **Validar**: Verificar qué utility type aplica según el árbol de decisiones
3. **Aplicar**: Preferir utility types sobre duplicación manual
4. **Reportar**: Explicar qué transformación se aplicó y por qué

### Notas Importantes

- **Preferir derivación** sobre duplicación de campos
- **Combinar utility types** cuando sea necesario
- **Documentar combinaciones complejas** con un comentario
- Los utility types mantienen sincronización automática con el tipo original

---

## Checklist de Revisión

- [ ] No hay duplicación de campos entre interfaces relacionadas
- [ ] Se usan Pick/Omit para subconjuntos de tipos existentes
- [ ] Se usa Partial para tipos de actualización
- [ ] Se usa Record para objetos con claves tipadas
- [ ] Las combinaciones complejas están comentadas

---

## Skills Relacionadas

- `typescript-best-practices` - Buenas prácticas generales
- `model-creation` - Creación de modelos con tipos derivados
- `form-interface-creation` - Interfaces de formularios

---

## Recursos

- **Documentación oficial**: [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
