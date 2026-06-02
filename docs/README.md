# Documentación – Control de Gastos

Aplicación web de finanzas personales para llevar el control de ingresos, gastos, suscripciones y compras con tarjeta de crédito en Argentina. Persiste todo en el navegador (localStorage), sin backend.

## Índice

### Documentos transversales

- [Arquitectura técnica](./architecture.md) – stack, signals, organización de carpetas, build.
- [Modelo de datos](./data-model.md) – todas las entidades y sus relaciones.
- [Reglas de negocio](./business-logic.md) – lógica de día de cierre, conversión USD, recargos.
- [Persistencia](./persistence.md) – claves de localStorage, formato.
- [Desarrollo](./development.md) – setup, comandos, requisitos.

### Documentación por funcionalidad

- [Transacciones manuales](./features/transactions.md) – alta de ingresos y gastos sueltos.
- [Fijos guardados](./features/recurring-templates.md) – plantillas de movimientos recurrentes.
- [Tarjetas de crédito](./features/credit-cards.md) – alta y edición de tarjetas.
- [Compras con tarjeta](./features/card-purchases.md) – compras con cuotas.
- [Suscripciones](./features/subscriptions.md) – cargos recurrentes con historial de precios.
- [Conversión USD ↔ ARS](./features/usd-conversion.md) – cotización, recargos por tipo.
- [Vista mensual](./features/monthly-view.md) – métricas, filtros, ordenamiento.
- [Datos / Respaldo](./features/data-backup.md) – export / import / borrar todo.
- [Temas](./features/themes.md) – clásico, synthwave, vaporwave, pop art.

## Características clave

- **Persistencia local**: todo en `localStorage`. No requiere backend. No sincroniza entre dispositivos.
- **Multi-moneda con conversión real**: las compras y suscripciones en USD se convierten a ARS usando el dólar oficial vendedor del día de cierre (consultado vía [argentinadatos.com](https://argentinadatos.com)).
- **Recargos según fecha**: el sistema aplica los impuestos que regían a la fecha del cierre (60% pre-Dic 2024, 30% Dic 2024 a Ene 2026, 0% post). Además permite marcar manualmente compras de servicios digitales (21% IVA), turísticas (30%) o pago directo en USD (sin conversión).
- **Soporte de cuotas y suscripciones**: las cuotas se generan virtualmente cada mes según el día de cierre de la tarjeta. Suscripciones con historial de precios y baja/reactivación.
- **Cuatro temas visuales**: Clásico, Synthwave, Vaporwave y Pop Art. El elegido se persiste en localStorage.

## Stack técnico

- **Frontend**: [Angular 21](https://angular.dev) (standalone components + signals + new control flow).
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com) con custom variants para los temas.
- **Fuentes**: Google Fonts (Orbitron, VT323, Playfair Display, Bangers, Bowlby One).
- **Persistencia**: `localStorage` del navegador.
- **API externa**: [api.argentinadatos.com](https://argentinadatos.com) para cotizaciones del dólar oficial.

## Estructura general del proyecto

```
src/
├── app/
│   ├── components/        # Componentes UI (ver docs/features/*)
│   ├── models/            # Tipos e interfaces
│   ├── services/          # Servicios singleton
│   ├── app.html           # Layout principal
│   ├── app.ts             # Componente raíz
│   └── app.config.ts      # Configuración global
├── styles.css             # Tailwind + imports de temas
├── synthwave-theme.css    # Override CSS para tema synthwave
├── vaporwave-theme.css    # Override CSS para tema vaporwave
├── popart-theme.css       # Override CSS para tema pop art
└── index.html             # Carga de fuentes
docs/                      # ← esta documentación
```

## Convenciones de la app

- **Mes seleccionado**: la app siempre trabaja sobre un mes (formato `YYYY-MM`) que se cambia desde el header. Todas las métricas y listas se filtran por ese mes.
- **Moneda principal**: ARS. USD se trata como secundaria y se convierte automáticamente, salvo cuando el usuario marca "Pago el resumen en USD".
- **Categorías**:
  - Gastos: Alquiler, Servicios, Alimentos, Transporte, Salud, Entretenimiento, Suscripciones, Otros.
  - Ingresos: Sueldo, Horas extras, Otros.
- **Fechas**: ISO `YYYY-MM-DD` siempre. Comparaciones lexicográficas sobre strings.

Para empezar, leé [Arquitectura técnica](./architecture.md) y después navegá las features que te interesen.
