# Temas visuales

Cuatro temas: **Clásico**, **Synthwave**, **Vaporwave** y **Pop Art**. La elección se persiste por navegador.

## Ubicación en la UI

- **Theme picker**: `<app-theme-picker>` en el header (botón con ícono de paleta de pintor). Click abre dropdown con las cuatro opciones, cada una con swatch de colores y descripción corta.

Archivos:
- Servicio: `src/app/services/theme.service.ts`
- Componente: `src/app/components/theme-picker/`
- CSS por tema: `src/synthwave-theme.css`, `src/vaporwave-theme.css`, `src/popart-theme.css`
- Importado desde: `src/styles.css`

## Cómo funciona el sistema

### `ThemeService`

```ts
type Theme = 'classic' | 'synthwave' | 'vaporwave' | 'popart';
```

Mantiene un signal con el tema activo. Persiste en `localStorage` (`control-gastos:theme`).

Un `effect()` en el constructor sincroniza la clase de `<html>`:

```ts
effect(() => {
  const t = this._theme();
  const root = document.documentElement;
  // Saca todas las clases de tema y aplica la actual (classic = ninguna)
  ['synthwave', 'vaporwave', 'popart'].forEach((cls) => root.classList.remove(cls));
  if (t !== 'classic') root.classList.add(t);
});
```

Default: `'classic'` si no hay nada persistido.

### Override CSS

Cada tema custom tiene un archivo CSS dedicado con todas sus reglas bajo selectores que empiezan con la clase del tema:

```css
.synthwave body { ... }
.synthwave .bg-white { ... !important; }
.synthwave button.bg-indigo-600 { ... !important; }
```

Los `!important` son necesarios para ganarle a las utility classes de Tailwind, que tienen alta especificidad inherente.

El tema clásico **no tiene archivo CSS dedicado**: es simplemente el resultado de Tailwind sin overrides.

### Carga de fuentes

Las fuentes para los temas custom se cargan en `src/index.html` vía Google Fonts:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?
  family=Bangers&
  family=Bowlby+One&
  family=Bowlby+One+SC&
  family=Orbitron:wght@400;500;700;900&
  family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,700;1,900&
  family=VT323&
  display=swap">
```

Se cargan siempre, aplican sólo cuando el tema activo las usa. Costo: ~80 KB pero permite switching instantáneo entre temas.

## Tema Clásico

Default. Es lo que ves al instalar la app.

- Fondo: gradiente claro azul-violáceo.
- Cards: blanco con bordes y sombras suaves.
- Acentos: indigo + violeta para primarios, verde/rojo para semánticos.
- Fuente del sistema (`-apple-system, BlinkMacSystemFont, ...`).

## Tema Synthwave

Estética 80s neón con grilla en perspectiva.

- Fondo: gradiente de negro profundo a violeta vibrante, con resplandor rosado central.
- Grilla en perspectiva en la mitad inferior (CSS `transform: perspective() rotateX()`).
- Scanlines sutiles encima de todo (`mix-blend-mode: multiply`).
- Cards: violeta translúcido con `backdrop-filter: blur()` y bordes rosa con glow.
- Texto con glow: `text-shadow: 0 0 8px currentColor`.
- Fuente headings: **Orbitron** (futurista).
- Fuente montos: **VT323** (LCD/terminal).
- Iconos SVG con `filter: drop-shadow()` neón.
- Animación pulsante en el icono del header.

## Tema Vaporwave

Estética 90s pastel con vibe Greek/marble.

- Fondo: gradiente pastel rosa → lavanda → cian + resplandor amarillo en una esquina.
- Grilla sutil cuadrada (40px) en violeta translúcido.
- Cards: glass rosáceo con `backdrop-filter: blur()` saturado.
- Texto con triple shadow (cian + rosa + lavanda) para efecto "chromatic aberration".
- Fuente: **Playfair Display** (serif elegante). Italic para los montos grandes.
- Botones: gradient pink→lavender / cyan→lavender, sin bordes duros.
- Iconos con drop-shadow violeta suave.
- Animación de hue-rotate en el icono del header.

## Tema Pop Art

Estética comic book con halftones y bordes negros gruesos.

- Fondo: crema con **halftone dots** rojos y azules (doble radial-gradient repetido).
- Cards: blanco con borde negro 3px y **sombra dura offset** (`4px 4px 0 0 black`).
- Texto con outline negro (`-webkit-text-stroke`).
- Acentos: rojo (#ff2d2d), azul cobalto (#0066cc), amarillo (#ffe600), rosa (#ff5599).
- Botones: borde negro grueso, color primario fuerte, sombra hard offset. Hover los hunde con transform translate + sombra reducida.
- Fuente headings: **Bangers** (estilo "BAM!"). Resto: **Bowlby One / Bowlby One SC** (chunky).
- SVG con stroke aumentado a 2.5 y drop-shadow negro (estilo tinta).
- Scrollbar custom con bordes negros, scrollbar thumb rojo.

## Theme picker

Dropdown con las cuatro opciones. Cada fila muestra:

- 4 cuadritos de color (swatch).
- Nombre del tema en bold.
- Descripción corta.
- ✓ check si es el activo.

Click en cualquier fila aplica el tema y cierra el dropdown. La selección se aplica al instante (sin recargar la página) porque el `effect()` del servicio reacciona inmediatamente.

Click afuera o tecla Escape cierra el dropdown sin cambiar nada.

## Tooltips y z-index en temas neón

Los temas custom crean **stacking contexts** en las cards (con `position: relative; z-index: 1` para que aparezcan por encima de los fondos decorativos). Esto puede tapar tooltips que se desbordan de una card.

Workaround: cada tema tiene reglas `:has()` para subir el z-index de una card cuando contiene un tooltip activo:

```css
.synthwave .bg-white:has(.info-badge:hover),
.synthwave .bg-white:has(.info-badge.active),
.synthwave .bg-white:has(.tooltip.visible),
.synthwave .group.bg-white:hover {
  z-index: 50 !important;
}
```

Esto requiere browser con `:has()` (Chrome 105+, Safari 15.4+, Firefox 121+). En navegadores muy viejos, los tooltips pueden quedar tapados en los temas custom (no crítico).

## Agregar un nuevo tema

Ver [development.md](../development.md#agregar-un-nuevo-tema-visual).
