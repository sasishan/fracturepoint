import { z } from 'zod';

// ── Coordinate Systems ──────────────────────────────────────────────────────

export const HexCoordSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
  s: z.number().int(),
}).refine(h => h.q + h.r + h.s === 0, 'Cube coordinates must sum to 0');

export type HexCoord = z.infer<typeof HexCoordSchema>;

export const GeoCoordSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type GeoCoord = z.infer<typeof GeoCoordSchema>;

// ── ID Types ────────────────────────────────────────────────────────────────

export const ProvinceIdSchema = z.string().regex(/^PRV_\d{4,6}$/, 'Province ID must be PRV_NNNNNN');
export type ProvinceId = z.infer<typeof ProvinceIdSchema>;

export const NationIdSchema = z.string().length(3, 'Nation ID must be ISO 3166-1 alpha-3').toUpperCase();
export type NationId = z.infer<typeof NationIdSchema>;

export const UnitIdSchema = z.string().uuid('Unit ID must be UUID v4');
export type UnitId = z.infer<typeof UnitIdSchema>;

export const PlayerIdSchema = z.string().uuid('Player ID must be UUID v4');
export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const GameIdSchema = z.string().uuid('Game ID must be UUID v4');
export type GameId = z.infer<typeof GameIdSchema>;

// ── Clock ───────────────────────────────────────────────────────────────────

export const GameSpeedSchema = z.enum(['paused', 'slow', 'normal', 'fast', 'very_fast']);
export type GameSpeed = z.infer<typeof GameSpeedSchema>;

export const GameClockSchema = z.object({
  strategyTick: z.number().int().nonnegative(),
  gameDay: z.number().int().nonnegative(),     // 0 = Jan 1, 2026
  gameYear: z.number().int().min(2026).max(2040),
  gameMonth: z.number().int().min(1).max(12),
  speed: GameSpeedSchema,
});
export type GameClock = z.infer<typeof GameClockSchema>;

// ── Terrain & Climate ────────────────────────────────────────────────────────

export const TerrainTypeSchema = z.enum([
  'plains', 'forest', 'mountain', 'desert', 'urban', 'coastal', 'water', 'arctic', 'radioactive',
]);
export type TerrainType = z.infer<typeof TerrainTypeSchema>;

export const ClimateTypeSchema = z.enum(['arctic', 'temperate', 'arid', 'tropical', 'continental']);
export type ClimateType = z.infer<typeof ClimateTypeSchema>;

export const WeatherConditionSchema = z.enum(['clear', 'rain', 'storm', 'snow', 'blizzard', 'fog', 'dust_storm']);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
