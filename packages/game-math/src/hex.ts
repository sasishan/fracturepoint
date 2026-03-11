import type { HexCoord } from '@ww3/shared-types';

// Cube hex directions (6 neighbors)
const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1,  r: -1, s: 0  },
  { q: 1,  r: 0,  s: -1 },
  { q: 0,  r: 1,  s: -1 },
  { q: -1, r: 1,  s: 0  },
  { q: -1, r: 0,  s: 1  },
  { q: 0,  r: -1, s: 1  },
];

export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function hexSubtract(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s };
}

export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

export function hexKey(h: HexCoord): string {
  return `${h.q},${h.r},${h.s}`;
}

export function hexNeighbors(h: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map(d => hexAdd(h, d));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const diff = hexSubtract(a, b);
  return (Math.abs(diff.q) + Math.abs(diff.r) + Math.abs(diff.s)) / 2;
}

export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [center];
  const results: HexCoord[] = [];
  // Start at the hex radius steps in direction 4
  let h: HexCoord = {
    q: center.q + HEX_DIRECTIONS[4]!.q * radius,
    r: center.r + HEX_DIRECTIONS[4]!.r * radius,
    s: center.s + HEX_DIRECTIONS[4]!.s * radius,
  };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(h);
      h = hexAdd(h, HEX_DIRECTIONS[i]!);
    }
  }
  return results;
}

export function hexSpiral(center: HexCoord, maxRadius: number): HexCoord[] {
  const results: HexCoord[] = [center];
  for (let r = 1; r <= maxRadius; r++) {
    results.push(...hexRing(center, r));
  }
  return results;
}

/**
 * A* pathfinding over hex grid.
 * blocked: Set of hexKey strings for impassable hexes.
 * Returns shortest path or null if unreachable.
 */
export function hexPathfind(
  start: HexCoord,
  end: HexCoord,
  blocked: Set<string>,
  maxSteps = 100,
): HexCoord[] | null {
  const startKey = hexKey(start);
  const endKey = hexKey(end);
  if (startKey === endKey) return [start];

  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, hexDistance(start, end)]]);
  const cameFrom = new Map<string, HexCoord>();
  const openSet = new Set<string>([startKey]);
  const hexByKey = new Map<string, HexCoord>([[startKey, start]]);

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let currentKey = '';
    let currentF = Infinity;
    for (const key of openSet) {
      const f = fScore.get(key) ?? Infinity;
      if (f < currentF) { currentF = f; currentKey = key; }
    }

    if (currentKey === endKey) {
      // Reconstruct path
      const path: HexCoord[] = [];
      let k = endKey;
      while (k !== startKey) {
        path.unshift(hexByKey.get(k)!);
        const prev = cameFrom.get(k)!;
        k = hexKey(prev);
      }
      path.unshift(start);
      return path;
    }

    openSet.delete(currentKey);
    const current = hexByKey.get(currentKey)!;
    const currentG = gScore.get(currentKey) ?? Infinity;

    if (currentG >= maxSteps) continue;

    for (const neighbor of hexNeighbors(current)) {
      const nKey = hexKey(neighbor);
      if (blocked.has(nKey)) continue;

      const tentativeG = currentG + 1;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + hexDistance(neighbor, end));
        openSet.add(nKey);
        hexByKey.set(nKey, neighbor);
      }
    }
  }

  return null; // unreachable
}

/**
 * Convert hex cube coordinates to pixel position (flat-top hexagon layout).
 * size = hex center-to-corner distance in pixels.
 */
export function hexToPixel(h: HexCoord, size: number): { x: number; y: number } {
  return {
    x: size * (3 / 2 * h.q),
    y: size * (Math.sqrt(3) / 2 * h.q + Math.sqrt(3) * h.r),
  };
}

/**
 * Convert pixel coordinates to nearest hex (flat-top).
 */
export function pixelToHex(x: number, y: number, size: number): HexCoord {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound({ q, r, s: -q - r });
}

function hexRound(h: { q: number; r: number; s: number }): HexCoord {
  let rq = Math.round(h.q);
  let rr = Math.round(h.r);
  let rs = Math.round(h.s);
  const dq = Math.abs(rq - h.q);
  const dr = Math.abs(rr - h.r);
  const ds = Math.abs(rs - h.s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  else rs = -rq - rr;
  return { q: rq, r: rr, s: rs };
}
