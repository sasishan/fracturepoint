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

// ── Nation economy summary ────────────────────────────────────────────────────

export interface NationEconomy {
  code:        string;
  name:        string;
  income:      number;   // B USD / turn (sum of controlled province taxIncome)
  treasury:    number;   // accumulated B USD
  provinces:   number;   // count of controlled provinces
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface GameStateStore {
  playerNation:      string;                  // ISO-3 code
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

  // DEFCON
  setDefcon:   (n: number) => void;
  /** Raise tension by 1 step toward 1 (clamped). Called whenever combat occurs. */
  raiseDefcon: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function advanceDate(year: number, month: number): [number, number] {
  month += 1;
  if (month > 12) { month = 1; year += 1; }
  return [year, month];
}

function buildEconomy(
  provinces:   Province[],
  ownership:   Map<number, string>,
): Map<string, NationEconomy> {
  const eco = new Map<string, NationEconomy>();

  for (const p of provinces) {
    const owner = ownership.get(p.id) ?? p.countryCode;
    let entry = eco.get(owner);
    if (!entry) {
      entry = { code: owner, name: p.country, income: 0, treasury: 0, provinces: 0 };
      eco.set(owner, entry);
    }
    entry.income    += p.taxIncome;
    entry.provinces += 1;
  }
  return eco;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  playerNation:      '',
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

    const eco = buildEconomy(provinces, ownership);

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

    // Add income to treasury for each nation
    const newEco = new Map(nationEconomy);
    for (const [code, entry] of newEco) {
      newEco.set(code, { ...entry, treasury: entry.treasury + entry.income });
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

  setDefcon: (n) => set({ defcon: Math.max(1, Math.min(5, n)) }),

  raiseDefcon: () => {
    const { defcon } = get();
    set({ defcon: Math.max(1, defcon - 1) });
  },
}));

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectPlayerEconomy = (s: GameStateStore) =>
  s.nationEconomy.get(s.playerNation) ?? null;
