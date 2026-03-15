/**
 * BuildingTypes — 13 building types for the military economy system.
 *
 * Buildings are placed in provinces and unlock unit production slots,
 * boost resource output, or provide strategic capabilities.
 */

export type BuildingType =
  | 'barracks'
  | 'tank_factory'
  | 'air_base'
  | 'naval_base'
  | 'drone_factory'
  | 'missile_facility'
  | 'farm'
  | 'power_plant'
  | 'oil_refinery'
  | 'rare_earth_mine'
  | 'industrial_zone'
  | 'research_lab'
  | 'diplomatic_office';

export type BuildingDomain = 'military' | 'economic' | 'strategic';

export interface BuildingDef {
  type:         BuildingType;
  label:        string;
  domain:       BuildingDomain;
  /** Treasury cost to construct (B USD) */
  buildCost:    number;
  /** Turns to complete */
  buildTime:    number;
  /** Per-turn treasury upkeep (B USD) */
  upkeep:       number;
  /** What this building produces each turn */
  output: {
    income?:           number;
    oil?:              number;
    food?:             number;
    rareEarth?:        number;
    politicalPower?:   number;
    researchPoints?:   number;
    energy?:           number;
    manpower?:         number;
    /** Fractional speed bonus applied to unit production in this province (e.g. 0.10 = 10% faster) */
    productionBonus?:  number;
  };
  /** Tooltip description */
  description: string;
}

export const BUILDING_DEF: Record<BuildingType, BuildingDef> = {
  barracks: {
    type: 'barracks', label: 'Barracks', domain: 'military',
    buildCost: 20, buildTime: 2, upkeep: 1,
    output: { manpower: 5 },
    description: 'Trains infantry, reserves, and special forces.',
  },
  tank_factory: {
    type: 'tank_factory', label: 'Tank Factory', domain: 'military',
    buildCost: 40, buildTime: 3, upkeep: 2,
    output: { productionBonus: 0.10 },
    description: 'Produces armored units and artillery. +10% production speed.',
  },
  air_base: {
    type: 'air_base', label: 'Air Base', domain: 'military',
    buildCost: 50, buildTime: 3, upkeep: 3,
    output: { energy: 1 },
    description: 'Required for all aircraft production.',
  },
  naval_base: {
    type: 'naval_base', label: 'Naval Base', domain: 'military',
    buildCost: 60, buildTime: 4, upkeep: 3,
    output: { income: 1 },
    description: 'Required for naval unit production. Coastal only.',
  },
  drone_factory: {
    type: 'drone_factory', label: 'Drone Factory', domain: 'military',
    buildCost: 35, buildTime: 2, upkeep: 2,
    output: {},
    description: 'Produces combat and recon drones.',
  },
  missile_facility: {
    type: 'missile_facility', label: 'Missile Facility', domain: 'military',
    buildCost: 55, buildTime: 4, upkeep: 3,
    output: {},
    description: 'Produces missile launchers and MLRS units.',
  },
  farm: {
    type: 'farm', label: 'Farm', domain: 'economic',
    buildCost: 10, buildTime: 1, upkeep: 0,
    output: { food: 10 },
    description: 'Produces food to sustain manpower and units.',
  },
  power_plant: {
    type: 'power_plant', label: 'Power Plant', domain: 'economic',
    buildCost: 25, buildTime: 2, upkeep: 1,
    output: { energy: 5 },
    description: 'Generates energy for industrial output.',
  },
  oil_refinery: {
    type: 'oil_refinery', label: 'Oil Refinery', domain: 'economic',
    buildCost: 30, buildTime: 2, upkeep: 1,
    output: { oil: 8, income: 3 },
    description: 'Refines oil for unit fuel and income.',
  },
  rare_earth_mine: {
    type: 'rare_earth_mine', label: 'Rare Earth Mine', domain: 'economic',
    buildCost: 35, buildTime: 3, upkeep: 1,
    output: { rareEarth: 5, income: 2 },
    description: 'Extracts rare earth minerals for advanced units.',
  },
  industrial_zone: {
    type: 'industrial_zone', label: 'Industrial Zone', domain: 'economic',
    buildCost: 45, buildTime: 3, upkeep: 2,
    output: { income: 5 },
    description: 'Boosts province income.',
  },
  research_lab: {
    type: 'research_lab', label: 'Research Lab', domain: 'strategic',
    buildCost: 50, buildTime: 3, upkeep: 2,
    output: { researchPoints: 10 },
    description: 'Accelerates technology research.',
  },
  diplomatic_office: {
    type: 'diplomatic_office', label: 'Diplomatic Office', domain: 'strategic',
    buildCost: 20, buildTime: 1, upkeep: 1,
    output: { politicalPower: 3 },
    description: 'Generates political power for diplomatic actions.',
  },
};

export const ALL_BUILDINGS = Object.keys(BUILDING_DEF) as BuildingType[];

// ── PNG filenames (served from /assets/buildings/) ────────────────────────────

export const BUILDING_PNG_FILE: Record<BuildingType, string> = {
  barracks:          'barracks.png',
  tank_factory:      'tank-factory.png',
  air_base:          'air-base.png',
  naval_base:        'naval-base.png',
  drone_factory:     'drone-factory.png',
  missile_facility:  'missile-facility.png',
  farm:              'farm.png',
  power_plant:       'power-plant.png',
  oil_refinery:      'oil-refinery.png',
  rare_earth_mine:   'rare-earth-mine.png',
  industrial_zone:   'industrial-zone.png',
  research_lab:      'research-lab.png',
  diplomatic_office: 'diplomatic-office.png',
};

export const BUILDING_DOMAIN_COLOR: Record<BuildingDomain, string> = {
  military:  '#cf4444',
  economic:  '#3fb950',
  strategic: '#d2a8ff',
};
