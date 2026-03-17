/**
 * DiplomacyStore — tracks nation-to-nation relations and diplomatic events.
 *
 * Relations are symmetric and keyed by sorted "A:B" strings.
 * States: 'peace' | 'war' | 'alliance'
 *
 * Truce system: after making peace, nations cannot re-declare war for 5 turns.
 * War exhaustion: accumulates from unit losses and turns at war.
 * Global Reputation: Aggression/Trust score per nation.
 */

import { create } from 'zustand';
import { useNotificationStore } from './NotificationStore';

export type RelationState = 'peace' | 'war' | 'alliance';

export interface DiplomacyEvent {
  id:   number;
  msg:  string;
  kind: 'war' | 'peace' | 'alliance';
  ts:   number;
}

export function relKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function reputationLabel(score: number): string {
  if (score >= 50)  return 'TRUSTED';
  if (score >= 10)  return 'COOPERATIVE';
  if (score >= -10) return 'NEUTRAL';
  if (score >= -50) return 'AGGRESSIVE';
  if (score >= -80) return 'DANGEROUS';
  return 'PARIAH';
}

export function reputationColor(score: number): string {
  if (score >= 50)  return '#3fb950';
  if (score >= 10)  return '#58a6ff';
  if (score >= -10) return '#cdd9e5';
  if (score >= -50) return '#e8a020';
  if (score >= -80) return '#cf4444';
  return '#ff0000';
}

let _evtId = 0;

const TRUCE_TURNS         = 5;
const PEACE_TURNS_REP     = 5;   // consecutive peace turns before +5 rep bonus
const REP_DECLARE_WAR     = -20;
const REP_BREAK_ALLIANCE  = -15;
const REP_CALL_ALLIES     = -5;
const REP_FORM_ALLIANCE   = 10;
const REP_ACCEPT_PEACE    = 5;
const REP_PEACE_STREAK    = 5;

interface DiplomacyStore {
  relations:    Map<string, RelationState>;
  events:       DiplomacyEvent[];
  /** relKey → turn number when truce expires */
  truces:       Map<string, number>;
  /** nation → war exhaustion score (unit losses + turns at war) */
  warExhaustion: Map<string, number>;
  /** nation → Global Reputation score */
  reputation:   Map<string, number>;
  /** nation → consecutive turns with zero active wars */
  peaceTurns:   Map<string, number>;

  reset(): void;
  initRelations(nations: string[]): void;
  getRelation(a: string, b: string): RelationState;
  isAtWar(a: string, b: string): boolean;
  canDeclareWar(a: string, b: string, currentTurn: number): boolean;
  inTruce(a: string, b: string, currentTurn: number): boolean;
  declareWar(from: string, to: string, provinceId?: number): void;
  makePeace(a: string, b: string, currentTurn: number): void;
  formAlliance(a: string, b: string): void;
  breakAlliance(a: string, b: string): void;
  getWarsOf(nation: string): string[];
  getAlliesOf(nation: string): string[];
  /** Called after Call Allies action — applies reputation penalty. */
  applyCallAlliesRep(nation: string): void;
  /** Accumulate war exhaustion from unit losses. */
  addWarExhaustion(nation: string, amount: number): void;
  getWarExhaustion(nation: string): number;
  getReputation(nation: string): number;
  /** Called each End Turn: expire truces, accumulate exhaustion, award peace rep. */
  tickDiplomacy(currentTurn: number): void;
}

