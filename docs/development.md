# Desarrollo

## Requisitos

- **Node.js** 18+ (probado con 22)
- **npm** 9+ (viene con Node)
- Cualquier sistema operativo. El proyecto está pensado para correr localmente.

## Setup inicial

```bash
git clone https://github.com/EtcGonza/control-gastos.git
cd control-gastos
npm install
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm start` | Server de dev en `http://localhost:4200` con HMR |
| `npm run build` | Build de producción a `dist/control-gastos/` |
| `npm run watch` | Build de development con watch |
| `npm test` | (No hay tests escritos todavía) |

## Estructura del proyecto

Ver [arquitectura](./architecture.md#estructura-de-carpetas).

## Stack y versiones

| Paquete | Versión |
|---------|---------|
| `@angular/core` | ^21.2.0 |
| `@angular/cli` | ^21.2.13 |
| `@angular/build` | ^21.2.13 |
| `tailwindcss` | ^4.1.7 |
| `@tailwindcss/postcss` | ^4.1.7 |
| `typescript` | ~5.9.2 |

## Conexiones externas

La app hace peticiones HTTP a:

- `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/{YYYY}/{MM}/{DD}` – cotización del dólar oficial para una fecha puntual.
- `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial` – fallback con histórico completo cuando una fecha puntual falla.

Estas peticiones se hacen client-side con `fetch`. No necesitan API key. Si el endpoint falla, la app sigue funcionando con el último TC conocido o sin conversión (los montos USD quedan como tales).

También se cargan fuentes desde `https://fonts.googleapis.com` (Orbitron, VT323, Playfair Display, Bangers, Bowlby One). Si el usuario está offline, los temas custom mostrarán fonts de fallback del sistema.

## Estilos

Tailwind v4 se configura vía `@import "tailwindcss"` en `src/styles.css`. No hay archivo `tailwind.config.js` — la configuración va inline si es necesaria.

Los temas custom (synthwave, vaporwave, pop art) son archivos CSS separados que se importan desde `styles.css`:

```css
@import "tailwindcss";
@import "./synthwave-theme.css";
@import "./vaporwave-theme.css";
@import "./popart-theme.css";
```

Cada tema usa selectores con su propia clase raíz (`.synthwave`, `.vaporwave`, `.popart`) para overridear las utility classes de Tailwind con `!important`. El tema "classic" no usa clase — es el default de Tailwind.

Ver [feature de temas](./features/themes.md) para detalles del sistema.

## Build de producción

```bash
npm run build
```

Output en `dist/control-gastos/browser/`. Es una SPA: serví los archivos estáticos desde cualquier servidor (Nginx, Apache, Netlify, Vercel, GitHub Pages, etc.).

El bundle inicial está en ~1.6 MB sin gzippear (~400 KB gzippeado). La mayor parte es el runtime de Angular.

## Agregar una nueva feature

1. Si la feature tiene estado propio, agregalo al `TransactionsService` con un signal privado y expuesto como `asReadonly()`.
2. Si tiene persistencia, sumá una clave nueva en `STORAGE_KEY` constants y agregá los `persist()` / `load()` correspondientes.
3. Si tiene UI, creá un componente nuevo en `src/app/components/{feature-name}/`.
4. Importá el componente en `app.ts` y agregalo al layout en `app.html`.
5. Documentá la feature en `docs/features/{feature-name}.md`.

## Agregar un nuevo tema visual

1. Creá un archivo `src/{theme-name}-theme.css`.
2. Definí las variables CSS y los overrides bajo `:root.{theme-name} ...` (con `!important`).
3. Si necesitás fuentes, agregalas al `<link>` de Google Fonts en `src/index.html`.
4. Importá el CSS en `src/styles.css`.
5. Sumá el tema a `AVAILABLE_THEMES` en `theme.service.ts` con nombre, descripción y swatch.
6. Sumá el id al union type `Theme` y a `THEME_CLASSES`.

Ver [feature de temas](./features/themes.md).

## Issues conocidos

- **EPERM al buildear desde mount FUSE**: si el repo está en un filesystem mount con permisos restringidos (típico de algunos entornos sandbox), `ng build` muestra "EPERM: operation not permitted, unlink ..." al final del build. El bundle se genera correctamente, sólo falla la limpieza del favicon temporal. Ignorar.
- **Fetch de cotizaciones bloqueado por CORS**: el endpoint de argentinadatos.com responde con CORS abierto, pero si en algún momento cambia esto, la conversión USD dejaría de funcionar. Plan de contingencia: agregar override manual de TC en el servicio (ya está parcialmente implementado vía `setManualRate`).
- **Cuotas que abarcan el cambio de regulación impositiva**: una compra USD pre-Dic 2024 con 18 cuotas tiene cuotas cuyos cierres caen en períodos con distinto recargo. El sistema aplica el recargo correcto para cada cuota individualmente, según la fecha del cierre. Verificado.

## Git

Repositorio: https://github.com/EtcGonza/control-gastos

Convención de commits (Angular/Conventional Commits):

```
feat(modulo): descripción corta
fix(modulo): descripción corta
docs(modulo): descripción corta
refactor(modulo): descripción corta
```

Ejemplos:
- `feat(subs): historial de precios con vigencia`
- `fix(cuotas): clamping de día de cierre en febrero`
- `docs(arquitectura): explicar uso de signals`
