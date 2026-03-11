import type { GameState, GameAction, NationId } from '@ww3/shared-types';
import { SeededRNG } from '@ww3/game-math';
import { simulateEconomyTick } from './economy/simulator.js';
import { applySupplyAttrition } from './military/supply.js';
import { expireAgreements } from './diplomacy/agreements.js';
import { simulateTechResearch } from './tech/tree.js';
import { updateDEFCON, resolveMissileFlight } from './nuclear/arsenal.js';
import { applyNuclearWinter } from './nuclear/effects.js';
import { checkVictoryConditions } from './victory.js';

/**
 * THE single entry point for all game logic.
 * Pure function: same inputs → same outputs.
 * No I/O, no network, no side effects.
 * Server calls this every 200ms (strategy tick).
 */
export function processTick(state: GameState, actions: GameAction[]): GameState {
  const rng = new SeededRNG(state.rngState);

  // Clear this-tick events
  let s = { ...state, events: [] };

  // 1. Advance game clock
  s = advanceClock(s);

  // 2. Process player actions
  for (const action of actions) {
    s = applyAction(s, action, rng);
  }

  // 3. Simulation subsystems (order matters)
  s = simulateEconomyTick(s, rng);
  s = applySupplyAttrition(s);
  s = expireAgreements(s);
  s = simulateTechResearch(s);
  s = updateDEFCON(s);
  s = applyNuclearWinter(s);
  s = checkVictoryConditions(s);

  // 4. Persist RNG state for determinism
  return { ...s, rngState: rng.getState() };
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function advanceClock(state: GameState): GameState {
  const tick = state.clock.strategyTick + 1;
  const totalDays = state.clock.gameDay + 1;
  const year = 2026 + Math.floor(totalDays / 365);
  const dayOfYear = totalDays % 365;
  const month = Math.min(12, Math.floor(dayOfYear / 30) + 1);

  return {
    ...state,
    clock: { ...state.clock, strategyTick: tick, gameDay: totalDays, gameYear: year, gameMonth: month as typeof state.clock.gameMonth },
  };
}

// ── Action Dispatcher ─────────────────────────────────────────────────────────

function applyAction(state: GameState, action: GameAction, _rng: SeededRNG): GameState {
  switch (action.type) {
    case 'MOVE_UNIT':         return applyMoveUnit(state, action);
    case 'ATTACK_PROVINCE':   return state; // resolved in military sim tick
    case 'TRAIN_UNIT':        return state; // added to production queue
    case 'RESEARCH_TECH':     return applyResearchTech(state, action);
    case 'DECLARE_DIPLOMACY': return applyDiplomacy(state, action);
    case 'PROPOSE_AGREEMENT': return state;
    case 'LAUNCH_NUCLEAR':    return state; // validated separately, queued as missile
    case 'SET_PRODUCTION':    return state;
    default:                  return state;
  }
}

function applyMoveUnit(state: GameState, action: { type: 'MOVE_UNIT'; unitId: string; targetProvince: string }): GameState {
  const unit = state.units[action.unitId];
  if (!unit) return state;
  return {
    ...state,
    units: {
      ...state.units,
      [action.unitId]: { ...unit, province: action.targetProvince, orderTarget: action.targetProvince, status: 'moving' },
    },
  };
}

function applyResearchTech(state: GameState, action: { type: 'RESEARCH_TECH'; techId: string }): GameState {
  // Find the player's nation
  const nation = Object.values(state.nations).find(n => n.isPlayerControlled);
  if (!nation) return state;
  return {
    ...state,
    nations: {
      ...state.nations,
      [nation.id as NationId]: { ...nation, currentResearch: action.techId, researchProgress: 0 },
    },
  };
}

function applyDiplomacy(state: GameState, action: { type: 'DECLARE_DIPLOMACY'; targetNation: NationId; action: string }): GameState {
  if (action.action === 'declare_war') {
    // Find acting nation
    const actorNation = Object.values(state.nations).find(n => n.isPlayerControlled);
    if (!actorNation) return state;

    const key = `${actorNation.id}:${action.targetNation}`;
    const reverseKey = `${action.targetNation}:${actorNation.id}`;
    const matrix = { ...state.diplomaticMatrix };

    if (matrix[key]) matrix[key] = { ...matrix[key]!, status: 'war' };
    if (matrix[reverseKey]) matrix[reverseKey] = { ...matrix[reverseKey]!, status: 'war' };

    return {
      ...state,
      diplomaticMatrix: matrix,
      globalTension: Math.min(100, state.globalTension + 10),
    };
  }
  return state;
}

// Re-export for backwards compatibility / tree-shaking
export { resolveMissileFlight };
