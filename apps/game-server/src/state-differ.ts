export interface GameStateDelta {
  tick: number;
  changedProvinces: Record<string, Record<string, unknown>>;
  changedNations: Record<string, Record<string, unknown>>;
  changedUnits: Record<string, Record<string, unknown>>;
  removedUnits: string[];
  addedUnits: string[];
  globalTension: number;
  nuclearWinterProgress: number;
  events: unknown[];
}

type GameStateSnapshot = {
  clock: { strategyTick: number };
  provinces: Record<string, unknown>;
  nations: Record<string, unknown>;
  units: Record<string, unknown>;
  globalTension: number;
  nuclearWinterProgress: number;
  events: unknown[];
};

/** Compute a minimal delta — only changed fields are included. */
export function diffGameState(prev: GameStateSnapshot, next: GameStateSnapshot): GameStateDelta {
  const delta: GameStateDelta = {
    tick: next.clock.strategyTick,
    changedProvinces: {},
    changedNations: {},
    changedUnits: {},
    removedUnits: [],
    addedUnits: [],
    globalTension: next.globalTension,
    nuclearWinterProgress: next.nuclearWinterProgress,
    events: next.events,
  };

  type R = Record<string, unknown>;

  // Province diffs
  for (const [id, nextPRaw] of Object.entries(next.provinces)) {
    const nextP = nextPRaw as R;
    const prevP = prev.provinces[id] as R | undefined;
    if (!prevP) { delta.changedProvinces[id] = nextP; continue; }
    const changes: R = {};
    for (const key of ['controlledBy', 'stability', 'suppression', 'isRadioactive', 'radiationLevel', 'population'] as const) {
      if (prevP[key] !== nextP[key]) changes[key] = nextP[key];
    }
    if (Object.keys(changes).length > 0) delta.changedProvinces[id] = changes;
  }

  // Nation diffs
  for (const [id, nextNRaw] of Object.entries(next.nations)) {
    const nextN = nextNRaw as R;
    const prevN = prev.nations[id] as R | undefined;
    if (!prevN) { delta.changedNations[id] = nextN; continue; }
    const changes: R = {};
    for (const key of ['gdp', 'stability', 'warExhaustion', 'nuclearWarheads', 'defconLevel', 'globalReputation'] as const) {
      if (prevN[key] !== nextN[key]) changes[key] = nextN[key];
    }
    if (JSON.stringify(prevN['stockpile']) !== JSON.stringify(nextN['stockpile'])) {
      changes['stockpile'] = nextN['stockpile'];
    }
    if (Object.keys(changes).length > 0) delta.changedNations[id] = changes;
  }

  // Unit diffs
  const prevIds = new Set(Object.keys(prev.units));
  const nextIds = new Set(Object.keys(next.units));

  for (const id of nextIds) {
    if (!prevIds.has(id)) {
      delta.addedUnits.push(id);
      delta.changedUnits[id] = next.units[id] as R;
    } else {
      const prevU = prev.units[id] as R;
      const nextU = next.units[id] as R;
      const changes: R = {};
      for (const key of ['province', 'strength', 'morale', 'status', 'supplyLevel'] as const) {
        if (prevU[key] !== nextU[key]) changes[key] = nextU[key];
      }
      if (Object.keys(changes).length > 0) delta.changedUnits[id] = changes;
    }
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) delta.removedUnits.push(id);
  }

  return delta;
}
