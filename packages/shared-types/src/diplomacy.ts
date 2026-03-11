import { z } from 'zod';
import { NationIdSchema } from './core.js';

export const DiplomaticStatusSchema = z.enum([
  'war', 'hostile', 'cold_war', 'neutral', 'friendly', 'allied', 'player_controlled',
]);
export type DiplomaticStatus = z.infer<typeof DiplomaticStatusSchema>;

export const AgreementTypeSchema = z.enum([
  'non_aggression', 'trade', 'military_access', 'mutual_defense',
  'alliance', 'ceasefire', 'peace_treaty', 'vassalage',
  'nuclear_sharing', 'intelligence_sharing', 'economic_union',
]);
export type AgreementType = z.infer<typeof AgreementTypeSchema>;

export const RelationStateSchema = z.object({
  fromNation: NationIdSchema,
  toNation: NationIdSchema,
  status: DiplomaticStatusSchema,
  relationScore: z.number().min(-100).max(100), // -100 = max hate, +100 = max alliance
  atWarSince: z.number().optional(),            // strategy tick
  agreements: z.array(z.object({
    type: AgreementTypeSchema,
    signedTick: z.number().int().nonnegative(),
    expiresTick: z.number().int().nonnegative().optional(),
    isActive: z.boolean(),
  })),
});
export type RelationState = z.infer<typeof RelationStateSchema>;

export const AllianceGroupSchema = z.enum([
  'NATO', 'CSTO', 'SCO', 'AUKUS', 'QUAD', 'BRICS', 'GULF_COALITION', 'NONE',
]);
export type AllianceGroup = z.infer<typeof AllianceGroupSchema>;
