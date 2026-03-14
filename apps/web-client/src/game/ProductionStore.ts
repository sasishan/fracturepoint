/**
 * ProductionStore — multi-turn production queue.
 *
 * Each nation has a single production queue. Items complete after
 * `turnsLeft` reaches 0 on End Turn. When a unit completes, it is
 * spawned via UnitStore. When a building completes, it is registered
 * via BuildingStore.
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

interface ProductionStore {
  /** nationCode → ordered queue (plain Record for Zustand reactivity) */
  queues: Record<string, QueueItem[]>;

  enqueueUnit:     (nationCode: string, provinceId: number, unitType: UnitType) => void;
  enqueueBuilding: (nationCode: string, provinceId: number, buildingType: BuildingType) => void;
  cancelFirst:     (nationCode: string) => void;
  cancelItem:      (nationCode: string, itemId: string) => void;
  tickProduction:  () => void;
  getQueue:        (nationCode: string) => QueueItem[];
}

export const useProductionStore = create<ProductionStore>((set, get) => ({
  queues: {},

  enqueueUnit: (nationCode, provinceId, unitType) => {
    const def  = UNIT_DEF[unitType];
    // Enforce required building in the target province
    if (!useBuildingStore.getState().hasBuilding(provinceId, def.requiredBuilding)) return;
    const item: QueueItem = {
      id:         `q-${_queueIdCounter++}`,
      kind:       'unit',
      unitType,
      nationCode,
      provinceId,
      totalTurns: def.buildTime,
      turnsLeft:  def.buildTime,
    };
    const prev = get().queues[nationCode] ?? [];
    set({ queues: { ...get().queues, [nationCode]: [...prev, item] } });
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
    const prev = get().queues[nationCode] ?? [];
    set({ queues: { ...get().queues, [nationCode]: [...prev, item] } });
  },

  cancelFirst: (nationCode) => {
    const prev = get().queues[nationCode] ?? [];
    set({ queues: { ...get().queues, [nationCode]: prev.slice(1) } });
  },

  cancelItem: (nationCode, itemId) => {
    const prev = get().queues[nationCode] ?? [];
    set({ queues: { ...get().queues, [nationCode]: prev.filter(i => i.id !== itemId) } });
  },

  tickProduction: () => {
    const buildingStore = useBuildingStore.getState();
    const unitStore     = useUnitStore.getState();
    const oldQueues     = get().queues;
    const newQueues: Record<string, QueueItem[]> = {};

    for (const nationCode of Object.keys(oldQueues)) {
      const queue = oldQueues[nationCode] ?? [];
      if (queue.length === 0) { newQueues[nationCode] = []; continue; }

      const active = queue[0]!;
      const updated: QueueItem = { ...active, turnsLeft: Math.max(0, active.turnsLeft - 1) };

      if (updated.turnsLeft === 0) {
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
        newQueues[nationCode] = queue.slice(1); // drop completed item
      } else {
        newQueues[nationCode] = [updated, ...queue.slice(1)];
      }
    }

    set({ queues: newQueues });
  },

  getQueue: (nationCode) => get().queues[nationCode] ?? [],
}));
