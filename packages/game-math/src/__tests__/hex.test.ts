import { describe, it, expect } from 'vitest';
import {
  hexNeighbors, hexDistance, hexRing, hexPathfind,
  hexToPixel, hexEquals, hexKey,
} from '../hex.js';

describe('hexDistance', () => {
  it('returns 0 for same hex', () => {
    expect(hexDistance({ q: 0, r: 0, s: 0 }, { q: 0, r: 0, s: 0 })).toBe(0);
  });

  it('returns correct distances', () => {
    expect(hexDistance({ q: 0, r: 0, s: 0 }, { q: 1, r: -1, s: 0 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0, s: 0 }, { q: 2, r: -2, s: 0 })).toBe(2);
    expect(hexDistance({ q: 0, r: 0, s: 0 }, { q: 3, r: -3, s: 0 })).toBe(3);
    expect(hexDistance({ q: 1, r: 2, s: -3 }, { q: -1, r: -2, s: 3 })).toBe(4);
  });
});

describe('hexNeighbors', () => {
  it('returns exactly 6 neighbors', () => {
    const n = hexNeighbors({ q: 0, r: 0, s: 0 });
    expect(n).toHaveLength(6);
  });

  it('all neighbors are distance 1', () => {
    const center = { q: 2, r: -1, s: -1 };
    for (const n of hexNeighbors(center)) {
      expect(hexDistance(center, n)).toBe(1);
    }
  });
});

describe('hexRing', () => {
  it('ring of radius 0 is just center', () => {
    const r = hexRing({ q: 0, r: 0, s: 0 }, 0);
    expect(r).toHaveLength(1);
  });

  it('ring of radius N has 6N hexes', () => {
    for (let r = 1; r <= 5; r++) {
      expect(hexRing({ q: 0, r: 0, s: 0 }, r)).toHaveLength(6 * r);
    }
  });

  it('all hexes in ring are at correct distance', () => {
    const center = { q: 0, r: 0, s: 0 };
    for (let r = 1; r <= 4; r++) {
      for (const h of hexRing(center, r)) {
        expect(hexDistance(center, h)).toBe(r);
      }
    }
  });
});

describe('hexPathfind', () => {
  it('finds direct path with no obstacles', () => {
    const path = hexPathfind(
      { q: 0, r: 0, s: 0 },
      { q: 3, r: -3, s: 0 },
      new Set(),
    );
    expect(path).not.toBeNull();
    expect(path!).toHaveLength(4); // start + 3 steps
    expect(hexEquals(path![0]!, { q: 0, r: 0, s: 0 })).toBe(true);
    expect(hexEquals(path![path!.length - 1]!, { q: 3, r: -3, s: 0 })).toBe(true);
  });

  it('returns null when fully blocked', () => {
    const blocked = new Set(['1,-1,0', '0,1,-1', '1,0,-1', '-1,0,1', '0,-1,1', '-1,1,0']);
    const path = hexPathfind(
      { q: 0, r: 0, s: 0 },
      { q: 3, r: -3, s: 0 },
      blocked,
    );
    expect(path).toBeNull();
  });

  it('same start and end returns single-element path', () => {
    const h = { q: 2, r: -1, s: -1 };
    const path = hexPathfind(h, h, new Set());
    expect(path).toEqual([h]);
  });
});
