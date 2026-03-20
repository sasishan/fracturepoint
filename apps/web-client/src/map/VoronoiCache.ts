/**
 * VoronoiCache — fetches the pre-built Voronoi cache from /voronoi-cache.json.
 *
 * The cache is generated at build time by tools/map-compiler and committed to
 * data/ (served as Vite publicDir / CDN static asset).  When present it
 * eliminates all client-side Voronoi computation (~30–120 s → ~0 s).
 *
 * Returns null if the file is absent (first run before the compiler has been
 * executed), allowing VoronoiMapScene to fall back to live computation.
 */

import { Delaunay } from 'd3-delaunay';
import type { Province } from './ProvinceClipper';
import type { SeaZone }  from './SeaZoneGenerator';

interface CacheBlob {
  provinces: Array<Omit<Province, 'rings'> & { rings: number[][] }>;
  seaZones:  Array<Omit<SeaZone,  'rings'> & { rings: number[][] }>;
}

export interface VoronoiCacheResult {
  provinces: Province[];
  seaZones:  SeaZone[];
  delaunay:  Delaunay<number>;
}

/**
 * Try to load the static Voronoi cache.
 * Returns null if the cache file is missing or malformed.
 */
export async function loadVoronoiCache(
  url = '/voronoi-cache.json',
): Promise<VoronoiCacheResult | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.json() as CacheBlob;
    if (!Array.isArray(blob.provinces) || !Array.isArray(blob.seaZones)) return null;

    const provinces: Province[] = blob.provinces.map(p => ({
      ...p,
      rings: p.rings.map(r => new Float64Array(r)),
    }));
    const seaZones: SeaZone[] = blob.seaZones.map(z => ({
      ...z,
      rings: z.rings.map(r => new Float64Array(r)),
    }));

    // Rebuild Delaunay from province centroids (same as ProvinceClassifier)
    const flat = new Float64Array(provinces.length * 2);
    for (let i = 0; i < provinces.length; i++) {
      flat[i * 2]     = provinces[i]?.cx ?? 0;
      flat[i * 2 + 1] = provinces[i]?.cy ?? 0;
    }
    const delaunay = new Delaunay(flat);

    console.info(
      `[VoronoiCache] loaded ${provinces.length} provinces + ${seaZones.length} sea zones from cache`,
    );
    return { provinces, seaZones, delaunay };
  } catch (e) {
    console.warn('[VoronoiCache] cache load failed, falling back to live computation:', e);
    return null;
  }
}
