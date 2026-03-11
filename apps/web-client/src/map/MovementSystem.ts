/**
 * MovementSystem — BFS move-range and A* pathfinding over the province adjacency graph.
 *
 * All province IDs are numbers (matching Province.id from ProvinceClipper).
 * Edge cost is uniform (1 per province step); A* uses Euclidean centroid distance
 * as the heuristic to prefer geographically direct routes.
 */

import type { Province }       from './ProvinceClipper';
import type { AdjacencyGraph } from './AdjacencyGraph';

// ── Move range ────────────────────────────────────────────────────────────────

export interface MoveRange {
  /** All province IDs reachable within the unit's movement points. */
  reachable: Set<number>;
  /** Minimum movement-point cost to reach each province. */
  costs: Map<number, number>;
}

/**
 * BFS from fromId up to movementPoints steps.
 * blocked: provinces that cannot be entered (e.g. impassable terrain).
 */
export function computeMoveRange(
  fromId:         number,
  movementPoints: number,
  adjacency:      AdjacencyGraph,
  blocked:        Set<number> = new Set(),
): MoveRange {
  const reachable = new Set<number>();
  const costs     = new Map<number, number>([[fromId, 0]]);

  // Simple BFS queue: [provinceId, costSoFar]
  const queue: [number, number][] = [[fromId, 0]];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const [id, cost] = item;

    for (const nid of (adjacency.get(id) ?? [])) {
      if (blocked.has(nid)) continue;
      const newCost = cost + 1;
      if (newCost > movementPoints) continue;
      if (costs.has(nid) && (costs.get(nid) ?? Infinity) <= newCost) continue;

      costs.set(nid, newCost);
      if (nid !== fromId) reachable.add(nid);
      queue.push([nid, newCost]);
    }
  }

  return { reachable, costs };
}

// ── A* pathfinding ────────────────────────────────────────────────────────────

/**
 * Find the shortest path (by hop count) from `from` to `to` over the adjacency graph.
 * Returns an ordered array of province IDs including start and end, or null if unreachable.
 *
 * Heuristic: Euclidean distance between province centroids (world-pixel coords).
 */
export function findPath(
  from:      number,
  to:        number,
  adjacency: AdjacencyGraph,
  provinces: Province[],
): number[] | null {
  if (from === to) return [from];

  // Build centroid lookup
  const centroid = new Map<number, [number, number]>();
  for (const p of provinces) centroid.set(p.id, [p.cx, p.cy]);

  const tgt = centroid.get(to);
  const heuristic = (id: number): number => {
    if (!tgt) return 0;
    const c = centroid.get(id);
    if (!c) return 0;
    const dx = c[0] - tgt[0], dy = c[1] - tgt[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  const open      = new Set<number>([from]);
  const cameFrom  = new Map<number, number>();
  const gScore    = new Map<number, number>([[from, 0]]);
  const fScore    = new Map<number, number>([[from, heuristic(from)]]);

  while (open.size > 0) {
    // Pick node with lowest fScore
    let current = -1;
    let lowestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) { lowestF = f; current = id; }
    }
    if (current === -1) break;

    if (current === to) {
      // Reconstruct path
      const path: number[] = [current];
      let node = current;
      while (cameFrom.has(node)) {
        node = cameFrom.get(node)!;
        path.unshift(node);
      }
      return path;
    }

    open.delete(current);

    for (const neighbor of (adjacency.get(current) ?? [])) {
      const tentG = (gScore.get(current) ?? Infinity) + 1;
      if (tentG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentG);
        fScore.set(neighbor, tentG + heuristic(neighbor));
        open.add(neighbor);
      }
    }
  }

  return null;
}
