/**
 * SeedGenerator — builds the unified seed array for a single Voronoi pass.
 *
 * Layout of the returned array:
 *   [0 … cityCount-1]   land seeds (one per city)
 *   [cityCount … end]   sea  seeds (regular lat/lon grid, land excluded)
 *
 * Keeping land seeds first means voronoi.cells[i] for i < cityCount is always
 * a city cell, which ProvinceClassifier exploits to avoid re-checking seed type.
 *
 * Coastline correctness is guaranteed by ProvinceClassifier, not here:
 * sea cells are clipped by subtracting country polygons rather than
 * intersecting with a separate ocean polygon, so both sides of a coastline
 * share the exact same polygon edge.
 */

import {
  booleanPointInPolygon,
  point    as turfPoint,
  simplify as turfSimplify,
} from '@turf/turf';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { City }         from './CityLoader';
import type { CountryIndex } from './ProvinceClipper';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CombinedSeed {
  lat:        number;
  lon:        number;
  population: number;
  name:       string;
  type:       'land' | 'sea';
  zoneName:   string;   // ocean basin label (empty string for land)
}

// ── Geographic zone labelling ──────────────────────────────────────────────────

export function getOceanZoneName(lon: number, lat: number): string {
  if (lat >  66)                                        return 'Arctic Ocean';
  if (lat < -60)                                        return 'Southern Ocean';
  if (lat >  30 && lat < 46 && lon >  -6 && lon <  36) return 'Mediterranean Sea';
  if (lat >  10 && lat < 30 && lon > -88 && lon < -60) return 'Caribbean Sea';
  if (lat >  -5 && lat < 35 && lon > 100 && lon < 122) return 'South China Sea';
  if (lat >  35 && lat < 65 && lon >  -5 && lon <  30) return 'North Sea';
  if (lat >  20 && lat < 40 && lon >  36 && lon <  65) return 'Arabian Sea';
  if (lat > -30 && lat <  5 && lon >  80 && lon < 100) return 'Bay of Bengal';
  if (lon >  110 || lon < -80)                          return 'Pacific Ocean';
  if (lon >  20  && lon < 110 && lat < 30)              return 'Indian Ocean';
  return 'Atlantic Ocean';
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Combine city seeds with ocean grid seeds into one sorted array.
 *
 * @param cities        Loaded city records
 * @param countryIndex  Country polygon index (rejects grid points on land)
 * @param oceanSpacing  Degrees between ocean grid points (default 8)
 */
export function generateCombinedSeeds(
  cities:       City[],
  countryIndex: CountryIndex,
  oceanSpacing  = 8,
): { seeds: CombinedSeed[]; cityCount: number } {
  // Land seeds — one per city, order preserved
  const landSeeds: CombinedSeed[] = cities.map(c => ({
    lat:        c.lat,
    lon:        c.lon,
    population: c.population,
    name:       c.name,
    type:       'land',
    zoneName:   '',
  }));

  // Sea seeds — regular grid, skip any point that falls inside a country
  const seaSeeds: CombinedSeed[] = [];

  for (let lat = -75; lat <= 80; lat += oceanSpacing) {
    for (let lon = -180; lon < 180; lon += oceanSpacing) {
      const pt = turfPoint([lon, lat]);
      let onLand = false;

      for (const entry of countryIndex.entries) {
        const [minLon, minLat, maxLon, maxLat] = entry.bbox;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
        if (booleanPointInPolygon(pt, entry.feature)) { onLand = true; break; }
      }

      if (onLand) continue;
      const zoneName = getOceanZoneName(lon, lat);
      seaSeeds.push({
        lat, lon,
        population: 0,
        name:       zoneName,
        type:       'sea',
        zoneName,
      });
    }
  }

  console.info(
    `[SeedGenerator] ${landSeeds.length} land + ${seaSeeds.length} sea seeds` +
    ` (${oceanSpacing}° spacing)`,
  );
  return { seeds: [...landSeeds, ...seaSeeds], cityCount: landSeeds.length };
}

// ── Ghost land seeds ───────────────────────────────────────────────────────────

/**
 * Fetch lands.geojson and return the first feature simplified for fast
 * point-in-polygon checks (tolerance 0.3° ≈ 33 km).
 */
export async function loadLandFeature(
  url = '/land/lands.geojson',
): Promise<Feature<MultiPolygon | Polygon>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`LandLoader: HTTP ${res.status} — ${url}`);

  const fc = await res.json() as FeatureCollection;
  const feat = fc.features[0] as Feature<MultiPolygon | Polygon> | undefined;
  if (!feat) throw new Error('LandLoader: no features in lands.geojson');

  // Simplify for speed — coastline detail is not needed here
  return turfSimplify(feat, { tolerance: 0.3, highQuality: false, mutate: false }) as
    Feature<MultiPolygon | Polygon>;
}

/**
 * Generate synthetic land seeds for areas not covered by any city.
 *
 * Walks a regular lat/lon grid; each candidate point is kept only if:
 *   (a) it falls inside the unified land polygon (lands.geojson), and
 *   (b) its nearest city is farther away than `minCityDist` degrees.
 *
 * The resulting seeds are City-compatible (population = 0, name = lat/lon
 * label) so they flow through the exact same Voronoi + clip pipeline as
 * real city seeds.
 *
 * @param landFeature  Simplified land MultiPolygon from loadLandFeature()
 * @param cities       Existing city seeds to compute exclusion distances from
 * @param gridSpacing  Degrees between candidate grid points (default 5°)
 * @param minCityDist  Min distance (degrees) from nearest city (default 3°)
 */
export function generateGhostLandSeeds(
  landFeature: Feature<MultiPolygon | Polygon>,
  cities:      City[],
  gridSpacing  = 5,
  minCityDist  = 3,
): City[] {
  const ghosts: City[]    = [];
  const minDistSq = minCityDist * minCityDist;

  for (let lat = -80; lat <= 83; lat += gridSpacing) {
    for (let lon = -180; lon < 180; lon += gridSpacing) {
      // Fast city-proximity rejection (squared euclidean in lon/lat is fine
      // as a conservative distance estimate; exact haversine not needed here)
      let tooClose = false;
      for (const city of cities) {
        const dlat = lat - city.lat;
        const dlon = lon - city.lon;
        if (dlat * dlat + dlon * dlon < minDistSq) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Land polygon check
      if (!booleanPointInPolygon(turfPoint([lon, lat]), landFeature)) continue;

      // Readable coordinate label: "45°N 80°E"
      const ns   = lat >= 0 ? 'N' : 'S';
      const ew   = lon >= 0 ? 'E' : 'W';
      const name = `${Math.abs(Math.round(lat))}°${ns} ${Math.abs(Math.round(lon))}°${ew}`;

      ghosts.push({ name, lat, lon, population: 0 });
    }
  }

  console.info(`[SeedGenerator] ${ghosts.length} ghost land seeds generated`);
  return ghosts;
}
