/**
 * UnitDefinitions — complete production specs for all 21 unit types.
 *
 * These augment LocalUnit's runtime data (movement, domain, etc.) with
 * the full production cost profile consumed by ProductionStore and
 * the ProductionPanel UI.
 */

import type { UnitType } from './LocalUnit';
import type { BuildingType } from './BuildingTypes';

export interface UnitProductionDef {
  type:              UnitType;
  /** Treasury cost (B USD) */
  buildCost:         number;
  /** Turns to produce */
  buildTime:         number;
  /** Manpower consumed on recruit (thousands) */
  manpowerCost:      number;
  /** Oil consumed on recruit */
  oilCost:           number;
  /** Food consumed on recruit */
  foodCost:          number;
  /** Rare earth consumed on recruit */
  rareEarthCost:     number;
  /** Required building in the province queue was placed */
  requiredBuilding:  BuildingType;
  /** Per-turn treasury maintenance */
  maintenanceCost:   number;
  /** Per-turn oil upkeep */
  oilUpkeep:         number;
  /** Per-turn food upkeep */
  foodUpkeep:        number;
  /** Starting strength (0–100) */
  startStrength:     number;
  /** Base offensive combat power (0–100) */
  attack:            number;
  /** Base defensive combat power (0–100) */
  defense:           number;
}

