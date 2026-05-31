# Control de Gastos

Aplicación en **Angular 21** + **Tailwind CSS 4** para llevar el control de tus ingresos y gastos mensuales.

## Funcionalidades

- Cargar **ingresos** (sueldo, freelance, inversiones, etc.) y **gastos** categorizados.
- Marcar transacciones como **fijas mensuales**.
- Selector de **mes** para ver el detalle por período.
- Tarjetas resumen: ingresos, gastos, **dinero que queda a fin de mes** y **% que se llevan los gastos fijos**.
- Desglose de gastos por categoría con barras de progreso.
- Persistencia local en el navegador (localStorage).

## Setup

> Importante: el `node_modules` incluido fue generado en otro entorno. Antes de correr el proyecto en tu Mac:

```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

Luego abrí http://localhost:4200

## Build de producción

```bash
npm run build
```

## Estructura

```
src/app/
  models/
    transaction.model.ts        # tipos, categorías, colores
  services/
    transactions.service.ts     # estado con signals + persistencia
  components/
    summary-cards/              # tarjetas resumen (ingresos, gastos, balance, %)
    transaction-form/           # alta de ingreso/gasto
    transaction-list/           # listado del mes
    category-breakdown/         # gastos por categoría
    month-selector/             # selector de mes
  app.ts / app.html             # dashboard principal
```
