import type { GameState, NationId, GameEvent } from '@ww3/shared-types';

/**
 * Resolve alliance chain triggers when aggressorNation attacks victimNation.
 * Returns updated state with triggered war declarations.
 */
export function resolveAllianceTriggers(
  state: GameState,
  aggressorNation: NationId,
  victimNation: NationId,
  rng: { next(): number },
): GameState {
  const victim = state.nations[victimNation];
  if (!victim) return state;

  let updatedState = state;
  const triggered: NationId[] = [];

  // Find nations with mutual_defense agreement with victim (up to 3 chain levels)
  const processed = new Set<NationId>([aggressorNation, victimNation]);
  const queue: [NationId, number][] = [[victimNation, 0]];

  while (queue.length > 0) {
    const [currentVictim, depth] = queue.shift()!;
    if (depth >= 3) continue; // Max 3 chain levels

    for (const [, rel] of Object.entries(state.diplomaticMatrix)) {
      if (rel.toNation !== currentVictim) continue;
      const allyId = rel.fromNation;
      if (processed.has(allyId)) continue;

      const hasMutualDefense = rel.agreements.some(
        a => (a.type === 'mutual_defense' || a.type === 'alliance') && a.isActive,
      );
      if (!hasMutualDefense) continue;

      // Check war exhaustion — 70% base honor chance, reduced by war exhaustion
      const ally = state.nations[allyId];
      if (!ally) continue;
      const honorChance = 0.70 - (ally.warExhaustion / 200);
      if (rng.next() > honorChance) continue; // Ally refuses

      triggered.push(allyId);
      processed.add(allyId);
      queue.push([allyId, depth + 1]);
    }
  }

  // Apply war declarations
  for (const allyId of triggered) {
    const newEvent: GameEvent = {
      type: 'DIPLOMACY',
      tick: state.clock.strategyTick,
      nationA: allyId,
      nationB: aggressorNation,
      action: 'alliance_triggered_war',
      result: 'forced',
      notes: `Alliance with ${victimNation} triggered war declaration`,
    };

    // Update diplomatic matrix
    const matrix = { ...updatedState.diplomaticMatrix };
    const key = `${allyId}:${aggressorNation}`;
    if (matrix[key]) {
      matrix[key] = { ...matrix[key]!, status: 'war' };
    }
    const reverseKey = `${aggressorNation}:${allyId}`;
    if (matrix[reverseKey]) {
      matrix[reverseKey] = { ...matrix[reverseKey]!, status: 'war' };
    }

    updatedState = {
      ...updatedState,
      diplomaticMatrix: matrix,
      globalTension: Math.min(100, updatedState.globalTension + 5),
      events: [...updatedState.events, newEvent],
    };
  }

  return updatedState;
}
