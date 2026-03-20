/**
 * LocalUnit — client-side unit representation for M07 gameplay.
 *
 * 21 unit types across three domains (land / air / naval), each mapped to a
 * PNG silhouette in /assets/units/. The renderer tints units with their nation's
 * stable hue so every country looks distinct without extra image sets.
 */

export type UnitDomain  = 'land' | 'air' | 'naval';
export type UnitState   = 'idle' | 'conflict';
export type UnitStance  = 'normal' | 'fortify';

export type UnitType =
  // ── Land ──────────────────────────────────────────────────────────────────
  | 'infantry'        | 'tank'           | 'artillery'
  | 'multi_launcher'  | 'air_defense'    | 'special_forces'
  | 'reserves'        | 'engineers'      | 'launcher'
  | 'logistics'
  // ── Air ───────────────────────────────────────────────────────────────────
  | 'stealth_fighter' | 'bomber'         | 'helicopter'
  | 'transport_heli'  | 'combat_drone'   | 'recon_drone'
  // ── Naval ─────────────────────────────────────────────────────────────────
  | 'carrier'         | 'destroyer'      | 'warship'
  | 'nuclear_sub'     | 'assault_ship';

export interface LocalUnit {
  id:                string;
  type:              UnitType;
  nationCode:        string;      // ISO-3, matches Province.countryCode
  provinceId:        number;      // current Voronoi province
  strength:          number;      // 0–100
  movementPoints:    number;      // remaining this turn
  maxMovementPoints: number;      // reset each turn
  experience:        number;      // 0–100
  /** 'conflict' persists for one full turn after combat, then clears to 'idle'. */
  state:             UnitState;
  /** 'fortify' is set by the Fortify action and cleared when the unit moves. */
  stance:            UnitStance;
  /** True during the turn the unit fought; cleared at the start of the next turn. */
  foughtThisTurn:    boolean;
  /** @deprecated use state === 'conflict' instead */
  routed?:           boolean;
}

// ── Movement allowances ───────────────────────────────────────────────────────

export const MOVEMENT_RANGE: Record<UnitType, number> = {
  // Land
  infantry:        2,
  tank:            3,
  artillery:       3,
  multi_launcher:  3,
  air_defense:     2,
  special_forces:  2,
  reserves:        2,
  engineers:       2,
  launcher:        2,
  logistics:       3,
  // Air
  stealth_fighter: 6,
  bomber:          4,
  helicopter:      3,
  transport_heli:  3,
  combat_drone:    5,
  recon_drone:     5,
  // Naval
  carrier:         4,
  destroyer:       4,
  warship:         3,
  nuclear_sub:     4,
  assault_ship:    3,
};

// ── PNG filenames (served from /assets/units/) ────────────────────────────────

export const UNIT_PNG_FILE: Record<UnitType, string> = {
  infantry:        'infantry.avif',
  tank:            'tank.avif',
  artillery:       'artillery.avif',
  multi_launcher:  'multi-launcher.avif',
  air_defense:     'surface-to-air.avif',
  special_forces:  'special-forces.avif',
  reserves:        'reserves.avif',
  engineers:       'engineerds.avif',   // filename typo preserved
  launcher:        'launcher.avif',
  logistics:       'convoy.avif',
  stealth_fighter: 'stealthfighter.avif',
  bomber:          'bomber.avif',
  helicopter:      'chopper.avif',
  transport_heli:  'transport-heli.avif',
  combat_drone:    'drones.avif',
  recon_drone:     'surveillance-drones.avif',
  carrier:         'aircraft-carrier.avif',
  destroyer:       'destroyer.avif',
  warship:         'warship.avif',
  nuclear_sub:     'nuclear-sub.avif',
  assault_ship:    'assault-ship.avif',
};

export const UNIT_ZOOMED_PNG_FILE: Record<UnitType, string> = {
  infantry:        'infantry-zoomed.avif',
  tank:            'tank-zoomed.avif',
  artillery:       'artillery-zoomed.avif',
  multi_launcher:  'multi-launcher-zoomed.avif',
  air_defense:     'surface-to-air.avif',
  special_forces:  'special-forces-zoomed.avif',
  reserves:        'reserves-zoomed.avif',
  engineers:       'engineerds.avif',   // filename typo preserved
  launcher:        'launcher-zoomed.avif',
  logistics:       'convoy.avif',
  stealth_fighter: 'stealthfighter-zoomed.avif',
  bomber:          'bomber-zoomed.avif',
  helicopter:      'chopper.avif',
  transport_heli:  'transport-heli-zoomed.avif',
  combat_drone:    'drones.avif',
  recon_drone:     'surveillance-drones-zoomed.avif',
  carrier:         'aircraft-carrier.avif',
  destroyer:       'destroyer-zoomed.avif',
  warship:         'warship.avif',
  nuclear_sub:     'nuclear-sub-zoomed.avif',
  assault_ship:    'assault-ship-zoomed.avif',
};
// ── Domain lookup ─────────────────────────────────────────────────────────────

