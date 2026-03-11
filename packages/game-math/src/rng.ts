/**
 * Mulberry32 seeded PRNG — deterministic, fast, good statistical quality.
 * Critical for replay correctness and anti-cheat validation.
 * Same seed → identical sequence every time.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0; // Ensure 32-bit unsigned
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Picks a random element from an array */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[this.nextInt(0, arr.length - 1)]!;
  }

  /** Fisher-Yates shuffle (in-place, returns array) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  /** Get current state for serialization */
  getState(): number {
    return this.state;
  }

  /** Restore from serialized state */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
