/**
 * fallbackTariffs.js — BijliCut
 * ---------------------------------------------------------------------------
 * Bundled June 2026 baseline tariff rows. Used the very first time the app
 * launches with NO cache and NO network, so calculations always work offline.
 *
 * Shape mirrors the rows returned by the Supabase `tariff_rates` table (after
 * mapping to camelCase in tariffStore.js). Keep this in sync with the seed.
 * ---------------------------------------------------------------------------
 */
export const FALLBACK_EFFECTIVE_DATE = '2026-06-01';

// Per-DISCO adjustments (FCA Rs/unit + flat surcharge Rs).
const DISCOS = [
  { disco: 'LESCO', fuelAdjustment: 3.2, surcharge: 0 },
  { disco: 'IESCO', fuelAdjustment: 2.6, surcharge: 0 },
  { disco: 'FESCO', fuelAdjustment: 2.9, surcharge: 0 },
  { disco: 'KE', fuelAdjustment: 4.4, surcharge: 150 },
];

// National slab bands (rate Rs/unit + fixed charge Rs). slabMax null = open band.
const SLABS = [
  { consumerType: 'protected', slabRange: '1-100', slabMin: 1, slabMax: 100, rate: 7.74, fixedCharge: 200 },
  { consumerType: 'protected', slabRange: '101-200', slabMin: 101, slabMax: 200, rate: 10.06, fixedCharge: 300 },
  { consumerType: 'unprotected', slabRange: '1-100', slabMin: 1, slabMax: 100, rate: 13.48, fixedCharge: 275 },
  { consumerType: 'unprotected', slabRange: '101-200', slabMin: 101, slabMax: 200, rate: 18.95, fixedCharge: 350 },
  { consumerType: 'unprotected', slabRange: '201-300', slabMin: 201, slabMax: 300, rate: 22.14, fixedCharge: 425 },
  { consumerType: 'unprotected', slabRange: '301-400', slabMin: 301, slabMax: 400, rate: 25.53, fixedCharge: 500 },
  { consumerType: 'unprotected', slabRange: '401-500', slabMin: 401, slabMax: 500, rate: 28.49, fixedCharge: 575 },
  { consumerType: 'unprotected', slabRange: '501-600', slabMin: 501, slabMax: 600, rate: 29.78, fixedCharge: 625 },
  { consumerType: 'unprotected', slabRange: '601-700', slabMin: 601, slabMax: 700, rate: 32.03, fixedCharge: 650 },
  { consumerType: 'unprotected', slabRange: '701+', slabMin: 701, slabMax: null, rate: 42.72, fixedCharge: 675 },
];

/** Flattened rows: one per (DISCO × slab band) = 40 rows. */
export const FALLBACK_TARIFFS = DISCOS.flatMap((d) =>
  SLABS.map((s) => ({
    disco: d.disco,
    consumerType: s.consumerType,
    slabRange: s.slabRange,
    slabMin: s.slabMin,
    slabMax: s.slabMax,
    rate: s.rate,
    fixedCharge: s.fixedCharge,
    fuelAdjustment: d.fuelAdjustment,
    surcharge: d.surcharge,
    effectiveDate: FALLBACK_EFFECTIVE_DATE,
  }))
);
