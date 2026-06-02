/**
 * tariffEngine.js — BijliCut
 * ---------------------------------------------------------------------------
 * Framework-agnostic billing math for Pakistani residential electricity bills.
 * Pure functions only — no React, no DOM, no native components. Safe to import
 * anywhere in the React Native / Expo app (e.g. screens, hooks, tests).
 *
 * ⚠️  All rates, fixed charges and taxes are INDICATIVE and change frequently
 *     via NEPRA notifications and monthly Fuel Cost Adjustments (FCA).
 *     Treat the exported tables as defaults and override them per DISCO/notice.
 * ---------------------------------------------------------------------------
 */

/**
 * Protected "lifeline" slabs. Applicable ONLY to consumers whose consumption
 * stays at/below 200 units consistently (per NEPRA's 6-month rule). Telescopic
 * per-unit energy rates plus a fixed monthly capacity charge.
 *
 * @type {Slab[]}
 */
export const PROTECTED_SLABS = [
  { min: 1, max: 100, rate: 7.74, fixed: 200, label: '1–100' },
  { min: 101, max: 200, rate: 10.06, fixed: 300, label: '101–200' },
];

/**
 * Unprotected tiers. Higher base per-unit rates with a fixed load charge that
 * scales up from Rs. 275 to Rs. 675 across consumption brackets.
 *
 * @type {Slab[]}
 */
export const UNPROTECTED_SLABS = [
  { min: 1, max: 100, rate: 13.48, fixed: 275, label: '1–100' },
  { min: 101, max: 200, rate: 18.95, fixed: 350, label: '101–200' },
  { min: 201, max: 300, rate: 22.14, fixed: 425, label: '201–300' },
  { min: 301, max: 400, rate: 25.53, fixed: 500, label: '301–400' },
  { min: 401, max: 500, rate: 28.49, fixed: 575, label: '401–500' },
  { min: 501, max: 600, rate: 29.78, fixed: 625, label: '501–600' },
  { min: 601, max: 700, rate: 32.03, fixed: 650, label: '601–700' },
  { min: 701, max: Infinity, rate: 42.72, fixed: 675, label: '701+' },
];

/** Default General Sales Tax applied on the energy charge. */
export const DEFAULT_GST_RATE = 0.18;

/* ───────────────────────── Solar constants ─────────────────────────────── */

/** Approx. monthly units generated per 1 kW of installed solar in Pakistan. */
export const UNITS_PER_KW_PER_MONTH = 125;

/** Wattage of a single modern solar panel (W). */
export const SOLAR_PANEL_WATTAGE = 550;

/** Turnkey system cost band per kW — structure, inverter & net-metering (Rs). */
export const COST_PER_KW_LOW = 150000;
export const COST_PER_KW_HIGH = 175000;

/**
 * Blended effective tariff (Rs/unit, incl. taxes & surcharges) used to convert
 * a monthly bill back into approximate units. Solar adopters are typically
 * higher-usage unprotected consumers, hence a mid-high blended rate. Override
 * via the options argument if you have a more accurate figure.
 */
export const DEFAULT_EFFECTIVE_TARIFF = 55;

/**
 * @typedef {Object} Slab
 * @property {number} min   Lower bound of the bracket (inclusive).
 * @property {number} max   Upper bound of the bracket (inclusive; may be Infinity).
 * @property {number} rate  Per-unit energy rate in Rs.
 * @property {number} fixed Fixed monthly capacity/load charge in Rs.
 * @property {string} label Human-readable bracket label, e.g. "201–300".
 */

const round2 = (n) => Math.round(n * 100) / 100;
const round1 = (n) => Math.round(n * 10) / 10;
const roundTo = (n, step) => Math.round(n / step) * step;

/**
 * Locate the slab a given unit count falls into.
 * @param {number} units
 * @param {Slab[]} slabs
 * @returns {Slab | null}
 */
function findSlab(units, slabs) {
  if (units <= 0) return null;
  return slabs.find((s) => units >= s.min && units <= s.max) || slabs[slabs.length - 1];
}

/**
 * Core charge computation for a single month of consumption against one slab
 * table. Energy is billed telescopically (each unit at its own slab's rate);
 * the fixed charge is taken from the bracket the total consumption lands in.
 *
 * @param {number} units
 * @param {Slab[]} slabs
 * @param {{ gstRate?: number, fuelAdjustment?: number }} [opts]
 * @returns {{
 *   energyCharge: number,
 *   fixedCharge: number,
 *   fuelAdjustment: number,
 *   tax: number,
 *   totalCost: number,
 *   slab: Slab | null,
 *   breakdown: Array<{ range: string, units: number, rate: number, amount: number }>
 * }}
 */
