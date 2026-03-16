/**
 * BuildingStore — tracks which buildings are present in each province.
 *
 * Each province can hold multiple buildings (one of each type).
 * Buildings are constructed through ProductionStore and committed here
 * when production completes.
 */

import { create } from 'zustand';
import type { BuildingType } from './BuildingTypes';

interface BuildingStore {
  /** provinceId → Set of BuildingTypes constructed there */
  buildings: Map<number, Set<BuildingType>>;

  /** Add a building to a province (called by ProductionStore on completion) */
  addBuilding: (provinceId: number, type: BuildingType) => void;

  /** Check if a province has a specific building */
  hasBuilding: (provinceId: number, type: BuildingType) => boolean;

  /** Return all buildings in a province */
  getBuildings: (provinceId: number) => Set<BuildingType>;

  /** Remove a building from a province (e.g. destroyed by bombing) */
  removeBuilding: (provinceId: number, type: BuildingType) => void;

  /** Seed initial buildings for a nation's starting provinces */
  initStarterBuildings: (provinceIds: number[], nationCode: string) => void;

  reset: () => void;
}

export const useBuildingStore = create<BuildingStore>((set, get) => ({
  buildings: new Map(),

  addBuilding: (provinceId, type) => {
    const buildings = new Map(get().buildings);
    const existing  = new Set(buildings.get(provinceId) ?? []);
    existing.add(type);
    buildings.set(provinceId, existing);
    set({ buildings });
  },

  hasBuilding: (provinceId, type) => {
    return get().buildings.get(provinceId)?.has(type) ?? false;
  },

  getBuildings: (provinceId) => {
    return get().buildings.get(provinceId) ?? new Set();
  },

  initStarterBuildings: (provinceIds, _nationCode) => {
    // Give every nation a basic starter set in their most populous provinces
    const buildings = new Map(get().buildings);
    provinceIds.forEach((id, i) => {
      const starter = new Set<BuildingType>();
      // First province gets full military base
      if (i === 0) {
        starter.add('barracks');
        starter.add('tank_factory');
        starter.add('power_plant');
        starter.add('industrial_zone');
      } else if (i < 3) {
        starter.add('barracks');
        starter.add('farm');
      } else {
        starter.add('farm');
      }
      buildings.set(id, starter);
    });
    set({ buildings });
  },

  removeBuilding: (provinceId, type) => {
    const buildings = new Map(get().buildings);
    const existing  = new Set(buildings.get(provinceId) ?? []);
    existing.delete(type);
    if (existing.size > 0) buildings.set(provinceId, existing);
    else buildings.delete(provinceId);
    set({ buildings });
  },

  reset: () => set({ buildings: new Map() }),
}));
