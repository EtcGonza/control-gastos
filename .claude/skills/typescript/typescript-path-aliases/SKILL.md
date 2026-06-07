---
name: typescript-path-aliases
description: >
  
license: MIT
metadata:
  version: "1.0"
  author: "Control de Gastos"
  category: "angular"
---

# TypeScript Path Aliases

> "Un buen import se lee como una dirección, no como un laberinto de puntos."

## Cuándo Usar

Activa este skill cuando:
- Importes archivos desde `src/app/core/` o sus subcarpetas
- Importes archivos desde `src/app/shared/` o sus subcarpetas
- Importes archivos desde `src/app/test/` (solo en `.spec.ts`)
- Importes archivos desde `src/environments/`
- El import relativo tendría más de 2 niveles (`../../..`)

**No usar cuando:**
- Importes archivos de la misma carpeta (`./archivo`)
- Importes archivos de una subcarpeta directa (`./subfolder/archivo`)
- Importes desde librerías externas (npm packages)
- El archivo hermano está en la misma carpeta de entidad (`../otra-entidad/`)

---

## Árbol de Decisiones

```
¿De dónde viene el archivo?
├── Misma carpeta → Import relativo: `./archivo`
├── Subcarpeta directa → Import relativo: `./subfolder/archivo`
├── Librería externa → Import normal: `'libreria'`
└── Otra carpeta del proyecto → ¿Más de 2 niveles (../../..)?
    ├── SÍ → Usar path alias
    └── NO → Evaluar:
        ├── ¿Es de core/shared/test? → Path alias
        └── ¿Es archivo hermano? → Relativo (`../`)
```

---

## Patrones Críticos

### Patrón 1: Aliases de Core

**Descripción**: Para modelos, helpers, servicios, validadores y guards del core.

```typescript
// ✅ CORRECTO: Usar path aliases
import { Usuario } from '@core-models/usuarios/usuario.model';
import { ZodHelper } from '@core-helper/zod-helper/zod.helper';
import { AuthService } from '@core-services/auth/auth.service';
import { cuilValidator } from '@core-validators/cuil-validator/cuil.validator';
import { identityGuard } from '@core-guards/identity/identity.guard';
```

### Patrón 2: Aliases de Shared

**Descripción**: Para componentes, servicios y constantes compartidas.

```typescript
// ✅ CORRECTO: Usar path aliases
import { SharedModule } from '@shared/shared.module';
import { appRoutes } from '@shared/constants/routes/app-routes';
import { SiniestroService } from '@shared-services/siniestro/siniestro.service';
import { ToastService } from '@shared-services/toast/toast.service';
```

### Patrón 3: Aliases de Testing

**Descripción**: Solo en archivos `.spec.ts` para mocks y helpers.

```typescript
// ✅ CORRECTO: En archivos de test
import { MockUsuarioService } from '@test/mocks/usuario.service.mock';
import { createTestComponent } from '@test/helpers/component.helper';
import { SharedTestModule } from '@test/helpers/shared-test.module';
```

### Patrón 4: Alias de Environment

**Descripción**: Para configuración de entornos.

```typescript
// ✅ CORRECTO
import { environment } from '@environment/environment';
```

### Patrón 5: Imports Relativos para Archivos Locales

**Descripción**: Archivos en la misma carpeta o subcarpetas directas.

```typescript
// ✅ CORRECTO: Mismo nivel
import { MiSchema } from './mi-entidad.schema';

// ✅ CORRECTO: Subcarpeta directa
import { SubComponente } from './components/sub-componente.component';

// ✅ CORRECTO: Entidad hermana
import { OtraEntidad } from '../otra-entidad/otra-entidad.model';
```

---

## Tabla de Referencia Rápida

| Alias | Ruta Real | Uso |
|-------|-----------|-----|
| `@core-models/*` | `src/app/core/models/*` | Modelos, schemas Zod |
| `@core-helper/*` | `src/app/core/helper/*` | Helpers y utilidades |
| `@core-services/*` | `src/app/core/services/*` | Servicios globales |
| `@core-validators/*` | `src/app/core/validators/*` | Validadores de formularios |
| `@core-guards/*` | `src/app/core/guards/*` | Guards de rutas |
| `@core/*` | `src/app/core/*` | Otros archivos de core |
| `@shared-components/*` | `src/app/shared/components/*` | Componentes compartidos |
| `@shared-services/*` | `src/app/shared/services/*` | Servicios compartidos |
| `@shared/*` | `src/app/shared/*` | Otros archivos shared |
| `@modules/*` | `src/app/modules/*` | Módulos de páginas |
| `@test/*` | `src/app/test/*` | Helpers de testing, mocks |
| `@environment/*` | `src/environments/*` | Configuración de environments |

---

## Ejemplos de Código

### ❌ Antipatrón: Rutas Relativas Largas

**Problema**: Difícil de leer, propenso a errores, se rompe al mover archivos.