export const UNIT_DOMAIN: Record<UnitType, UnitDomain> = {
  infantry: 'land', tank: 'land', artillery: 'land', multi_launcher: 'land',
  air_defense: 'land', special_forces: 'land', reserves: 'land',
  engineers: 'land', launcher: 'land', logistics: 'land',
  stealth_fighter: 'air', bomber: 'air', helicopter: 'air',
  transport_heli: 'air', combat_drone: 'air', recon_drone: 'air',
  carrier: 'naval', destroyer: 'naval', warship: 'naval',
  nuclear_sub: 'naval', assault_ship: 'naval',
};

// ── Target domain restrictions (which enemy domains this unit can engage) ─────
// Empty array = unarmed / cannot initiate combat.

export const TARGET_DOMAINS: Record<UnitType, UnitDomain[]> = {
  // Land — fight land and/or air only; no naval targeting
  infantry:        ['land'],
  reserves:        ['land'],
  special_forces:  ['land'],
  engineers:       ['land'],
  logistics:       [],               // unarmed support
  tank:            ['land'],
  artillery:       ['land', 'air'],
  multi_launcher:  ['land', 'air'],
  launcher:        ['land', 'air'],
  air_defense:     ['air'],          // intercepts air only
  // Air — fighters engage air + land; bombers hit land + naval
  stealth_fighter: ['air', 'land'],
  bomber:          ['land', 'naval'],
  helicopter:      ['land'],
  transport_heli:  [],               // unarmed transport
  combat_drone:    ['land', 'air'],
  recon_drone:     [],               // unarmed recon
  // Naval — fight naval; destroyer + warship can shore-bombard coastal land
  destroyer:       ['naval', 'land'],
  warship:         ['naval', 'land'],
  nuclear_sub:     ['naval'],
  carrier:         ['naval'],
  assault_ship:    ['naval'],
};

// ── Support types (used for combined-arms bonus calculation) ──────────────────

export type SupportType = 'artillery' | 'air_support' | 'none';

export const UNIT_SUPPORT_TYPE: Record<UnitType, SupportType> = {
  infantry: 'none',        reserves: 'none',        special_forces: 'none',
  engineers: 'none',       logistics: 'none',        tank: 'none',
  artillery: 'artillery',  multi_launcher: 'artillery', launcher: 'artillery',
  air_defense: 'none',
  stealth_fighter: 'air_support', bomber: 'air_support',
  helicopter: 'air_support',      transport_heli: 'none',
  combat_drone: 'air_support',    recon_drone: 'none',
  destroyer: 'none',   warship: 'none',   nuclear_sub: 'none',
  carrier: 'none',     assault_ship: 'none',
};

// ── Display names ─────────────────────────────────────────────────────────────

export const UNIT_FULL_NAME: Record<UnitType, string> = {
  infantry:        'Infantry',
  tank:            'Armored',
  artillery:       'Artillery',
  multi_launcher:  'Rocket Artillery',
  air_defense:     'Air Defense',
  special_forces:  'Special Forces',
  reserves:        'Reserves',
  engineers:       'Engineers',
  launcher:        'Missile Launcher',
  logistics:       'Logistics',
  stealth_fighter: 'Stealth Fighter',
  bomber:          'Bomber',
  helicopter:      'Helicopter',
  transport_heli:  'Transport Heli',
  combat_drone:    'Combat Drone',
  recon_drone:     'Recon Drone',
  carrier:         'Aircraft Carrier',
  destroyer:       'Destroyer',
  warship:         'Warship',
  nuclear_sub:     'Nuclear Sub',
  assault_ship:    'Assault Ship',
};

// ── Short labels (fallback when image unavailable) ────────────────────────────

export const UNIT_LABEL: Record<UnitType, string> = {
  infantry: 'INF', tank: 'TNK', artillery: 'ART', multi_launcher: 'MRL',
  air_defense: 'SAM', special_forces: 'SOF', reserves: 'RES',
  engineers: 'ENG', launcher: 'MSL', logistics: 'LOG',
  stealth_fighter: 'F', bomber: 'BMB', helicopter: 'HEL',
  transport_heli: 'TRN', combat_drone: 'UAV', recon_drone: 'REC',
  carrier: 'CVN', destroyer: 'DDG', warship: 'WSP',
  nuclear_sub: 'SUB', assault_ship: 'LHD',
};
