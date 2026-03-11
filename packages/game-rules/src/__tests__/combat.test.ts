import { describe, it, expect } from 'vitest';
import { resolveLandCombat } from '../combat/resolver.js';
import { SeededRNG } from '@ww3/game-math';
import type { UnitState } from '@ww3/shared-types';

function makeUnit(id: string, nation: string, strength: number, morale: number): UnitState {
  return {
    id,
    definitionId: 'UNIT_INFANTRY',
    nation,
    province: 'PRV_000001',
    hex: { q: 0, r: 0, s: 0 },
    strength,
    experience: 50,
    morale,
    supplyLevel: 100,
    status: 'active',
    entrenched: 0,
  };
}

describe('resolveLandCombat', () => {
  it('attacker with huge advantage tends to win', () => {
    const wins: number[] = [];
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const result = resolveLandCombat({
        attackerNation: 'USA',
        defenderNation: 'PRK',
        provinceId: 'PRV_000001',
        attackerUnits: [makeUnit('a1', 'USA', 100, 100), makeUnit('a2', 'USA', 100, 100), makeUnit('a3', 'USA', 100, 100)],
        defenderUnits: [makeUnit('d1', 'PRK', 30, 30)],
        terrain: 'plains',
        airModifier: 1.2,
        supplyModifier: 1.0,
      }, rng);
      if (result.provinceCaptured) wins.push(1);
    }
    // Should win >70% of the time with 3:1 advantage
    expect(wins.length).toBeGreaterThan(70);
  });

  it('defender advantage in mountains', () => {
    const rng = new SeededRNG(42);
    const result = resolveLandCombat({
      attackerNation: 'USA',
      defenderNation: 'CHN',
      provinceId: 'PRV_000205',
      attackerUnits: [makeUnit('a1', 'USA', 100, 100)],
      defenderUnits: [makeUnit('d1', 'CHN', 100, 100)],
      terrain: 'mountain',
      airModifier: 1.0,
      supplyModifier: 1.0,
    }, rng);
    // Defender has terrain advantage — attacker should suffer more
    expect(result.attackerCasualtyRate).toBeGreaterThan(result.defenderCasualtyRate);
  });

  it('deterministic — same seed same result', () => {
    const attackers = [makeUnit('a1', 'USA', 80, 80)];
    const defenders = [makeUnit('d1', 'RUS', 80, 80)];
    const params = {
      attackerNation: 'USA' as const,
      defenderNation: 'RUS' as const,
      provinceId: 'PRV_000001' as const,
      attackerUnits: attackers,
      defenderUnits: defenders,
      terrain: 'plains' as const,
      airModifier: 1.0,
      supplyModifier: 1.0,
    };
    const r1 = resolveLandCombat(params, new SeededRNG(999));
    const r2 = resolveLandCombat(params, new SeededRNG(999));
    expect(r1.outcome).toBe(r2.outcome);
    expect(r1.attackerCasualtyRate).toBe(r2.attackerCasualtyRate);
  });
});