```typescript
// MAL - Contar puntos es propenso a errores
import { Usuario } from '../../../core/models/usuarios/usuario.model';
import { ZodHelper } from '../../../../core/helper/zod-helper/zod.helper';
import { AuthService } from '../../../core/services/auth/auth.service';
```

### ✅ Patrón Correcto: Path Aliases

**Solución**: Usar aliases definidos en tsconfig.json.

```typescript
// BIEN - Claro y consistente
import { Usuario } from '@core-models/usuarios/usuario.model';
import { ZodHelper } from '@core-helper/zod-helper/zod.helper';
import { AuthService } from '@core-services/auth/auth.service';
```

### ❌ Antipatrón: Alias para Archivos Locales

**Problema**: Sobreingeniería, el alias no aporta claridad.

```typescript
// MAL - Usar alias para archivo en misma carpeta
import { MiSchema } from '@core-models/mi-entidad/mi-entidad.schema';  // Desde mi-entidad.model.ts
```

### ✅ Patrón Correcto: Relativo para Local

**Solución**: Usar import relativo para archivos cercanos.

```typescript
// BIEN - Import relativo para misma carpeta
import { MiSchema } from './mi-entidad.schema';
```

### ❌ Antipatrón: Mezclar Estilos

**Problema**: Inconsistencia dificulta mantenimiento.

```typescript
// MAL - Mezclar alias y relativos para mismo nivel
import { Servicio1 } from '@core-services/servicio1/servicio1.service';
import { Servicio2 } from '../../../core/services/servicio2/servicio2.service';
```

### ✅ Patrón Correcto: Consistencia

**Solución**: Usar el mismo estilo para imports del mismo origen.

```typescript
// BIEN - Consistente
import { Servicio1 } from '@core-services/servicio1/servicio1.service';
import { Servicio2 } from '@core-services/servicio2/servicio2.service';
```

---

## Orden de Imports Recomendado

```typescript
// 1. Angular core
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

// 2. Librerías externas (rxjs, zod, etc.)
import { Observable, Subject } from 'rxjs';
import { z } from 'zod';

// 3. Librerías internas (@asociart)
import { AsoModalService } from '@asociart/portal.fe.lib.ui-core-components';

// 4. Core (modelos, helpers, servicios, validators, guards)
import { Usuario } from '@core-models/usuarios/usuario.model';
import { ZodHelper } from '@core-helper/zod-helper/zod.helper';
import { AuthService } from '@core-services/auth/auth.service';

// 5. Shared
import { SharedModule } from '@shared/shared.module';
import { SiniestroService } from '@shared-services/siniestro/siniestro.service';

// 6. Test (solo en .spec.ts)
import { MockService } from '@test/mocks/service.mock';

// 7. Imports relativos (misma carpeta o subcarpetas)
import { MiComponenteLocal } from './mi-componente-local.component';
```

---

## Configuración en tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@core-models/*": ["src/app/core/models/*"],
      "@core-helper/*": ["src/app/core/helper/*"],
      "@core-services/*": ["src/app/core/services/*"],
      "@core-validators/*": ["src/app/core/validators/*"],
      "@core-guards/*": ["src/app/core/guards/*"],
      "@core/*": ["src/app/core/*"],
      "@shared-components/*": ["src/app/shared/components/*"],
      "@shared-services/*": ["src/app/shared/services/*"],
      "@shared/*": ["src/app/shared/*"],
      "@modules/*": ["src/app/modules/*"],
      "@test/*": ["src/app/test/*"],
      "@environment/*": ["src/environments/*"]
    }
  }
}
```

---

## Comportamiento del Agente

Cuando trabajes con este skill:

1. **Primero**: Identificar de dónde viene el archivo a importar
2. **Validar**: Verificar si existe un alias apropiado para esa ruta
3. **Aplicar**: Usar el árbol de decisiones para elegir alias o relativo
4. **Reportar**: Si se detectan imports inconsistentes, sugerir corrección

### Notas Importantes

- **NUNCA** uses rutas relativas con más de 2 niveles (`../../../`)
- **SIEMPRE** mantén consistencia en el estilo de imports del mismo archivo
- **RECUERDA** que `@test/*` solo se usa en archivos `.spec.ts`
- El orden de imports mejora legibilidad: Angular → Externos → @asociart → Core → Shared → Test → Relativos

---

## Checklist de Revisión

- [ ] No hay imports con más de 2 niveles relativos
- [ ] Se usan path aliases para core, shared, test y environment
- [ ] Los imports relativos solo son para archivos locales
- [ ] El orden de imports sigue la convención
- [ ] No hay mezcla de estilos para el mismo origen

---

## Skills Relacionadas

- `typescript-best-practices` - Buenas prácticas TypeScript
- `module-creation` - Imports en módulos Angular
- `model-creation` - Estructura de modelos con paths

---

## Recursos

- **Documentación oficial**: [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)
