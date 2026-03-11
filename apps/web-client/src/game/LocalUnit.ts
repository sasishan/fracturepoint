/**
 * LocalUnit — client-side unit representation for M07 gameplay.
 *
 * 21 unit types across three domains (land / air / naval), each mapped to a
 * PNG silhouette in /assets/units/. The renderer tints units with their nation's
 * stable hue so every country looks distinct without extra image sets.
 */

export type UnitDomain = 'land' | 'air' | 'naval';

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
  nationCode:        string;   // ISO-3, matches Province.countryCode
  provinceId:        number;   // current Voronoi province
  strength:          number;   // 0–100
  movementPoints:    number;   // remaining this turn
  maxMovementPoints: number;   // reset each turn
  experience:        number;   // 0–100
}

// ── Movement allowances ───────────────────────────────────────────────────────

export const MOVEMENT_RANGE: Record<UnitType, number> = {
  // Land
  infantry:        1,
  tank:            2,
  artillery:       1,
  multi_launcher:  1,
  air_defense:     1,
  special_forces:  2,
  reserves:        1,
  engineers:       1,
  launcher:        1,
  logistics:       2,
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
  infantry:        'infantry.png',
  tank:            'tank.png',
  artillery:       'artillery.png',
  multi_launcher:  'multi-launcher.png',
  air_defense:     'surface-to-air.png',
  special_forces:  'special-forces.png',
  reserves:        'reserves.png',
  engineers:       'engineerds.png',   // filename typo preserved
  launcher:        'launcher.png',
  logistics:       'convoy.png',
  stealth_fighter: 'stealthfighter.png',
  bomber:          'bomber.png',
  helicopter:      'chopper.png',
  transport_heli:  'transport-heli.png',
  combat_drone:    'drones.png',
  recon_drone:     'surveillance-drones.png',
  carrier:         'aircraft-carrier.png',
  destroyer:       'destroyer.png',
  warship:         'warship.png',
  nuclear_sub:     'nuclear-sub.png',
  assault_ship:    'assault-ship.png',
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
