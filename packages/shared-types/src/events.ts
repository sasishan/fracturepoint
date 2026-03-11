import { z } from 'zod';
import { NationIdSchema, ProvinceIdSchema, UnitIdSchema } from './core.js';

export const CombatEventSchema = z.object({
  type: z.literal('COMBAT'),
  tick: z.number().int(),
  province: ProvinceIdSchema,
  attackerNation: NationIdSchema,
  defenderNation: NationIdSchema,
  attackerCasualties: z.number(),
  defenderCasualties: z.number(),
  outcome: z.enum(['attacker_repelled', 'attacker_breakthrough', 'defender_routed', 'stalemate']),
  provinceCaptured: z.boolean(),
});

export const NuclearEventSchema = z.object({
  type: z.literal('NUCLEAR'),
  tick: z.number().int(),
  launchNation: NationIdSchema,
  targetProvince: ProvinceIdSchema,
  warheadYield: z.enum(['tactical', 'strategic', 'city_buster']),
  casualties: z.number().int(),
  defconBefore: z.number().int().min(1).max(5),
  defconAfter: z.number().int().min(1).max(5),
  nuclearWinterProgress: z.number().min(0).max(100),
});

export const DiplomacyEventSchema = z.object({
  type: z.literal('DIPLOMACY'),
  tick: z.number().int(),
  nationA: NationIdSchema,
  nationB: NationIdSchema,
  action: z.string(),
  result: z.enum(['accepted', 'rejected', 'pending', 'forced']),
  notes: z.string().optional(),
});

export const EconomicEventSchema = z.object({
  type: z.literal('ECONOMIC'),
  tick: z.number().int(),
  nation: NationIdSchema,
  event: z.enum([
    'trade_route_blocked', 'sanctions_imposed', 'debt_crisis',
    'inflation_spike', 'resource_depletion', 'boom', 'recession',
  ]),
  severity: z.enum(['minor', 'moderate', 'severe', 'catastrophic']),
});

export const GameEventSchema = z.discriminatedUnion('type', [
  CombatEventSchema,
  NuclearEventSchema,
  DiplomacyEventSchema,
  EconomicEventSchema,
]);
export type GameEvent = z.infer<typeof GameEventSchema>;