export const UNIT_DEF: Record<UnitType, UnitProductionDef> = {
  // ── Land ──────────────────────────────────────────────────────────────────
  infantry: {
    type: 'infantry', buildCost: 5, buildTime: 1,
    manpowerCost: 10, oilCost: 0, foodCost: 5, rareEarthCost: 0,
    requiredBuilding: 'barracks',
    maintenanceCost: 1, oilUpkeep: 0, foodUpkeep: 1,
    startStrength: 90, attack: 75, defense: 80,
  },
  reserves: {
    type: 'reserves', buildCost: 3, buildTime: 1,
    manpowerCost: 8, oilCost: 0, foodCost: 3, rareEarthCost: 0,
    requiredBuilding: 'barracks',
    maintenanceCost: 0, oilUpkeep: 0, foodUpkeep: 1,
    startStrength: 70, attack: 55, defense: 60,
  },
  special_forces: {
    type: 'special_forces', buildCost: 30, buildTime: 2,
    manpowerCost: 2, oilCost: 2, foodCost: 5, rareEarthCost: 1,
    requiredBuilding: 'barracks',
    maintenanceCost: 3, oilUpkeep: 1, foodUpkeep: 1,
    startStrength: 95, attack: 90, defense: 85,
  },
  engineers: {
    type: 'engineers', buildCost: 10, buildTime: 1,
    manpowerCost: 5, oilCost: 1, foodCost: 3, rareEarthCost: 0,
    requiredBuilding: 'barracks',
    maintenanceCost: 1, oilUpkeep: 1, foodUpkeep: 1,
    startStrength: 80, attack: 50, defense: 70,
  },
  logistics: {
    type: 'logistics', buildCost: 8, buildTime: 1,
    manpowerCost: 4, oilCost: 3, foodCost: 2, rareEarthCost: 0,
    requiredBuilding: 'barracks',
    maintenanceCost: 1, oilUpkeep: 2, foodUpkeep: 1,
    startStrength: 75, attack: 30, defense: 40,
  },
  tank: {
    type: 'tank', buildCost: 20, buildTime: 2,
    manpowerCost: 5, oilCost: 5, foodCost: 2, rareEarthCost: 2,
    requiredBuilding: 'tank_factory',
    maintenanceCost: 2, oilUpkeep: 3, foodUpkeep: 0,
    startStrength: 90, attack: 90, defense: 85,
  },
  artillery: {
    type: 'artillery', buildCost: 15, buildTime: 2,
    manpowerCost: 5, oilCost: 3, foodCost: 2, rareEarthCost: 1,
    requiredBuilding: 'tank_factory',
    maintenanceCost: 2, oilUpkeep: 2, foodUpkeep: 0,
    startStrength: 85, attack: 95, defense: 50,
  },
  multi_launcher: {
    type: 'multi_launcher', buildCost: 22, buildTime: 2,
    manpowerCost: 4, oilCost: 4, foodCost: 2, rareEarthCost: 1,
    requiredBuilding: 'missile_facility',
    maintenanceCost: 2, oilUpkeep: 2, foodUpkeep: 0,
    startStrength: 85, attack: 90, defense: 50,
  },
  air_defense: {
    type: 'air_defense', buildCost: 18, buildTime: 2,
    manpowerCost: 4, oilCost: 2, foodCost: 1, rareEarthCost: 3,
    requiredBuilding: 'missile_facility',
    maintenanceCost: 2, oilUpkeep: 1, foodUpkeep: 0,
    startStrength: 88, attack: 80, defense: 75,  // high attack vs air targets
  },
  launcher: {
    type: 'launcher', buildCost: 25, buildTime: 3,
    manpowerCost: 3, oilCost: 3, foodCost: 1, rareEarthCost: 4,
    requiredBuilding: 'missile_facility',
    maintenanceCost: 3, oilUpkeep: 1, foodUpkeep: 0,
    startStrength: 80, attack: 85, defense: 50,
  },
  // ── Air ───────────────────────────────────────────────────────────────────
  stealth_fighter: {
    type: 'stealth_fighter', buildCost: 40, buildTime: 3,
    manpowerCost: 2, oilCost: 8, foodCost: 1, rareEarthCost: 5,
    requiredBuilding: 'air_base',
    maintenanceCost: 5, oilUpkeep: 5, foodUpkeep: 0,
    startStrength: 95, attack: 95, defense: 80,
  },
  bomber: {
    type: 'bomber', buildCost: 35, buildTime: 3,
    manpowerCost: 3, oilCost: 10, foodCost: 1, rareEarthCost: 3,
    requiredBuilding: 'air_base',
    maintenanceCost: 4, oilUpkeep: 7, foodUpkeep: 0,
    startStrength: 90, attack: 85, defense: 60,
  },
  helicopter: {
    type: 'helicopter', buildCost: 20, buildTime: 2,
    manpowerCost: 2, oilCost: 5, foodCost: 1, rareEarthCost: 2,
    requiredBuilding: 'air_base',
    maintenanceCost: 3, oilUpkeep: 3, foodUpkeep: 0,
    startStrength: 85, attack: 80, defense: 65,
  },
  transport_heli: {
    type: 'transport_heli', buildCost: 15, buildTime: 2,
    manpowerCost: 2, oilCost: 4, foodCost: 1, rareEarthCost: 1,
    requiredBuilding: 'air_base',
    maintenanceCost: 2, oilUpkeep: 3, foodUpkeep: 0,
    startStrength: 75, attack: 10, defense: 40,  // unarmed transport
  },
  combat_drone: {
    type: 'combat_drone', buildCost: 20, buildTime: 2,
    manpowerCost: 1, oilCost: 3, foodCost: 0, rareEarthCost: 3,
    requiredBuilding: 'drone_factory',
    maintenanceCost: 2, oilUpkeep: 2, foodUpkeep: 0,
    startStrength: 80, attack: 85, defense: 55,
  },
  recon_drone: {
    type: 'recon_drone', buildCost: 12, buildTime: 1,
    manpowerCost: 1, oilCost: 2, foodCost: 0, rareEarthCost: 2,
    requiredBuilding: 'drone_factory',
    maintenanceCost: 1, oilUpkeep: 1, foodUpkeep: 0,
    startStrength: 70, attack: 5, defense: 40,  // unarmed recon
  },
  // ── Naval ─────────────────────────────────────────────────────────────────
  destroyer: {
    type: 'destroyer', buildCost: 30, buildTime: 3,
    manpowerCost: 5, oilCost: 8, foodCost: 3, rareEarthCost: 3,
    requiredBuilding: 'naval_base',
    maintenanceCost: 4, oilUpkeep: 5, foodUpkeep: 1,
    startStrength: 90, attack: 85, defense: 80,
  },
  warship: {
    type: 'warship', buildCost: 25, buildTime: 3,
    manpowerCost: 8, oilCost: 10, foodCost: 4, rareEarthCost: 2,
    requiredBuilding: 'naval_base',
    maintenanceCost: 3, oilUpkeep: 6, foodUpkeep: 1,
    startStrength: 85, attack: 80, defense: 75,
  },
  nuclear_sub: {
    type: 'nuclear_sub', buildCost: 55, buildTime: 5,
    manpowerCost: 4, oilCost: 6, foodCost: 3, rareEarthCost: 8,
    requiredBuilding: 'naval_base',
    maintenanceCost: 7, oilUpkeep: 4, foodUpkeep: 1,
    startStrength: 95, attack: 95, defense: 90,
  },
  carrier: {
    type: 'carrier', buildCost: 80, buildTime: 6,
    manpowerCost: 20, oilCost: 15, foodCost: 8, rareEarthCost: 10,
    requiredBuilding: 'naval_base',
    maintenanceCost: 10, oilUpkeep: 10, foodUpkeep: 3,
    startStrength: 95, attack: 70, defense: 75,  // fights via escorts; moderate direct combat
  },
  assault_ship: {
    type: 'assault_ship', buildCost: 45, buildTime: 4,
    manpowerCost: 15, oilCost: 10, foodCost: 6, rareEarthCost: 4,
    requiredBuilding: 'naval_base',
    maintenanceCost: 6, oilUpkeep: 7, foodUpkeep: 2,
    startStrength: 88, attack: 60, defense: 70,
  },
};
