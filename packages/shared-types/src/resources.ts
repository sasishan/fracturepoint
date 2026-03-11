import { z } from 'zod';
import { NationIdSchema, ProvinceIdSchema } from './core.js';

export const ResourceTypeSchema = z.enum([
  'oil', 'gas', 'coal', 'uranium', 'steel',
  'electronics', 'food', 'manpower', 'currency',
  'rare_earth', 'water',
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceDepositSchema = z.object({
  type: ResourceTypeSchema,
  richness: z.number().min(0).max(10), // 0 = none, 10 = exceptional
  annualOutput: z.number().nonnegative(), // base units per game-year
});
export type ResourceDeposit = z.infer<typeof ResourceDepositSchema>;

export const ResourceStockpileSchema = z.record(ResourceTypeSchema, z.number().nonnegative());
export type ResourceStockpile = z.infer<typeof ResourceStockpileSchema>;

export const TradeRouteSchema = z.object({
  id: z.string(),
  fromNation: NationIdSchema,
  toNation: NationIdSchema,
  resource: ResourceTypeSchema,
  volumePerTick: z.number().nonnegative(),
  pricePerUnit: z.number().nonnegative(),
  routeHexes: z.array(ProvinceIdSchema), // land route provinces OR sea zone ids
  isActive: z.boolean(),
  isBlocked: z.boolean(),
  blockedBy: NationIdSchema.optional(),
});
export type TradeRoute = z.infer<typeof TradeRouteSchema>;
