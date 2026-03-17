/**
 * VoronoiMapScene — React orchestrator for the land-clipped Voronoi map.
 *
 * Loading pipeline (sequential, all async):
 *   1. loadCities()           — ~1 k city records from JSON
 *   2. loadCountryIndex()     — 15 MB GeoJSON → bbox-indexed cache
 *   3. generateVoronoi()      — d3-delaunay tessellation (synchronous)
 *   4. clipProvincesToLand()  — turf.intersect batch (1–3 s, with progress)
 *   5. EconomySystem.enrich() — fill taxIncome (instant)
 *   6. ProvinceRenderer.setData() — pre-build Path2D, start RAF loop
 *   7. buildAdjacencyGraph()  — province neighbor map
 *   8. initFromProvinces()    — game state + unit placement
 *
 * Mouse events: scroll = zoom, drag = pan.
 * Click own unit → select → BFS range shown → click destination → move/attack.
 */

import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';

import { loadCities }         from './CityLoader';
import { generateVoronoi }    from './VoronoiGenerator';
import {
  loadCountryIndex,
}                             from './ProvinceClipper';
import type { Province }      from './ProvinceClipper';
import type { SeaZone }       from './SeaZoneGenerator';
import {
  generateCombinedSeeds,
  loadLandFeature,
  generateGhostLandSeeds,
} from './SeedGenerator';
import { classifyAndClip }    from './ProvinceClassifier';
import { SeaZoneRenderer }    from './SeaZoneRenderer';
import { ProvinceRenderer }   from './ProvinceRenderer';
import type { MapMode }       from './ProvinceRenderer';
import { EconomySystem }      from './EconomySystem';
import {
  tierFromPopulation,
  strategicScore,
}                             from './EconomySystem';
import {
  EquirectangularProjection,
  WORLD_W, WORLD_H,
}                             from './ProjectionSystem';
import {
  buildAdjacencyGraph,
  buildCombinedAdjacency,
  computeCoastalProvinces,
  type AdjacencyGraph,
}                             from './AdjacencyGraph';

import { useUnitStore }             from '../game/UnitStore';
import { useGameStateStore }        from '../game/GameStateStore';
import { useSettingsStore, AI_MOVE_DELAY } from '../game/SettingsStore';
import { useBuildingStore }         from '../game/BuildingStore';
import { useProductionStore, getNationQueue } from '../game/ProductionStore';
import { BUILDING_DEF, BUILDING_DOMAIN_COLOR, ALL_BUILDINGS, BUILDING_PNG_FILE } from '../game/BuildingTypes';
import type { BuildingType }        from '../game/BuildingTypes';
import { cameraService }            from '../game/cameraService';
import type { LocalUnit }           from '../game/LocalUnit';
import type { UnitType }            from '../game/LocalUnit';
import { MOVEMENT_RANGE, UNIT_DOMAIN, UNIT_FULL_NAME, UNIT_PNG_FILE } from '../game/LocalUnit';
import { loadUnitImages }           from '../game/UnitImageLoader';
import { loadBuildingImages }       from '../game/BuildingImageLoader';
import { UNIT_DEF }                 from '../game/UnitDefinitions';
import { useDiplomacyStore }        from '../game/DiplomacyStore';
import { MapModeToolbar }           from '../hud/MapModeToolbar';
import { AudioManager, VOICE, MOVE_LOOP, UNIT_MOVE_LOOP } from '../game/AudioManager';
import { checkNationEliminated }    from '../game/AISystem';
import { useAIMoveQueue }           from '../game/AIMoveQueue';

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadPhase =
  | 'idle' | 'cities' | 'countries' | 'voronoi' | 'clipping' | 'ready' | 'error';

// ── EU member remapping ───────────────────────────────────────────────────────
// GeoJSON uses individual ISO-3 codes for EU states (FRA, DEU, …). Remap them
// all to the game's unified 'EUF' code so they share economy, units, and AI.
const EU_MEMBER_CODES = new Set([
  'FRA','DEU','ITA','ESP','POL','SWE','FIN','NLD','BEL','AUT',
  'CZE','HUN','ROU','BGR','GRC','PRT','SVK','HRV','DNK','IRL',
  'SVN','LVA','LTU','EST','LUX','CYP','MLT',
]);

// ── Nation tiers ──────────────────────────────────────────────────────────────

const MAJOR_NATIONS    = new Set(['USA', 'RUS', 'CHN', 'EUF', 'IND', 'GBR']);
const REGIONAL_NATIONS = new Set(['GBR', 'IND', 'IRN', 'ISR', 'SAU', 'TUR', 'PAK', 'PRK']);

function nationTier(code: string): 'major' | 'regional' | 'minor' {
  if (MAJOR_NATIONS.has(code))    return 'major';
  if (REGIONAL_NATIONS.has(code)) return 'regional';
  return 'minor';
}

// Province counts to seed per tier
const TIER_PROVINCE_COUNT = { major: 6, regional: 4, minor: 2 } as const;

// Buildings seeded on each province for the tier
const TIER_BUILDINGS: Record<'major' | 'regional' | 'minor', BuildingType[]> = {
  major:    ['industrial_zone', 'power_plant'],  // military buildings seeded geographically
  regional: ['barracks', 'farm'],
  minor:    ['farm'],
};

// ── Unit deployment: core home forces + forward bases ─────────────────────────

/** ~70% of forces — placed in the nation's most populous home provinces. */
const CORE_UNITS: Record<string, UnitType[]> = {
  USA: ['tank', 'infantry', 'infantry', 'infantry', 'artillery', 'stealth_fighter', 'stealth_fighter', 'bomber'],
  RUS: ['tank', 'tank', 'infantry', 'infantry', 'artillery', 'air_defense', 'bomber', 'infantry'],
  CHN: ['tank', 'tank', 'infantry', 'infantry', 'artillery', 'stealth_fighter', 'special_forces'],
  GBR: ['infantry', 'infantry', 'special_forces', 'stealth_fighter', 'air_defense'],
  EUF: ['tank', 'tank', 'infantry', 'infantry', 'artillery', 'stealth_fighter', 'air_defense', 'stealth_fighter'],
  IND: ['infantry', 'infantry', 'infantry', 'tank', 'artillery', 'helicopter', 'air_defense'],
  IRN: ['infantry', 'infantry', 'infantry', 'artillery', 'air_defense', 'launcher'],
  ISR: ['tank', 'tank', 'special_forces', 'stealth_fighter', 'combat_drone', 'air_defense'],
  PAK: ['infantry', 'infantry', 'tank', 'artillery', 'stealth_fighter', 'air_defense', 'warship'],
  SAU: ['infantry', 'infantry', 'tank', 'stealth_fighter', 'air_defense', 'air_defense', 'warship'],
  TUR: ['infantry', 'infantry', 'tank', 'artillery', 'stealth_fighter', 'air_defense'],
  PRK: ['infantry', 'infantry', 'infantry', 'artillery', 'artillery', 'launcher', 'air_defense', 'warship'],
};

/** ~30% of forces — specific lat/lon deployments (overseas bases, forward positions). */
interface UnitDeploy { lat: number; lon: number; type: UnitType; naval?: true; }

