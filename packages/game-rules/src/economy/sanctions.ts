import type { GameState, NationId } from '@ww3/shared-types';

export function computeSanctionEffect(state: GameState, nation: NationId): {
  gdpPenalty: number;
  tradeReduction: number;
  stabilityPenalty: number;
} {
  const n = state.nations[nation];
  if (!n) return { gdpPenalty: 1, tradeReduction: 1, stabilityPenalty: 0 };

  // Count how many nations are sanctioning this nation
  let sanctionerCount = 0;
  let p5Sanctioners = 0;
  for (const [, relation] of Object.entries(state.diplomaticMatrix)) {
    if (relation.toNation !== nation) continue;
    // Check if any agreements include sanctions (simplified: hostile = sanctioning)
  }

  // Simple: count hostile nations
  for (const [key, rel] of Object.entries(state.diplomaticMatrix)) {
    if (rel.toNation === nation && (rel.status === 'hostile' || rel.status === 'war')) {
      sanctionerCount++;
      const sanctioner = state.nations[rel.fromNation];
      if (sanctioner?.unSecurityCouncil) p5Sanctioners++;
    }
  }

  const gdpPenalty = Math.max(0.4, 1 - sanctionerCount * 0.05 - p5Sanctioners * 0.10);
  const tradeReduction = Math.max(0.2, 1 - sanctionerCount * 0.08);
  const stabilityPenalty = sanctionerCount * 0.5 + p5Sanctioners * 2;

  return { gdpPenalty, tradeReduction, stabilityPenalty };
}

export function applySanctions(
  state: GameState,
  sanctioningNation: NationId,
  targetNation: NationId,
): GameState {
  // Block all trade routes between the two nations
  const tradeRoutes = { ...state.tradeRoutes };
  for (const [id, route] of Object.entries(tradeRoutes)) {
    if (
      (route.fromNation === sanctioningNation && route.toNation === targetNation) ||
      (route.fromNation === targetNation && route.toNation === sanctioningNation)
    ) {
      tradeRoutes[id] = { ...route, isBlocked: true, blockedBy: sanctioningNation };
    }
  }

  // Reputation effects
  const nations = { ...state.nations };
  const target = nations[targetNation];
  if (target) {
    nations[targetNation] = {
      ...target,
      stability: Math.max(0, target.stability - 5),
      globalReputation: Math.max(-100, target.globalReputation - 10),
    };
  }

  return { ...state, tradeRoutes, nations };
}
