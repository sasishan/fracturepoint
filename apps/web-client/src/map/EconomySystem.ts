/**
 * EconomySystem — derives game-relevant economic metrics from province data
 * and writes them back to Province.taxIncome.
 *
 * Tax income uses a rough global-average GDP-per-capita ($13 000) at a 20%
 * tax rate, scaled to per-turn game units (billions USD / turn).
 */

import type { Province } from './ProvinceClipper';

// ── Constants ─────────────────────────────────────────────────────────────────

const GDP_PER_CAPITA = 13_000;  // USD — rough world average
const TAX_RATE       = 0.20;    // 20 %

// ── Economy tier (for external use, e.g. renderer / UI) ──────────────────────

export type EconomyTier = 'minor' | 'regional' | 'major' | 'megacity';

export function tierFromPopulation(pop: number): EconomyTier {
  if (pop >= 5_000_000) return 'megacity';
  if (pop >= 1_000_000) return 'major';
  if (pop >= 200_000)   return 'regional';
  return 'minor';
}

export function strategicScore(pop: number): number {
  if (pop >= 10_000_000) return 10;
  if (pop >= 5_000_000)  return 9;
  if (pop >= 2_000_000)  return 8;
  if (pop >= 1_000_000)  return 7;
  if (pop >= 500_000)    return 5;
  if (pop >= 200_000)    return 3;
  return 1;
}

// ── EconomySystem ─────────────────────────────────────────────────────────────

export class EconomySystem {
  /**
   * Fill Province.taxIncome for every province in-place.
   * taxIncome = (population × GDP_PER_CAPITA × TAX_RATE) / 1e9
   * Result is in billions USD per turn (minimum 1).
   */
  enrich(provinces: Province[]): void {
    for (const p of provinces) {
      p.taxIncome = Math.max(1, Math.round(
        (p.population * GDP_PER_CAPITA * TAX_RATE) / 1e9,
      ));
    }
  }

  /** Recruitment capacity in thousands of troops per turn. */
  recruitment(p: Province): number {
    return Math.max(0, Math.round(p.population * 0.01 / 1_000));
  }
}
