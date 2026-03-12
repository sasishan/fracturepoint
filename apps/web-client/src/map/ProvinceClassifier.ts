/**
 * ProvinceClassifier — two-Voronoi classification and clipping.
 *
 * Gap-free coastlines — the core insight
 * ────────────────────────────────────────
 * Previous approach (single combined Voronoi):
 *   Land city seeds compete with ocean seeds → Voronoi boundaries are pushed
 *   far offshore → near-shore ocean strips left uncovered after land clipping.
 *
 * This approach (two separate Voronoi diagrams):
 *   landVoronoi  = generateVoronoi(cities)     — city seeds only
 *   seaVoronoi   = generateVoronoi(seaSeeds)   — ocean seeds only
 *
 *   land cell  =  landVoronoiCell  ∩  countryPolygon
 *   sea  cell  =  seaVoronoiCell   −  ⋃(overlapping country polygons)
 *
 * Because ocean Voronoi has no land-seed competitors, each ocean cell extends
 * naturally to the coastline.  The subtracted country polygon boundary is
 * shared with land province clipping → zero geometric gap.
 *
 * Performance:
 *   • Country polygons are pre-simplified to 0.1° tolerance (in loadCountryIndex).
 *   • Sea cells only subtract countries whose bbox overlaps the cell bbox.
 *   • Far-from-land sea cells skip the subtraction loop entirely.
 *   • Results are cached in localStorage; keyed on land-count + sea-count + country-count.
 *   • Event-loop yields every 20 seeds keep the browser responsive.
 */

import {
  intersect,
  difference,
  featureCollection,
  polygon  as turfPolygon,
  bbox     as turfBbox,
  booleanPointInPolygon,
  point    as turfPoint,
} from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import { Delaunay }  from 'd3-delaunay';

import type { City }             from './CityLoader';
import type { CombinedSeed }    from './SeedGenerator';
import type { VoronoiResult }   from './VoronoiGenerator';
import type {
  Province, ProvinceBounds, CountryIndex,
}                               from './ProvinceClipper';
import type { SeaZone }         from './SeaZoneGenerator';
import {
  EquirectangularProjection,
  WORLD_W, WORLD_H,
}                               from './ProjectionSystem';

// ── Result type ───────────────────────────────────────────────────────────────

export interface ClassifyResult {
  /** Land provinces, IDs 0 … P-1. */
  provinces: Province[];
  /** Sea zones, IDs P … P+S-1.  Both share the same country-polygon boundary. */
  seaZones:  SeaZone[];
  /** Province-only Delaunay for ProvinceRenderer hit-testing. */
  delaunay:  Delaunay<number>;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function ringToPixels(
  ring: Position[],
  proj: EquirectangularProjection,
): Float64Array {
  const flat = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    const [x, y] = proj.project(pt?.[0] ?? 0, pt?.[1] ?? 0);
    flat[i * 2]     = x;
    flat[i * 2 + 1] = y;
  }
  return flat;
}

function extractRings(
  geom: Polygon | MultiPolygon,
  proj: EquirectangularProjection,
): Float64Array[] {
  const rings: Float64Array[] = [];
  if (geom.type === 'Polygon') {
    const outer = geom.coordinates[0];
    if (outer && outer.length >= 3) rings.push(ringToPixels(outer, proj));
  } else {
    for (const poly of geom.coordinates) {
      const outer = poly[0];
      if (outer && outer.length >= 3) rings.push(ringToPixels(outer, proj));
    }
  }
  return rings;
}

