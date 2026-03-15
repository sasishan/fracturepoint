/**
 * UnitStore — Zustand store for all in-game units, selection state,
 * move-range highlights, and A* path previews.
 *
 * Combat is resolved here when a unit moves into an enemy-occupied province.
 * Results are deterministic only if a seeded RNG is supplied; for now we use
 * Math.random() since there is no server.
 */

import { create } from 'zustand';
import type { Province }        from '../map/ProvinceClipper';
import type { AdjacencyGraph }  from '../map/AdjacencyGraph';
import { computeMoveRange, findPath, type MoveRange } from '../map/MovementSystem';
import type { LocalUnit }       from './LocalUnit';
import { UNIT_DOMAIN, TARGET_DOMAINS, UNIT_SUPPORT_TYPE } from './LocalUnit';
import { UNIT_DEF }             from './UnitDefinitions';
import { useGameStateStore }    from './GameStateStore';
import { AudioManager, VOICE, WEAPON_SFX } from './AudioManager';

// ── Adjacency helper ─────────────────────────────────────────────────────────

/**
 * Special forces are land-only and cannot reach provinces only accessible via sea.
 * All other units use the combined sea+land adjacency (blocked by domain rules).
 */
function adjForUnit(
  type: LocalUnit['type'],
  landAdj: AdjacencyGraph,
  seaAdj: AdjacencyGraph,
): AdjacencyGraph {
  if (type === 'special_forces') return landAdj;
  return seaAdj.size > 0 ? seaAdj : landAdj;
}

// ── Combat ────────────────────────────────────────────────────────────────────

export interface CombatResult {
  outcome:              'attacker_wins' | 'defender_holds';
  attackerCasualties:   number;   // strength points lost per attacking unit (avg)
  defenderCasualties:   number;   // strength points lost per defending unit (avg)
  provinceId:           number;   // defender / target province
  attackerProvinceId:   number;   // attacker's source province
  attackerNation:       string;
  defenderNation:       string;
  bonuses:              string[];  // human-readable modifiers that fired
}

// Terrain defense multiplier — denser urban areas are harder to capture
function terrainBonus(provinceId: number, provinces: Province[]): number {
  const p = provinces.find(pr => pr.id === provinceId);
  if (!p) return 1.0;
  if (p.population >= 5_000_000) return 1.15;   // megacity
  if (p.population >= 1_000_000) return 1.08;   // major city
  if (p.population >= 200_000)   return 1.05;   // regional hub
  return 1.0;
}

// BFS retreat — nearest province owned by this nation reachable through adjacency
function findRetreatProvince(
  fromId:     number,
  nationCode: string,
  adjacency:  AdjacencyGraph,
  provinces:  Province[],
  ownership:  Map<number, string>,
): number | null {
  const visited = new Set<number>([fromId]);
  const queue   = [...(adjacency.get(fromId) ?? [])];
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const owner = ownership.get(cur) ?? provinces.find(p => p.id === cur)?.countryCode;
    if (owner === nationCode) return cur;
    for (const n of (adjacency.get(cur) ?? [])) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return null;
}

/**
 * resolveBattle — group vs group combat with full modifier stack.
 *
 * Domain filter:   units can only engage enemy domains listed in TARGET_DOMAINS.
 * Combined arms:   mixed infantry+tank +10%, artillery present +10%, air support +10%.
 * Fortification:   defending fortified unit ×1.25; engineers ×1.10.
 * Terrain:         population-based province multiplier on defense.
 * Supply penalty:  primary attacker already spent movement → -10% attack.
 * Damage model:    damage = |aRoll − dRoll| × 0.3, clamped 10–50.
 *                  Loser takes full damage, winner takes 25%.
 */