function computeCharges(units, slabs, opts = {}) {
  const gstRate = opts.gstRate ?? DEFAULT_GST_RATE;
  const perUnitFuel = opts.fuelAdjustment ?? 0; // Rs/unit FCA, optional

  const breakdown = [];
  let energyCharge = 0;
  let remaining = units;

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const slabWidth = slab.max === Infinity ? remaining : slab.max - slab.min + 1;
    const unitsInSlab = Math.min(remaining, slabWidth);
    const amount = unitsInSlab * slab.rate;

    breakdown.push({
      range: slab.label,
      units: unitsInSlab,
      rate: slab.rate,
      amount: round2(amount),
    });

    energyCharge += amount;
    remaining -= unitsInSlab;
  }

  const slab = findSlab(units, slabs);
  const fixedCharge = slab ? slab.fixed : 0;
  const fuelAdjustment = perUnitFuel * units;
  const tax = (energyCharge + fuelAdjustment) * gstRate;
  const totalCost = energyCharge + fuelAdjustment + fixedCharge + tax;

  return {
    energyCharge: round2(energyCharge),
    fixedCharge: round2(fixedCharge),
    fuelAdjustment: round2(fuelAdjustment),
    tax: round2(tax),
    totalCost: round2(totalCost),
    slab,
    breakdown,
  };
}

/**
 * Build the "Smart Saving Tip": exactly how many units to cut to fall into the
 * next lower bracket, and how much that would save per month.
 *
 * @param {number} units
 * @param {Slab[]} slabs
 * @param {string} modeLabel    "Protected" | "Unprotected"
 * @param {object} opts         Charge options (gstRate, fuelAdjustment).
 * @param {number} currentTotal Already-computed total for `units`.
 * @returns {{
 *   applicable: boolean,
 *   unitsToCut: number,
 *   targetUnits: number,
 *   targetSlabLabel: string | null,
 *   estimatedSaving: number,
 *   message: string
 * }}
 */
function buildSavingTip(units, slabs, modeLabel, opts, currentTotal) {
  const idx = slabs.findIndex((s) => units >= s.min && units <= s.max);

  // Already in the cheapest bracket (or no consumption) — nothing to suggest.
  if (idx <= 0) {
    return {
      applicable: false,
      unitsToCut: 0,
      targetUnits: units,
      targetSlabLabel: idx === 0 ? slabs[0].label : null,
      estimatedSaving: 0,
      message:
        units <= 0
          ? 'Enter your monthly units to see a personalised saving tip.'
          : `You're already in the lowest ${modeLabel.toLowerCase()} bracket (${slabs[0].label} units). Nicely done!`,
    };
  }

  const targetUnits = slabs[idx - 1].max; // top of the next-lower bracket
  const unitsToCut = units - targetUnits;
  const targetTotal = computeCharges(targetUnits, slabs, opts).totalCost;
  const estimatedSaving = round2(currentTotal - targetTotal);

  return {
    applicable: estimatedSaving > 0,
    unitsToCut,
    targetUnits,
    targetSlabLabel: slabs[idx - 1].label,
    estimatedSaving,
    message:
      `Cut ${unitsToCut} unit${unitsToCut === 1 ? '' : 's'} (down to ${targetUnits}) to drop ` +
      `into the ${slabs[idx - 1].label} bracket and save about Rs. ` +
      `${estimatedSaving.toLocaleString('en-PK')} per month.`,
  };
}

/**
 * Estimate a Pakistani residential electricity bill and return a structured
 * layout, including the active slab label and a Smart Saving Tip.
 *
 * @param {number} monthlyUnits           Units consumed this month (kWh).
 * @param {Object} [variables]            Calculated/contextual variables.
 * @param {boolean} [variables.isProtected=false]  Whether the consumer qualifies
 *        for protected lifeline rates (NEPRA: ≤200 units sustained for 6 months).
 *        Automatically ignored if monthlyUnits > 200.
 * @param {number} [variables.gstRate=0.18]        GST applied to energy + FCA.
 * @param {number} [variables.fuelAdjustment=0]    Per-unit FCA in Rs/unit.
 * @returns {{
 *   monthlyUnits: number,
 *   isProtected: boolean,
 *   currency: 'PKR',
 *   slabLabel: string,
 *   energyCharge: number,
 *   fixedCharge: number,
 *   fuelAdjustment: number,
 *   tax: number,
 *   totalCost: number,
 *   breakdown: Array<{ range: string, units: number, rate: number, amount: number }>,
 *   smartSavingTip: ReturnType<typeof buildSavingTip>
 * }}
 */
