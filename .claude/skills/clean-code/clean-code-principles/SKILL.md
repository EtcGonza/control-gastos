---
name: clean-code-principles
description: >
  
license: MIT
metadata:
  version: "1.0"
  author: "Control de Gastos"
  category: "angular"
---

## When to Use

**Trigger**: Invoke this skill when:

- Refactorizar código existente aplicando principios SOLID
- Revisar código antes de crear Pull Request
- Mejorar legibilidad, mantenibilidad y simplicidad del código
## ⚠️ Advertencias Importantes

### Idioma del Código: Español/Spanglish

Este proyecto utiliza **español** para nombres de dominio y **inglés** para términos técnicos:

```typescript
// ✅ CORRECTO: Estilo del proyecto
export class CargaSiniestroDataService { }      // Clase en español
private _contactosEmpleador: Contacto[] = [];   // Variables en español
get formaAccidenteOpcionesSelect() { }          // Getters en español

// Términos técnicos en inglés permitidos:
Observable, Subject, Component, Service, Model, etc.
```

### Evitar Sobreingeniería

**NO aplicar todos los principios en todo momento**. Evaluar según complejidad:

| Complejidad | Aplicar | Evitar |
|-------------|---------|--------|
| Simple (función de 5-10 líneas) | Nombres claros | Abstracciones, interfaces extra |
| Media (módulo con 3-5 archivos) | SRP básico, early returns | Patrones de diseño complejos |
| Alta (feature completo) | SOLID, abstracciones | - |

**Pregunta clave**: "¿Este código va a cambiar/extenderse?" Si no → mantener simple.

---

## Principio #1: Nombres Descriptivos

Los nombres deben comunicar **qué hace** sin necesidad de leer la implementación.

### Funciones: Verbos que Describen la Acción

```typescript
// ✅ CORRECTO: Verbos claros en español
function obtenerSiniestrosPorEmpleador(empleadorId: string): Observable<Siniestro[]> { }
function validarFormularioAccidente(): boolean { }
function guardarDatosTrabajador(datos: DatosTrabajador): void { }
function calcularDiasLicencia(fechaInicio: Date, fechaFin: Date): number { }

// ❌ INCORRECTO: Nombres vagos o sin verbo
function datos() { }
function siniestros() { }
function proceso() { }
function handleClick() { }  // ¿Qué hace el click?
```

### Variables: Sustantivos Descriptivos

```typescript
// ✅ CORRECTO: Sustantivos claros
const siniestrosActivos: Siniestro[] = [];
const fechaUltimoAccidente: Date = new Date();
const totalDiasLicencia: number = 30;
const esTrabajadorActivo: boolean = true;

// ❌ INCORRECTO: Nombres genéricos
const data: any = [];
const temp: Date = new Date();
const x: number = 30;
const flag: boolean = true;
```

### Booleanos: Preguntas que se Responden con Sí/No

```typescript
// ✅ CORRECTO: Prefijos es/tiene/puede/debe
const esSiniestroLaboral: boolean;
const tieneDocumentacion: boolean;
const puedeEditarSiniestro: boolean;
const debeNotificarEmpleador: boolean;
const estaCargando: boolean;

// ❌ INCORRECTO: Sin prefijo de pregunta
const activo: boolean;
const documentacion: boolean;
const editar: boolean;
```

---

## Principio #2: Funciones Pequeñas y Enfocadas

### Cuándo Aplicar (Evaluar Complejidad)

| Tamaño Función | Acción |
|----------------|--------|
| 1-15 líneas | ✅ Mantener así |
| 15-30 líneas | ⚠️ Revisar si hace una sola cosa |
| 30+ líneas | 🔴 Dividir en funciones menores |

### Single Responsibility (Una Sola Cosa)

```typescript
// ✅ CORRECTO: Una función = una responsabilidad
function validarCUIL(cuil: string): boolean {
  const patronCUIL = /^\d{2}-\d{8}-\d{1}$/;
  return patronCUIL.test(cuil);
}

function formatearCUIL(cuil: string): string {
  return `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`;
}

function obtenerTrabajadorPorCUIL(cuil: string): Observable<Trabajador> {
  return this.http.get<Trabajador>(`${this.api}/trabajadores/${cuil}`);
}
```

