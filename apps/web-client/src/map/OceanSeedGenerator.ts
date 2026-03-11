/**
 * OceanSeedGenerator — produces Voronoi seed points guaranteed to be in ocean.
 *
 * Strategy: sample a regular lat/lon grid and reject any point that falls
 * inside a country polygon (via the existing CountryIndex bbox + PiP check).
 * The survivors are guaranteed to lie in open water and get a geographic
 * zone name (Pacific, Atlantic, etc.) used to label the resulting sea zone.
 */

import { booleanPointInPolygon, point as turfPoint } from '@turf/turf';
import type { CountryIndex } from './ProvinceClipper';
import type { City }         from './CityLoader';

// ── Geographic zone naming ─────────────────────────────────────────────────────

/**
 * Rough IHO-inspired basin names derived from coordinate position only.
 * Good enough for strategy-game sea-zone labels.
 */
export function getOceanZoneName(lon: number, lat: number): string {
  if (lat >  66)                                        return 'Arctic Ocean';
  if (lat < -60)                                        return 'Southern Ocean';
  if (lat >  30 && lat < 46 && lon >  -6 && lon <  36) return 'Mediterranean Sea';
  if (lat >  10 && lat < 30 && lon > -88 && lon < -60) return 'Caribbean Sea';
  if (lat >  -5 && lat < 35 && lon > 100 && lon < 122) return 'South China Sea';
  if (lat >  35 && lat < 65 && lon >  -5 && lon <  30) return 'North Sea / Baltic';
  if (lat >  20 && lat < 40 && lon >  36 && lon <  65) return 'Arabian Sea';
  if (lat > -30 && lat <  5 && lon >  80 && lon < 100) return 'Bay of Bengal';
  // Pacific: west and east of date-line gap
  if (lon >  110 || lon < -80)                          return 'Pacific Ocean';
  // Indian: east of Africa, south-west of SE Asia
  if (lon >  20  && lon < 110 && lat < 30)              return 'Indian Ocean';
  return 'Atlantic Ocean';
}

// ── OceanSeed type ─────────────────────────────────────────────────────────────

/** A City-compatible seed point known to be in open water. */
export interface OceanSeed extends City {
  readonly isOcean: true;
  readonly zoneName: string;
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generate ocean seed points on a regular lat/lon grid, discarding any that
 * fall on land.  A spacing of 15° gives ~100–150 seeds worldwide.
 *
 * @param countryIndex  Country polygon index built by loadCountryIndex()
 * @param spacing       Grid step in degrees (default 15)
 */
export function generateOceanSeeds(
  countryIndex: CountryIndex,
  spacing = 15,
): OceanSeed[] {
  const seeds: OceanSeed[] = [];

  for (let lat = -75; lat <= 80; lat += spacing) {
    for (let lon = -180; lon < 180; lon += spacing) {
      const pt = turfPoint([lon, lat]);
      let onLand = false;

      for (const entry of countryIndex.entries) {
        const [minLon, minLat, maxLon, maxLat] = entry.bbox;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
        if (booleanPointInPolygon(pt, entry.feature)) { onLand = true; break; }
      }

      if (onLand) continue;

      const zoneName = getOceanZoneName(lon, lat);
      seeds.push({
        name:       `${zoneName} (${lon >= 0 ? '+' : ''}${lon},${lat >= 0 ? '+' : ''}${lat})`,
        lat, lon,
        population: 0,
        isOcean:    true,
        zoneName,
      });
    }
  }

  console.info(`[OceanSeedGenerator] ${seeds.length} ocean seeds at ${spacing}° spacing`);
  return seeds;
}