function computeBounds(rings: Float64Array[]): ProvinceBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 2) {
      const x = ring[i] ?? 0, y = ring[i + 1] ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

// ── Country lookup ────────────────────────────────────────────────────────────

function findCountry(
  lon: number,
  lat: number,
  index: CountryIndex,
): (typeof index.entries)[number] | null {
  const pt = turfPoint([lon, lat]);
  for (const entry of index.entries) {
    const [minLon, minLat, maxLon, maxLat] = entry.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (booleanPointInPolygon(pt, entry.feature)) return entry;
  }
  return null;
}

// ── Delaunay builder ──────────────────────────────────────────────────────────

function buildDelaunay(items: ReadonlyArray<{ cx: number; cy: number }>): Delaunay<number> {
  const flat = new Float64Array(items.length * 2);
  for (let i = 0; i < items.length; i++) {
    flat[i * 2]     = items[i]?.cx ?? 0;
    flat[i * 2 + 1] = items[i]?.cy ?? 0;
  }
  return new Delaunay(flat);
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'clf-v5';

interface CacheBlob {
  provinces: Array<Omit<Province, 'rings'> & { rings: number[][] }>;
  seaZones:  Array<Omit<SeaZone,  'rings'> & { rings: number[][] }>;
}

function cacheKey(landCount: number, seaCount: number, countryCount: number): string {
  return `ww3-classify-${CACHE_VERSION}-l${landCount}-s${seaCount}-c${countryCount}`;
}

function saveCache(key: string, provinces: Province[], seaZones: SeaZone[]): void {
  try {
    const blob: CacheBlob = {
      provinces: provinces.map(p => ({ ...p, rings: p.rings.map(r => Array.from(r)) })),
      seaZones:  seaZones.map(z => ({ ...z, rings: z.rings.map(r => Array.from(r)) })),
    };
    localStorage.setItem(key, JSON.stringify(blob));
    console.info(`[ProvinceClassifier] cached ${provinces.length} provinces + ${seaZones.length} sea zones`);
  } catch (e) {
    console.warn('[ProvinceClassifier] cache write failed:', e);
  }
}

function loadCache(key: string): { provinces: Province[]; seaZones: SeaZone[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const blob = JSON.parse(raw) as CacheBlob;
    return {
      provinces: blob.provinces.map(p => ({ ...p, rings: p.rings.map(r => new Float64Array(r)) })),
      seaZones:  blob.seaZones.map(z => ({ ...z, rings: z.rings.map(r => new Float64Array(r)) })),
    };
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Classify and clip land provinces + sea zones using TWO separate Voronoi diagrams.
 *
 * Land provinces  (from landVoronoi, one cell per city/ghost seed):
 *   Intersect each cell with the landmass polygon (lands.geojson).
 *   Provinces stop at coastlines but freely cross country borders.
 *   Country name/code are still assigned by point-in-polygon on the seed.
 *
 * Sea zones  (from seaVoronoi, one cell per sea seed):
 *   Start from the raw Voronoi cell, then subtract each country polygon whose
 *   bounding box overlaps the cell.  Because there are no city seeds competing
 *   with ocean seeds, each ocean cell extends naturally all the way to the
 *   coastline — eliminating the near-shore coverage gap.
 *
 *   Sea zone boundary = country polygon boundary → zero gap with land provinces.
 *
 * Province IDs: 0 … P-1
 * Sea zone IDs: P … P+S-1   (so combined IDs form a contiguous range)
 *
 * @param cities        City records (land seeds); indices match landVoronoi.cells
 * @param landVoronoi   Voronoi built from city seeds only
 * @param seaSeeds      Sea seed records; indices match seaVoronoi.cells
 * @param seaVoronoi    Voronoi built from sea seeds only
 * @param countryIndex  Pre-simplified country polygon index (for country name lookup)
 * @param landFeature   Landmass polygon (lands.geojson) used to clip provinces to coastlines
 * @param proj          Equirectangular projection (default world size)
 * @param onProgress    Progress callback (done, total)
 */
export async function classifyAndClip(
  cities:       City[],
  landVoronoi:  VoronoiResult,
  seaSeeds:     CombinedSeed[],
  seaVoronoi:   VoronoiResult,
  countryIndex: CountryIndex,
  landFeature:  Feature<Polygon | MultiPolygon>,
  proj:         EquirectangularProjection = new EquirectangularProjection(WORLD_W, WORLD_H),
  onProgress?:  (done: number, total: number) => void,
): Promise<ClassifyResult> {

  const key    = cacheKey(cities.length, seaSeeds.length, countryIndex.countryCount);
  const cached = loadCache(key);
  if (cached) {
    const { provinces, seaZones } = cached;
    console.info(`[ProvinceClassifier] cache hit — ${provinces.length} provinces, ${seaZones.length} sea zones`);
    onProgress?.(cities.length + seaSeeds.length, cities.length + seaSeeds.length);
    return { provinces, seaZones, delaunay: buildDelaunay(provinces) };
  }

  const provinces: Province[] = [];
  const seaZones:  SeaZone[]  = [];
  const total = cities.length + seaSeeds.length;

  // ── Pass 1: Land provinces ─────────────────────────────────────────────────

  for (let i = 0; i < cities.length; i++) {
    if (i % 20 === 0) {
      onProgress?.(i, total);
      await new Promise<void>(r => setTimeout(r, 0));
    }

    const city = cities[i];
    if (!city) continue;

    const cell = landVoronoi.cells[i];
    if (!cell || cell.length < 4) continue;

    // Clip to landmass — province stops at coastline, crosses country borders freely
    let clipped: Feature<Polygon | MultiPolygon> | null = null;
    try {
      clipped = intersect(featureCollection([
        turfPolygon([cell]) as Feature<Polygon | MultiPolygon>,
        landFeature,
      ]));
    } catch { continue; }
    if (!clipped) continue;

    const rings = extractRings(clipped.geometry, proj);
    if (rings.length === 0) continue;

    // Country info is assigned by seed location only — not used for clipping
    const countryEntry = findCountry(city.lon, city.lat, countryIndex);
    const [cx, cy] = proj.project(city.lon, city.lat);
    const props = (countryEntry?.feature.properties ?? {}) as Record<string, string>;

    provinces.push({
      id:          provinces.length,
      city:        city.name,
      country:     props['ADMIN']   ?? props['NAME']    ?? 'Unknown',
      countryCode: props['ADM0_A3'] ?? props['ISO_A3']  ?? 'UNK',
      rings,
      bounds:      computeBounds(rings),
      cx, cy,
      lat: city.lat,
      lon: city.lon,
      population: city.population,
      taxIncome:  0,
    });
  }

  // ── Pass 2: Sea zones ──────────────────────────────────────────────────────
  //
  // Ocean Voronoi has no city-seed competitors, so each cell extends naturally
  // to the coast.  We only subtract country polygons to carve out the land.

  for (let j = 0; j < seaSeeds.length; j++) {
    const done = cities.length + j;
    if (done % 20 === 0) {
      onProgress?.(done, total);
      await new Promise<void>(r => setTimeout(r, 0));
    }

    const seed = seaSeeds[j];
    if (!seed) continue;

    const cell = seaVoronoi.cells[j];
    if (!cell || cell.length < 4) continue;

    const cellBboxArr = turfBbox(turfPolygon([cell]));
    const [cMinLon, cMinLat, cMaxLon, cMaxLat] = cellBboxArr;

    let seaGeom: Feature<Polygon | MultiPolygon> | null =
      turfPolygon([cell]) as Feature<Polygon | MultiPolygon>;

    for (const entry of countryIndex.entries) {
      if (!seaGeom) break;
      const [minLon, minLat, maxLon, maxLat] = entry.bbox;
      // Quick bbox rejection
      if (
        maxLon < (cMinLon ?? -180) || minLon > (cMaxLon ?? 180) ||
        maxLat < (cMinLat ??  -90) || minLat > (cMaxLat ??  90)
      ) continue;

      try {
        const result = difference(featureCollection([seaGeom, entry.feature]));
        seaGeom = result;   // null → cell fully covered by land, exit loop
      } catch { /* ignore invalid geometry, keep seaGeom unchanged */ }
    }

    if (!seaGeom) continue;

    const rings = extractRings(seaGeom.geometry, proj);
    if (rings.length === 0) continue;

    const [cx, cy] = proj.project(seed.lon, seed.lat);
    seaZones.push({
      id:     provinces.length + seaZones.length,
      name:   seed.zoneName,
      type:   'sea',
      rings,
      bounds: computeBounds(rings),
      cx, cy,
      lat: seed.lat,
      lon: seed.lon,
    });
  }

  onProgress?.(total, total);
  console.info(`[ProvinceClassifier] ${provinces.length} provinces, ${seaZones.length} sea zones`);
  saveCache(key, provinces, seaZones);
  return { provinces, seaZones, delaunay: buildDelaunay(provinces) };
}