const FORWARD_BASES: Partial<Record<string, UnitDeploy[]>> = {
  USA: [
    { lat: 49.4,  lon:   7.6, type: 'stealth_fighter' },        // Ramstein AB, Germany
    { lat: 52.4,  lon:   0.5, type: 'stealth_fighter' },        // RAF Lakenheath, UK
    { lat: 41.0,  lon:  14.0, type: 'infantry' },               // Aviano/Naples, Italy
    { lat: 25.3,  lon:  51.5, type: 'stealth_fighter' },        // Al Udeid AB, Qatar
    { lat: 29.4,  lon:  47.5, type: 'tank' },                   // Camp Arifjan, Kuwait
    { lat: 26.2,  lon: 127.7, type: 'infantry' },               // Okinawa, Japan
    { lat: 37.1,  lon: 127.1, type: 'tank' },                   // Camp Humphreys, South Korea
    { lat: 13.5,  lon: 144.8, type: 'bomber' },                 // Andersen AFB, Guam
    { lat: -7.3,  lon:  72.4, type: 'bomber' },                 // Diego Garcia
    { lat: 26.2,  lon:  50.6, type: 'destroyer', naval: true }, // 5th Fleet, Bahrain
    { lat: 35.0,  lon:  18.0, type: 'carrier',   naval: true }, // Mediterranean
    { lat: 25.0,  lon:  56.0, type: 'destroyer', naval: true }, // Persian Gulf
    { lat: 15.0,  lon: 143.0, type: 'carrier',   naval: true }, // Western Pacific
    { lat: 12.0,  lon: 115.0, type: 'destroyer', naval: true }, // South China Sea
  ],
  RUS: [
    { lat: 35.5,  lon:  35.8, type: 'infantry' },               // Hmeimim AB, Syria
    { lat: 35.5,  lon:  35.8, type: 'destroyer', naval: true }, // Tartus naval base
    { lat: 53.0,  lon: 159.0, type: 'air_defense' },            // Kamchatka
    { lat: 75.0,  lon:  35.0, type: 'destroyer', naval: true }, // Arctic fleet (Murmansk)
    { lat: 44.5,  lon:  34.0, type: 'destroyer', naval: true }, // Black Sea fleet
    { lat: 45.0,  lon: 136.0, type: 'destroyer', naval: true }, // Pacific fleet (Vladivostok)
  ],
  CHN: [
    { lat: 11.5,  lon:  43.1, type: 'destroyer', naval: true }, // Djibouti naval base
    { lat:  9.6,  lon: 114.2, type: 'air_defense' },            // South China Sea islands
    { lat:  9.6,  lon: 114.2, type: 'stealth_fighter' },        // SCS island airstrips
    { lat: 25.1,  lon:  63.5, type: 'infantry' },               // Gwadar, Pakistan
    { lat: 15.0,  lon: 115.0, type: 'destroyer', naval: true }, // SCS fleet
    { lat: 30.0,  lon: 125.0, type: 'destroyer', naval: true }, // East China Sea
  ],
  GBR: [
    { lat: 34.6,  lon:  33.0, type: 'stealth_fighter' },        // Akrotiri, Cyprus
    { lat: 34.6,  lon:  33.0, type: 'infantry' },               // Dhekelia, Cyprus
    { lat: -51.8, lon: -59.0, type: 'air_defense' },            // Falkland Islands
    { lat: 50.0,  lon: -30.0, type: 'carrier',   naval: true }, // North Atlantic
    { lat: 35.0,  lon:  18.0, type: 'destroyer', naval: true }, // Mediterranean
  ],
  EUF: [
    { lat: 11.5,  lon:  43.1, type: 'infantry' },               // Djibouti (French base)
    { lat: 14.7,  lon: -17.5, type: 'infantry' },               // Dakar, Senegal
    { lat: -21.1, lon:  55.5, type: 'infantry' },               // Réunion
    { lat: -21.3, lon: 165.5, type: 'combat_drone' },           // New Caledonia
    { lat: 35.0,  lon:  18.0, type: 'destroyer', naval: true }, // Mediterranean
    { lat: -10.0, lon:  70.0, type: 'destroyer', naval: true }, // Indian Ocean
  ],
  IND: [
    { lat: 12.0,  lon:  93.0, type: 'destroyer', naval: true }, // Andaman Islands
    { lat: 10.5,  lon:  72.6, type: 'infantry' },               // Lakshadweep
    { lat: 20.0,  lon:  65.0, type: 'warship',   naval: true }, // Arabian Sea
    { lat: 15.0,  lon:  90.0, type: 'destroyer', naval: true }, // Bay of Bengal
  ],
  IRN: [
    { lat: 27.2,  lon:  56.3, type: 'warship',   naval: true }, // Persian Gulf / Bandar Abbas
    { lat: 26.8,  lon:  56.0, type: 'air_defense' },            // Qeshm Island / Hormuz
  ],
  TUR: [
    { lat: 35.1,  lon:  33.4, type: 'infantry' },               // Northern Cyprus
    { lat: 25.3,  lon:  51.5, type: 'infantry' },               // Qatar Turkish base
    { lat: 36.0,  lon:  30.0, type: 'destroyer', naval: true }, // Eastern Mediterranean
    { lat: 43.0,  lon:  35.0, type: 'destroyer', naval: true }, // Black Sea
  ],
  // ISR, PAK, SAU, PRK have no forward bases — all forces are home-based
};

// Fallback for minor nations not in the tables above
const DEFAULT_CORE_UNITS: UnitType[] = ['infantry', 'infantry', 'tank', 'artillery'];

// ── Geographic building seeding ────────────────────────────────────────────────

interface BuildingDeploy { lat: number; lon: number; type: BuildingType; naval?: true; }

const HOME_BUILDINGS: Partial<Record<string, BuildingDeploy[]>> = {
  USA: [
    { lat: 31.1, lon:  -97.8, type: 'barracks' },                   // Fort Hood, Texas
    { lat: 39.1, lon:  -96.7, type: 'barracks' },                   // Fort Riley, Midwest
    { lat: 34.9, lon: -117.9, type: 'air_base' },                   // Edwards AFB, California
    { lat: 35.3, lon:  -77.9, type: 'air_base' },                   // Seymour Johnson, East Coast
    { lat: 36.9, lon:  -76.3, type: 'naval_base', naval: true },    // Norfolk (Atlantic)
    { lat: 47.6, lon: -122.7, type: 'naval_base', naval: true },    // Puget Sound (Pacific)
  ],
  RUS: [
    { lat: 55.7, lon:  37.6, type: 'barracks' },                    // Moscow region
    { lat: 54.8, lon:  32.0, type: 'barracks' },                    // Smolensk
    { lat: 45.0, lon:  38.9, type: 'barracks' },                    // Krasnodar
    { lat: 55.6, lon:  36.7, type: 'air_base' },                    // Kubinka, Moscow
    { lat: 53.0, lon: 158.0, type: 'air_base' },                    // Yelizovo, Kamchatka
    { lat: 69.0, lon:  33.1, type: 'naval_base', naval: true },     // Severomorsk (Arctic)
    { lat: 43.1, lon: 131.9, type: 'naval_base', naval: true },     // Vladivostok (Pacific)
  ],
  CHN: [
    { lat: 39.9, lon: 116.4, type: 'barracks' },                    // Beijing
    { lat: 34.3, lon: 108.9, type: 'barracks' },                    // Xi'an
    { lat: 31.2, lon: 121.5, type: 'air_base' },                    // Shanghai region
    { lat: 23.1, lon: 113.3, type: 'air_base' },                    // Guangzhou
    { lat: 21.3, lon: 110.4, type: 'naval_base', naval: true },     // Zhanjiang (South Sea fleet)
    { lat: 29.9, lon: 121.5, type: 'naval_base', naval: true },     // Ningbo (East Sea fleet)
  ],
  EUF: [
    { lat: 48.9, lon:   2.3, type: 'barracks' },                    // Paris region
    { lat: 52.5, lon:  13.4, type: 'barracks' },                    // Berlin
    { lat: 43.5, lon:   5.0, type: 'air_base' },                    // Istres-Le Tubé, France
    { lat: 52.4, lon:  16.9, type: 'air_base' },                    // Krzesiny, Poland
    { lat: 43.1, lon:   5.9, type: 'naval_base', naval: true },     // Toulon (Mediterranean)
  ],
  IND: [
    { lat: 28.6, lon:  77.2, type: 'barracks' },                    // Delhi region
    { lat: 21.1, lon:  79.1, type: 'barracks' },                    // Nagpur, Central India
    { lat: 28.7, lon:  77.7, type: 'air_base' },                    // Hindon AFB
    { lat: 18.9, lon:  72.8, type: 'naval_base', naval: true },     // Mumbai (Western fleet)
    { lat: 17.7, lon:  83.3, type: 'naval_base', naval: true },     // Visakhapatnam (Eastern fleet)
  ],
  GBR: [
    { lat: 51.1, lon:  -1.8, type: 'barracks' },                    // Salisbury Plain / Tidworth
    { lat: 51.8, lon:  -1.6, type: 'air_base' },                    // RAF Brize Norton
    { lat: 57.7, lon:  -3.3, type: 'air_base' },                    // RAF Lossiemouth
    { lat: 50.8, lon:  -1.1, type: 'naval_base', naval: true },     // Portsmouth
    { lat: 56.0, lon:  -3.4, type: 'naval_base', naval: true },     // Rosyth / Firth of Forth
  ],
};

const FORWARD_BUILDINGS: Partial<Record<string, BuildingDeploy[]>> = {
  USA: [
    { lat: 49.4, lon:   7.6, type: 'air_base' },                    // Ramstein AB, Germany
    { lat: 52.4, lon:   0.5, type: 'air_base' },                    // RAF Lakenheath, UK
    { lat: 25.3, lon:  51.5, type: 'air_base' },                    // Al Udeid, Qatar
    { lat: 13.5, lon: 144.8, type: 'air_base' },                    // Andersen AFB, Guam
    { lat: -7.3, lon:  72.4, type: 'air_base' },                    // Diego Garcia
    { lat: 29.4, lon:  47.5, type: 'barracks' },                    // Camp Arifjan, Kuwait
    { lat: 37.1, lon: 127.1, type: 'barracks' },                    // Camp Humphreys, S. Korea
    { lat: 26.2, lon: 127.7, type: 'barracks' },                    // Okinawa, Japan
    { lat: 26.2, lon:  50.6, type: 'naval_base', naval: true },     // 5th Fleet, Bahrain
    { lat: 35.0, lon:  18.0, type: 'naval_base', naval: true },     // Mediterranean
    { lat: 15.0, lon: 143.0, type: 'naval_base', naval: true },     // Western Pacific
    { lat: 12.0, lon: 115.0, type: 'naval_base', naval: true },     // South China Sea
  ],
  RUS: [
    { lat: 35.5, lon:  35.8, type: 'barracks' },                    // Hmeimim AB, Syria
    { lat: 53.0, lon: 159.0, type: 'air_base' },                    // Kamchatka forward
    { lat: 35.5, lon:  35.8, type: 'naval_base', naval: true },     // Tartus naval base
    { lat: 75.0, lon:  35.0, type: 'naval_base', naval: true },     // Arctic fleet
    { lat: 44.5, lon:  34.0, type: 'naval_base', naval: true },     // Black Sea fleet
    { lat: 45.0, lon: 136.0, type: 'naval_base', naval: true },     // Pacific fleet
  ],
  CHN: [
    { lat: 11.5, lon:  43.1, type: 'naval_base', naval: true },     // Djibouti
    { lat:  9.6, lon: 114.2, type: 'air_base' },                    // SCS island airstrips
    { lat: 25.1, lon:  63.5, type: 'barracks' },                    // Gwadar, Pakistan
    { lat: 15.0, lon: 115.0, type: 'naval_base', naval: true },     // SCS fleet
    { lat: 30.0, lon: 125.0, type: 'naval_base', naval: true },     // East China Sea
  ],
  EUF: [
    { lat: 11.5, lon:  43.1, type: 'barracks' },                    // Djibouti (French base)
    { lat: 14.7, lon: -17.5, type: 'barracks' },                    // Dakar, Senegal
    { lat: -21.1, lon:  55.5, type: 'barracks' },                   // Réunion
    { lat: -21.3, lon: 165.5, type: 'air_base' },                   // New Caledonia
    { lat: 35.0, lon:  18.0, type: 'naval_base', naval: true },     // Mediterranean
    { lat: -10.0, lon:  70.0, type: 'naval_base', naval: true },    // Indian Ocean
  ],
  IND: [
    { lat: 12.0, lon:  93.0, type: 'naval_base', naval: true },     // Andaman Islands
    { lat: 10.5, lon:  72.6, type: 'barracks' },                    // Lakshadweep
    { lat: 20.0, lon:  65.0, type: 'naval_base', naval: true },     // Arabian Sea
    { lat: 15.0, lon:  90.0, type: 'naval_base', naval: true },     // Bay of Bengal
  ],
  GBR: [
    { lat: 34.6, lon:  33.0, type: 'air_base' },                    // Akrotiri, Cyprus
    { lat: 34.6, lon:  33.0, type: 'barracks' },                    // Dhekelia, Cyprus
    { lat: -51.8, lon: -59.0, type: 'air_base' },                   // Falkland Islands
    { lat: 50.0, lon: -30.0, type: 'naval_base', naval: true },     // North Atlantic
    { lat: 35.0, lon:  18.0, type: 'naval_base', naval: true },     // Mediterranean
  ],
};

