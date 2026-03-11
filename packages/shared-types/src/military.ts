import { z } from 'zod';
import { HexCoordSchema, NationIdSchema, ProvinceIdSchema, UnitIdSchema } from './core.js';
import { ResourceTypeSchema } from './resources.js';

export const UnitDomainSchema = z.enum(['land', 'air', 'sea', 'strategic']);
export type UnitDomain = z.infer<typeof UnitDomainSchema>;

export const UnitClassSchema = z.enum([
  // Land
  'infantry', 'armor', 'artillery', 'air_defense', 'engineer', 'special_forces',
  'logistics', 'mechanized', 'helicopter',
  // Air
  'fighter', 'bomber', 'cas', 'transport', 'recon', 'uav', 'awacs',
  // Sea
  'carrier', 'destroyer', 'submarine', 'cruiser', 'frigate', 'amphibious', 'patrol',
  // Strategic
  'icbm', 'slbm', 'cruise_missile', 'tactical_nuke', 'cyber_unit', 'satellite',
]);
export type UnitClass = z.infer<typeof UnitClassSchema>;

export const UnitStatusSchema = z.enum([
  'active', 'moving', 'combat', 'retreating', 'besieged', 'routed',
  'training', 'embarked', 'in_reserve', 'destroyed',
]);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const UnitDefinitionSchema = z.object({
  id: z.string(),             // e.g. "UNIT_M1A2_ABRAMS"
  name: z.string(),
  class: UnitClassSchema,
  domain: UnitDomainSchema,
  tier: z.number().int().min(1).max(4),
  // Combat stats
  hardAttack: z.number().min(0).max(100),
  softAttack: z.number().min(0).max(100),
  defense: z.number().min(0).max(100),
  piercing: z.number().min(0).max(100),
  airAttack: z.number().min(0).max(100),
  antiAir: z.number().min(0).max(100),
  // Mobility
  movementRange: z.number().int().positive(), // hexes per strategy tick
  supplyConsumption: z.number().nonnegative(),
  // Production
  productionCost: z.number().nonnegative(),
  trainingTime: z.number().int().positive(), // in strategy ticks
  upkeepCost: z.record(ResourceTypeSchema, z.number().nonnegative()),
  // Constraints
  availableToNations: z.array(z.string()).optional(), // null = all nations
  requiresTech: z.string().optional(),
});
export type UnitDefinition = z.infer<typeof UnitDefinitionSchema>;

export const UnitStateSchema = z.object({
  id: UnitIdSchema,
  definitionId: z.string(),
  nation: NationIdSchema,
  province: ProvinceIdSchema,
  hex: HexCoordSchema,
  strength: z.number().min(0).max(100),   // 0 = destroyed, 100 = full
  experience: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  supplyLevel: z.number().min(0).max(100),
  status: UnitStatusSchema,
  entrenched: z.number().min(0).max(3),   // 0–3 levels of entrenchment
  attachedToId: UnitIdSchema.optional(),  // HQ attachment
  orderTarget: ProvinceIdSchema.optional(),
});
export type UnitState = z.infer<typeof UnitStateSchema>;