function resolveBattle(
  attackers:  LocalUnit[],
  defenders:  LocalUnit[],
  provinceId: number,
  provinces:  Province[],
): CombatResult {
  const bonuses: string[] = [];

  // ── Domain filter ─────────────────────────────────────────────────────────
  const defDomains = new Set(defenders.map(d => UNIT_DOMAIN[d.type]));
  const atkDomains = new Set(attackers.map(a => UNIT_DOMAIN[a.type]));

  const validAtk = attackers.filter(a => TARGET_DOMAINS[a.type].some(td => defDomains.has(td)));
  const validDef = defenders.filter(d => TARGET_DOMAINS[d.type].some(td => atkDomains.has(td)));

  // Unarmed defenders still absorb damage even if they can't shoot back
  const effectiveDef = validDef.length > 0 ? validDef : defenders;

  // ── Attack power ──────────────────────────────────────────────────────────
  const rawAtk = validAtk.reduce((s, u) => s + UNIT_DEF[u.type].attack * (u.strength / 100), 0);

  // ── Combined-arms bonus ───────────────────────────────────────────────────
  const atkTypes      = new Set(validAtk.map(u => u.type));
  const hasInfOrTank  = validAtk.some(u => u.type === 'infantry' || u.type === 'tank' || u.type === 'special_forces');
  const hasArtillery  = validAtk.some(u => UNIT_SUPPORT_TYPE[u.type] === 'artillery');
  const hasAirSupport = validAtk.some(u => UNIT_SUPPORT_TYPE[u.type] === 'air_support');
  const hasMixed      = atkTypes.size >= 2 && hasInfOrTank && validAtk.some(u => u.type === 'tank' || u.type === 'infantry');

  let combinedArmsBonus = 1.0;
  if (hasMixed)      { combinedArmsBonus += 0.10; bonuses.push('COMBINED ARMS +10%'); }
  if (hasArtillery)  { combinedArmsBonus += 0.10; bonuses.push('ARTILLERY SUPPORT +10%'); }
  if (hasAirSupport) { combinedArmsBonus += 0.10; bonuses.push('AIR SUPPORT +10%'); }

  // ── Supply penalty: primary attacker already spent all movement ───────────
  const supplyMult = attackers[0]?.movementPoints === 0 ? 0.90 : 1.0;
  if (supplyMult < 1) bonuses.push('SUPPLY STRAIN -10%');

  // ── Defense power ─────────────────────────────────────────────────────────
  const rawDef = effectiveDef.reduce((s, u) => s + UNIT_DEF[u.type].defense * (u.strength / 100), 0);

  // ── Fortification & engineer bonuses ─────────────────────────────────────
  let fortMult = 1.0;
  if (effectiveDef.some(u => u.fortified))           { fortMult *= 1.25; bonuses.push('FORTIFIED +25%'); }
  if (effectiveDef.some(u => u.type === 'engineers')) { fortMult *= 1.10; bonuses.push('ENGINEERS +10%'); }

  // ── Terrain bonus ─────────────────────────────────────────────────────────
  const terrain = terrainBonus(provinceId, provinces);
  if (terrain > 1.0) bonuses.push(`URBAN TERRAIN +${Math.round((terrain - 1) * 100)}%`);

  // ── Final power rolls ─────────────────────────────────────────────────────
  const attackerPower = rawAtk * combinedArmsBonus * supplyMult;
  const defenderPower = rawDef * fortMult * terrain;

  // Attacker has more variance; defender gets a small home advantage
  const aRoll = attackerPower * (0.85 + Math.random() * 0.30);
  const dRoll = defenderPower * (1.00 + Math.random() * 0.25);

  // ── Damage model ──────────────────────────────────────────────────────────
  const rawDamage    = Math.abs(aRoll - dRoll) * 0.3;
  const loserDamage  = Math.round(Math.max(10, Math.min(50, rawDamage)));
  const winnerDamage = Math.round(loserDamage * 0.25);

  const attackerWins = aRoll > dRoll;

  return {
    outcome:            attackerWins ? 'attacker_wins' : 'defender_holds',
    attackerCasualties: attackerWins ? winnerDamage : loserDamage,
    defenderCasualties: attackerWins ? loserDamage  : winnerDamage,
    provinceId,
    attackerNation:     attackers[0]?.nationCode ?? '',
    defenderNation:     defenders[0]?.nationCode ?? '',
    bonuses,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface UnitStore {
  units:          Map<string, LocalUnit>;
  selectedUnitId: string | null;
  /** True when the selected unit is part of a same-type stack — all group members move/fortify together. */
  groupSelected:  boolean;
  moveRange:      MoveRange | null;
  pendingPath:    number[] | null;
  lastCombat:     CombatResult | null;

  // Persistent map data (set once after the clip pipeline)
  _provinces:    Province[];
  _adjacency:    AdjacencyGraph;        // land-only (province IDs)
  _seaAdjacency: AdjacencyGraph;        // combined land+sea (all IDs)
  _seaZoneIds:   Set<number>;           // IDs that are sea zones
  _coastalIds:   Set<number>;           // land province IDs adjacent to sea

  // Setup
  initUnits:  (units: LocalUnit[]) => void;
  setMapData: (
    provinces:    Province[],
    adjacency:    AdjacencyGraph,
    seaAdjacency: AdjacencyGraph,
    seaZoneIds:   Set<number>,
    coastalIds:   Set<number>,
  ) => void;

  // Selection / hover
  selectUnit:       (id: string | null) => void;
  setGroupSelected: (v: boolean) => void;
  hoverDestination: (provinceId: number) => void;

  // Orders
  moveUnit:      (unitId: string, targetProvinceId: number, onConquer?: (provinceId: number, newOwner: string) => void) => void;
  /** Commit an animation-driven move without requiring moveRange (already validated pre-animation).
   *  When groupSelected is true, all same-type units in the same province move together. */
  commitMove:    (unitId: string, targetProvinceId: number, cost: number, onConquer?: (provinceId: number, newOwner: string) => void) => void;
  attackProvince:(unitId: string, targetProvinceId: number, onConquer?: (provinceId: number, newOwner: string) => void) => void;
  /** Fortify: spend all remaining movement points in exchange for a defensive posture flag.
   *  When groupSelected is true, the entire stack fortifies together. */
  fortifyUnit:   (unitId: string) => void;

  // Spawn (production)
  spawnUnit: (unit: LocalUnit) => void;

  // Elimination
  removeUnitsOfNation: (nationCode: string) => void;

  // Turn
  resetMovement: () => void;

  // New game
  reset: () => void;
}

export const useUnitStore = create<UnitStore>((set, get) => ({
  units:          new Map(),
  selectedUnitId: null,
  groupSelected:  false,
  moveRange:      null,
  pendingPath:    null,
  lastCombat:     null,

  _provinces:    [],
  _adjacency:    new Map(),
  _seaAdjacency: new Map(),
  _seaZoneIds:   new Set(),
  _coastalIds:   new Set(),

  // ── Setup ───────────────────────────────────────────────────────────────────

  initUnits: (units) =>
    set({ units: new Map(units.map(u => [u.id, u])) }),

  setMapData: (provinces, adjacency, seaAdjacency, seaZoneIds, coastalIds) =>
    set({ _provinces: provinces, _adjacency: adjacency, _seaAdjacency: seaAdjacency, _seaZoneIds: seaZoneIds, _coastalIds: coastalIds }),

  // ── Selection ───────────────────────────────────────────────────────────────

  selectUnit: (id) => {
    if (!id) {
      set({ selectedUnitId: null, groupSelected: false, moveRange: null, pendingPath: null });
      return;
    }
    const unit = get().units.get(id);
    if (!unit) {
      set({ selectedUnitId: id, groupSelected: false, moveRange: null, pendingPath: null });
      return;
    }

    // Voice line for player's own units only
    if (unit.nationCode === useGameStateStore.getState().playerNation) {
      const domain = UNIT_DOMAIN[unit.type] ?? 'land';
      AudioManager.playRandom(...(
        domain === 'air'   ? VOICE.selectAir   :
        domain === 'naval' ? VOICE.selectNaval :
                             VOICE.selectLand
      ));
    }

    // Detect same-type stack in this province
    const stack = Array.from(get().units.values()).filter(
      u => u.provinceId === unit.provinceId && u.type === unit.type && u.nationCode === unit.nationCode,
    );
    const isGroup = stack.length > 1;
    // Group range is limited by the unit with the fewest movement points
    const effectiveMP = isGroup
      ? Math.min(...stack.map(u => u.movementPoints))
      : unit.movementPoints;

    if (effectiveMP === 0) {
      set({ selectedUnitId: id, groupSelected: isGroup, moveRange: null, pendingPath: null });
      return;
    }

    const { _seaAdjacency, _adjacency, _seaZoneIds, _coastalIds, _provinces } = get();
    const adj = adjForUnit(unit.type, _adjacency, _seaAdjacency);
    if (!adj.size) {
      set({ selectedUnitId: id, groupSelected: isGroup, moveRange: null, pendingPath: null });
      return;
    }

    // Domain movement restrictions — build blocked set
    const domain = UNIT_DOMAIN[unit.type];
    let blocked  = new Set<number>();

    if (domain === 'land') {
      blocked = new Set(_seaZoneIds);
    } else if (domain === 'naval') {
      for (const p of _provinces) {
        if (!_seaZoneIds.has(p.id) && !_coastalIds.has(p.id)) blocked.add(p.id);
      }
    }

    // Block provinces occupied by friendly units of a DIFFERENT type
    // (same-type units stack; cross-type co-occupation is not allowed)
    for (const u of get().units.values()) {
      if (u.nationCode === unit.nationCode && u.type !== unit.type && u.provinceId !== unit.provinceId) {
        blocked.add(u.provinceId);
      }
    }

    const range = computeMoveRange(unit.provinceId, effectiveMP, adj, blocked);
    set({ selectedUnitId: id, groupSelected: isGroup, moveRange: range, pendingPath: null });
  },

  setGroupSelected: (v) => {
    const { selectedUnitId, units, _seaAdjacency, _adjacency, _seaZoneIds, _coastalIds, _provinces } = get();
    if (!selectedUnitId) return;
    const unit = units.get(selectedUnitId);
    if (!unit) return;

    if (!v) {
      // Ungroup: recompute range using only this unit's movement points
      const adj = adjForUnit(unit.type, _adjacency, _seaAdjacency);
      if (!adj.size || unit.movementPoints === 0) {
        set({ groupSelected: false, moveRange: null });
        return;
      }
      const domain  = UNIT_DOMAIN[unit.type];
      let blocked   = new Set<number>();
      if (domain === 'land') blocked = new Set(_seaZoneIds);
      else if (domain === 'naval') {
        for (const p of _provinces) {
          if (!_seaZoneIds.has(p.id) && !_coastalIds.has(p.id)) blocked.add(p.id);
        }
      }
      for (const u of units.values()) {
        if (u.nationCode === unit.nationCode && u.type !== unit.type && u.provinceId !== unit.provinceId) {
          blocked.add(u.provinceId);
        }
      }
      const range = computeMoveRange(unit.provinceId, unit.movementPoints, adj, blocked);
      set({ groupSelected: false, moveRange: range });
    } else {
      // Group: recompute range using min movement points across the stack
      const stack = Array.from(units.values()).filter(
        u => u.provinceId === unit.provinceId && u.type === unit.type && u.nationCode === unit.nationCode,
      );
      if (stack.length < 2) return;
      const effectiveMP = Math.min(...stack.map(u => u.movementPoints));
      const adj = adjForUnit(unit.type, _adjacency, _seaAdjacency);
      if (!adj.size || effectiveMP === 0) {
        set({ groupSelected: true, moveRange: null });
        return;
      }
      const domain  = UNIT_DOMAIN[unit.type];
      let blocked   = new Set<number>();
      if (domain === 'land') blocked = new Set(_seaZoneIds);
      else if (domain === 'naval') {
        for (const p of _provinces) {
          if (!_seaZoneIds.has(p.id) && !_coastalIds.has(p.id)) blocked.add(p.id);
        }
      }
      for (const u of units.values()) {
        if (u.nationCode === unit.nationCode && u.type !== unit.type && u.provinceId !== unit.provinceId) {
          blocked.add(u.provinceId);
        }
      }
      const range = computeMoveRange(unit.provinceId, effectiveMP, adj, blocked);
      set({ groupSelected: true, moveRange: range });
    }
  },

  hoverDestination: (provinceId) => {
    const { selectedUnitId, moveRange, units, _provinces, _seaAdjacency, _adjacency } = get();
    if (!selectedUnitId || !moveRange) return;
    if (!moveRange.reachable.has(provinceId)) { set({ pendingPath: null }); return; }
    const unit = units.get(selectedUnitId);
    if (!unit) return;
    const adj = adjForUnit(unit.type, _adjacency, _seaAdjacency);
    const path = findPath(unit.provinceId, provinceId, adj, _provinces);
    set({ pendingPath: path });
  },

  // ── Move (empty province) ───────────────────────────────────────────────────

  moveUnit: (unitId, targetProvinceId, onConquer) => {
    const { units, moveRange } = get();
    const unit = units.get(unitId);
    if (!unit || !moveRange?.reachable.has(targetProvinceId)) return;
    // Refuse if a friendly different-type unit already occupies the target
    if (Array.from(units.values()).some(
      u => u.provinceId === targetProvinceId && u.nationCode === unit.nationCode && u.type !== unit.type,
    )) return;

    const cost = moveRange.costs.get(targetProvinceId) ?? 1;
    const newUnits = new Map(units);
    newUnits.set(unitId, {
      ...unit,
      provinceId:     targetProvinceId,
      movementPoints: Math.max(0, unit.movementPoints - cost),
    });
    set({ units: newUnits, selectedUnitId: null, groupSelected: false, moveRange: null, pendingPath: null });
    onConquer?.(targetProvinceId, unit.nationCode);
  },

  // ── Commit (post-animation, moveRange already cleared) ──────────────────────

  commitMove: (unitId, targetProvinceId, cost, onConquer) => {
    const { units, groupSelected } = get();
    const unit = units.get(unitId);
    if (!unit) return;
    const newUnits = new Map(units);

    if (groupSelected) {
      // Move all units in the same-type stack together
      const stack = Array.from(units.values()).filter(
        u => u.provinceId === unit.provinceId && u.type === unit.type && u.nationCode === unit.nationCode,
      );
      for (const u of stack) {
        newUnits.set(u.id, {
          ...u,
          provinceId:     targetProvinceId,
          movementPoints: Math.max(0, u.movementPoints - cost),
        });
      }
    } else {
      newUnits.set(unitId, {
        ...unit,
        provinceId:     targetProvinceId,
        movementPoints: Math.max(0, unit.movementPoints - cost),
      });
    }

    set({ units: newUnits });
    onConquer?.(targetProvinceId, unit.nationCode);
  },

  // ── Attack (enemy-occupied province) ────────────────────────────────────────

  attackProvince: (unitId, targetProvinceId, onConquer) => {
    const { units, _provinces, _adjacency, _seaAdjacency } = get();
    const primaryAttacker = units.get(unitId);
    if (!primaryAttacker) return;

    // All enemy units in the target province
    const defenders = Array.from(units.values()).filter(
      u => u.provinceId === targetProvinceId && u.nationCode !== primaryAttacker.nationCode,
    );
    if (defenders.length === 0) {
      get().moveUnit(unitId, targetProvinceId, onConquer);
      return;
    }

    // All friendly units in the same source province contribute attack power
    const supporters = Array.from(units.values()).filter(
      u => u.provinceId === primaryAttacker.provinceId
        && u.nationCode === primaryAttacker.nationCode
        && u.id !== unitId,
    );
    const attackerGroup = [primaryAttacker, ...supporters];

    const playerNationNow = useGameStateStore.getState().playerNation;

    const playerIsAttacker = primaryAttacker.nationCode === playerNationNow;
    const playerIsDefender = defenders.some(u => u.nationCode === playerNationNow);

    if (playerIsAttacker || playerIsDefender) {
      // Voice order (player attacker only)
      if (playerIsAttacker) AudioManager.playRandom(...VOICE.attack);
      // Alert when player's units are being attacked by enemy
      if (playerIsDefender) AudioManager.play('unit_under_attack');
      // Weapon fire only when player is involved
      const weaponKeys = WEAPON_SFX[primaryAttacker.type];
      if (weaponKeys) AudioManager.playRandom(...weaponKeys);
    }

    const result = { ...resolveBattle(attackerGroup, defenders, targetProvinceId, _provinces), attackerProvinceId: primaryAttacker.provinceId };
    const newUnits = new Map(units);

    const ownership = useGameStateStore.getState().provinceOwnership;
    const adj       = adjForUnit(primaryAttacker.type, _adjacency, _seaAdjacency);

    if (result.outcome === 'attacker_wins') {
      // Defenders are marked routed — they stay in the province this turn and
      // auto-retreat at the start of the next turn (resetMovement).
      // The attacker waits in the source province and advances manually next turn.
      for (const u of defenders) {
        const newStr = u.strength - result.defenderCasualties;
        if (newStr <= 0) {
          newUnits.delete(u.id);   // destroyed outright
        } else {
          newUnits.set(u.id, { ...u, strength: Math.max(5, newStr), movementPoints: 0, fortified: false, routed: true });
        }
      }
      // Attackers spend their movement but do NOT advance yet
      for (const u of attackerGroup) {
        newUnits.set(u.id, {
          ...u,
          strength:       Math.max(5, u.strength - result.attackerCasualties),
          movementPoints: 0,
          experience:     Math.min(100, u.experience + (u.id === unitId ? 5 : 3)),
        });
      }

    } else {
      // Defender holds — badly damaged attackers (<20 str) rout immediately;
      // others fall back in place with movement spent.
      const routeAttacker = (u: LocalUnit, newStr: number) => {
        if (newStr <= 0) { newUnits.delete(u.id); return; }
        const retreatId = findRetreatProvince(u.provinceId, u.nationCode, adj, _provinces, ownership);
        if (retreatId !== null) {
          newUnits.set(u.id, { ...u, provinceId: retreatId, strength: Math.max(5, newStr), movementPoints: 0, fortified: false, routed: false });
        } else {
          newUnits.delete(u.id);   // surrounded — destroyed
        }
      };

      for (const u of attackerGroup) {
        const newStr = u.strength - result.attackerCasualties;
        if (newStr < 20) routeAttacker(u, newStr);
        else newUnits.set(u.id, { ...u, strength: Math.max(5, newStr), movementPoints: 0 });
      }
      // Winning defenders take light casualties but hold their ground
      for (const u of defenders) {
        newUnits.set(u.id, { ...u, strength: Math.max(5, u.strength - result.defenderCasualties), experience: Math.min(100, u.experience + 3) });
      }
    }

    // Every combat raises global DEFCON tension
    useGameStateStore.getState().raiseDefcon();

    // Play outcome sound if the player was involved
    if (result.attackerNation === playerNationNow || result.defenderNation === playerNationNow) {
      const playerWon =
        (result.attackerNation === playerNationNow && result.outcome === 'attacker_wins') ||
        (result.defenderNation === playerNationNow && result.outcome === 'defender_holds');
      AudioManager.play(playerWon ? 'combat_victory' : 'combat_defeat');
    }

    set({ units: newUnits, selectedUnitId: null, groupSelected: false, moveRange: null, pendingPath: null, lastCombat: result });
  },

  // ── Fortify ──────────────────────────────────────────────────────────────────

  fortifyUnit: (unitId) => {
    const { units, groupSelected } = get();
    const unit = units.get(unitId);
    if (!unit || unit.movementPoints === 0) return;   // already spent

    const newUnits = new Map(units);

    if (unit.nationCode === useGameStateStore.getState().playerNation) {
      AudioManager.playRandom(...VOICE.fortify);
    }

    if (groupSelected) {
      // Fortify the entire same-type stack
      const stack = Array.from(units.values()).filter(
        u => u.provinceId === unit.provinceId && u.type === unit.type && u.nationCode === unit.nationCode,
      );
      for (const u of stack) {
        newUnits.set(u.id, { ...u, movementPoints: 0, fortified: true });
      }
    } else {
      newUnits.set(unitId, { ...unit, movementPoints: 0, fortified: true });
    }

    set({ units: newUnits, selectedUnitId: null, groupSelected: false, moveRange: null, pendingPath: null });
  },

  // ── Spawn (production) ──────────────────────────────────────────────────

  spawnUnit: (unit) => {
    const newUnits = new Map(get().units);
    newUnits.set(unit.id, unit);
    set({ units: newUnits });
  },

  removeUnitsOfNation: (nationCode) => {
    const newUnits = new Map(get().units);
    for (const [id, unit] of newUnits) {
      if (unit.nationCode === nationCode) newUnits.delete(id);
    }
    set({ units: newUnits });
  },

  // ── End of turn ─────────────────────────────────────────────────────────────

  resetMovement: () => {
    const { _provinces, _adjacency, _seaAdjacency } = get();
    const newUnits  = new Map(get().units);
    const ownership = useGameStateStore.getState().provinceOwnership;
    // Step 1: retreat all routed units before refreshing movement.
    // Routed units from last turn's combat now flee to the nearest friendly province.
    for (const [id, unit] of newUnits) {
      if (!unit.routed) continue;
      const adj = adjForUnit(unit.type, _adjacency, _seaAdjacency);
      const retreatId = findRetreatProvince(unit.provinceId, unit.nationCode, adj, _provinces, ownership);
      if (retreatId !== null) {
        newUnits.set(id, { ...unit, provinceId: retreatId, routed: false });
      } else {
        newUnits.delete(id);   // surrounded — no escape, unit destroyed
      }
    }

    // Step 2: refresh movement for all survivors
    for (const [id, unit] of newUnits) {
      newUnits.set(id, { ...unit, movementPoints: unit.maxMovementPoints, fortified: false, routed: false });
    }

    set({ units: newUnits, lastCombat: null });
  },

  reset: () => set({
    units:          new Map(),
    selectedUnitId: null,
    groupSelected:  false,
    moveRange:      null,
    pendingPath:    null,
    lastCombat:     null,
  }),
}));
