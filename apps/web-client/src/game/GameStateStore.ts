/**
 * GameStateStore — global game-state slice for the local (offline) M07/M08 session.
 *
 * Tracks:
 *   • Player nation (ISO-3 country code)
 *   • Province ownership overrides (what conquests look like on the map)
 *   • Per-nation income + treasury (derived from Province.taxIncome)
 *   • Turn counter and game date (starts 1 Jan 2026)
 *   • DEFCON level (1–5; raised toward 1 when combat occurs)
 *   • serverTick — monotonic counter used by TopBar; increments each End Turn
 */

import { create } from 'zustand';
import type { Province } from '../map/ProvinceClipper';
import { UNIT_DEF }     from './UnitDefinitions';

// ── Nation economy summary ────────────────────────────────────────────────────

export interface NationEconomy {
  code:           string;
  name:           string;
  income:         number;   // B USD / turn (sum of controlled province taxIncome)
  treasury:       number;   // accumulated B USD
  provinces:      number;   // count of controlled provinces
  energy:         number;   // strategic energy score
  manpower:       number;   // recruitable troops (thousands / turn)
  researchPoints: number;   // accumulated RP
  // Extended resources
  oil:            number;   // barrels equivalent / turn
  food:           number;   // food units / turn
  rareEarth:      number;   // rare earth units / turn
  politicalPower: number;   // PP / turn (diplomatic currency)
  // Stockpiles (cumulative, spent on production)
  oilStock:            number;
  foodStock:           number;
  rareEarthStock:      number;
  politicalPowerStock: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface GameStateStore {
  playerNation:      string;                  // ISO-3 code
  /** 'all' = all 12 nations active; 'major' = only the 6 major powers */
  opponentsMode:     'all' | 'major';
  provinceOwnership: Map<number, string>;     // provinceId → nationCode
  nationEconomy:     Map<string, NationEconomy>;
  turn:              number;
  gameYear:          number;
  gameMonth:         number;

  /** Nuclear tension level (5 = peace, 1 = war imminent). */
  defcon:     number;
  /** Monotonic tick counter — increments on every End Turn. */
  serverTick: number;
  /** Always false until M06 networking is implemented. */
  connected:  boolean;
  /** Phase label shown in TopBar ("SKIRMISH", "LOBBY", etc.). */
  phase:      string;

  // Setup
  initFromProvinces: (provinces: Province[], playerNation?: string) => void;

  // Province ownership (called when a unit conquers a province)
  setProvinceOwner: (provinceId: number, newOwner: string) => void;

  // Economy tick (called on End Turn)
  tickEconomy: () => void;

  /** Deduct amount from nationCode's treasury. Returns false if insufficient funds. */
  deductTreasury: (nationCode: string, amount: number) => boolean;

  /** Deduct Political Power. Returns false if insufficient. */
  spendPP: (nationCode: string, amount: number) => boolean;

  /** Deduct resources (oil/food/rareEarth) from stockpiles. Returns false if any insufficient. */
  deductResources: (nationCode: string, oil: number, food: number, rareEarth: number) => boolean;

  /** Deduct manpower. Returns false if insufficient. */
  deductManpower: (nationCode: string, amount: number) => boolean;

  /** Apply per-turn unit maintenance costs across all nations.
   *  Caller passes units to avoid circular import with UnitStore. */
  tickMaintenance: (units: Map<string, { type: string; nationCode: string }>) => void;

  // DEFCON
  setDefcon:   (n: number) => void;
  /** Raise tension by 1 step toward 1 (clamped). Called whenever combat occurs. */
  raiseDefcon: () => void;

  /** Change the active player nation (called from main menu on game start). */
  setPlayerNation: (code: string) => void;
  setOpponentsMode: (mode: 'all' | 'major') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function advanceDate(year: number, month: number): [number, number] {
  month += 1;
  if (month > 12) { month = 1; year += 1; }
  return [year, month];
}

function provinceEnergy(pop: number): number {
  if (pop >= 5_000_000) return 8;
  if (pop >= 1_000_000) return 4;
  if (pop >= 200_000)   return 2;
  return 1;
}

// Nations with significant oil production
const OIL_NATIONS = new Set(['SAU', 'IRN', 'IRQ', 'UAE', 'KWT', 'QAT', 'RUS', 'USA', 'VEN', 'NOR', 'LBY',
  'GBR', 'CHN', 'IND', 'PAK', 'PRK', 'ISR', 'TUR', 'DEU', 'FRA']);
// Nations with rare earth deposits
const RE_NATIONS  = new Set(['CHN', 'RUS', 'BRA', 'IND', 'AUS', 'USA', 'MNG', 'PRK', 'VNM', 'ZAF']);
// Nations with strong agricultural output
const FOOD_NATIONS = new Set(['USA', 'BRA', 'CHN', 'RUS', 'IND', 'ARG', 'FRA', 'DEU', 'UKR', 'AUS', 'CAN']);

function provinceOilYield(countryCode: string, pop: number): number {
  if (!OIL_NATIONS.has(countryCode)) return 0;
  return pop >= 1_000_000 ? 4 : pop >= 200_000 ? 2 : 1;
}

function provinceREYield(countryCode: string, pop: number): number {
  if (!RE_NATIONS.has(countryCode)) return 0;
  return pop >= 1_000_000 ? 2 : 1;
}

function provinceFoodYield(countryCode: string, pop: number): number {
  const base = FOOD_NATIONS.has(countryCode) ? 3 : 1;
  return pop >= 1_000_000 ? base * 2 : pop >= 200_000 ? base : Math.ceil(base / 2);
}

function buildEconomy(
  provinces:     Province[],
  ownership:     Map<number, string>,
  activeNations?: Set<string>,
): Map<string, NationEconomy> {
  const eco = new Map<string, NationEconomy>();

  for (const p of provinces) {
    const owner = ownership.get(p.id) ?? p.countryCode;
    // Inactive nations still own provinces (map coloring) but get no economy entry
    if (activeNations && !activeNations.has(owner)) continue;
    let entry = eco.get(owner);
    if (!entry) {
      entry = {
        code: owner, name: p.country,
        income: 0, treasury: 0, provinces: 0,
        energy: 0, manpower: 0, researchPoints: 0,
        oil: 0, food: 0, rareEarth: 0, politicalPower: 0,
        oilStock: 0, foodStock: 0, rareEarthStock: 0, politicalPowerStock: 0,
      };
      eco.set(owner, entry);
    }
    entry.income     += p.taxIncome;
    entry.provinces  += 1;
    entry.energy     += provinceEnergy(p.population);
    entry.manpower   += Math.max(0, Math.round(p.population * 0.01 / 1_000));
    entry.oil        += provinceOilYield(p.countryCode, p.population);
    entry.food       += provinceFoodYield(p.countryCode, p.population);
    entry.rareEarth  += provinceREYield(p.countryCode, p.population);
    entry.politicalPower += 1; // 1 PP per province
  }

  // Enforce minimum resource rates so every nation can field units.
  const MIN_OIL = 2, MIN_FOOD = 2, MIN_RE = 1;
  for (const entry of eco.values()) {
    entry.oil      = Math.max(entry.oil,      MIN_OIL);
    entry.food     = Math.max(entry.food,     MIN_FOOD);
    entry.rareEarth = Math.max(entry.rareEarth, MIN_RE);
  }

  // Seed starting stockpiles so units are purchasable from turn 1.
  for (const entry of eco.values()) {
    entry.treasury       = entry.income * 5;
    entry.oilStock       = entry.oil    * 10;
    entry.foodStock      = entry.food   * 10;
    entry.rareEarthStock = entry.rareEarth * 10;
  }

  return eco;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  playerNation:      '',
  opponentsMode:     'all',
  provinceOwnership: new Map(),
  nationEconomy:     new Map(),
  turn:              1,
  gameYear:          2026,
  gameMonth:         1,
  defcon:            5,
  serverTick:        0,
  connected:         false,
  phase:             'SKIRMISH',

  initFromProvinces: (provinces, playerNation) => {
    // Build initial ownership: each province belongs to its country code
    const ownership = new Map<number, string>(
      provinces.map(p => [p.id, p.countryCode]),
    );

    // Choose player nation if not provided: country with most provinces
    let chosenNation = playerNation ?? '';
    if (!chosenNation) {
      const counts = new Map<string, number>();
      for (const p of provinces) {
        counts.set(p.countryCode, (counts.get(p.countryCode) ?? 0) + 1);
      }
      let best = 0;
      for (const [code, count] of counts) {
        if (count > best) { best = count; chosenNation = code; }
      }
    }

    const { opponentsMode } = get();
    const MAJOR_NATIONS = new Set(['USA', 'RUS', 'CHN', 'EUF', 'IND', 'GBR']);
    const activeNations: Set<string> | undefined = opponentsMode === 'major'
      ? new Set([...MAJOR_NATIONS, chosenNation])
      : undefined;

    const eco = buildEconomy(provinces, ownership, activeNations);

    set({
      playerNation:      chosenNation,
      provinceOwnership: ownership,
      nationEconomy:     eco,
      turn:              1,
      gameYear:          2026,
      gameMonth:         1,
      defcon:            5,
      serverTick:        0,
    });
  },

  setProvinceOwner: (provinceId, newOwner) => {
    const ownership = new Map(get().provinceOwnership);
    ownership.set(provinceId, newOwner);
    set({ provinceOwnership: ownership });
    // Economy will be recalculated on next tickEconomy call
  },

  tickEconomy: () => {
    const { nationEconomy, provinceOwnership, turn, gameYear, gameMonth, serverTick } = get();

    // Add income + resources to each nation's stockpiles
    const newEco = new Map(nationEconomy);
    for (const [code, entry] of newEco) {
      const rpGain = Math.max(1, Math.floor(entry.income * 0.05));
      newEco.set(code, {
        ...entry,
        treasury:            entry.treasury + entry.income,
        researchPoints:      Math.min(9999, entry.researchPoints + rpGain),
        oilStock:            Math.min(9999, entry.oilStock + entry.oil),
        foodStock:           Math.min(9999, entry.foodStock + entry.food),
        rareEarthStock:      Math.min(9999, entry.rareEarthStock + entry.rareEarth),
        politicalPowerStock: Math.min(999,  entry.politicalPowerStock + entry.politicalPower),
      });
    }

    const [newYear, newMonth] = advanceDate(gameYear, gameMonth);

    set({
      nationEconomy: newEco,
      turn:          turn + 1,
      serverTick:    serverTick + 1,
      gameYear:      newYear,
      gameMonth:     newMonth,
      provinceOwnership,
    });
  },

  deductTreasury: (nationCode, amount) => {
    const eco   = new Map(get().nationEconomy);
    const entry = eco.get(nationCode);
    if (!entry || entry.treasury < amount) return false;
    eco.set(nationCode, { ...entry, treasury: entry.treasury - amount });
    set({ nationEconomy: eco });
    return true;
  },

  spendPP: (nationCode, amount) => {
    const eco   = new Map(get().nationEconomy);
    const entry = eco.get(nationCode);
    if (!entry || entry.politicalPowerStock < amount) return false;
    eco.set(nationCode, { ...entry, politicalPowerStock: entry.politicalPowerStock - amount });
    set({ nationEconomy: eco });
    return true;
  },

  deductResources: (nationCode, oil, food, rareEarth) => {
    const eco   = new Map(get().nationEconomy);
    const entry = eco.get(nationCode);
    if (!entry) return false;
    if (entry.oilStock < oil || entry.foodStock < food || entry.rareEarthStock < rareEarth) return false;
    eco.set(nationCode, {
      ...entry,
      oilStock:       entry.oilStock - oil,
      foodStock:      entry.foodStock - food,
      rareEarthStock: entry.rareEarthStock - rareEarth,
    });
    set({ nationEconomy: eco });
    return true;
  },

  deductManpower: (nationCode, amount) => {
    const eco   = new Map(get().nationEconomy);
    const entry = eco.get(nationCode);
    if (!entry || entry.manpower < amount) return false;
    eco.set(nationCode, { ...entry, manpower: entry.manpower - amount });
    set({ nationEconomy: eco });
    return true;
  },

  tickMaintenance: (units) => {
    const maintenance = new Map<string, { treasury: number; oil: number; food: number; rareEarth: number }>();
    for (const unit of units.values()) {
      const def  = UNIT_DEF[unit.type as keyof typeof UNIT_DEF];
      if (!def) continue;
      const prev = maintenance.get(unit.nationCode) ?? { treasury: 0, oil: 0, food: 0, rareEarth: 0 };
      maintenance.set(unit.nationCode, {
        treasury:  prev.treasury  + def.maintenanceCost,
        oil:       prev.oil       + def.oilUpkeep,
        food:      prev.food      + def.foodUpkeep,
        rareEarth: prev.rareEarth + def.rareEarthUpkeep,
      });
    }

    const eco = new Map(get().nationEconomy);
    for (const [code, costs] of maintenance) {
      const entry = eco.get(code);
      if (!entry) continue;
      eco.set(code, {
        ...entry,
        treasury:       Math.max(0, entry.treasury       - costs.treasury),
        oilStock:       Math.max(0, entry.oilStock       - costs.oil),
        foodStock:      Math.max(0, entry.foodStock      - costs.food),
        rareEarthStock: Math.max(0, entry.rareEarthStock - costs.rareEarth),
      });
    }
    set({ nationEconomy: eco });
  },

  setDefcon: (n) => set({ defcon: Math.max(1, Math.min(5, n)) }),

  raiseDefcon: () => {
    const { defcon } = get();
    set({ defcon: Math.max(1, defcon - 1) });
  },

  setPlayerNation: (code) => set({ playerNation: code }),
  setOpponentsMode: (mode) => set({ opponentsMode: mode }),
}));

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectPlayerEconomy = (s: GameStateStore) =>
  s.nationEconomy.get(s.playerNation) ?? null;
