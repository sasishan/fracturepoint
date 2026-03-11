import type { HexCoord } from '@ww3/shared-types';
import { hexKey, hexDistance, hexNeighbors } from './hex.js';

/**
 * Find all hexes within a given radius (flood fill, respects blocked set).
 */
export function hexesInRange(center: HexCoord, radius: number, blocked?: Set<string>): HexCoord[] {
  const results: HexCoord[] = [];
  const visited = new Set<string>([hexKey(center)]);
  const queue: Array<[HexCoord, number]> = [[center, 0]];

  while (queue.length > 0) {
    const [current, dist] = queue.shift()!;
    results.push(current);
    if (dist >= radius) continue;

    for (const neighbor of hexNeighbors(current)) {
      const nKey = hexKey(neighbor);
      if (visited.has(nKey)) continue;
      if (blocked?.has(nKey)) continue;
      visited.add(nKey);
      queue.push([neighbor, dist + 1]);
    }
  }

  return results;
}

/**
 * Line of sight check between two hexes (Bresenham-style for hex grid).
 * Returns true if there is a clear line of sight (no blocking hexes in path).
 */
export function hexLineOfSight(from: HexCoord, to: HexCoord, opaque: Set<string>): boolean {
  const dist = hexDistance(from, to);
  if (dist === 0) return true;

  for (let i = 1; i <= dist; i++) {
    const t = i / dist;
    const lerped = {
      q: from.q + (to.q - from.q) * t,
      r: from.r + (to.r - from.r) * t,
      s: from.s + (to.s - from.s) * t,
    };
    // Round to nearest hex
    let rq = Math.round(lerped.q);
    let rr = Math.round(lerped.r);
    let rs = Math.round(lerped.s);
    const dq = Math.abs(rq - lerped.q);
    const dr = Math.abs(rr - lerped.r);
    const ds = Math.abs(rs - lerped.s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    else rs = -rq - rr;

    const key = `${rq},${rr},${rs}`;
    if (i < dist && opaque.has(key)) return false;
  }

  return true;
}

/**
 * Find the N closest hexes to a target (from a set of candidates).
 */
export function closestHexes(target: HexCoord, candidates: HexCoord[], n: number): HexCoord[] {
  return [...candidates]
    .sort((a, b) => hexDistance(a, target) - hexDistance(b, target))
    .slice(0, n);
}
