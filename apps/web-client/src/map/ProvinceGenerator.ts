/**
 * ProvinceGenerator — builds Voronoi provinces from city point data.
 *
 * Each city becomes the seed of one Voronoi cell. The cell polygon is that
 * province's territory on the map. d3-delaunay handles the triangulation and
 * clipping to the world bounding box.
 *
 * Output uses a fixed "world" coordinate space (WORLD_W × WORLD_H) so the
 * renderer can apply zoom/pan independently of the data.
 */

import { Delaunay } from 'd3-delaunay';
import type { City } from './CityLoader';
import { EquirectangularProjection, WORLD_W, WORLD_H } from './ProjectionSystem';

// ── Province shape ────────────────────────────────────────────────────────────

export interface ProvinceBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Province {
  /** Index matching the original cities array (also unique province ID). */
  id: number;
  cityName: string;
  population: number;
  /** Source geographic coordinates. */
  lon: number;
  lat: number;
  /** City center in world pixels (projection output). */
  cx: number;
  cy: number;
  /**
   * Voronoi cell polygon as flat [x0, y0, x1, y1, …] Float64Array.
   * The polygon is closed (last point == first point) and wound clockwise.
   */
  polygon: Float64Array;
  /** Axis-aligned bounding box in world pixels — used for viewport culling. */
  bounds: ProvinceBounds;
}

// ── Generation output ─────────────────────────────────────────────────────────

export interface GeneratedMap {
  provinces: Province[];
  /**
   * The underlying Delaunay triangulation.
   * `delaunay.find(wx, wy)` returns the nearest province index for hit-testing
   * in O(log n) time — far faster than polygon ray-casting at 10k+ provinces.
   */
  delaunay: Delaunay<number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBounds(poly: Float64Array): ProvinceBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < poly.length - 1; i += 2) {
    const x = poly[i] ?? 0, y = poly[i + 1] ?? 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generate Voronoi provinces from a city dataset.
 *
 * @param cities   Array of cities (source of truth for points and metadata).
 * @param proj     Equirectangular projection (defaults to WORLD_W × WORLD_H).
 * @returns        Province array + Delaunay object for subsequent hit-testing.
 */
export function generateProvinces(
  cities: City[],
  proj: EquirectangularProjection = new EquirectangularProjection(),
): GeneratedMap {
  const n = cities.length;

  // Build flat point array for Delaunay: [x0, y0, x1, y1, …]
  const flatPoints = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const city = cities[i];
    if (!city) continue;
    const [x, y] = proj.project(city.lon, city.lat);
    flatPoints[i * 2]     = x;
    flatPoints[i * 2 + 1] = y;
  }

  const delaunay = new Delaunay(flatPoints);
  const voronoi  = delaunay.voronoi([0, 0, proj.worldW, proj.worldH]);

  const provinces: Province[] = [];

  for (let i = 0; i < n; i++) {
    const city = cities[i];
    if (!city) continue;
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 3) continue;

    // Convert [[x,y], …] pairs to flat Float64Array for cache-friendly access
    const poly = new Float64Array(cell.length * 2);
    for (let j = 0; j < cell.length; j++) {
      const pt = cell[j];
      if (!pt) continue;
      poly[j * 2]     = pt[0];
      poly[j * 2 + 1] = pt[1];
    }

    provinces.push({
      id:         i,
      cityName:   city.name,
      population: city.population,
      lon:        city.lon,
      lat:        city.lat,
      cx:         flatPoints[i * 2] ?? 0,
      cy:         flatPoints[i * 2 + 1] ?? 0,
      polygon:    poly,
      bounds:     computeBounds(poly),
    });
  }

  console.info(`[ProvinceGenerator] generated ${provinces.length} provinces`);
  return { provinces, delaunay };
}