```typescript
// ❌ INCORRECTO: Función que hace demasiadas cosas
function procesarTrabajador(cuil: string): Observable<Trabajador> {
  // Valida
  if (!this.validarCUIL(cuil)) throw new Error('CUIL inválido');
  
  // Formatea
  const cuilFormateado = this.formatearCUIL(cuil);
  
  // Busca
  return this.http.get<Trabajador>(`${this.api}/trabajadores/${cuilFormateado}`).pipe(
    // Transforma
    map(trabajador => this.normalizarDatos(trabajador)),
    // Guarda en cache
    tap(trabajador => this.cache.set(cuil, trabajador)),
    // Notifica
    tap(() => this.notificar('Trabajador cargado'))
  );
}
```

### Cuándo NO Dividir (Evitar Sobreingeniería)

```typescript
// ✅ ACEPTABLE: Función simple, no necesita división
function calcularEdad(fechaNacimiento: Date): number {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
    edad--;
  }
  return edad;
}

// ❌ SOBREINGENIERÍA: Dividir algo tan simple
function calcularEdad(fechaNacimiento: Date): number {
  const diferenciaAnios = this.calcularDiferenciaAnios(fechaNacimiento);
  const ajuste = this.calcularAjustePorMes(fechaNacimiento);
  return diferenciaAnios + ajuste;
}
```

---

## Principio #3: Early Returns (Guard Clauses)

Usar retornos tempranos para evitar anidamiento excesivo. Manejar casos excepcionales primero.

### Patrón Recomendado

```typescript
// ✅ CORRECTO: Early returns
function procesarSiniestro(siniestro: Siniestro | null): ResultadoProceso {
  if (!siniestro) {
    return ResultadoProceso.error('Siniestro no proporcionado');
  }

  if (!siniestro.esValido) {
    return ResultadoProceso.error('Siniestro inválido');
  }

  if (siniestro.estaCerrado) {
    return ResultadoProceso.error('Siniestro ya cerrado');
  }

  // Lógica principal sin anidamiento
  const resultado = this.ejecutarProceso(siniestro);
  return ResultadoProceso.exito(resultado);
}
```

```typescript
// ❌ INCORRECTO: Anidamiento profundo
function procesarSiniestro(siniestro: Siniestro | null): ResultadoProceso {
  if (siniestro) {
    if (siniestro.esValido) {
      if (!siniestro.estaCerrado) {
        const resultado = this.ejecutarProceso(siniestro);
        return ResultadoProceso.exito(resultado);
      } else {
        return ResultadoProceso.error('Siniestro ya cerrado');
      }
    } else {
      return ResultadoProceso.error('Siniestro inválido');
    }
  } else {
    return ResultadoProceso.error('Siniestro no proporcionado');
  }
}
```

### Nivel Máximo de Anidamiento: 2-3 Niveles

```typescript
// ✅ CORRECTO: Máximo 2 niveles
siniestros.forEach(siniestro => {
  if (siniestro.esActivo) {
    this.procesarActivo(siniestro);
  }
});

// ❌ INCORRECTO: Demasiados niveles
siniestros.forEach(siniestro => {
  if (siniestro.esActivo) {
    if (siniestro.tieneDocumentos) {
      siniestro.documentos.forEach(doc => {
        if (doc.esValido) {
          if (doc.tipo === 'DNI') {
            // 5 niveles de anidamiento = muy difícil de leer
          }
        }
      });
    }
  }
});
```

---

## Principio #4: Evitar Magic Numbers y Strings

Usar constantes con nombres descriptivos en lugar de valores literales.

### Cuándo Aplicar

- Valores que se repiten
- Valores con significado de negocio
- Configuraciones

### Cuándo NO Aplicar (Evitar Sobreingeniería)

- Valores obvios usados una sola vez (ej: `array.length - 1`)
- Índices de arrays en contexto claro
- Valores matemáticos obvios (`* 2`, `/ 100`)

```typescript
// ✅ CORRECTO: Constantes significativas
const DIAS_MAXIMOS_LICENCIA = 365;
const PORCENTAJE_DESCUENTO_AFILIADO = 0.15;
const ESTADO_SINIESTRO_ACTIVO = 'ACT';

if (diasLicencia > DIAS_MAXIMOS_LICENCIA) {
  throw new Error('Excede días máximos');
}

// ✅ ACEPTABLE: Valor obvio en contexto
const ultimoElemento = array[array.length - 1];
const porcentaje = valor / 100;

// ❌ INCORRECTO: Magic numbers sin contexto
if (diasLicencia > 365) { }
if (estado === 'ACT') { }
if (descuento > 0.15) { }
```

