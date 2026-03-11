import type { GameState, NationId, ProvinceId } from '@ww3/shared-types';

export function updateDEFCON(state: GameState): GameState {
  const nations = { ...state.nations };
  let globalMinDefcon = 5;

  for (const [, nation] of Object.entries(state.nations)) {
    if (!nation.nuclearWarheads && !nation.unSecurityCouncil) continue;

    let defcon = 5;

    // DEFCON 4: conventional war between nuclear powers
    const isAtWar = Object.values(state.diplomaticMatrix).some(rel =>
      rel.fromNation === nation.id && rel.status === 'war',
    );
    if (isAtWar && nation.nuclearWarheads > 0) defcon = Math.min(defcon, 4);

    // DEFCON 3: capital province threatened
    const capital = state.provinces[nation.capitalProvince];
    if (capital && capital.controlledBy !== nation.id) defcon = Math.min(defcon, 3);

    // DEFCON 2: nuclear detonation has occurred
    if (state.totalNuclearDetonations > 0) defcon = Math.min(defcon, 2);

    // DEFCON 1: nuclear exchange ongoing
    if (state.totalNuclearDetonations > 5) defcon = Math.min(defcon, 1);

    globalMinDefcon = Math.min(globalMinDefcon, defcon);
  }

  // Update all nuclear nations to at least the global minimum
  for (const [id, nation] of Object.entries(nations)) {
    if (nation.nuclearWarheads > 0 || nation.unSecurityCouncil) {
      nations[id as NationId] = {
        ...nation,
        defconLevel: Math.min(nation.defconLevel, globalMinDefcon),
      };
    }
  }

  return { ...state, nations };
}

export function resolveMissileFlight(
  _fromProvince: ProvinceId,
  _toProvince: ProvinceId,
  deliverySystem: string,
): number {
  // Flight time in strategy ticks
  const flightTimes: Record<string, number> = {
    icbm: 15,
    slbm: 12,
    bomber: 30,
    tactical: 3,
    cruise_missile: 8,
  };
  return flightTimes[deliverySystem] ?? 10;
}
