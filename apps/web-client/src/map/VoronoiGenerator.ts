/**
 * VoronoiGenerator — builds raw Voronoi cells in geographic (lon/lat) space.
 *
 * Cells are returned as GeoJSON-compatible [lon, lat][] rings, suitable for
 * direct use with Turf.js polygon intersection. No projection is applied here;
 * ProvinceClipper handles projection after clipping.
 *
 * Voronoi bounds span the full world [-180, -90, 180, 90] so every city gets
 * a cell even near poles or date-line edges.
 */

import { Delaunay } from 'd3-delaunay';
import type { City } from './CityLoader';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VoronoiResult {
  /**
   * One cell per input city (same index). A cell is a closed ring of [lon, lat]
   * pairs; null if d3-delaunay could not produce a polygon for that point.
   */
  cells: ([number, number][] | null)[];
  /**
   * Underlying Delaunay triangulation in geographic space.
   * Retained so ProvinceClipper can rebuild a hit-test structure from the
   * surviving (land-clipped) province centroids.
   */
  delaunay: Delaunay<number>;
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generate a full-world Voronoi diagram from city lon/lat coordinates.
 * Runs synchronously — all computation is pure JS/WASM with no I/O.
 */
export function generateVoronoi(cities: City[]): VoronoiResult {
  const n = cities.length;
  const flatPoints = new Float64Array(n * 2);

  for (let i = 0; i < n; i++) {
    const city = cities[i];
    if (!city) continue;
    flatPoints[i * 2]     = city.lon;
    flatPoints[i * 2 + 1] = city.lat;
  }

  const delaunay = new Delaunay(flatPoints);
  // Clip Voronoi to full geographic extent
  const voronoi = delaunay.voronoi([-180, -90, 180, 90]);

  const cells: ([number, number][] | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const cell = voronoi.cellPolygon(i);
    // cellPolygon returns a closed ring [[lon,lat], ...] or null
    cells[i] = cell ? (cell as [number, number][]) : null;
  }

  console.info(`[VoronoiGenerator] generated ${n} raw cells`);
  return { cells, delaunay };
}
