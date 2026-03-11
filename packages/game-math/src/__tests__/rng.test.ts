import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng.js';

describe('SeededRNG', () => {
  it('produces values in [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed → same sequence', () => {
    const seq1: number[] = [];
    const seq2: number[] = [];
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);
    for (let i = 0; i < 10000; i++) {
      seq1.push(rng1.next());
      seq2.push(rng2.next());
    }
    expect(seq1).toEqual(seq2);
  });

  it('different seeds → different sequences', () => {
    const rng1 = new SeededRNG(1);
    const rng2 = new SeededRNG(2);
    const diverges = Array.from({ length: 100 }, () => rng1.next() !== rng2.next());
    expect(diverges.some(Boolean)).toBe(true);
  });

  it('serializes and restores state correctly', () => {
    const rng = new SeededRNG(999);
    for (let i = 0; i < 500; i++) rng.next();
    const savedState = rng.getState();

    const seq1 = Array.from({ length: 1000 }, () => rng.next());

    const rng2 = new SeededRNG(0);
    rng2.setState(savedState);
    const seq2 = Array.from({ length: 1000 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('nextInt returns values in range', () => {
    const rng = new SeededRNG(777);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});
