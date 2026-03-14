/**
 * DiplomacyStore — tracks nation-to-nation relations and diplomatic events.
 *
 * Relations are symmetric and keyed by sorted "A:B" strings.
 * States: 'peace' | 'war' | 'alliance'
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

function relKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

let _evtId = 0;

interface DiplomacyStore {
  relations: Map<string, RelationState>;
  events:    DiplomacyEvent[];

  initRelations(nations: string[]): void;
  getRelation(a: string, b: string): RelationState;
  isAtWar(a: string, b: string): boolean;
  declareWar(from: string, to: string, provinceId?: number): void;
  makePeace(a: string, b: string): void;
  formAlliance(a: string, b: string): void;
  getWarsOf(nation: string): string[];
  getAlliesOf(nation: string): string[];
}

export const useDiplomacyStore = create<DiplomacyStore>((set, get) => ({
  relations: new Map(),
  events:    [],

  initRelations(nations) {
    const relations = new Map<string, RelationState>();
    for (let i = 0; i < nations.length; i++) {
      for (let j = i + 1; j < nations.length; j++) {
        relations.set(relKey(nations[i]!, nations[j]!), 'peace');
      }
    }
    set({ relations, events: [] });
  },

  getRelation(a, b) {
    if (a === b) return 'alliance';
    return get().relations.get(relKey(a, b)) ?? 'peace';
  },

  isAtWar(a, b) {
    return get().getRelation(a, b) === 'war';
  },

  declareWar(from, to, provinceId?) {
    if (get().getRelation(from, to) === 'war') return;
    const relations = new Map(get().relations);
    relations.set(relKey(from, to), 'war');
    const msg = `⚔ ${from} DECLARES WAR ON ${to}`;
    const ev: DiplomacyEvent = {
      id: _evtId++, kind: 'war', msg, ts: Date.now(),
    };
    set({ relations, events: [...get().events, ev].slice(-30) });
    const alertData = provinceId !== undefined
      ? { kind: 'war' as const, msg, provinceId }
      : { kind: 'war' as const, msg };
    useNotificationStore.getState().push(alertData);
  },

  makePeace(a, b) {
    if (get().getRelation(a, b) === 'peace') return;
    const relations = new Map(get().relations);
    relations.set(relKey(a, b), 'peace');
    const ev: DiplomacyEvent = {
      id: _evtId++, kind: 'peace',
      msg: `✦ ${a} & ${b} SIGN ARMISTICE`,
      ts: Date.now(),
    };
    set({ relations, events: [...get().events, ev].slice(-30) });
  },

  formAlliance(a, b) {
    const relations = new Map(get().relations);
    relations.set(relKey(a, b), 'alliance');
    const ev: DiplomacyEvent = {
      id: _evtId++, kind: 'alliance',
      msg: `★ ${a} & ${b} FORM ALLIANCE`,
      ts: Date.now(),
    };
    set({ relations, events: [...get().events, ev].slice(-30) });
  },

  getWarsOf(nation) {
    const wars: string[] = [];
    for (const [k, state] of get().relations) {
      if (state !== 'war') continue;
      const [a, b] = k.split(':') as [string, string];
      if (a === nation) wars.push(b);
      else if (b === nation) wars.push(a);
    }
    return wars;
  },

  getAlliesOf(nation) {
    const allies: string[] = [];
    for (const [k, state] of get().relations) {
      if (state !== 'alliance') continue;
      const [a, b] = k.split(':') as [string, string];
      if (a === nation) allies.push(b);
      else if (b === nation) allies.push(a);
    }
    return allies;
  },
}));
