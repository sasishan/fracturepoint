import type { GameState, ProvinceId, GameEvent, NationId } from '@ww3/shared-types';
import type { SeededRNG } from '@ww3/game-math';

const YIELD_RADIUS: Record<string, number> = {
  tactical: 1,
  strategic: 2,
  city_buster: 3,
};

const YIELD_UNIT_KILL: Record<string, number> = {
  tactical: 0.60,
  strategic: 0.90,
  city_buster: 1.00,
};

const YIELD_POP_KILL: Record<string, number> = {
  tactical: 0.20,
  strategic: 0.70,
  city_buster: 0.95,
};

export function resolveDetonation(
  state: GameState,
  targetProvinceId: ProvinceId,
  warheadYield: 'tactical' | 'strategic' | 'city_buster',
  rng: SeededRNG,
): GameState {
  const radius = YIELD_RADIUS[warheadYield] ?? 1;
  const provinces = { ...state.provinces };
  const units = { ...state.units };
  const nations = { ...state.nations };
  const events: GameEvent[] = [...state.events];

  // Find all affected provinces within radius using BFS
  const affectedProvinces = new Map<ProvinceId, number>(); // id → distance
  const queue: [ProvinceId, number][] = [[targetProvinceId, 0]];
  const visited = new Set<ProvinceId>([targetProvinceId]);

  while (queue.length > 0) {
    const [current, dist] = queue.shift()!;
    affectedProvinces.set(current, dist);
    if (dist >= radius) continue;

    const province = state.provinces[current];
    if (!province) continue;
    for (const adjId of province.adjacentProvinces) {
      if (!visited.has(adjId)) {
        visited.add(adjId);
        queue.push([adjId, dist + 1]);
      }
    }
  }

  let casualties = 0;

  for (const [provinceId, distance] of affectedProvinces) {
    const province = provinces[provinceId];
    if (!province) continue;

    // Damage drops with distance
    const damageMultiplier = Math.max(0, 1 - distance * 0.3);
    const popKillRate = (YIELD_POP_KILL[warheadYield] ?? 0.2) * damageMultiplier;
    const unitKillRate = (YIELD_UNIT_KILL[warheadYield] ?? 0.6) * damageMultiplier;

    const killedPop = Math.floor(province.population * popKillRate * (0.9 + rng.next() * 0.2));
    casualties += killedPop;

    provinces[provinceId] = {
      ...province,
      population: Math.max(0, province.population - killedPop),
      isRadioactive: true,
      radiationLevel: Math.min(10, (province.radiationLevel ?? 0) + (10 - distance * 3)),
      stability: Math.max(0, province.stability - 40 * damageMultiplier),
      infrastructure: {
        roads: Math.max(0, province.infrastructure.roads - Math.ceil(3 * damageMultiplier)) as 0|1|2|3|4|5,
        ports: Math.max(0, province.infrastructure.ports - Math.ceil(2 * damageMultiplier)),
        airports: Math.max(0, province.infrastructure.airports - Math.ceil(2 * damageMultiplier)),
        rail: Math.max(0, province.infrastructure.rail - Math.ceil(3 * damageMultiplier)) as 0|1|2|3|4|5,
        fortification: Math.max(0, province.infrastructure.fortification - Math.ceil(3 * damageMultiplier)) as 0|1|2|3|4|5,
      },
    };

    // Damage units in this province
    for (const [unitId, unit] of Object.entries(units)) {
      if (unit.province !== provinceId || unit.status === 'destroyed') continue;
      const unitDamage = unitKillRate * (0.8 + rng.next() * 0.4);
      units[unitId] = {
        ...unit,
        strength: Math.max(0, unit.strength * (1 - unitDamage)),
        status: unit.strength * (1 - unitDamage) <= 5 ? 'destroyed' : unit.status,
      };
    }
  }

  // Update global state
  let globalTension = Math.min(100, state.globalTension + (warheadYield === 'city_buster' ? 30 : warheadYield === 'strategic' ? 15 : 5));
  let nuclearWinterProgress = state.nuclearWinterProgress;
  if (warheadYield === 'city_buster') nuclearWinterProgress += 10;
  else if (warheadYield === 'strategic') nuclearWinterProgress += 4;
  else nuclearWinterProgress += 1;

  events.push({
    type: 'NUCLEAR',
    tick: state.clock.strategyTick,
    launchNation: 'UNK' as NationId, // caller should set this
    targetProvince: targetProvinceId,
    warheadYield,
    casualties,
    defconBefore: 2,
    defconAfter: 1,
    nuclearWinterProgress,
  });

  return {
    ...state,
    provinces,
    units,
    nations,
    events,
    globalTension,
    nuclearWinterProgress,
    totalNuclearDetonations: state.totalNuclearDetonations + 1,
  };
}

export function spreadRadiation(
  state: GameState,
  epicenterProvinceId: ProvinceId,
  intensity: number,
): GameState {
  const provinces = { ...state.provinces };
  const epicenter = provinces[epicenterProvinceId];
  if (!epicenter) return state;

  // Radiation spreads outward; reduce by 50% per ring
  const queue: [ProvinceId, number][] = [[epicenterProvinceId, intensity]];
  const visited = new Set<ProvinceId>([epicenterProvinceId]);

  while (queue.length > 0) {
    const [current, level] = queue.shift()!;
    if (level < 0.5) continue;

    const province = provinces[current];
    if (!province) continue;

    provinces[current] = {
      ...province,
      radiationLevel: Math.min(10, (province.radiationLevel ?? 0) + level),
      isRadioactive: true,
    };

    for (const adjId of province.adjacentProvinces) {
      if (!visited.has(adjId)) {
        visited.add(adjId);
        queue.push([adjId, level * 0.5]);
      }
    }
  }

  return { ...state, provinces };
}

export function applyNuclearWinter(state: GameState): GameState {
  if (state.nuclearWinterProgress < 50) return state;

  const nations = { ...state.nations };
  const severity = state.nuclearWinterProgress > 80 ? 2 : 1;

  for (const [id, nation] of Object.entries(nations)) {
    nations[id as NationId] = {
      ...nation,
      gdp: nation.gdp * (1 - 0.003 * severity), // -0.3% per tick at level 1
      stability: Math.max(0, nation.stability - 0.1 * severity),
    };
  }

  // Radiation decay on provinces
  const provinces = { ...state.provinces };
  for (const [id, province] of Object.entries(provinces)) {
    if (province.isRadioactive && (province.radiationLevel ?? 0) > 0) {
      const newLevel = Math.max(0, (province.radiationLevel ?? 0) - 0.01);
      provinces[id] = {
        ...province,
        radiationLevel: newLevel,
        isRadioactive: newLevel > 0.1,
        population: Math.max(0, province.population - Math.floor(province.population * 0.001 * (province.radiationLevel ?? 0))),
        stability: Math.max(0, province.stability - 0.05 * (province.radiationLevel ?? 0)),
      };
    }
  }

  const phase = state.nuclearWinterProgress > 80 && state.phase === 'active'
    ? ('nuclear_winter' as const)
    : state.phase;

  return { ...state, nations, provinces, phase };
}
