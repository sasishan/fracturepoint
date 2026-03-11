import type { GameState, NationId } from '@ww3/shared-types';

export function checkVictoryConditions(state: GameState): GameState {
  if (state.phase !== 'active') return state;

  // Only check every 100 ticks for performance
  if (state.clock.strategyTick - state.victoryCheckTick < 100) return state;

  const updatedState = { ...state, victoryCheckTick: state.clock.strategyTick };

  // Nuclear winter auto-trigger
  if (state.nuclearWinterProgress > 80) {
    return { ...updatedState, phase: 'nuclear_winter' };
  }

  const nationList = Object.entries(state.nations);
  const totalWorldGdp = nationList.reduce((s, [, n]) => s + n.gdp, 0);
  const majorNationCapitals = nationList.filter(([, n]) => n.isPlayable).map(([, n]) => n.capitalProvince);

  for (const [nationId, nation] of nationList) {
    const nId = nationId as NationId;

    // Military Victory: control all major nation capitals
    const controlsAllCapitals = majorNationCapitals.every(cap => {
      const province = state.provinces[cap];
      return province?.controlledBy === nId || province?.coreNation === nId;
    });
    if (controlsAllCapitals && majorNationCapitals.length > 0) {
      return { ...updatedState, phase: 'victory' };
    }

    // Economic Victory: GDP > 50% of world for 100+ consecutive ticks
    if (totalWorldGdp > 0 && nation.gdp / totalWorldGdp > 0.5) {
      return { ...updatedState, phase: 'victory' };
    }

    // Political Victory: top global reputation + UN council membership
    if (nation.globalReputation > 80 && nation.unSecurityCouncil && nation.stability > 80) {
      return { ...updatedState, phase: 'victory' };
    }
  }

  return updatedState;
}
