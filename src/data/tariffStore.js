/**
 * tariffStore.js — BijliCut
 * ---------------------------------------------------------------------------
 * Offline-first tariff data layer.
 *
 *   • Supabase client (read-only, anon key) for the `tariff_rates` table.
 *   • AsyncStorage cache get/set primitives.
 *   • Bundled fallback (re-exported) for the first-ever offline launch.
 *
 * The A/B/C orchestration (instant cache → background fetch → adopt-if-newer)
 * lives in App.js's init useEffect; this module just exposes the building
 * blocks. Every network path fails soft (returns null) so the UI never blocks.
 * ---------------------------------------------------------------------------
 */
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FALLBACK_TARIFFS, FALLBACK_EFFECTIVE_DATE } from './fallbackTariffs';

// Publishable (anon) credentials — safe to ship in a client; RLS restricts
// access to read-only SELECT on tariff_rates.
const SUPABASE_URL = 'https://druxbksscacocuclnzxs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydXhia3NzY2Fjb2N1Y2xuenhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTMyOTQsImV4cCI6MjA3NzMyOTI5NH0._tlLjLoBVwI2hFKqpLFupERMN2ouvyDc-JG1rf574u0';

const CACHE_KEY = 'bijlicut.tariff_rates.v1';
const FETCH_TIMEOUT_MS = 8000;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // No auth/session needed for anonymous public reads.
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Map a raw DB row (snake_case) into the engine-facing camelCase shape. */
function mapRow(r) {
  return {
    disco: r.regional_disco,
    consumerType: r.consumer_type,
    slabRange: r.slab_range,
    slabMin: r.slab_min,
    slabMax: r.slab_max, // null = open-ended top band
    rate: Number(r.base_rate),
    fixedCharge: Number(r.fixed_charge),
    fuelAdjustment: Number(r.fuel_adjustment),
    surcharge: Number(r.surcharge),
    effectiveDate: r.effective_date,
  };
}

/** The newest effective_date across a set of rows (ISO strings compare lexically). */
export function latestEffectiveDate(rows) {
  return (rows || []).reduce(
    (max, r) => (r.effectiveDate > max ? r.effectiveDate : max),
    ''
  );
}

/**
 * Read cached tariffs from AsyncStorage.
 * @returns {Promise<{ rows: object[], version: string } | null>}
 */
export async function getCachedTariffs() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows) || !parsed.rows.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist tariffs to AsyncStorage for the next (possibly offline) launch. */
export async function saveCachedTariffs(payload) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal: app keeps working with in-memory rows.
  }
}

/**
 * Background fetch of the latest rows from Supabase. Fails soft: returns null
 * on offline / timeout / error / empty so callers simply keep their cache.
 * @returns {Promise<{ rows: object[], version: string } | null>}
 */
export async function fetchRemoteTariffs() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .from('tariff_rates')
      .select(
        'regional_disco,consumer_type,slab_range,slab_min,slab_max,base_rate,fixed_charge,fuel_adjustment,surcharge,effective_date'
      )
      .abortSignal(controller.signal);

    if (error || !Array.isArray(data) || data.length === 0) return null;
    const rows = data.map(mapRow);
    return { rows, version: latestEffectiveDate(rows) };
  } catch {
    return null; // offline / aborted / unexpected
  } finally {
    clearTimeout(timer);
  }
}

export { FALLBACK_TARIFFS, FALLBACK_EFFECTIVE_DATE };
