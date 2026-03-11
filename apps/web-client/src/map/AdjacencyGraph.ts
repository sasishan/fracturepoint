/**
 * AdjacencyGraph — builds province / sea-zone neighbor maps from Delaunay.
 *
 * Province IDs and sea zone IDs share the same integer namespace:
 *   provinces:  ID = 0 … P-1
 *   sea zones:  ID = P … P+S-1   (startId = provinces.length)
 *
 * buildAdjacencyGraph   — land provinces only (province Delaunay from ClipResult)
 * buildCombinedAdjacency — full graph: land + sea; used by air and cross-domain A*
 */

import { Delaunay } from 'd3-delaunay';
import type { Province } from './ProvinceClipper';
import type { SeaZone }  from './SeaZoneGenerator';

/** nodeId → [neighborNodeId, ...] */
export type AdjacencyGraph = Map<number, number[]>;

// ── Land-only adjacency ────────────────────────────────────────────────────────

/**
 * Build adjacency from the province-only Delaunay returned by clipProvincesToLand.
 * Province IDs equal their index in the provinces array.
 */
export function buildAdjacencyGraph(
  provinces: Province[],
  delaunay:  Delaunay<number>,
): AdjacencyGraph {
  const graph: AdjacencyGraph = new Map();

  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i];
    if (!p) continue;

    const neighbors: number[] = [];
    for (const ni of delaunay.neighbors(i)) {
      const neighbor = provinces[ni];
      if (neighbor) neighbors.push(neighbor.id);
    }
    graph.set(p.id, neighbors);
  }

  return graph;
}

// ── Combined land + sea adjacency ─────────────────────────────────────────────

/**
 * Build a single adjacency graph spanning both land provinces and sea zones.
 *
 * A new Delaunay is computed from ALL centroids (province then sea zone), so
 * Delaunay index i maps directly to ID i (since province IDs = 0…P-1 and sea
 * zone IDs = P…P+S-1, which equals their Delaunay indices).
 *
 * Used by:
 *   - Air units   (no terrain restrictions — can move anywhere)
 *   - Naval units (filtered to sea-zone IDs only via UnitStore blocked set)
 *   - Land units  (filtered to province IDs only via UnitStore blocked set)
 */
export function buildCombinedAdjacency(
  provinces: Province[],
  seaZones:  SeaZone[],
): AdjacencyGraph {
  const total = provinces.length + seaZones.length;
  if (total === 0) return new Map();

  // Build flat centroid array: provinces first, then sea zones
  const flat = new Float64Array(total * 2);
  for (let i = 0; i < provinces.length; i++) {
    flat[i * 2]     = provinces[i]?.cx ?? 0;
    flat[i * 2 + 1] = provinces[i]?.cy ?? 0;
  }
  for (let i = 0; i < seaZones.length; i++) {
    const j = provinces.length + i;
    flat[j * 2]     = seaZones[i]?.cx ?? 0;
    flat[j * 2 + 1] = seaZones[i]?.cy ?? 0;
  }

  const delaunay = new Delaunay(flat);
  const graph: AdjacencyGraph = new Map();

  for (let i = 0; i < total; i++) {
    // ID equals index (provinces: i, sea zones: provinces.length + j → same as their .id)
    const id = i < provinces.length
      ? (provinces[i]?.id ?? i)
      : (seaZones[i - provinces.length]?.id ?? i);

    const neighbors: number[] = [];
    for (const ni of delaunay.neighbors(i)) {
      const nid = ni < provinces.length
        ? (provinces[ni]?.id ?? ni)
        : (seaZones[ni - provinces.length]?.id ?? ni);
      neighbors.push(nid);
    }
    graph.set(id, neighbors);
  }

  return graph;
}

// ── Coastal province detection ────────────────────────────────────────────────

/**
 * Returns the set of land province IDs adjacent to at least one sea zone.
 * These are "coastal" provinces where naval units may enter or exit.
 */
export function computeCoastalProvinces(
  provinces:  Province[],
  seaZones:   SeaZone[],
  combined:   AdjacencyGraph,
): Set<number> {
  const seaIds = new Set(seaZones.map(z => z.id));
  const coastal = new Set<number>();

  for (const p of provinces) {
    const neighbors = combined.get(p.id) ?? [];
    if (neighbors.some(nid => seaIds.has(nid))) coastal.add(p.id);
  }

  return coastal;
}