export function calculateBill(monthlyUnits, variables = {}) {
  const units = Math.max(0, Math.floor(Number(monthlyUnits) || 0));

  const opts = {
    gstRate: variables.gstRate ?? DEFAULT_GST_RATE,
    fuelAdjustment: variables.fuelAdjustment ?? 0,
  };

  // Protected status only holds at/below 200 units. Above that, NEPRA bills the
  // month at unprotected rates regardless of historical eligibility.
  const wantsProtected = Boolean(variables.isProtected);
  const isProtected = wantsProtected && units <= 200;

  const slabs = isProtected ? PROTECTED_SLABS : UNPROTECTED_SLABS;
  const modeLabel = isProtected ? 'Protected' : 'Unprotected';

  const charges = computeCharges(units, slabs, opts);
  const slabLabel = charges.slab
    ? `${modeLabel} · ${charges.slab.label} units`
    : `${modeLabel} · no consumption`;

  const smartSavingTip = buildSavingTip(units, slabs, modeLabel, opts, charges.totalCost);

  return {
    monthlyUnits: units,
    isProtected,
    currency: 'PKR',
    slabLabel,
    energyCharge: charges.energyCharge,
    fixedCharge: charges.fixedCharge,
    fuelAdjustment: charges.fuelAdjustment,
    tax: charges.tax,
    totalCost: charges.totalCost,
    breakdown: charges.breakdown,
    smartSavingTip,
  };
}

/**
 * Estimate a rooftop solar setup from a consumer's average monthly bill.
 *
 * Method:
 *   1. Convert the bill → approximate monthly units via a blended tariff.
 *   2. Size the system: units ÷ {@link UNITS_PER_KW_PER_MONTH} kW.
 *   3. Derive panel count from {@link SOLAR_PANEL_WATTAGE}.
 *   4. Cost the system across the Rs.150k–175k/kW band.
 *   5. Payback = investment ÷ monthly saving (a well-sized system offsets
 *      effectively the whole bill), reported in months and years.
 *
 * @param {number} averageBillRs        Average monthly bill in Rs. (use summer).
 * @param {Object} [options]
 * @param {number} [options.effectiveTariff]  Rs/unit blended rate for bill→units.
 * @returns {{
 *   averageBillRs: number,
 *   currency: 'PKR',
 *   estimatedMonthlyUnits: number,
 *   systemSizeKw: number,
 *   panels: number,
 *   panelWattage: number,
 *   investmentLow: number,
 *   investmentHigh: number,
 *   investmentEstimate: number,
 *   monthlySaving: number,
 *   paybackMonths: number,
 *   paybackYears: number,
 *   paybackRange: { minMonths: number, maxMonths: number }
 * }}
 */
export function calculateSolarSetup(averageBillRs, options = {}) {
  const bill = Math.max(0, Number(averageBillRs) || 0);
  const effectiveTariff = options.effectiveTariff ?? DEFAULT_EFFECTIVE_TARIFF;

  // Empty / zero bill → nothing to size.
  if (bill <= 0) {
    return {
      averageBillRs: 0,
      currency: 'PKR',
      estimatedMonthlyUnits: 0,
      systemSizeKw: 0,
      panels: 0,
      panelWattage: SOLAR_PANEL_WATTAGE,
      investmentLow: 0,
      investmentHigh: 0,
      investmentEstimate: 0,
      monthlySaving: 0,
      paybackMonths: 0,
      paybackYears: 0,
      paybackRange: { minMonths: 0, maxMonths: 0 },
    };
  }

  const estimatedMonthlyUnits = bill / effectiveTariff;

  const rawKw = estimatedMonthlyUnits / UNITS_PER_KW_PER_MONTH;
  const systemSizeKw = Math.max(0.5, round1(rawKw)); // round to 0.1 kW, floor 0.5
  const panels = Math.max(1, Math.ceil((systemSizeKw * 1000) / SOLAR_PANEL_WATTAGE));

  const investmentLow = roundTo(systemSizeKw * COST_PER_KW_LOW, 1000);
  const investmentHigh = roundTo(systemSizeKw * COST_PER_KW_HIGH, 1000);
  const investmentEstimate = roundTo((investmentLow + investmentHigh) / 2, 1000);

  // A correctly-sized system offsets essentially the full monthly bill.
  const monthlySaving = bill;
  const paybackMonths = Math.ceil(investmentEstimate / monthlySaving);
  const paybackYears = round1(paybackMonths / 12);

  return {
    averageBillRs: Math.round(bill),
    currency: 'PKR',
    estimatedMonthlyUnits: Math.round(estimatedMonthlyUnits),
    systemSizeKw,
    panels,
    panelWattage: SOLAR_PANEL_WATTAGE,
    investmentLow,
    investmentHigh,
    investmentEstimate,
    monthlySaving: Math.round(monthlySaving),
    paybackMonths,
    paybackYears,
    paybackRange: {
      minMonths: Math.ceil(investmentLow / monthlySaving),
      maxMonths: Math.ceil(investmentHigh / monthlySaving),
    },
  };
}

export default calculateBill;
