/**
 * SeaZoneGenerator — clips Voronoi cells to the ocean polygon to produce
 * named sea zones.
 *
 * Works alongside ProvinceClipper: land provinces clip city cells to country
 * polygons; sea zones clip ocean-seed cells to the ocean polygon loaded from
 * /oceans/oceans.geojson.
 *
 * Performance:
 *   • Ocean polygon is simplified to 1° tolerance (~90 % vertex reduction)
 *     before intersection, making turf.intersect fast per seed.
 *   • Computed sea zones are cached in localStorage keyed on seed-count so
 *     reloads after the first clip are instant.
 *   • Event-loop yields every 10 seeds to keep the browser responsive.
 */

import {
  intersect,
  featureCollection,
  polygon  as turfPolygon,
  bbox     as turfBbox,
  simplify as turfSimplify,
} from '@turf/turf';
import type {
  Feature, FeatureCollection, Polygon, MultiPolygon, Position,
} from 'geojson';
import type { OceanSeed }         from './OceanSeedGenerator';
import type { VoronoiResult }     from './VoronoiGenerator';
import type { ProvinceBounds }    from './ProvinceClipper';
import {
  EquirectangularProjection,
  WORLD_W, WORLD_H,
}                                  from './ProjectionSystem';

// ── SeaZone ───────────────────────────────────────────────────────────────────

export interface SeaZone {
  id:     number;
  name:   string;
  type:   'sea';
  rings:  Float64Array[];
  bounds: ProvinceBounds;
  cx:     number;
  cy:     number;
  lat:    number;
  lon:    number;
}

// ── OceanIndex ────────────────────────────────────────────────────────────────

export interface OceanIndex {
  feature: Feature<Polygon | MultiPolygon>;
  bbox:    [number, number, number, number];
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Fetch oceans.geojson, simplify to 1° tolerance, return a single-entry index.
 * Simplification reduces vertex count ~90 % (critical for a 14 MB source file).
 */
export async function loadOceanIndex(
  url = '/oceans/oceans.geojson',
): Promise<OceanIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SeaZoneGenerator: HTTP ${res.status} — ${url}`);

  const fc = await res.json() as FeatureCollection;
  const f  = fc.features[0];
  if (!f || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) {
    throw new Error('SeaZoneGenerator: expected Polygon/MultiPolygon feature');
  }

  let simplified: Feature<Polygon | MultiPolygon>;
  try {
    simplified = turfSimplify(
      f as Feature<Polygon | MultiPolygon>,
      { tolerance: 1.0, highQuality: false, mutate: false },
    );
  } catch {
    simplified = f as Feature<Polygon | MultiPolygon>;
  }

  const b = turfBbox(simplified);
  console.info('[SeaZoneGenerator] ocean polygon loaded & simplified');
  return {
    feature: simplified,
    bbox:    [b[0] ?? -180, b[1] ?? -90, b[2] ?? 180, b[3] ?? 90],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'sz-v1';

interface SerializedSeaZone {
  id: number; name: string; type: 'sea';
  rings:  number[][];
  bounds: ProvinceBounds;
  cx: number; cy: number; lat: number; lon: number;
}

function cacheKey(seedCount: number, provinceCount: number): string {
  return `ww3-seazones-${CACHE_VERSION}-s${seedCount}-p${provinceCount}`;
}

function saveCache(key: string, zones: SeaZone[]): void {
  try {
    const data: SerializedSeaZone[] = zones.map(z => ({
      ...z,
      rings: z.rings.map(r => Array.from(r)),
    }));
    localStorage.setItem(key, JSON.stringify(data));
    console.info(`[SeaZoneGenerator] cached ${zones.length} sea zones`);
  } catch (e) {
    console.warn('[SeaZoneGenerator] cache write failed:', e);
  }
}

function loadCache(key: string): SeaZone[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedSeaZone[];
    return parsed.map(z => ({ ...z, rings: z.rings.map(r => new Float64Array(r)) }));
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Clip the Voronoi cell for each ocean seed to the ocean polygon.
 *
 * @param seeds         Ocean seeds from generateOceanSeeds()
 * @param seedOffset    Index of the first seed in voronoi.cells (= cities.length)
 * @param voronoi       Voronoi built from the combined [cities, ...seeds] array
 * @param oceanIndex    Simplified ocean polygon from loadOceanIndex()
 * @param startId       First sea zone ID — use provinces.length so IDs are unique
 * @param proj          Projection (defaults to equirectangular world)
 * @param onProgress    Optional progress callback
 */
export async function generateSeaZones(
  seeds:       OceanSeed[],
  seedOffset:  number,
  voronoi:     VoronoiResult,
  oceanIndex:  OceanIndex,
  startId:     number,
  proj:        EquirectangularProjection = new EquirectangularProjection(WORLD_W, WORLD_H),
  onProgress?: (done: number, total: number) => void,
): Promise<SeaZone[]> {

  const key    = cacheKey(seeds.length, startId);
  const cached = loadCache(key);
  if (cached) {
    console.info(`[SeaZoneGenerator] cache hit — ${cached.length} sea zones`);
    onProgress?.(seeds.length, seeds.length);
    return cached;
  }

  const seaZones: SeaZone[] = [];
  const n = seeds.length;

  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) {
      onProgress?.(i, n);
      await new Promise<void>(r => setTimeout(r, 0));
    }

    const seed = seeds[i];
    if (!seed) continue;

    const cell = voronoi.cells[seedOffset + i];
    if (!cell || cell.length < 4) continue;

    let clipped: Feature<Polygon | MultiPolygon> | null = null;
    try {
      clipped = intersect(
        featureCollection([
          turfPolygon([cell]) as Feature<Polygon | MultiPolygon>,
          oceanIndex.feature,
        ]),
      );
    } catch {
      continue;
    }
    if (!clipped) continue;

    const rings = extractRings(clipped.geometry, proj);
    if (rings.length === 0) continue;

    const [cx, cy] = proj.project(seed.lon, seed.lat);
    seaZones.push({
      id:     startId + seaZones.length,
      name:   seed.zoneName,
      type:   'sea',
      rings,
      bounds: computeBounds(rings),
      cx, cy,
      lat: seed.lat,
      lon: seed.lon,
    });
  }

  onProgress?.(n, n);
  console.info(`[SeaZoneGenerator] ${seaZones.length} sea zones from ${n} seeds`);
  saveCache(key, seaZones);
  return seaZones;
}
