import type { GameState, ProvinceId, NationId } from '@ww3/shared-types';

/**
 * Trace supply from a unit's province back to nearest friendly supply depot.
 * Returns supply level 0–100.
 */
export function traceSupplyLine(
  unitProvince: ProvinceId,
  unitNation: NationId,
  state: GameState,
): number {
  const province = state.provinces[unitProvince];
  if (!province) return 0;

  // If in own territory with good infrastructure → full supply
  if (province.controlledBy === unitNation) {
    if (province.infrastructure.roads >= 3) return 100;
    if (province.infrastructure.roads >= 1) return 85;
    return 70;
  }

  // BFS to find nearest friendly province
  const visited = new Set<ProvinceId>([unitProvince]);
  const queue: Array<[ProvinceId, number]> = [[unitProvince, 0]];
  let minDistToFriendly = Infinity;
  let crossedHostile = false;

  while (queue.length > 0) {
    const [current, dist] = queue.shift()!;
    if (dist > 6) break; // Max supply range

    const currentProvince = state.provinces[current];
    if (!currentProvince) continue;

    if (currentProvince.controlledBy === unitNation && dist > 0) {
      minDistToFriendly = Math.min(minDistToFriendly, dist);
      break;
    }

    // Check if crossing hostile territory
    const controller = currentProvince.controlledBy;
    const relation = state.diplomaticMatrix[`${unitNation}:${controller}`];
    if (relation?.status === 'war' || relation?.status === 'hostile') {
      crossedHostile = true;
    }

    for (const adjId of currentProvince.adjacentProvinces) {
      if (!visited.has(adjId)) {
        visited.add(adjId);
        queue.push([adjId, dist + 1]);
      }
    }
  }

  if (minDistToFriendly === Infinity) return 10; // Out of supply

  let supply = 100 - minDistToFriendly * 10;
  if (crossedHostile) supply -= 40;

  return Math.max(0, Math.min(100, supply));
}

/**
 * Apply supply attrition to out-of-supply units.
 */
export function applySupplyAttrition(state: GameState): GameState {
  const units = { ...state.units };

  for (const [id, unit] of Object.entries(units)) {
    if (unit.status === 'destroyed') continue;
    if (unit.supplyLevel < 10) {
      // 1% strength attrition per tick when out of supply
      units[id] = {
        ...unit,
        strength: Math.max(0, unit.strength - 1),
        morale: Math.max(0, unit.morale - 2),
        status: unit.strength <= 5 ? 'destroyed' : unit.status,
      };
    }
  }

  return { ...state, units };
}
