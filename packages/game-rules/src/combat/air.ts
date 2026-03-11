import type { UnitState } from '@ww3/shared-types';
import type { SeededRNG } from '@ww3/game-math';

export interface AirCombatResult {
  airSuperiority: number; // -100 to +100, positive = attacker favored
  attackerLossFraction: number;
  defenderLossFraction: number;
  groundModifier: number; // multiplier for attacker in subsequent ground combat
}

export function computeAirSuperiority(
  attackerFighters: UnitState[],
  defenderFighters: UnitState[],
  defenderAAUnits: UnitState[],
  rng: SeededRNG,
): AirCombatResult {
  // Fighter effectiveness = strength * morale
  const attackerPower = attackerFighters.reduce((s, u) =>
    s + (u.strength / 100) * (u.morale / 100) * 50, 0);

  const defenderFighterPower = defenderFighters.reduce((s, u) =>
    s + (u.strength / 100) * (u.morale / 100) * 50, 0);

  // AA adds to defender air defense (at 40% efficiency vs fighters)
  const aaPower = defenderAAUnits.reduce((s, u) =>
    s + (u.strength / 100) * (u.morale / 100) * 20, 0);

  const totalDefenderPower = defenderFighterPower + aaPower;

  if (attackerPower === 0 && totalDefenderPower === 0) {
    return { airSuperiority: 0, attackerLossFraction: 0, defenderLossFraction: 0, groundModifier: 1.0 };
  }

  // Air superiority score: +100 = total attacker dominance
  const rand = (rng.next() - 0.5) * 20;
  const superiority = Math.max(-100, Math.min(100,
    ((attackerPower - totalDefenderPower) / Math.max(attackerPower + totalDefenderPower, 1)) * 100 + rand,
  ));

  // Losses: losers lose more
  const attackerLoss = superiority < 0
    ? 0.08 + Math.abs(superiority) / 1000
    : 0.03 + rng.next() * 0.03;
  const defenderLoss = superiority > 0
    ? 0.08 + superiority / 1000
    : 0.03 + rng.next() * 0.03;

  // Ground modifier
  let groundModifier = 1.0;
  if (superiority > 30) groundModifier = 1.20;
  else if (superiority > 60) groundModifier = 1.35;
  else if (superiority < -30) groundModifier = 0.85;
  else if (superiority < -60) groundModifier = 0.70;

  return {
    airSuperiority: superiority,
    attackerLossFraction: Math.min(0.30, attackerLoss),
    defenderLossFraction: Math.min(0.30, defenderLoss),
    groundModifier,
  };
}
