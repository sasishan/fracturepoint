import type { GameState, ProvinceId, NationId } from '@ww3/shared-types';

/**
 * Compute which nation (if any) holds Zone of Control over a province.
 * Returns null if no single nation controls it (contested or empty).
 */
export function computeZoneOfControl(
  provinceId: ProvinceId,
  state: GameState,
): NationId | null {
  const province = state.provinces[provinceId];
  if (!province) return null;

  // Units in province assert ZoC
  const unitsInProvince = Object.values(state.units).filter(
    u => u.province === provinceId && u.status !== 'destroyed' && u.status !== 'retreating',
  );

  if (unitsInProvince.length === 0) return null;

  const nations = new Set(unitsInProvince.map(u => u.nation));
  if (nations.size > 1) return null; // Contested

  return [...nations][0] ?? null;
}

/**
 * Check if a nation's unit would be surrounded (all adjacent provinces in enemy ZoC).
 */
export function isUnitSurrounded(
  unitProvince: ProvinceId,
  unitNation: NationId,
  state: GameState,
): boolean {
  const province = state.provinces[unitProvince];
  if (!province) return false;

  for (const adjId of province.adjacentProvinces) {
    const zoc = computeZoneOfControl(adjId, state);
    if (!zoc || zoc === unitNation) return false; // Has an escape route
    const rel = state.diplomaticMatrix[`${unitNation}:${zoc}`];
    if (!rel || rel.status !== 'war') return false;
  }

  return province.adjacentProvinces.length > 0;
}