---

## Principio #5: DRY - Don't Repeat Yourself

### Cuándo Aplicar (Regla del 3)

Extraer código duplicado cuando aparece **3 o más veces**.

```typescript
// ✅ CORRECTO: Extraer después de 3 repeticiones
function formatearFechaParaApi(fecha: Date): string {
  return fecha.toISOString().split('T')[0];
}

// Uso en múltiples lugares
const fechaInicio = formatearFechaParaApi(siniestro.fechaInicio);
const fechaCierre = formatearFechaParaApi(siniestro.fechaCierre);
const fechaNotificacion = formatearFechaParaApi(siniestro.fechaNotificacion);
```

### Cuándo NO Aplicar

Si el código es similar pero con **diferencias semánticas**, mantenerlo separado:

```typescript
// ✅ ACEPTABLE: Similar pero distinto propósito
function validarCUILTrabajador(cuil: string): boolean {
  // Validación específica para trabajadores
  return cuil.startsWith('20') || cuil.startsWith('27');
}

function validarCUILEmpleador(cuit: string): boolean {
  // Validación específica para empleadores
  return cuit.startsWith('30') || cuit.startsWith('33');
}

// ❌ SOBREINGENIERÍA: Unificar cosas distintas
function validarCUIL(cuil: string, tipo: 'trabajador' | 'empleador'): boolean {
  // Ahora la función conoce demasiado sobre el contexto
}
```

---

## Principio #6: Comentarios

### Cuándo SÍ Comentar

```typescript
// ✅ CORRECTO: Comentarios que explican el "por qué"

/** 
 * Se usa un timeout de 3 segundos porque el servicio de SRT
 * tiene un delay conocido en respuestas grandes.
 * Ticket: #1234
 */
const TIMEOUT_SRT = 3000;

// Workaround para bug en versión 2.3 de la librería
// TODO: Remover cuando actualicemos a v3.0
this.resetearEstado();
```

### Cuándo NO Comentar

```typescript
// ❌ INCORRECTO: Comentarios obvios que repiten el código

// Incrementa el contador
contador++;

// Obtiene el siniestro por ID
function obtenerSiniestroPorId(id: string) { }

// Verifica si es válido
if (esValido) { }
```

### JSDoc para APIs Públicas

```typescript
/**
 * Obtiene los siniestros activos de un empleador.
 * @param empleadorId - ID del empleador (CUIT sin guiones)
 * @returns Observable con lista de siniestros ordenados por fecha
 * @throws Error si el empleador no existe
 */
function obtenerSiniestrosActivos(empleadorId: string): Observable<Siniestro[]> {
  // ...
}
```

---

## Checklist de Revisión

Antes de hacer commit, verificar según la complejidad del cambio:

### Cambios Simples (1-2 archivos)
- [ ] Nombres descriptivos en español/spanglish del proyecto
- [ ] Sin magic numbers evidentes
- [ ] Funciones no superan 30 líneas

### Cambios Medianos (feature pequeño)
- [ ] Todo lo anterior
- [ ] Early returns donde aplique
- [ ] Código duplicado extraído (regla del 3)
- [ ] Máximo 2-3 niveles de anidamiento

### Cambios Grandes (feature completo)
- [ ] Todo lo anterior
- [ ] Single Responsibility en funciones
- [ ] JSDoc en APIs públicas
- [ ] Constantes para valores de negocio

---

## Resumen: Cuándo SÍ y Cuándo NO

| Principio | Aplicar Siempre | Evaluar Complejidad |
|-----------|-----------------|---------------------|
| Nombres descriptivos | ✅ | - |
| Early returns | ✅ | - |
| Evitar magic numbers | - | ⚠️ Solo si se repite o tiene significado |
| DRY | - | ⚠️ Regla del 3 |
| Funciones pequeñas | - | ⚠️ Si >30 líneas |
| Abstracciones/Interfaces | - | ⚠️ Solo si hay extensibilidad real |
| Patrones de diseño | - | ⚠️ Solo en código complejo |
