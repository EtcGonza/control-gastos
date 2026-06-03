/**
 * Endpoint público de cotizaciones oficiales (compra/venta del Banco Nación).
 * Devuelve histórico día por día. Se consulta con path `/YYYY/MM/DD`.
 */
export const USD_RATE_API_BASE =
  'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial';

/**
 * Umbrales históricos del recargo "auto" (Impuesto PAÍS + Ganancias) sobre
 * el dólar oficial vendedor cuando se paga con tarjeta argentina.
 *
 * Las fechas son ISO `YYYY-MM-DD` y representan el primer día EXCLUSIVO del
 * tramo: el recargo aplica para fechas `< límite`.
 */
export const USD_AUTO_SURCHARGE_THRESHOLDS = {
  /** < 2024-12-01 → 60% (PAÍS 30% + Ganancias 30%). */
  before: { until: '2024-12-01', pct: 0.6 },
  /** 2024-12-01 ↔ 2026-01-02 → 30% (sólo Ganancias). */
  middle: { until: '2026-01-02', pct: 0.3 },
  /** ≥ 2026-01-02 → 0% (sin recargo). */
  after: { pct: 0 },
} as const;

/** IVA de Servicios Digitales del exterior (Steam, Netflix, Spotify, etc.). */
export const USD_DIGITAL_SERVICE_VAT = 0.21;

/** Servicios turísticos pagados en pesos. */
export const USD_TOURISM_SURCHARGE = 0.3;
