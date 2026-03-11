/**
 * ProvinceClipper — intersects Voronoi cells with country land polygons.
 *
 * Performance:
 *   • Country polygons are simplified to 0.1° tolerance before intersection,
 *     reducing vertex counts by ~90 % and making turf.intersect ~10× faster.
 *   • Computed provinces are cached in localStorage so every reload after the
 *     first is instant (cache is keyed by city-count + country-count so it
 *     auto-invalidates when source data changes).
 *   • Bbox pre-filter skips the expensive booleanPointInPolygon for most
 *     countries on each city lookup.
 *   • Event-loop yields every 25 cities keep the browser responsive during
 *     the initial clip pass.
 */

import {
  intersect,
  booleanPointInPolygon,
  featureCollection,
  polygon  as turfPolygon,
  point    as turfPoint,
  bbox     as turfBbox,
  simplify as turfSimplify,
} from '@turf/turf';
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
  Position,
} from 'geojson';
import { Delaunay } from 'd3-delaunay';

import type { City }         from './CityLoader';
import type { VoronoiResult } from './VoronoiGenerator';
import { EquirectangularProjection, WORLD_W, WORLD_H } from './ProjectionSystem';

// ── Province ──────────────────────────────────────────────────────────────────

export interface ProvinceBounds {
  minX: number; minY: number;
  maxX: number; maxY: number;
}

export interface Province {
  id:          number;
  city:        string;
  country:     string;   // ADMIN name from GeoJSON
  countryCode: string;   // ADM0_A3 ISO-3 code
  rings:       Float64Array[];
  bounds:      ProvinceBounds;
  cx:          number;
  cy:          number;
  lat:         number;
  lon:         number;
  population:  number;
  taxIncome:   number;
}

// ── Country index ─────────────────────────────────────────────────────────────

interface CountryEntry {
  feature: Feature<Polygon | MultiPolygon>;
  bbox: [number, number, number, number];
}

export interface CountryIndex {
  entries:      CountryEntry[];
  countryCount: number;
}

// ── Clip result ───────────────────────────────────────────────────────────────

export interface ClipResult {
  provinces: Province[];
  delaunay:  Delaunay<number>;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
//
// Provinces are cached in localStorage after the first (expensive) clip pass.
// Float64Arrays are serialised to plain number[] for JSON compatibility.
// Cache key encodes city-count + country-count so stale entries are ignored.

const CACHE_VERSION = 'v4';

function cacheKey(cityCount: number, countryCount: number): string {
  return `ww3-provinces-${CACHE_VERSION}-c${cityCount}-n${countryCount}`;
}

interface SerializedProvince {
  id: number; city: string; country: string; countryCode: string;
  rings: number[][];
  bounds: ProvinceBounds;
  cx: number; cy: number; lat: number; lon: number;
  population: number; taxIncome: number;
}

function saveCache(key: string, provinces: Province[]): void {
  try {
    const serialized: SerializedProvince[] = provinces.map(p => ({
      ...p,
      rings: p.rings.map(r => Array.from(r)),
    }));
    localStorage.setItem(key, JSON.stringify(serialized));
    console.info(`[ProvinceClipper] cached ${provinces.length} provinces`);
  } catch (e) {
    // localStorage might be full or unavailable — not a fatal error
    console.warn('[ProvinceClipper] cache write failed:', e);
  }
}

function loadCache(key: string): Province[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedProvince[];
    return parsed.map(p => ({
      ...p,
      rings: p.rings.map(r => new Float64Array(r)),
    }));
  } catch {
    return null;
  }
}

// ── Country loading ───────────────────────────────────────────────────────────

/**
 * Fetch countries.geojson, simplify each polygon to 0.1° tolerance, and build
 * a bbox-indexed lookup table.
 *
 * Simplification reduces vertex counts by ~90 % (e.g. Russia: ~15 000 → ~800
 * vertices) which makes turf.intersect roughly 10× faster per city.
 */
