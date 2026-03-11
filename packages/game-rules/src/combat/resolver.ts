import type { UnitState, ProvinceState, NationId, ProvinceId } from '@ww3/shared-types';
import type { SeededRNG } from '@ww3/game-math';

export interface CombatParams {
  attackerNation: NationId;
  defenderNation: NationId;
  provinceId: ProvinceId;
  attackerUnits: UnitState[];
  defenderUnits: UnitState[];
  terrain: ProvinceState['terrain'];
  airModifier: number;    // 1.0 = parity, >1 = attacker favored
  supplyModifier: number; // 0.5–1.0
}

export interface CombatResult {
  outcome: 'attacker_repelled' | 'attacker_breakthrough' | 'defender_routed' | 'stalemate';
  attackerCasualtyRate: number;
  defenderCasualtyRate: number;
  provinceCaptured: boolean;
  newAttackerUnits: UnitState[];
  newDefenderUnits: UnitState[];
}

const TERRAIN_DEFENSE_MODIFIER: Record<string, number> = {
  mountain: 1.40,
  urban: 1.60,
  forest: 1.25,
  plains: 1.00,
  desert: 0.90,
  coastal: 1.10,
  arctic: 1.20,
  water: 0.80,
  radioactive: 0.95,
};

/** Compute effective fighting strength sum across a unit array */
function computeStrength(units: UnitState[], statKey: 'softAttack' | 'defense'): number {
  // We don't have unit definitions here, use strength/morale as proxy
  // softAttack proxy = strength * morale * 0.3 (normalized)
  // defense proxy = strength * morale * 0.25 (normalized)
  const multiplier = statKey === 'softAttack' ? 0.3 : 0.25;
  return units.reduce((sum, u) => {
    if (u.status === 'destroyed') return sum;
    return sum + (u.strength / 100) * (u.morale / 100) * multiplier * 100;
  }, 0);
}

export function resolveLandCombat(params: CombatParams, rng: SeededRNG): CombatResult {
  const { attackerUnits, defenderUnits, terrain, airModifier, supplyModifier } = params;

  const terrainMod = TERRAIN_DEFENSE_MODIFIER[terrain] ?? 1.0;

  let attackStr = computeStrength(attackerUnits, 'softAttack') * supplyModifier * airModifier;
  let defendStr = computeStrength(defenderUnits, 'defense') * terrainMod;

  // Avoid division by zero
  attackStr = Math.max(attackStr, 0.01);
  defendStr = Math.max(defendStr, 0.01);

  // Lanchester Square Law casualty rates
  const BASE_K_A = 0.05; // attacker lethality (defender casualties)
  const BASE_K_B = 0.04; // defender lethality (attacker casualties)

  let attackerCasRate = BASE_K_B * defendStr / attackStr;
  let defenderCasRate = BASE_K_A * attackStr / defendStr;

  // Cap at 40% and add ±20% randomness
  const randA = 1 + (rng.next() - 0.5) * 0.4;
  const randD = 1 + (rng.next() - 0.5) * 0.4;
  attackerCasRate = Math.min(0.40, attackerCasRate * randA);
  defenderCasRate = Math.min(0.40, defenderCasRate * randD);

  // Determine outcome
  let outcome: CombatResult['outcome'];
  let provinceCaptured = false;

  if (defenderCasRate > 0.35) {
    outcome = 'defender_routed';
    provinceCaptured = true;
  } else if (attackerCasRate > defenderCasRate * 2) {
    outcome = 'attacker_repelled';
  } else if (attackStr > defendStr * 1.5 && defenderCasRate > 0.20) {
    outcome = 'attacker_breakthrough';
    provinceCaptured = true;
  } else {
    outcome = 'stalemate';
  }

  // Apply casualties to units
  const newAttackerUnits = applyUnitCasualties(attackerUnits, attackerCasRate, rng);
  const newDefenderUnits = applyUnitCasualties(defenderUnits, defenderCasRate, rng);

  return { outcome, attackerCasualtyRate: attackerCasRate, defenderCasualtyRate: defenderCasRate, provinceCaptured, newAttackerUnits, newDefenderUnits };
}

function applyUnitCasualties(units: UnitState[], casualtyRate: number, rng: SeededRNG): UnitState[] {
  return units.map(unit => {
    if (unit.status === 'destroyed') return unit;
    const unitCas = casualtyRate * (0.8 + rng.next() * 0.4); // ±20% per unit
    const newStrength = Math.max(0, unit.strength * (1 - unitCas));
    const moraleDrop = unitCas > 0.25 ? 15 : unitCas > 0.15 ? 8 : 3;
    return {
      ...unit,
      strength: Math.round(newStrength * 10) / 10,
      morale: Math.max(0, unit.morale - moraleDrop),
      status: newStrength <= 5 ? ('destroyed' as const) : newStrength < 20 ? ('retreating' as const) : unit.status,
    };
  });
}