export const useDiplomacyStore = create<DiplomacyStore>((set, get) => ({
  relations:     new Map(),
  events:        [],
  truces:        new Map(),
  warExhaustion: new Map(),
  reputation:    new Map(),
  peaceTurns:    new Map(),

  reset() {
    set({
      relations: new Map(), events: [], truces: new Map(),
      warExhaustion: new Map(), reputation: new Map(), peaceTurns: new Map(),
    });
  },

  initRelations(nations) {
    const relations   = new Map<string, RelationState>();
    const reputation  = new Map<string, number>();
    const peaceTurns  = new Map<string, number>();
    for (let i = 0; i < nations.length; i++) {
      for (let j = i + 1; j < nations.length; j++) {
        relations.set(relKey(nations[i]!, nations[j]!), 'peace');
      }
    }
    for (const n of nations) {
      reputation.set(n, 0);
      peaceTurns.set(n, 0);
    }
    set({ relations, events: [], truces: new Map(), warExhaustion: new Map(), reputation, peaceTurns });
  },

  getRelation(a, b) {
    if (a === b) return 'alliance';
    return get().relations.get(relKey(a, b)) ?? 'peace';
  },

  isAtWar(a, b) {
    return get().getRelation(a, b) === 'war';
  },

  canDeclareWar(a, b, currentTurn) {
    if (get().getRelation(a, b) === 'war') return false;
    return !get().inTruce(a, b, currentTurn);
  },

  inTruce(a, b, currentTurn) {
    const expiry = get().truces.get(relKey(a, b));
    return expiry !== undefined && currentTurn < expiry;
  },

  declareWar(from, to, provinceId?) {
    if (get().getRelation(from, to) === 'war') return;
    const relations  = new Map(get().relations);
    const reputation = new Map(get().reputation);
    relations.set(relKey(from, to), 'war');
    // Aggressor takes reputation hit
    reputation.set(from, (reputation.get(from) ?? 0) + REP_DECLARE_WAR);
    const msg = `⚔ ${from} DECLARES WAR ON ${to}`;
    const ev: DiplomacyEvent = { id: _evtId++, kind: 'war', msg, ts: Date.now() };
    set({ relations, reputation, events: [...get().events, ev].slice(-30) });
    const alertData = provinceId !== undefined
      ? { kind: 'war' as const, msg, provinceId }
      : { kind: 'war' as const, msg };
    useNotificationStore.getState().push(alertData);
  },

  makePeace(a, b, currentTurn) {
    if (get().getRelation(a, b) === 'peace') return;
    const relations  = new Map(get().relations);
    const truces     = new Map(get().truces);
    const reputation = new Map(get().reputation);
    relations.set(relKey(a, b), 'peace');
    truces.set(relKey(a, b), currentTurn + TRUCE_TURNS);
    // Both parties gain rep for accepting peace
    reputation.set(a, (reputation.get(a) ?? 0) + REP_ACCEPT_PEACE);
    reputation.set(b, (reputation.get(b) ?? 0) + REP_ACCEPT_PEACE);
    const ev: DiplomacyEvent = {
      id: _evtId++, kind: 'peace',
      msg: `✦ ${a} & ${b} SIGN ARMISTICE — ${TRUCE_TURNS}-TURN TRUCE`,
      ts: Date.now(),
    };
    set({ relations, truces, reputation, events: [...get().events, ev].slice(-30) });
    useNotificationStore.getState().push({ kind: 'peace', msg: ev.msg });
  },

  formAlliance(a, b) {
    const relations  = new Map(get().relations);
    const reputation = new Map(get().reputation);
    relations.set(relKey(a, b), 'alliance');
    // Both parties gain rep
    reputation.set(a, (reputation.get(a) ?? 0) + REP_FORM_ALLIANCE);
    reputation.set(b, (reputation.get(b) ?? 0) + REP_FORM_ALLIANCE);
    const ev: DiplomacyEvent = {
      id: _evtId++, kind: 'alliance',
      msg: `★ ${a} & ${b} FORM ALLIANCE`,
      ts: Date.now(),
    };
    set({ relations, reputation, events: [...get().events, ev].slice(-30) });
    useNotificationStore.getState().push({ kind: 'alliance', msg: ev.msg });
  },

  breakAlliance(a, b) {
    if (get().getRelation(a, b) !== 'alliance') return;
    const relations  = new Map(get().relations);
    const reputation = new Map(get().reputation);
    relations.set(relKey(a, b), 'peace');
    // Breaker (a) takes the hit; b is the wronged party
    reputation.set(a, (reputation.get(a) ?? 0) + REP_BREAK_ALLIANCE);
    const ev: DiplomacyEvent = {
      id: _evtId++, kind: 'peace',
      msg: `✦ ${a} BREAKS ALLIANCE WITH ${b}`,
      ts: Date.now(),
    };
    set({ relations, reputation, events: [...get().events, ev].slice(-30) });
  },

  getWarsOf(nation) {
    const wars: string[] = [];
    for (const [k, rel] of get().relations) {
      if (rel !== 'war') continue;
      const [a, b] = k.split(':') as [string, string];
      if (a === nation) wars.push(b);
      else if (b === nation) wars.push(a);
    }
    return wars;
  },

  getAlliesOf(nation) {
    const allies: string[] = [];
    for (const [k, rel] of get().relations) {
      if (rel !== 'alliance') continue;
      const [a, b] = k.split(':') as [string, string];
      if (a === nation) allies.push(b);
      else if (b === nation) allies.push(a);
    }
    return allies;
  },

  applyCallAlliesRep(nation) {
    const reputation = new Map(get().reputation);
    reputation.set(nation, (reputation.get(nation) ?? 0) + REP_CALL_ALLIES);
    set({ reputation });
  },

  addWarExhaustion(nation, amount) {
    const warExhaustion = new Map(get().warExhaustion);
    warExhaustion.set(nation, (warExhaustion.get(nation) ?? 0) + amount);
    set({ warExhaustion });
  },

  getWarExhaustion(nation) {
    return get().warExhaustion.get(nation) ?? 0;
  },

  getReputation(nation) {
    return get().reputation.get(nation) ?? 0;
  },

  tickDiplomacy(currentTurn) {
    const { relations, truces, warExhaustion, reputation, peaceTurns } = get();

    // Expire truces
    const newTruces = new Map(truces);
    for (const [key, expiry] of newTruces) {
      if (currentTurn >= expiry) newTruces.delete(key);
    }

    // War exhaustion += 1 per active war per nation, peace turns tracking
    const newExhaustion = new Map(warExhaustion);
    const newPeaceTurns = new Map(peaceTurns);
    const newReputation = new Map(reputation);

    // Collect all nations from relations keys
    const allNations = new Set<string>();
    for (const key of relations.keys()) {
      const [a, b] = key.split(':') as [string, string];
      allNations.add(a); allNations.add(b);
    }

    for (const nation of allNations) {
      const wars = [];
      for (const [k, state] of relations) {
        if (state !== 'war') continue;
        const [a, b] = k.split(':') as [string, string];
        if (a === nation || b === nation) wars.push(k);
      }

      if (wars.length > 0) {
        // Add 1 exhaustion per active war this turn
        newExhaustion.set(nation, (newExhaustion.get(nation) ?? 0) + wars.length);
        newPeaceTurns.set(nation, 0);
      } else {
        const streak = (newPeaceTurns.get(nation) ?? 0) + 1;
        newPeaceTurns.set(nation, streak);
        // Award +REP every PEACE_TURNS_REP consecutive peace turns
        if (streak % PEACE_TURNS_REP === 0) {
          newReputation.set(nation, (newReputation.get(nation) ?? 0) + REP_PEACE_STREAK);
        }
      }
    }

    set({ truces: newTruces, warExhaustion: newExhaustion, peaceTurns: newPeaceTurns, reputation: newReputation });
  },
}));
