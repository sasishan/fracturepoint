import type { GameAction, GameState, NationId } from '@ww3/shared-types';

const REPUTATION_CHANGES: Partial<Record<string, number>> = {
  declare_war: -20,
  nuclear_launch: -50,
  violated_treaty: -20,
  humanitarian_aid: 5,
  peace_offer_accepted: 10,
  sanctions_imposed: -5,
};

/**
 * Compute global reputation change from a player action.
 * Returns a map of NationId → rep delta that this action causes.
 */
export function computeReputationDelta(
  action: GameAction,
  actingNation: NationId,
  state: GameState,
): Map<NationId, number> {
  const deltas = new Map<NationId, number>();

  if (action.type === 'DECLARE_DIPLOMACY' && action.action === 'declare_war') {
    // Global penalty
    for (const nationId of Object.keys(state.nations)) {
      deltas.set(nationId as NationId, (deltas.get(nationId as NationId) ?? 0) - 20);
    }
    // Extra penalty in victim's allies
    const targetNation = action.targetNation;
    for (const [, rel] of Object.entries(state.diplomaticMatrix)) {
      if (rel.toNation === targetNation && (rel.status === 'allied' || rel.status === 'friendly')) {
        const existing = deltas.get(rel.fromNation) ?? -20;
        deltas.set(rel.fromNation, existing - 20); // extra -20
      }
    }
    // Acting nation itself
    deltas.set(actingNation, (deltas.get(actingNation) ?? -20) + 5); // slight boost to war hawks at home
  }

  if (action.type === 'LAUNCH_NUCLEAR') {
    for (const nationId of Object.keys(state.nations)) {
      deltas.set(nationId as NationId, (deltas.get(nationId as NationId) ?? 0) - 50);
    }
  }

  return deltas;
}

export function applyReputationDeltas(
  state: GameState,
  actingNation: NationId,
  deltas: Map<NationId, number>,
): GameState {
  const nations = { ...state.nations };
  const actor = nations[actingNation];
  if (!actor) return state;

  // Apply the global reputation change to the acting nation
  let totalGlobalDelta = 0;
  for (const [, delta] of deltas) {
    totalGlobalDelta += delta;
  }
  const avgDelta = deltas.size > 0 ? totalGlobalDelta / deltas.size : 0;

  nations[actingNation] = {
    ...actor,
    globalReputation: Math.max(-100, Math.min(100, actor.globalReputation + avgDelta)),
  };

  return { ...state, nations };
}