function spawnStarterUnits(
  provinces:      Province[],
  seaZones:       SeaZone[],
  coastalIds:     Set<number>,
  combinedAdj:    AdjacencyGraph,
  activeNations?: Set<string>,
): LocalUnit[] {
  const byCode = new Map<string, Province[]>();
  for (const p of provinces) {
    const arr = byCode.get(p.countryCode) ?? [];
    arr.push(p); byCode.set(p.countryCode, arr);
  }

  const seaZoneMap = new Map(seaZones.map(z => [z.id, z]));
  const seaZoneIds = new Set(seaZones.map(z => z.id));

  // Find the nearest land province to a lat/lon (from ALL provinces — forward bases
  // can be in other nations' territory).
  function nearestProvince(lat: number, lon: number): Province | undefined {
    let best: Province | undefined;
    let bestD = Infinity;
    for (const p of provinces) {
      const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function nearestSeaZone(lat: number, lon: number): SeaZone | undefined {
    let best: SeaZone | undefined;
    let bestD = Infinity;
    for (const z of seaZones) {
      const d = (z.lat - lat) ** 2 + (z.lon - lon) ** 2;
      if (d < bestD) { bestD = d; best = z; }
    }
    return best;
  }

  const units: LocalUnit[] = [];
  let uid = 0;

  // Track which nation and unit type first occupies each province/sea-zone.
  // Stacking rule: same nation + same type may share; all other combos are blocked.
  const occupiedBy   = new Map<number, string>();    // id → nationCode
  const occupiedType = new Map<number, UnitType>();  // id → first unit type placed here

  const makeUnit = (type: UnitType, nationCode: string, provinceId: number): LocalUnit => {
    occupiedBy.set(provinceId, nationCode);
    if (!occupiedType.has(provinceId)) occupiedType.set(provinceId, type);
    return {
      id: `unit-${uid++}`, type, nationCode, provinceId,
      strength: 80 + Math.floor(Math.random() * 20),
      movementPoints: MOVEMENT_RANGE[type], maxMovementPoints: MOVEMENT_RANGE[type],
      experience: 0,
    };
  };

  /** True if this province can accept a new unit of (myCode, myType). */
  function canPlace(id: number, myCode: string, myType: UnitType): boolean {
    const occ  = occupiedBy.get(id);
    const occT = occupiedType.get(id);
    if (occ && occ !== myCode) return false;           // different nation
    if (occT && occT !== myType) return false;          // same nation, different type
    return true;
  }

  // Nearest province not occupied by a conflicting (nation, type) combo.
  function nearestFreeProvince(lat: number, lon: number, myCode: string, myType: UnitType): Province | undefined {
    let best: Province | undefined;
    let bestD = Infinity;
    for (const p of provinces) {
      if (!canPlace(p.id, myCode, myType)) continue;
      const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best ?? nearestProvince(lat, lon);
  }

  function nearestFreeSeaZone(lat: number, lon: number, myCode: string, myType: UnitType): SeaZone | undefined {
    let best: SeaZone | undefined;
    let bestD = Infinity;
    for (const z of seaZones) {
      if (!canPlace(z.id, myCode, myType)) continue;
      const d = (z.lat - lat) ** 2 + (z.lon - lon) ** 2;
      if (d < bestD) { bestD = d; best = z; }
    }
    return best ?? nearestSeaZone(lat, lon);
  }

  // ── Pass 1: core home forces for every nation ────────────────────────────────
  // All home provinces must be claimed before forward bases are placed, so that
  // a nation processed early cannot grab another nation's home province as a
  // "free" forward-base slot.
  for (const [code, provs] of byCode) {
    if (activeNations && !activeNations.has(code)) continue;

    const byPop = [...provs].sort((a, b) => b.population - a.population);

    const coastal = byPop.filter(p => coastalIds.has(p.id));
    const adjSeaZoneIds = new Set<number>();
    for (const cp of coastal) {
      for (const nid of (combinedAdj.get(cp.id) ?? [])) {
        if (seaZoneIds.has(nid)) adjSeaZoneIds.add(nid);
      }
    }
    const adjSeaZones = [...adjSeaZoneIds]
      .map(id => seaZoneMap.get(id)).filter(Boolean) as SeaZone[];

    // Per-type slot cursors so each unit type cycles through its own province list,
    // preventing same-nation different-type co-placement at spawn.
    const landTypeIdx  = new Map<UnitType, number>();
    const navalTypeIdx = new Map<UnitType, number>();

    function nextHomeProvince(type: UnitType): Province | undefined {
      const start = landTypeIdx.get(type) ?? 0;
      for (let i = 0; i < byPop.length; i++) {
        const idx = (start + i) % byPop.length;
        const p   = byPop[idx]!;
        if (canPlace(p.id, code, type)) {
          landTypeIdx.set(type, idx + 1);
          return p;
        }
      }
      // Fallback: ignore type constraint (nation is tight on provinces)
      const fallback = byPop[start % Math.max(1, byPop.length)];
      landTypeIdx.set(type, (start + 1) % Math.max(1, byPop.length));
      return fallback;
    }

    function nextHomeSeaZone(type: UnitType): SeaZone | undefined {
      if (adjSeaZones.length === 0) return undefined;
      const start = navalTypeIdx.get(type) ?? 0;
      for (let i = 0; i < adjSeaZones.length; i++) {
        const idx = (start + i) % adjSeaZones.length;
        const sz  = adjSeaZones[idx]!;
        if (canPlace(sz.id, code, type)) {
          navalTypeIdx.set(type, idx + 1);
          return sz;
        }
      }
      const fallback = adjSeaZones[start % adjSeaZones.length];
      navalTypeIdx.set(type, (start + 1) % adjSeaZones.length);
      return fallback;
    }

    for (const type of (CORE_UNITS[code] ?? DEFAULT_CORE_UNITS)) {
      const domain = UNIT_DOMAIN[type];
      if (domain === 'naval') {
        const sz = nextHomeSeaZone(type);
        if (!sz) continue;
        units.push(makeUnit(type, code, sz.id));
      } else {
        const prov = nextHomeProvince(type);
        if (!prov) continue;
        units.push(makeUnit(type, code, prov.id));
      }
    }

    // Claim ALL home provinces for this nation (even those without units yet)
    // so forward-base search in Pass 2 skips them for other nations.
    for (const p of byPop) {
      if (!occupiedBy.has(p.id)) occupiedBy.set(p.id, code);
    }
  }

  // ── Pass 2: forward deployments (all home provinces already claimed) ─────────
  for (const [code] of byCode) {
    if (activeNations && !activeNations.has(code)) continue;
    for (const deploy of (FORWARD_BASES[code] ?? [])) {
      if (deploy.naval) {
        const sz = nearestFreeSeaZone(deploy.lat, deploy.lon, code, deploy.type);
        if (!sz) continue;
        units.push(makeUnit(deploy.type, code, sz.id));
      } else {
        const prov = nearestFreeProvince(deploy.lat, deploy.lon, code, deploy.type);
        if (!prov) continue;
        units.push(makeUnit(deploy.type, code, prov.id));
      }
    }
  }
  return units;
}

// ── VoronoiMapScene ───────────────────────────────────────────────────────────

export function VoronoiMapScene(): React.ReactElement {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef    = useRef<ProvinceRenderer | null>(null);

  const provincesRef  = useRef<Province[]>([]);
  const seaZonesRef   = useRef<SeaZone[]>([]);
  const adjacencyRef  = useRef<AdjacencyGraph>(new Map());

  const [phase,         setPhase]        = useState<LoadPhase>('idle');
  const [loadError,     setLoadError]    = useState<string | null>(null);
  const [clipProgress,  setClipProgress] = useState(0);
  const [provinceCount, setProvinceCount] = useState(0);
  const [seaZoneCount,  setSeaZoneCount]  = useState(0);
  const [selectedProv,    setSelectedProv]    = useState<Province | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<{ provinceId: number; buildingType: string } | null>(null);
  const [mapMode, setMapModeState] = useState<MapMode>('political');
  const [warConfirm, setWarConfirm] = useState<{
    targetNation: string;
    ppCost: number;
    onConfirm: () => void;
  } | null>(null);

  const isDragging   = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });

  // ── Init pipeline ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas      = canvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    if (!canvas || !labelCanvas) return;

    const parent = canvas.parentElement!;
    const w = parent.clientWidth, h = parent.clientHeight;
    canvas.width = w;      canvas.height = h;
    labelCanvas.width = w; labelCanvas.height = h;

    const ctx      = canvas.getContext('2d')!;
    const labelCtx = labelCanvas.getContext('2d')!;

    const renderer = new ProvinceRenderer();
    rendererRef.current = renderer;
    renderer.resize(w, h);

    const szRenderer = new SeaZoneRenderer();

    (async () => {
      try {
        setPhase('cities');
        const cities = await loadCities('/cities/cities.json');

        setPhase('countries');
        const [countryIndex, landFeature] = await Promise.all([
          loadCountryIndex('/countries/countries.geojson'),
          loadLandFeature('/land/lands.geojson'),
        ]);

        setPhase('voronoi');
        // Ghost seeds fill land areas that have no nearby city — otherwise those
        // regions would be completely absent from the province map.
        const ghostSeeds    = generateGhostLandSeeds(landFeature, cities);
        const allLandSeeds  = [...cities, ...ghostSeeds];

        // Two separate Voronoi diagrams — ocean cells extend naturally to coastlines
        // without city-seed competition, eliminating near-shore coverage gaps.
        const { seeds, cityCount } = generateCombinedSeeds(allLandSeeds, countryIndex);
        const seaSeeds    = seeds.slice(cityCount);
        const landVoronoi = generateVoronoi(allLandSeeds);  // city + ghost seeds
        const seaVoronoi  = generateVoronoi(seaSeeds);      // ocean seeds only

        setPhase('clipping');
        const proj = new EquirectangularProjection(WORLD_W, WORLD_H);
        // ProvinceClassifier clips land cells (landVoronoi ∩ country) and sea cells
        // (seaVoronoi − countries) in two passes.  Both use the same country polygon
        // boundary → zero geometric gap at coastlines.
        const { provinces, seaZones, delaunay } = await classifyAndClip(
          allLandSeeds, landVoronoi, seaSeeds, seaVoronoi, countryIndex, landFeature, proj,
          (done, total) => setClipProgress(Math.round((done / total) * 100)),
        );

        // Remap individual EU member-state codes → unified 'EUF' game code
        for (const p of provinces) {
          if (EU_MEMBER_CODES.has(p.countryCode)) {
            p.countryCode = 'EUF';
            p.country     = 'EU Federation';
          }
        }

        new EconomySystem().enrich(provinces);

        // ── Build adjacency ──────────────────────────────────────────────────
        const landAdj     = buildAdjacencyGraph(provinces, delaunay);
        const combinedAdj = buildCombinedAdjacency(provinces, seaZones);
        const seaZoneIds  = new Set(seaZones.map(z => z.id));
        const coastalIds  = computeCoastalProvinces(provinces, seaZones, combinedAdj);

        provincesRef.current = provinces;
        seaZonesRef.current  = seaZones;
        adjacencyRef.current = landAdj;

        // ── Render setup ─────────────────────────────────────────────────────
        szRenderer.setData(seaZones);
        renderer.setSeaZoneRenderer(szRenderer);
        renderer.setSeaZones(seaZones);
        renderer.setData(provinces, delaunay, WORLD_W, WORLD_H);
        renderer.loadWorldMap('/assets/worldmap.png');
        renderer.fitWorld(w, h);
        renderer.start(ctx, labelCtx);
        cameraService.register(renderer);

        // Load unit PNGs (non-blocking)
        loadUnitImages().then(({ regular, zoomed }) => renderer.setUnitImages(regular, zoomed));
        // Load building PNGs (non-blocking)
        loadBuildingImages().then(imgs => renderer.setBuildingImages(imgs));

        // ── Game state ───────────────────────────────────────────────────────
        useUnitStore.getState().setMapData(
          provinces, landAdj, combinedAdj, seaZoneIds, coastalIds,
        );
        const chosenNation = useGameStateStore.getState().playerNation || undefined;
        useGameStateStore.getState().initFromProvinces(provinces, chosenNation);

        const playerNation  = useGameStateStore.getState().playerNation;
        const opponentsMode = useGameStateStore.getState().opponentsMode;
        const activeNations: Set<string> | undefined = opponentsMode === 'major'
          ? new Set([...MAJOR_NATIONS, playerNation])
          : undefined;

        const starterUnits = spawnStarterUnits(provinces, seaZones, coastalIds, combinedAdj, activeNations);
        useUnitStore.getState().initUnits(starterUnits);

        renderer.setUnits(starterUnits, playerNation, null,
          n => useDiplomacyStore.getState().getRelation(playerNation, n));

        // Seed starter buildings — only for active nations
        const allNationCodes2 = [...new Set(provinces.map(p => p.countryCode))];
        const buildingMap = new Map<number, Set<BuildingType>>();

        for (const code of allNationCodes2) {
          if (activeNations && !activeNations.has(code)) continue;
          const tier       = nationTier(code);
          const count      = TIER_PROVINCE_COUNT[tier];
          const bldgs      = TIER_BUILDINGS[tier];
          const topProvs   = provinces
            .filter(p => p.countryCode === code)
            .sort((a, b) => b.population - a.population)
            .slice(0, count);

          for (const prov of topProvs) {
            const existing = new Set(buildingMap.get(prov.id) ?? []);
            for (const b of bldgs) existing.add(b);
            buildingMap.set(prov.id, existing);
          }
        }

        // Geographic seeding for major-nation military buildings
        const seedBuilding = (id: number, type: BuildingType) => {
          const existing = buildingMap.get(id) ?? new Set<BuildingType>();
          existing.add(type);
          buildingMap.set(id, existing);
        };
        const geoNearestOwnedProv = (lat: number, lon: number, code: string): number | null => {
          let best: number | null = null, bestD = Infinity;
          for (const p of provinces) {
            if (p.countryCode !== code) continue;
            const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
            if (d < bestD) { bestD = d; best = p.id; }
          }
          return best;
        };
        const geoNearestSeaZone = (lat: number, lon: number): number | null => {
          let best: number | null = null, bestD = Infinity;
          for (const z of seaZones) {
            const d = (z.lat - lat) ** 2 + (z.lon - lon) ** 2;
            if (d < bestD) { bestD = d; best = z.id; }
          }
          return best;
        };
        const geoNearestAnyProv = (lat: number, lon: number): number | null => {
          let best: number | null = null, bestD = Infinity;
          for (const p of provinces) {
            const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
            if (d < bestD) { bestD = d; best = p.id; }
          }
          return best;
        };
        for (const [code, deploys] of Object.entries(HOME_BUILDINGS)) {
          if (!deploys) continue;
          if (activeNations && !activeNations.has(code)) continue;
          for (const deploy of deploys) {
            const id = deploy.naval
              ? geoNearestSeaZone(deploy.lat, deploy.lon)
              : geoNearestOwnedProv(deploy.lat, deploy.lon, code);
            if (id !== null) seedBuilding(id, deploy.type);
          }
        }
        for (const [code, deploys] of Object.entries(FORWARD_BUILDINGS)) {
          if (!deploys) continue;
          if (activeNations && !activeNations.has(code)) continue;
          for (const deploy of deploys) {
            const id = deploy.naval
              ? geoNearestSeaZone(deploy.lat, deploy.lon)
              : geoNearestAnyProv(deploy.lat, deploy.lon);
            if (id !== null) seedBuilding(id, deploy.type);
          }
        }

        // Initialise HP at 100 for every seeded building
        const buildingHpMap = new Map<number, Map<BuildingType, number>>();
        for (const [pid, bset] of buildingMap) {
          const hpEntry = new Map<BuildingType, number>();
          for (const b of bset) hpEntry.set(b, 100);
          buildingHpMap.set(pid, hpEntry);
        }
        useBuildingStore.setState({ buildings: buildingMap, buildingHp: buildingHpMap, craters: new Map() });

        // Init diplomacy — all nations start at peace
        const allNationCodes = [...new Set(provinces.map(p => p.countryCode))];
        useDiplomacyStore.getState().initRelations(allNationCodes);

        // Push initial building data to renderer immediately after seeding
        // (pushBuildingState is defined in the subscriber block below — use inline here)
        {
          const bs = useBuildingStore.getState();
          const flat = new Map<number, string[]>();
          for (const [pid, bset] of bs.buildings) {
            if (bset.size > 0) flat.set(pid, [...bset]);
          }
          renderer.setBuildingData(flat);
          renderer.setBuildingHp(new Map());   // all at max HP initially
          renderer.setCraterData(new Map());
        }

        setProvinceCount(provinces.length);
        setSeaZoneCount(seaZones.length);
        setPhase('ready');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[VoronoiMapScene]', msg);
        setLoadError(msg); setPhase('error');
      }
    })();

    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width: rw, height: rh } = entry.contentRect;
      const fw = Math.floor(rw), fh = Math.floor(rh);
      canvas.width = fw;      canvas.height = fh;
      labelCanvas.width = fw; labelCanvas.height = fh;
      renderer.resize(fw, fh); renderer.markDirty();
    });
    ro.observe(parent);

    return () => { cameraService.register(null); ro.disconnect(); renderer.stop(); rendererRef.current = null; };
  }, []);

  // ── Sync stores → renderer (outside React render cycle) ─────────────────

  useEffect(() => {
    // Recompute which province-pairs should show a red combat line.
    // Called from both the unit subscriber and the diplomacy subscriber so that
    // lines appear immediately when war is declared, not only after the next unit move.
    const refreshCombatPairs = () => {
      const r = rendererRef.current;
      if (!r) return;
      const unitState = useUnitStore.getState();
      const units     = Array.from(unitState.units.values());
      const landAdj   = adjacencyRef.current;
      const seaAdj    = unitState._seaAdjacency;
      const diplo     = useDiplomacyStore.getState();

      const getNeighbors = (id: number): number[] => {
        const a = landAdj.get(id) ?? [];
        const b = seaAdj.get(id)  ?? [];
        return b.length === 0 ? a : [...new Set([...a, ...b])];
      };

      // Build province → units lookup
      const unitsByProv = new Map<number, typeof units[number][]>();
      for (const u of units) {
        const arr = unitsByProv.get(u.provinceId) ?? [];
        arr.push(u);
        unitsByProv.set(u.provinceId, arr);
      }

      const pairs: [number, number][] = [];
      const seen = new Set<string>();

      // Adjacency-based pairs
      for (const unit of units) {
        for (const neighborId of getNeighbors(unit.provinceId)) {
          const hasHostile = (unitsByProv.get(neighborId) ?? []).some(
            u => u.nationCode !== unit.nationCode && diplo.isAtWar(unit.nationCode, u.nationCode),
          );
          if (!hasHostile) continue;
          const key = `${Math.min(unit.provinceId, neighborId)}:${Math.max(unit.provinceId, neighborId)}`;
          if (!seen.has(key)) { seen.add(key); pairs.push([unit.provinceId, neighborId]); }
        }
      }

      // Fought-pairs supplement: force-include any historically-fought pair where hostile
      // warring units still occupy both provinces (catches gaps in Delaunay sea connectivity).
      for (const key of r.getFoughtPairs()) {
        if (seen.has(key)) continue;
        const [aStr, bStr] = key.split(':');
        const aId = parseInt(aStr!, 10), bId = parseInt(bStr!, 10);
        const aUnits = unitsByProv.get(aId) ?? [];
        const bUnits = unitsByProv.get(bId) ?? [];
        const stillConflict = aUnits.some(a =>
          bUnits.some(b => a.nationCode !== b.nationCode && diplo.isAtWar(a.nationCode, b.nationCode)),
        );
        if (stillConflict) { seen.add(key); pairs.push([aId, bId]); }
      }

      r.setActiveCombatPairs(pairs);
    };

    const unsubUnit = useUnitStore.subscribe((state, prev) => {
      const r = rendererRef.current;
      if (!r) return;
      const playerNation = useGameStateStore.getState().playerNation;
      const units = Array.from(state.units.values());
      r.setUnits(units, playerNation, state.selectedUnitId);
      r.setMoveRange(state.moveRange);
      r.setPendingPath(state.pendingPath);
      refreshCombatPairs();
    });

    const unsubGame = useGameStateStore.subscribe((state) => {
      rendererRef.current?.setOwnershipOverrides(state.provinceOwnership);
    });

    const pushBuildingState = (state: ReturnType<typeof useBuildingStore.getState>) => {
      const r = rendererRef.current;
      if (!r) return;
      const flat = new Map<number, string[]>();
      for (const [pid, bset] of state.buildings) {
        if (bset.size > 0) flat.set(pid, [...bset]);
      }
      r.setBuildingData(flat);
      const hpFlat = new Map<number, Map<string, number>>();
      for (const [pid, hpMap] of state.buildingHp) {
        if (hpMap.size > 0) hpFlat.set(pid, hpMap as Map<string, number>);
      }
      r.setBuildingHp(hpFlat);
      const craterFlat = new Map<number, string[]>();
      for (const [pid, cset] of state.craters) {
        if (cset.size > 0) craterFlat.set(pid, [...cset]);
      }
      r.setCraterData(craterFlat);
    };

    const unsubBuildings = useBuildingStore.subscribe(pushBuildingState);

    // Push initial building state immediately
    pushBuildingState(useBuildingStore.getState());

    const unsubDiplo = useDiplomacyStore.subscribe((state) => {
      const r = rendererRef.current;
      if (!r) return;
      const player = useGameStateStore.getState().playerNation;
      r.setWarNations(new Set(state.getWarsOf(player)));
      r.setAllyNations(new Set(state.getAlliesOf(player)));
      // War status changed — recompute combat lines immediately without waiting for a unit move.
      refreshCombatPairs();
    });

    const unsubCombat = useUnitStore.subscribe((state, prev) => {
      const r = rendererRef.current;
      if (!r || !state.lastCombat || state.lastCombat === prev.lastCombat) return;
      r.addCombatEffect(state.lastCombat.attackerProvinceId, state.lastCombat.provinceId);
      // addCombatEffect updates foughtPairs — refresh so the new pair shows a red line immediately.
      refreshCombatPairs();
    });

    return () => { unsubUnit(); unsubGame(); unsubBuildings(); unsubDiplo(); unsubCombat(); };
  }, []);

  // ── Sequential AI move animation ─────────────────────────────────────────
  // Drain AIMoveQueue one action at a time: pan camera → animate → execute.

  const processAIQueueRef = useRef<() => void>(() => {});
  useEffect(() => {
    processAIQueueRef.current = () => {
      const qStore = useAIMoveQueue.getState();
      if (qStore.processing) return;
      const action = qStore.dequeue();
      if (!action) return;

      qStore.setProcessing(true);
      const r = rendererRef.current;
      if (!r) {
        action.execute();
        qStore.setProcessing(false);
        if (useAIMoveQueue.getState().queue.length === 0) {
          useUnitStore.getState().resetMovement();
        }
        processAIQueueRef.current();
        return;
      }

      cameraService.focusOnIdZoom(action.fromProvinceId);
      const delay = AI_MOVE_DELAY[useSettingsStore.getState().aiMoveSpeed];
      r.animateMove(action.unitId, [action.fromProvinceId, action.toProvinceId], () => {
        action.execute();
        qStore.setProcessing(false);
        // If this was the last AI action, reset player movement now so that
        // AI combat results (routing/damage) cannot persist into the new turn.
        if (useAIMoveQueue.getState().queue.length === 0) {
          useUnitStore.getState().resetMovement();
        }
        setTimeout(() => processAIQueueRef.current(), delay);
      });
    };
  });

  useEffect(() => {
    return useAIMoveQueue.subscribe((state, prev) => {
      if (state.queue.length > prev.queue.length && !state.processing) {
        // Defer one tick so all enqueues from tickAI() complete first
        setTimeout(() => processAIQueueRef.current(), 0);
      }
    });
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      rendererRef.current?.zoom(
        e.deltaY < 0 ? 1.12 : 1 / 1.12,
        e.clientX - rect.left, e.clientY - rect.top,
      );
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // ── Mouse events ──────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current   = true;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = rendererRef.current;
    if (!r) return;

    if (isDragging.current) {
      r.pan(e.clientX - lastMousePos.current.x, e.clientY - lastMousePos.current.y);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // hitTestId checks land provinces first, then sea zones
    const hovId = r.hitTestId(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    r.setHovered(hovId);

    // Show A* path preview while unit is selected
    const unitState = useUnitStore.getState();
    if (unitState.selectedUnitId && hovId >= 0) {
      unitState.hoverDestination(hovId);
    }
  }, []);

  /** War declaration PP cost: 50 base, +10 if target has more units. */
  const warDeclareCost = (from: string, to: string): number => {
    const allUnits = useUnitStore.getState().units;
    const fromCount = Array.from(allUnits.values()).filter(u => u.nationCode === from).length;
    const toCount   = Array.from(allUnits.values()).filter(u => u.nationCode === to).length;
    return 50 + (toCount > fromCount ? 10 : 0);
  };

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = rendererRef.current;
    isDragging.current = false;
    if (!r) return;

    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx > 4 || dy > 4) return; // was a drag

    const unitState    = useUnitStore.getState();
    const gameState    = useGameStateStore.getState();
    const playerNation = gameState.playerNation;

    // ── Check building icons first ────────────────────────────────────────────
    const clickedBuilding = r.hitTestBuilding(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (clickedBuilding) {
      setSelectedBuilding(clickedBuilding);
      setSelectedProv(null);
      unitState.selectUnit(null);
      r.setSelected(-1);
      return;
    }

    // Clear building selection on any other click
    setSelectedBuilding(null);

    // ── Check units first (direct hit testing) ────────────────────────────────
    const clickedUnit = r.hitTestUnit(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    
    // hitTestId covers both land provinces and sea zones (fallback)
    const clickId = r.hitTestId(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    
    // For the detail panel we still need the Province object (land only)
    const landProv = r.hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);

    // ── Bombing mode ─────────────────────────────────────────────────────────
    if (unitState.bombingMode && unitState.selectedUnitId) {
      const bomber = unitState.units.get(unitState.selectedUnitId);
      if (bomber?.nationCode === playerNation && unitState.moveRange?.reachable.has(clickId)) {
        const targetOwner = gameState.provinceOwnership.get(clickId)
          ?? provincesRef.current.find(p => p.id === clickId)?.countryCode;
        const diplo = useDiplomacyStore.getState();
        if (targetOwner && targetOwner !== playerNation && !diplo.isAtWar(playerNation, targetOwner)) {
          const ppCost = warDeclareCost(playerNation, targetOwner);
          const bombId = unitState.selectedUnitId;
          setWarConfirm({
            targetNation: targetOwner,
            ppCost,
            onConfirm: () => {
              useGameStateStore.getState().spendPP(playerNation, ppCost);
              useDiplomacyStore.getState().declareWar(playerNation, targetOwner);
              unitState.bombProvince(bombId, clickId);
              r.setSelected(-1);
              setSelectedProv(null);
              setWarConfirm(null);
            },
          });
          return;
        }
        unitState.bombProvince(unitState.selectedUnitId, clickId);
        r.setSelected(-1);
        setSelectedProv(null);
        return;
      }
      unitState.selectUnit(null);
      r.setSelected(-1);
      return;
    }

    // ── With a unit selected ──────────────────────────────────────────────────
    if (unitState.selectedUnitId) {
      // Move/attack takes priority over reselect. This allows stacking same-type
      // units: clicking a province in range always moves there even if a friendly
      // unit already occupies it. Enemy units are read-only — never issue orders for them.
      const selectedUnit = unitState.units.get(unitState.selectedUnitId);
      if (selectedUnit?.nationCode === playerNation && unitState.moveRange?.reachable.has(clickId)) {
        const hasEnemy    = Array.from(unitState.units.values()).some(
          u => u.provinceId === clickId && u.nationCode !== playerNation,
        );
        // Capture everything needed before selection is cleared
        const movingId    = unitState.selectedUnitId;
        const moveCost    = unitState.moveRange?.costs.get(clickId) ?? 1;
        const animPath    = (unitState.pendingPath?.at(-1) === clickId)
          ? [...(unitState.pendingPath ?? [])]
          : [unitState.units.get(movingId)?.provinceId ?? clickId, clickId];
        const primaryUnit = unitState.units.get(movingId)!;
        const stackIds: string[] = unitState.groupSelected
          ? Array.from(unitState.units.values())
              .filter(u => u.provinceId === primaryUnit.provinceId
                        && u.type === primaryUnit.type
                        && u.nationCode === playerNation)
              .map(u => u.id)
          : [movingId];
        const domain = UNIT_DOMAIN[primaryUnit.type] ?? 'land';

        // Collect all nations that need a war declaration.
        // Air units fly over — only the destination matters.
        // Land/naval units physically enter each province — check the full path.
        const diplo = useDiplomacyStore.getState();
        const warTargets = new Set<string>();
        const pathToCheck = domain === 'air' ? animPath.slice(-1) : animPath.slice(1);
        for (const pid of pathToCheck) {
          const owner = gameState.provinceOwnership.get(pid)
            ?? provincesRef.current.find(p => p.id === pid)?.countryCode;
          if (owner && owner !== playerNation && diplo.getRelation(playerNation, owner) === 'peace') {
            warTargets.add(owner);
          }
        }
        if (hasEnemy) {
          const defender = Array.from(unitState.units.values()).find(
            u => u.provinceId === clickId && u.nationCode !== playerNation,
          );
          if (defender && diplo.getRelation(playerNation, defender.nationCode) === 'peace') {
            warTargets.add(defender.nationCode);
          }
        }

        const cb = (pid: number, owner: string) => {
          const prevOwner = gameState.provinceOwnership.get(pid)
            ?? provincesRef.current.find(p => p.id === pid)?.countryCode;
          // Don't capture allied provinces — just transit through
          if (prevOwner && useDiplomacyStore.getState().getRelation(owner, prevOwner) === 'alliance') return;
          gameState.setProvinceOwner(pid, owner);
          if (prevOwner && prevOwner !== owner) {
            const prod = useProductionStore.getState();
            for (const item of prod.getQueue(prevOwner)) {
              if (item.provinceId === pid) prod.cancelItem(prevOwner, item.id);
            }
            checkNationEliminated(prevOwner);
          }
        };

        const executeMove = () => {
          unitState.selectUnit(null);
          r.setSelected(-1);
          setSelectedProv(null);
          if (!hasEnemy) {
            AudioManager.playRandom(...(
              domain === 'air'   ? VOICE.moveAir   :
              domain === 'naval' ? VOICE.moveNaval :
                                   VOICE.moveLand
            ));
          }
          const moveLoopKey = UNIT_MOVE_LOOP[primaryUnit.type]
            ?? MOVE_LOOP[domain as 'land' | 'air' | 'naval']
            ?? MOVE_LOOP.land;
          const stopMoveSfx = AudioManager.playLoop(moveLoopKey);
          r.animateMove(movingId, animPath, () => {
            stopMoveSfx();
            if (hasEnemy) {
              unitState.attackProvince(movingId, clickId, cb);
            } else {
              for (const uid of stackIds) {
                unitState.commitMove(uid, clickId, moveCost, uid === movingId ? cb : undefined);
              }
            }
          });
        };

        if (warTargets.size > 0) {
          const targetList = [...warTargets];
          const ppCost = targetList.reduce((sum, t) => sum + warDeclareCost(playerNation, t), 0);
          setWarConfirm({
            targetNation: targetList.join(', '),
            ppCost,
            onConfirm: () => {
              const gs = useGameStateStore.getState();
              const d  = useDiplomacyStore.getState();
              gs.spendPP(playerNation, ppCost);
              for (const t of targetList) d.declareWar(playerNation, t);
              setWarConfirm(null);
              executeMove();
            },
          });
        } else {
          executeMove();
        }
        return;
      }

      // Outside range: reselect own unit, or inspect any unit (read-only for enemies)
      if (clickedUnit && clickedUnit.id !== unitState.selectedUnitId) {
        if (clickedUnit.nationCode === playerNation) {
          unitState.selectUnit(clickedUnit.id);
        } else {
          // Enemy — inspect only, never compute move range
          useUnitStore.setState({ selectedUnitId: clickedUnit.id, groupSelected: false, moveRange: null, pendingPath: null });
        }
        r.setSelected(clickedUnit.provinceId);
        setSelectedProv(r.hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY));
        return;
      }
      const unitHere = clickId >= 0 ? Array.from(unitState.units.values()).find(
        u => u.provinceId === clickId && u.nationCode === playerNation,
      ) : null;
      if (unitHere && unitHere.id !== unitState.selectedUnitId) {
        unitState.selectUnit(unitHere.id);
        r.setSelected(clickId);
        setSelectedProv(landProv);
        return;
      }

      // Nothing useful clicked → deselect
      unitState.selectUnit(null);
      r.setSelected(-1);
      setSelectedProv(null);
      return;
    }

    // ── No unit selected: try selecting a unit or province ───────────────────
    // Check direct unit hit first (any nation — enemy units are read-only)
    if (clickedUnit) {
      if (clickedUnit.nationCode === playerNation) {
        unitState.selectUnit(clickedUnit.id);
      } else {
        // Enemy — inspect only, never compute move range
        useUnitStore.setState({ selectedUnitId: clickedUnit.id, groupSelected: false, moveRange: null, pendingPath: null });
      }
      r.setSelected(clickedUnit.provinceId);
      const clickedProv = r.hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      setSelectedProv(clickedProv); // null for sea zones — panel won't show
    } else if (clickId >= 0) {
      // Fallback: check by province ID (own units only for province fallback)
      const unitHere = Array.from(unitState.units.values()).find(
        u => u.provinceId === clickId && u.nationCode === playerNation,
      );

      if (unitHere) {
        unitState.selectUnit(unitHere.id);
        r.setSelected(clickId);
        setSelectedProv(landProv); // null for sea zones — panel won't show
      } else {
        unitState.selectUnit(null);
        r.setSelected(clickId);
        setSelectedProv(landProv);
      }
    }
    
    if (clickId >= 0) {
      r.setHovered(clickId);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    rendererRef.current?.setHovered(-1);
    useUnitStore.getState().hoverDestination(-1);
  }, []);

  // Sync selectedBuilding → renderer yellow ring
  useEffect(() => {
    rendererRef.current?.setSelectedBuilding(
      selectedBuilding?.provinceId ?? null,
      selectedBuilding?.buildingType ?? null,
    );
  }, [selectedBuilding]);

  // Allow external panels (UnitRosterPanel) to open the BuildingActionPanel
  useEffect(() => {
    cameraService.registerBuildingSelect((provinceId, buildingType) => {
      setSelectedBuilding({ provinceId, buildingType });
      setSelectedProv(null);
    });
  }, []);

  const deselect = useCallback(() => {
    rendererRef.current?.setSelected(-1);
    setSelectedProv(null);
    setSelectedBuilding(null);
    useUnitStore.getState().selectUnit(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') deselect(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deselect]);

  const handleMapMode = useCallback((mode: MapMode) => {
    rendererRef.current?.setMapMode(mode);
    setMapModeState(mode);
  }, []);

  // Sync showCountryNames from SettingsStore → renderer whenever it changes
  useEffect(() => {
    return useSettingsStore.subscribe((s) => {
      rendererRef.current?.setShowCountryNames(s.showCountryNames);
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      <canvas
        ref={labelCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      <MapModeToolbar current={mapMode} onChange={handleMapMode} />

      {phase !== 'ready' && phase !== 'error' && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={{ color: '#E8A020', fontSize: 18, letterSpacing: 3, marginBottom: 14 }}>
              GENERATING WORLD MAP
            </div>
            <LoadingStep active={phase === 'cities'}    done={phaseIndex(phase) > 0} label="LOADING CITIES" />
            <LoadingStep active={phase === 'countries'} done={phaseIndex(phase) > 1} label="LOADING COUNTRY BORDERS" />
            <LoadingStep active={phase === 'voronoi'}   done={phaseIndex(phase) > 2} label="BUILDING VORONOI GRAPH" />
            <LoadingStep active={phase === 'clipping'}  done={phaseIndex(phase) > 3}
              label={`CLASSIFYING PROVINCES + SEA ZONES${phase === 'clipping' ? ` ${clipProgress}%` : ''}`} />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={overlayStyle}>
          <div style={{ ...overlayBoxStyle, borderColor: '#CF4444' }}>
            <div style={{ color: '#CF4444', fontSize: 18, letterSpacing: 3, marginBottom: 12 }}>MAP LOAD FAILED</div>
            <div style={{ color: '#7D8FA0', fontSize: 14, maxWidth: 340, textAlign: 'center' }}>{loadError}</div>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
          <div style={badgeStyle}>{provinceCount} PROVINCES · {seaZoneCount} SEA ZONES</div>
          <div style={{ ...badgeStyle, color: '#7D8FA0', fontSize: 13 }}>
            SCROLL: zoom · DRAG: pan · CLICK UNIT: select · CLICK DEST: move
          </div>
        </div>
      )}

      {warConfirm && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)', zIndex: 50,
        }}>
          <div style={{
            background: 'rgba(10,14,20,0.98)', border: '1px solid #cf4444',
            fontFamily: 'Rajdhani, sans-serif', padding: '28px 32px', maxWidth: 380, textAlign: 'center',
            boxShadow: '0 0 40px rgba(207,68,68,0.3)',
          }}>
            <div style={{ color: '#cf4444', fontSize: 22, letterSpacing: 3, fontWeight: 700, marginBottom: 10 }}>
              ⚔ DECLARE WAR
            </div>
            <div style={{ color: '#cdd9e5', fontSize: 18, letterSpacing: 1.5, marginBottom: 6 }}>
              This action will start a war with
            </div>
            <div style={{ color: '#e8a020', fontSize: 24, letterSpacing: 2, fontWeight: 700, marginBottom: 14 }}>
              {warConfirm.targetNation}
            </div>
            <div style={{ color: '#7d8fa0', fontSize: 16, letterSpacing: 1, marginBottom: 20, lineHeight: 1.5 }}>
              Cost: <span style={{ color: '#58a6ff', fontWeight: 700 }}>{warConfirm.ppCost} PP</span>
              {warConfirm.ppCost > 50 && (
                <span style={{ color: '#e8a020' }}> (+10 stronger nation)</span>
              )}
              <br />
              All allied nations may be drawn into the conflict.
              <br />
              <span style={{ color: '#cf4444' }}>This cannot be undone.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={warConfirm.onConfirm} style={{
                background: 'rgba(207,68,68,0.12)', border: '1px solid #cf4444',
                color: '#cf4444', fontSize: 18, letterSpacing: 2, fontWeight: 700,
                padding: '8px 24px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
              }}>
                DECLARE WAR
              </button>
              <button onClick={() => { setWarConfirm(null); useUnitStore.getState().selectUnit(null); }} style={{
                background: 'transparent', border: '1px solid #3a4a5a',
                color: '#7d8fa0', fontSize: 18, letterSpacing: 2, fontWeight: 700,
                padding: '8px 24px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
              }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProv && (
        <ProvinceDetailPanel province={selectedProv} onClose={deselect} />
      )}
      {selectedBuilding && !selectedProv && (
        <BuildingActionPanel
          provinceId={selectedBuilding.provinceId}
          buildingType={selectedBuilding.buildingType as BuildingType}
          provinces={provincesRef.current}
          onClose={() => setSelectedBuilding(null)}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function phaseIndex(phase: LoadPhase): number {
  const order: LoadPhase[] = ['idle', 'cities', 'countries', 'voronoi', 'clipping', 'ready'];
  return order.indexOf(phase);
}

function LoadingStep({ active, done, label }: { active: boolean; done: boolean; label: string }): React.ReactElement {
  const color = done ? '#3fb950' : active ? '#e8a020' : '#3a4a5a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ color, fontSize: 14, letterSpacing: 1.5 }}>{label}</div>
    </div>
  );
}

function ProvinceDetailPanel({ province, onClose }: { province: Province; onClose: () => void }): React.ReactElement {
  const tier = tierFromPopulation(province.population);
  const sv   = strategicScore(province.population);
  const tierColor: Record<string, string> = {
    megacity: '#e8c060', major: '#58a6ff', regional: '#3fb950', minor: '#7d8fa0',
  };
  const popStr = province.population >= 1_000_000
    ? `${(province.population / 1_000_000).toFixed(2)} M`
    : `${(province.population / 1_000).toFixed(0)} K`;

  const playerNation  = useGameStateStore((s) => s.playerNation);
  const ownership     = useGameStateStore((s) => s.provinceOwnership);
  const treasury      = useGameStateStore((s) => s.nationEconomy.get(playerNation)?.treasury ?? 0);
  const buildings     = useBuildingStore((s) => s.buildings.get(province.id) ?? new Set<BuildingType>());
  const owner         = ownership.get(province.id) ?? province.countryCode;
  const isOwned       = owner === playerNation;

  const [buildFeedback, setBuildFeedback] = React.useState<string | null>(null);

  const handleBuildHere = (type: BuildingType) => {
    const def = BUILDING_DEF[type];
    const gs  = useGameStateStore.getState();
    if (!gs.deductTreasury(playerNation, def.buildCost)) {
      setBuildFeedback('✗ INSUFFICIENT FUNDS');
      setTimeout(() => setBuildFeedback(null), 1500);
      return;
    }
    useProductionStore.getState().enqueueBuilding(playerNation, province.id, type);
    setBuildFeedback(`✓ ${def.label.toUpperCase()} QUEUED`);
    setTimeout(() => setBuildFeedback(null), 1500);
  };

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={{ color: '#cdd9e5', fontSize: 20, letterSpacing: 2, fontWeight: 600 }}>
            {province.city.toUpperCase()}
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 1.5, marginTop: 3 }}>
            {province.country.toUpperCase()}
          </div>
          <div style={{ color: tierColor[tier], fontSize: 13, letterSpacing: 2, marginTop: 2 }}>
            ◆ {tier.toUpperCase()} · {isOwned ? <span style={{ color: '#3fb950' }}>OWNED</span> : <span style={{ color: '#7d8fa0' }}>{owner}</span>}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      <div style={{ padding: '10px 14px' }}>
        <PRow label="POPULATION"  value={popStr} />
        <PRow label="TAX INCOME"  value={`${province.taxIncome} B/turn`} />
        <PRow label="STRATEGIC"   value={
          <span style={{ color: sv >= 8 ? '#cf4444' : sv >= 6 ? '#e8a020' : '#3fb950' }}>{sv} / 10</span>
        } />
        <PRow label="COORDINATES" value={`${province.lat.toFixed(1)}°, ${province.lon.toFixed(1)}°`} />
      </div>

      {/* Buildings section */}
      <div style={{ borderTop: '1px solid #1e2d45' }}>
        <div style={{ padding: '6px 14px 4px', color: '#7d8fa0', fontSize: 11, letterSpacing: 2, fontWeight: 700, background: 'rgba(7,9,13,0.5)' }}>
          ▣ BUILDINGS {buildings.size > 0 ? `(${buildings.size})` : ''}
        </div>

        {/* Existing buildings */}
        {buildings.size > 0 && (
          <div style={{ padding: '4px 14px 6px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...buildings].map(bt => {
              const def = BUILDING_DEF[bt];
              const col = BUILDING_DOMAIN_COLOR[def.domain];
              return (
                <span key={bt} style={{
                  fontSize: 10, letterSpacing: 0.5, padding: '2px 6px',
                  border: `1px solid ${col}55`, color: col,
                  background: `rgba(${col === '#cf4444' ? '207,68,68' : col === '#3fb950' ? '63,185,80' : '210,168,255'},0.08)`,
                  borderRadius: 2,
                }}>
                  {def.label.toUpperCase()}
                </span>
              );
            })}
          </div>
        )}

        {buildings.size === 0 && (
          <div style={{ padding: '6px 14px', color: '#3a4a5a', fontSize: 11, letterSpacing: 1 }}>
            NO BUILDINGS
          </div>
        )}

        {/* Build controls — only for player-owned provinces */}
        {isOwned && (
          <>
            <div style={{ padding: '4px 14px 2px', color: '#7d8fa0', fontSize: 11, letterSpacing: 2, borderTop: '1px solid rgba(30,45,69,0.4)', background: 'rgba(7,9,13,0.3)' }}>
              BUILD HERE
            </div>
            {buildFeedback && (
              <div style={{ padding: '3px 14px', fontSize: 11, letterSpacing: 1, color: buildFeedback.startsWith('✓') ? '#3fb950' : '#cf4444' }}>
                {buildFeedback}
              </div>
            )}
            <div style={{ padding: '4px 14px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ALL_BUILDINGS.map(type => {
                const def       = BUILDING_DEF[type];
                const built     = buildings.has(type);
                const canAfford = treasury >= def.buildCost;
                const col       = BUILDING_DOMAIN_COLOR[def.domain];
                return (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: built ? 0.4 : canAfford ? 1 : 0.55 }}>
                    <span style={{ color: built ? '#3a4a5a' : '#cdd9e5', fontSize: 11, letterSpacing: 0.5 }}>
                      {built ? '✓ ' : ''}{def.label.toUpperCase()}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: canAfford ? '#3fb950' : '#cf4444', fontSize: 10 }}>{def.buildCost}B</span>
                      {!built && (
                        <button
                          onClick={() => handleBuildHere(type)}
                          disabled={!canAfford}
                          style={{
                            padding: '1px 5px', fontSize: 10, letterSpacing: 1, fontWeight: 700,
                            fontFamily: 'Rajdhani, sans-serif', cursor: canAfford ? 'pointer' : 'not-allowed',
                            background: canAfford ? `rgba(${col === '#cf4444' ? '207,68,68' : col === '#3fb950' ? '63,185,80' : '210,168,255'},0.1)` : 'transparent',
                            border: `1px solid ${canAfford ? col + '55' : '#1e2d45'}`,
                            color: canAfford ? col : '#3a4a5a',
                          }}
                        >
                          BUILD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── BuildingActionPanel ───────────────────────────────────────────────────────

const ALL_UNIT_TYPES = Object.keys(UNIT_DEF) as UnitType[];

function BuildingActionPanel({
  provinceId, buildingType, provinces, onClose,
}: {
  provinceId:   number;
  buildingType: BuildingType;
  provinces:    Province[];
  onClose:      () => void;
}): React.ReactElement {
  const playerNation = useGameStateStore((s) => s.playerNation);
  const economy      = useGameStateStore((s) => s.nationEconomy.get(playerNation));
  const ownership    = useGameStateStore((s) => s.provinceOwnership);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const treasury  = economy?.treasury  ?? 0;
  const oilStock  = economy?.oilStock  ?? 0;
  const foodStock = economy?.foodStock ?? 0;
  const reStock   = economy?.rareEarthStock ?? 0;
  const manpower  = economy?.manpower  ?? 0;

  const queue = useProductionStore((s) => getNationQueue(s.queues, playerNation));

  const prov = provinces.find(p => p.id === provinceId);
  const def  = BUILDING_DEF[buildingType];

  // Queue items being produced in this province that require this building
  const producing = queue.filter(item =>
    item.provinceId === provinceId &&
    item.kind === 'unit' &&
    item.unitType !== undefined &&
    UNIT_DEF[item.unitType]?.requiredBuilding === buildingType,
  );

  // Units that require this building type
  const trainable = ALL_UNIT_TYPES.filter(t => UNIT_DEF[t].requiredBuilding === buildingType);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleTrain = (type: UnitType) => {
    const udef = UNIT_DEF[type];
    const gs   = useGameStateStore.getState();
    const canAffordAll = treasury  >= udef.buildCost
      && oilStock  >= udef.oilCost
      && foodStock >= udef.foodCost
      && reStock   >= udef.rareEarthCost
      && manpower  >= udef.manpowerCost;
    if (!canAffordAll) { flash('✗ INSUFFICIENT RESOURCES'); return; }

    if (!gs.deductTreasury(playerNation, udef.buildCost)) { flash('✗ INSUFFICIENT FUNDS'); return; }
    gs.deductResources(playerNation, udef.oilCost, udef.foodCost, udef.rareEarthCost);
    gs.deductManpower(playerNation, udef.manpowerCost);
    useProductionStore.getState().enqueueUnit(playerNation, provinceId, type);
    flash(`✓ ${UNIT_FULL_NAME[type].toUpperCase()} QUEUED`);
  };

  const domainColor: Record<string, string> = { land: '#3fb950', air: '#58a6ff', naval: '#79c0ff' };
  const col = BUILDING_DOMAIN_COLOR[def.domain];

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, width: 240,
      background: 'rgba(10,14,20,0.97)', border: `1px solid ${col}55`,
      fontFamily: 'Rajdhani, sans-serif', zIndex: 30,
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderBottom: `1px solid ${col}44`,
        background: 'rgba(7,9,13,0.6)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, flexShrink: 0,
          background: `${col}18`, border: `1px solid ${col}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <img src={`/assets/buildings/${BUILDING_PNG_FILE[buildingType]}`} alt={def.label}
            style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: col, fontSize: 14, letterSpacing: 2, fontWeight: 700 }}>
            {def.label.toUpperCase()}
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 1, marginTop: 2 }}>
            {prov ? (prov.city || prov.country).toUpperCase() : `ZONE ${provinceId}`}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #1e2d45', color: '#7d8fa0',
          cursor: 'pointer', width: 20, height: 20, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>✕</button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '4px 12px', fontSize: 11, letterSpacing: 1.5, textAlign: 'center',
          color: feedback.startsWith('✓') ? '#3fb950' : '#cf4444',
          background: feedback.startsWith('✓') ? 'rgba(63,185,80,0.08)' : 'rgba(207,68,68,0.08)',
          borderBottom: '1px solid rgba(30,45,69,0.4)',
        }}>{feedback}</div>
      )}

      {/* Active production queue for this building */}
      {producing.length > 0 && (
        <div style={{ borderBottom: `1px solid ${col}33` }}>
          <div style={{
            padding: '4px 12px', fontSize: 14, letterSpacing: 2, fontWeight: 700,
            color: '#e8a020', background: 'rgba(232,160,32,0.06)',
          }}>
            ⟳ PRODUCING ({producing.length})
          </div>
          {producing.map((item, idx) => {
            const utype    = item.unitType!;
            const udef     = UNIT_DEF[utype];
            const done     = item.totalTurns - item.turnsLeft;
            const isActive = idx === 0;
            const dc       = domainColor[UNIT_DOMAIN[utype]] ?? '#3fb950';
            return (
              <div key={item.id} style={{
                padding: '6px 12px', borderBottom: '1px solid rgba(30,45,69,0.3)',
                background: isActive ? 'rgba(232,160,32,0.04)' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={`/assets/units/${UNIT_PNG_FILE[utype]}`} alt={utype}
                      style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ color: isActive ? '#cdd9e5' : '#5a6e82', fontSize: 14, letterSpacing: 1, fontWeight: isActive ? 700 : 400 }}>
                      {isActive ? '▶ ' : `${idx + 1}. `}{UNIT_FULL_NAME[utype].toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      color: item.turnsLeft === 1 ? '#3fb950' : '#e8a020',
                      fontSize: 14, fontWeight: 700, letterSpacing: 1,
                    }}>
                      {item.turnsLeft === 0 ? 'READY' : item.turnsLeft === 1 ? 'NEXT' : `${item.turnsLeft}T`}
                    </span>
                    {isActive && (
                      <button
                        onClick={() => useProductionStore.getState().cancelItem(playerNation, item.id)}
                        style={{
                          padding: '1px 5px', fontSize: 13, letterSpacing: 1, fontWeight: 700,
                          fontFamily: 'Rajdhani, sans-serif', cursor: 'pointer',
                          background: 'rgba(207,68,68,0.1)', border: '1px solid #cf444466',
                          color: '#cf4444',
                        }}
                      >✕</button>
                    )}
                  </div>
                </div>
                {/* Segmented progress bar */}
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: item.totalTurns }).map((_, t) => (
                    <div key={t} style={{
                      flex: 1, height: 3, borderRadius: 1,
                      background: t < done
                        ? (isActive ? dc : '#3a4a5a')
                        : 'rgba(30,45,69,0.7)',
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trainable units */}
      <div style={{ padding: '6px 0' }}>
        {trainable.length === 0 ? (
          <div style={{ padding: '8px 12px', color: '#3a4a5a', fontSize: 11, letterSpacing: 1 }}>
            NO UNITS REQUIRE THIS BUILDING
          </div>
        ) : trainable.map(type => {
          const udef = UNIT_DEF[type];
          const dc   = domainColor[UNIT_DOMAIN[type]] ?? '#3fb950';
          const canAfford = treasury  >= udef.buildCost
            && oilStock  >= udef.oilCost
            && foodStock >= udef.foodCost
            && reStock   >= udef.rareEarthCost
            && manpower  >= udef.manpowerCost;
          return (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderBottom: '1px solid rgba(30,45,69,0.3)',
              opacity: canAfford ? 1 : 0.45,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                background: `${dc}18`, border: `1px solid ${dc}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                <img src={`/assets/units/${UNIT_PNG_FILE[type]}`} alt={type}
                  style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#cdd9e5', fontSize: 13, letterSpacing: 1, fontWeight: 600 }}>
                  {UNIT_FULL_NAME[type]}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 1 }}>
                  <span style={{ color: treasury >= udef.buildCost ? '#3fb950' : '#cf4444', fontSize: 10 }}>{udef.buildCost}B</span>
                  {udef.oilCost  > 0 && <span style={{ color: oilStock  >= udef.oilCost  ? '#e8a020' : '#cf4444', fontSize: 10 }}>{udef.oilCost}OIL</span>}
                  {udef.foodCost > 0 && <span style={{ color: foodStock >= udef.foodCost ? '#79c0ff' : '#cf4444', fontSize: 10 }}>{udef.foodCost}FOD</span>}
                  {udef.manpowerCost > 0 && <span style={{ color: manpower >= udef.manpowerCost ? '#58a6ff' : '#cf4444', fontSize: 10 }}>{udef.manpowerCost}MP</span>}
                  <span style={{ color: '#7d8fa0', fontSize: 10 }}>{udef.buildTime}T</span>
                </div>
              </div>
              <button
                onClick={() => handleTrain(type)}
                disabled={!canAfford}
                style={{
                  padding: '3px 7px', fontSize: 11, letterSpacing: 1.5, fontWeight: 700,
                  fontFamily: 'Rajdhani, sans-serif', cursor: canAfford ? 'pointer' : 'not-allowed',
                  background: canAfford ? `${dc}18` : 'transparent',
                  border: `1px solid ${canAfford ? dc + '66' : '#1e2d45'}`,
                  color: canAfford ? dc : '#3a4a5a', flexShrink: 0,
                }}
              >BUILD</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid rgba(30,45,69,0.5)',
    }}>
      <span style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 1.5 }}>{label}</span>
      <span style={{ color: '#cdd9e5', fontSize: 11, letterSpacing: 1 }}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(7,9,13,0.88)', pointerEvents: 'none',
};
const overlayBoxStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  background: 'rgba(10,14,20,0.92)', border: '1px solid #1E2D45',
  padding: '28px 40px', fontFamily: 'Rajdhani, sans-serif',
};
const badgeStyle: React.CSSProperties = {
  background: 'rgba(10,14,20,0.85)', border: '1px solid #1E2D45',
  color: '#3FB950', fontSize: 14, letterSpacing: 2,
  padding: '4px 10px', fontFamily: 'Rajdhani, monospace',
};
const panelStyle: React.CSSProperties = {
  position: 'absolute', top: 12, right: 12, width: 260,
  background: 'rgba(10,14,20,0.96)', border: '1px solid #1E2D45',
  fontFamily: 'Rajdhani, sans-serif', zIndex: 30,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
};
const panelHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '12px 14px', borderBottom: '1px solid #1E2D45',
  background: 'rgba(7,9,13,0.5)',
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #1E2D45', color: '#7d8fa0',
  cursor: 'pointer', width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, flexShrink: 0, fontFamily: 'monospace',
};
