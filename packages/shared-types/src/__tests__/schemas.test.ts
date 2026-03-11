import { describe, it, expect } from 'vitest';
import { HexCoordSchema, GameStateSchema, GameActionSchema } from '../index.js';

describe('HexCoordSchema', () => {
  it('accepts valid cube coordinates', () => {
    expect(() => HexCoordSchema.parse({ q: 1, r: -1, s: 0 })).not.toThrow();
    expect(() => HexCoordSchema.parse({ q: 0, r: 0, s: 0 })).not.toThrow();
    expect(() => HexCoordSchema.parse({ q: 3, r: -5, s: 2 })).not.toThrow();
  });

  it('rejects invalid cube coordinates (sum ≠ 0)', () => {
    expect(() => HexCoordSchema.parse({ q: 1, r: 1, s: 1 })).toThrow();
    expect(() => HexCoordSchema.parse({ q: 0, r: 0, s: 1 })).toThrow();
  });
});

describe('GameActionSchema', () => {
  it('parses MOVE_UNIT action', () => {
    const action = GameActionSchema.parse({
      type: 'MOVE_UNIT',
      unitId: '550e8400-e29b-41d4-a716-446655440000',
      targetProvince: 'PRV_000001',
    });
    expect(action.type).toBe('MOVE_UNIT');
  });

  it('rejects unknown action types', () => {
    expect(() => GameActionSchema.parse({ type: 'UNKNOWN_ACTION' })).toThrow();
  });
});
