import type { GameState, NationId, AgreementType, GameEvent } from '@ww3/shared-types';

export function createAgreement(
  state: GameState,
  nationA: NationId,
  nationB: NationId,
  type: AgreementType,
  durationTicks?: number,
): GameState {
  const key = `${nationA}:${nationB}`;
  const reverseKey = `${nationB}:${nationA}`;
  const matrix = { ...state.diplomaticMatrix };

  const agreement = {
    type,
    signedTick: state.clock.strategyTick,
    expiresTick: durationTicks ? state.clock.strategyTick + durationTicks : undefined,
    isActive: true,
  };

  const relAB = matrix[key];
  const relBA = matrix[reverseKey];

  if (relAB) {
    matrix[key] = { ...relAB, agreements: [...relAB.agreements, agreement] };
  }
  if (relBA) {
    matrix[reverseKey] = { ...relBA, agreements: [...relBA.agreements, agreement] };
  }

  return { ...state, diplomaticMatrix: matrix };
}

export function expireAgreements(state: GameState): GameState {
  const currentTick = state.clock.strategyTick;
  const matrix = { ...state.diplomaticMatrix };
  const newEvents: GameEvent[] = [];

  for (const [key, rel] of Object.entries(matrix)) {
    const updatedAgreements = rel.agreements.map(agreement => {
      if (agreement.isActive && agreement.expiresTick !== undefined && currentTick >= agreement.expiresTick) {
        newEvents.push({
          type: 'DIPLOMACY',
          tick: currentTick,
          nationA: rel.fromNation,
          nationB: rel.toNation,
          action: `${agreement.type}_expired`,
          result: 'accepted',
        });
        return { ...agreement, isActive: false };
      }
      return agreement;
    });
    matrix[key] = { ...rel, agreements: updatedAgreements };
  }

  return { ...state, diplomaticMatrix: matrix, events: [...state.events, ...newEvents] };
}

export function violateAgreement(
  state: GameState,
  violatingNation: NationId,
  type: AgreementType,
): GameState {
  const nations = { ...state.nations };
  const violator = nations[violatingNation];
  if (violator) {
    nations[violatingNation] = {
      ...violator,
      globalReputation: Math.max(-100, violator.globalReputation - 20),
    };
  }

  // Deactivate agreement in diplomatic matrix
  const matrix = { ...state.diplomaticMatrix };
  for (const [key, rel] of Object.entries(matrix)) {
    if (rel.fromNation !== violatingNation && rel.toNation !== violatingNation) continue;
    const agreements = rel.agreements.map(a =>
      a.type === type && a.isActive ? { ...a, isActive: false } : a,
    );
    matrix[key] = { ...rel, agreements };
  }

  const newEvent: GameEvent = {
    type: 'DIPLOMACY',
    tick: state.clock.strategyTick,
    nationA: violatingNation,
    nationB: 'UNK' as NationId,
    action: `violated_${type}`,
    result: 'forced',
  };

  return { ...state, nations, diplomaticMatrix: matrix, events: [...state.events, newEvent] };
}