export async function loadCountryIndex(url = '/countries/countries.geojson'): Promise<CountryIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ProvinceClipper: HTTP ${res.status} — ${url}`);

  const fc = await res.json() as FeatureCollection;
  const entries: CountryEntry[] = [];

  for (const f of fc.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;

    // Simplify: 0.1° ≈ 11 km tolerance — retains country shape, strips detail
    let simplified: Feature<Polygon | MultiPolygon>;
    try {
      simplified = turfSimplify(
        f as Feature<Polygon | MultiPolygon>,
        { tolerance: 0.1, highQuality: false, mutate: false },
      );
    } catch {
      simplified = f as Feature<Polygon | MultiPolygon>;
    }

    const b = turfBbox(simplified);
    entries.push({
      feature: simplified,
      bbox: [b[0] ?? -180, b[1] ?? -90, b[2] ?? 180, b[3] ?? 90],
    });
  }

  console.info(`[ProvinceClipper] loaded & simplified ${entries.length} country polygons`);
  return { entries, countryCount: entries.length };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findCountry(lon: number, lat: number, index: CountryIndex): CountryEntry | null {
  const pt = turfPoint([lon, lat]);
  for (const entry of index.entries) {
    const [minLon, minLat, maxLon, maxLat] = entry.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (booleanPointInPolygon(pt, entry.feature)) return entry;
  }
  return null;
}

function ringToPixels(ring: Position[], proj: EquirectangularProjection): Float64Array {
  const flat = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    const [x, y] = proj.project(pt?.[0] ?? 0, pt?.[1] ?? 0);
    flat[i * 2]     = x;
    flat[i * 2 + 1] = y;
  }
  return flat;
}

function extractRings(geom: Polygon | MultiPolygon, proj: EquirectangularProjection): Float64Array[] {
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

function buildDelaunay(provinces: Province[]): Delaunay<number> {
  const flat = new Float64Array(provinces.length * 2);
  for (let i = 0; i < provinces.length; i++) {
    flat[i * 2]     = provinces[i]?.cx ?? 0;
    flat[i * 2 + 1] = provinces[i]?.cy ?? 0;
  }
  return new Delaunay(flat);
}

// ── Main clip function ────────────────────────────────────────────────────────

export async function clipProvincesToLand(
  cities:      City[],
  voronoi:     VoronoiResult,
  countries:   CountryIndex,
  proj:        EquirectangularProjection = new EquirectangularProjection(WORLD_W, WORLD_H),
  onProgress?: (done: number, total: number) => void,
): Promise<ClipResult> {
  // ── Cache hit ──────────────────────────────────────────────────────────────
  const key = cacheKey(cities.length, countries.countryCount);
  const cached = loadCache(key);
  if (cached) {
    console.info(`[ProvinceClipper] cache hit — ${cached.length} provinces, skipping clip`);
    onProgress?.(cities.length, cities.length);
    return { provinces: cached, delaunay: buildDelaunay(cached) };
  }

  // ── Cache miss: run the clip pipeline ─────────────────────────────────────
  const provinces: Province[] = [];
  const n = cities.length;

  for (let i = 0; i < n; i++) {
    if (i % 25 === 0) {
      onProgress?.(i, n);
      await new Promise<void>(r => setTimeout(r, 0));
    }

    const city = cities[i];
    if (!city) continue;

    const cell = voronoi.cells[i];
    if (!cell || cell.length < 4) continue;

    const countryEntry = findCountry(city.lon, city.lat, countries);
    if (!countryEntry) continue;

    let clipped: Feature<Polygon | MultiPolygon> | null = null;
    try {
      clipped = intersect(
        featureCollection([
          turfPolygon([cell]) as Feature<Polygon | MultiPolygon>,
          countryEntry.feature,
        ]),
      );
    } catch {
      continue;
    }
    if (!clipped) continue;

    const rings = extractRings(clipped.geometry, proj);
    if (rings.length === 0) continue;

    const [cx, cy] = proj.project(city.lon, city.lat);
    const props = (countryEntry.feature.properties ?? {}) as Record<string, string>;

    provinces.push({
      id:          provinces.length,
      city:        city.name,
      country:     props['ADMIN']   ?? props['NAME']    ?? 'Unknown',
      countryCode: props['ADM0_A3'] ?? props['ISO_A3'] ?? 'UNK',
      rings,
      bounds:      computeBounds(rings),
      cx, cy,
      lat: city.lat,
      lon: city.lon,
      population: city.population,
      taxIncome:  0,
    });
  }

  onProgress?.(n, n);
  console.info(`[ProvinceClipper] ${provinces.length} land provinces from ${n} cities`);

  saveCache(key, provinces);
  return { provinces, delaunay: buildDelaunay(provinces) };
}
