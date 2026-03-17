/**
 * BuildingStore — tracks which buildings are present in each province,
 * their HP (0–100), and craters left by destroyed buildings.
 *
 * Each building starts at 100 HP. Combat and bombing deal damage; when HP
 * reaches 0 the building is removed and a crater is recorded in its place.
 * Craters are cleared when the same building type is re-constructed.
 */

import { create } from 'zustand';
import type { BuildingType } from './BuildingTypes';

interface BuildingStore {
  /** provinceId → Set of BuildingTypes currently standing */
  buildings: Map<number, Set<BuildingType>>;

  /** provinceId → BuildingType → current HP (0–100) */
  buildingHp: Map<number, Map<BuildingType, number>>;

  /** provinceId → BuildingTypes that were destroyed (crater remains) */
  craters: Map<number, Set<BuildingType>>;

  /** Add a building to a province at full HP, clearing any crater of that type */
  addBuilding: (provinceId: number, type: BuildingType) => void;

  /** Check if a province has a specific building */
  hasBuilding: (provinceId: number, type: BuildingType) => boolean;

  /** Return all buildings in a province */
  getBuildings: (provinceId: number) => Set<BuildingType>;

  /** Return HP of a specific building (100 if unknown) */
  getBuildingHp: (provinceId: number, type: BuildingType) => number;

  /** Return crater types in a province */
  getCraters: (provinceId: number) => Set<BuildingType>;

  /**
   * Deal `damage` HP to all buildings in a province, distributing it evenly.
   * Buildings that reach ≤ 0 HP are destroyed and converted to craters.
   * Returns the list of destroyed building types (empty if none).
   */
  damageBuildingsInProvince: (provinceId: number, totalDamage: number) => BuildingType[];

  /**
   * Deal `damage` HP to one specific building.
   * Returns true if the building was destroyed.
   */
  damageBuilding: (provinceId: number, type: BuildingType, damage: number) => boolean;

  /** Remove a building instantly (e.g. administrative) */
  removeBuilding: (provinceId: number, type: BuildingType) => void;

  /** Seed initial buildings for a nation's starting provinces (legacy) */
  initStarterBuildings: (provinceIds: number[], nationCode: string) => void;

  reset: () => void;
}

const BUILDING_MAX_HP = 100;

export const useBuildingStore = create<BuildingStore>((set, get) => ({
  buildings:  new Map(),
  buildingHp: new Map(),
  craters:    new Map(),

  addBuilding: (provinceId, type) => {
    const buildings  = new Map(get().buildings);
    const buildingHp = new Map(get().buildingHp);
    const craters    = new Map(get().craters);

    const existing = new Set(buildings.get(provinceId) ?? []);
    existing.add(type);
    buildings.set(provinceId, existing);

    // Full HP on construction
    const hpMap = new Map(buildingHp.get(provinceId) ?? []);
    hpMap.set(type, BUILDING_MAX_HP);
    buildingHp.set(provinceId, hpMap);

    // Clear crater for this type if one existed
    const craterSet = new Set(craters.get(provinceId) ?? []);
    craterSet.delete(type);
    if (craterSet.size > 0) craters.set(provinceId, craterSet);
    else craters.delete(provinceId);

    set({ buildings, buildingHp, craters });
  },

  hasBuilding: (provinceId, type) =>
    get().buildings.get(provinceId)?.has(type) ?? false,

  getBuildings: (provinceId) =>
    get().buildings.get(provinceId) ?? new Set(),

  getBuildingHp: (provinceId, type) =>
    get().buildingHp.get(provinceId)?.get(type) ?? BUILDING_MAX_HP,

  getCraters: (provinceId) =>
    get().craters.get(provinceId) ?? new Set(),

  damageBuildingsInProvince: (provinceId, totalDamage) => {
    const buildings  = new Map(get().buildings);
    const buildingHp = new Map(get().buildingHp);
    const craters    = new Map(get().craters);

    const bset = buildings.get(provinceId);
    if (!bset || bset.size === 0) return [];

    const btypes = [...bset];
    // Distribute damage evenly across all buildings, with some randomness
    const perBuilding = totalDamage / btypes.length;
    const hpMap       = new Map(buildingHp.get(provinceId) ?? []);
    const destroyed: BuildingType[] = [];

    for (const type of btypes) {
      const dmg    = Math.round(perBuilding * (0.7 + Math.random() * 0.6));
      const curHp  = hpMap.get(type) ?? BUILDING_MAX_HP;
      const newHp  = curHp - dmg;
      if (newHp <= 0) {
        hpMap.delete(type);
        bset.delete(type);
        const craterSet = new Set(craters.get(provinceId) ?? []);
        craterSet.add(type);
        craters.set(provinceId, craterSet);
        destroyed.push(type);
      } else {
        hpMap.set(type, newHp);
      }
    }

    if (bset.size > 0) buildings.set(provinceId, bset);
    else buildings.delete(provinceId);
    if (hpMap.size > 0) buildingHp.set(provinceId, hpMap);
    else buildingHp.delete(provinceId);

    set({ buildings, buildingHp, craters });
    return destroyed;
  },

  damageBuilding: (provinceId, type, damage) => {
    const buildings  = new Map(get().buildings);
    const buildingHp = new Map(get().buildingHp);
    const craters    = new Map(get().craters);

    const hpMap = new Map(buildingHp.get(provinceId) ?? []);
    const curHp = hpMap.get(type) ?? BUILDING_MAX_HP;
    const newHp = curHp - damage;

    if (newHp <= 0) {
      hpMap.delete(type);
      const bset = new Set(buildings.get(provinceId) ?? []);
      bset.delete(type);
      if (bset.size > 0) buildings.set(provinceId, bset);
      else buildings.delete(provinceId);

      const craterSet = new Set(craters.get(provinceId) ?? []);
      craterSet.add(type);
      craters.set(provinceId, craterSet);

      if (hpMap.size > 0) buildingHp.set(provinceId, hpMap);
      else buildingHp.delete(provinceId);

      set({ buildings, buildingHp, craters });
      return true;
    } else {
      hpMap.set(type, newHp);
      buildingHp.set(provinceId, hpMap);
      set({ buildingHp });
      return false;
    }
  },

  removeBuilding: (provinceId, type) => {
    const buildings = new Map(get().buildings);
    const existing  = new Set(buildings.get(provinceId) ?? []);
    existing.delete(type);
    if (existing.size > 0) buildings.set(provinceId, existing);
    else buildings.delete(provinceId);
    set({ buildings });
  },

  initStarterBuildings: (provinceIds, _nationCode) => {
    const buildings  = new Map(get().buildings);
    const buildingHp = new Map(get().buildingHp);
    provinceIds.forEach((id, i) => {
      const starter = new Set<BuildingType>();
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
      const hpMap = new Map<BuildingType, number>();
      for (const b of starter) hpMap.set(b, BUILDING_MAX_HP);
      buildingHp.set(id, hpMap);
    });
    set({ buildings, buildingHp });
  },

  reset: () => set({ buildings: new Map(), buildingHp: new Map(), craters: new Map() }),
}));
