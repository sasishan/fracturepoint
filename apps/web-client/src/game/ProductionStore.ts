/**
 * ProductionStore — multi-turn production queue.
 *
 * Each province has its own independent queue keyed by `${nationCode}:${provinceId}`.
 * Different provinces (and their buildings) produce in PARALLEL.
 * Items within the same province queue are SEQUENTIAL.
 *
 * Uses a plain Record (not Map) so Zustand change-detection works reliably.
 */

import { create } from 'zustand';
import type { UnitType }     from './LocalUnit';
import type { BuildingType } from './BuildingTypes';
import { MOVEMENT_RANGE }    from './LocalUnit';
import { UNIT_DEF }          from './UnitDefinitions';
import { BUILDING_DEF }      from './BuildingTypes';
import { useBuildingStore }  from './BuildingStore';
import { useUnitStore }      from './UnitStore';
import { useGameStateStore } from './GameStateStore';
import { AudioManager, VOICE } from './AudioManager';

export type QueueItemKind = 'unit' | 'building';

export interface QueueItem {
  id:            string;
  kind:          QueueItemKind;
  unitType?:     UnitType;
  buildingType?: BuildingType;
  nationCode:    string;
  provinceId:    number;
  totalTurns:    number;
  turnsLeft:     number;
}

let _queueIdCounter = 0;
let _unitIdCounter  = 20000;

/** Queue key: each province has its own independent production slot. */
const qKey = (nationCode: string, provinceId: number) => `${nationCode}:${provinceId}`;

/** Selector helper — aggregate all queue items for a nation across all province slots. */
export function getNationQueue(queues: Record<string, QueueItem[]>, nationCode: string): QueueItem[] {
  const prefix = nationCode + ':';
  const result: QueueItem[] = [];
  for (const [key, items] of Object.entries(queues)) {
    if (key.startsWith(prefix)) result.push(...items);
  }
  return result;
}

/** Returns the total number of active (in-progress) items for a nation. */
export function getNationQueueLength(queues: Record<string, QueueItem[]>, nationCode: string): number {
  const prefix = nationCode + ':';
  let count = 0;
  for (const [key, items] of Object.entries(queues)) {
    if (key.startsWith(prefix)) count += items.length;
  }
  return count;
}

interface ProductionStore {
  /** `${nationCode}:${provinceId}` → ordered queue (plain Record for Zustand reactivity) */
  queues: Record<string, QueueItem[]>;

  enqueueUnit:     (nationCode: string, provinceId: number, unitType: UnitType) => void;
  enqueueBuilding: (nationCode: string, provinceId: number, buildingType: BuildingType) => void;
  cancelItem:      (nationCode: string, itemId: string) => void;
  tickProduction:  () => void;
  /** Returns all queued items across all provinces for the given nation. */
  getQueue:        (nationCode: string) => QueueItem[];
}

export const useProductionStore = create<ProductionStore>((set, get) => ({
  queues: {},

  enqueueUnit: (nationCode, provinceId, unitType) => {
    const def  = UNIT_DEF[unitType];
    const item: QueueItem = {
      id:         `q-${_queueIdCounter++}`,
      kind:       'unit',
      unitType,
      nationCode,
      provinceId,
      totalTurns: def.buildTime,
      turnsLeft:  def.buildTime,
    };
    const key  = qKey(nationCode, provinceId);
    const prev = get().queues[key] ?? [];
    set({ queues: { ...get().queues, [key]: [...prev, item] } });
    if (nationCode === useGameStateStore.getState().playerNation) {
      AudioManager.playRandom(...VOICE.production);
    }
  },

  enqueueBuilding: (nationCode, provinceId, buildingType) => {
    const def  = BUILDING_DEF[buildingType];
    const item: QueueItem = {
      id:           `q-${_queueIdCounter++}`,
      kind:         'building',
      buildingType,
      nationCode,
      provinceId,
      totalTurns:   def.buildTime,
      turnsLeft:    def.buildTime,
    };
    const key  = qKey(nationCode, provinceId);
    const prev = get().queues[key] ?? [];
    set({ queues: { ...get().queues, [key]: [...prev, item] } });
    if (nationCode === useGameStateStore.getState().playerNation) {
      AudioManager.playRandom(...VOICE.production);
    }
  },

  cancelItem: (nationCode, itemId) => {
    const queues = get().queues;
    const prefix = nationCode + ':';
    for (const key of Object.keys(queues)) {
      if (!key.startsWith(prefix)) continue;
      const q = queues[key]!;
      if (q.some(i => i.id === itemId)) {
        set({ queues: { ...queues, [key]: q.filter(i => i.id !== itemId) } });
        return;
      }
    }
  },

  tickProduction: () => {
    const buildingStore = useBuildingStore.getState();
    const unitStore     = useUnitStore.getState();
    const playerNation  = useGameStateStore.getState().playerNation;
    const oldQueues     = get().queues;
    const newQueues: Record<string, QueueItem[]> = {};

    for (const key of Object.keys(oldQueues)) {
      const [nationCode] = key.split(':') as [string, ...string[]];
      const queue = oldQueues[key] ?? [];
      if (queue.length === 0) { newQueues[key] = []; continue; }

      const active  = queue[0]!;
      const updated = { ...active, turnsLeft: Math.max(0, active.turnsLeft - 1) };

      if (updated.turnsLeft === 0) {
        if (nationCode === playerNation) {
          AudioManager.playRandom(...VOICE.complete);
        }
        if (updated.kind === 'building' && updated.buildingType) {
          buildingStore.addBuilding(updated.provinceId, updated.buildingType);
        } else if (updated.kind === 'unit' && updated.unitType) {
          const def = UNIT_DEF[updated.unitType];
          unitStore.spawnUnit({
            id:                `unit-${_unitIdCounter++}`,
            type:              updated.unitType,
            nationCode,
            provinceId:        updated.provinceId,
            strength:          def.startStrength,
            movementPoints:    MOVEMENT_RANGE[updated.unitType],
            maxMovementPoints: MOVEMENT_RANGE[updated.unitType],
            experience:        0,
          });
        }
        newQueues[key] = queue.slice(1);
      } else {
        newQueues[key] = [updated, ...queue.slice(1)];
      }
    }

    set({ queues: newQueues });
  },

  getQueue: (nationCode) => {
    const prefix = nationCode + ':';
    const result: QueueItem[] = [];
    for (const [key, items] of Object.entries(get().queues)) {
      if (key.startsWith(prefix)) result.push(...items);
    }
    return result;
  },
}));
