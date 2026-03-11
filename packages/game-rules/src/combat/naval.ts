import type { UnitState } from '@ww3/shared-types';
import type { SeededRNG } from '@ww3/game-math';

export interface NavalResult {
  seaZoneControl: 'attacker' | 'defender' | 'contested';
  attackerLossFraction: number;
  defenderLossFraction: number;
}

export function resolveNavalCombat(
  attackerFleet: UnitState[],
  defenderFleet: UnitState[],
  rng: SeededRNG,
): NavalResult {
  function fleetPower(fleet: UnitState[]): number {
    return fleet.reduce((s, u) => {
      if (u.status === 'destroyed') return s;
      const base = (u.strength / 100) * (u.morale / 100);
      // Submarines get bonus vs surface ships
      const isSubm = u.definitionId.includes('SUBMARINE') || u.definitionId.includes('SSN') || u.definitionId.includes('SSBN');
      const isCarrier = u.definitionId.includes('CARRIER') || u.definitionId.includes('CVN');
      return s + base * (isSubm ? 70 : isCarrier ? 40 : 50);
    }, 0);
  }

  // Carrier bonus: +20% to fleet effectiveness
  const attackerHasCarrier = attackerFleet.some(u => u.definitionId.includes('CARRIER'));
  const defenderHasCarrier = defenderFleet.some(u => u.definitionId.includes('CARRIER'));

  const attackPow = fleetPower(attackerFleet) * (attackerHasCarrier ? 1.20 : 1.0);
  const defendPow = fleetPower(defenderFleet) * (defenderHasCarrier ? 1.20 : 1.0);

  if (attackPow === 0 && defendPow === 0) {
    return { seaZoneControl: 'contested', attackerLossFraction: 0, defenderLossFraction: 0 };
  }

  const rand = (rng.next() - 0.5) * 0.2;
  const ratio = (attackPow + 0.01) / (defendPow + 0.01);

  const attackerLoss = Math.min(0.30, (0.05 / ratio) * (1 + rand));
  const defenderLoss = Math.min(0.30, 0.05 * ratio * (1 - rand));

  let seaZoneControl: NavalResult['seaZoneControl'];
  const attackerRemaining = attackPow * (1 - attackerLoss);
  const defenderRemaining = defendPow * (1 - defenderLoss);
  const totalRemaining = attackerRemaining + defenderRemaining;

  if (attackerRemaining / totalRemaining > 0.6) seaZoneControl = 'attacker';
  else if (defenderRemaining / totalRemaining > 0.6) seaZoneControl = 'defender';
  else seaZoneControl = 'contested';

  return { seaZoneControl, attackerLossFraction: attackerLoss, defenderLossFraction: defenderLoss };
}
