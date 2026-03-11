import { z } from 'zod';
import { NationIdSchema, ProvinceIdSchema, UnitIdSchema } from './core.js';
import { ResourceTypeSchema } from './resources.js';
import { AgreementTypeSchema } from './diplomacy.js';

// All possible player commands (sent over WebSocket as Protobuf)
export const MoveUnitActionSchema = z.object({
  type: z.literal('MOVE_UNIT'),
  unitId: UnitIdSchema,
  targetProvince: ProvinceIdSchema,
});

export const AttackProvinceActionSchema = z.object({
  type: z.literal('ATTACK_PROVINCE'),
  attackingUnitIds: z.array(UnitIdSchema).min(1).max(20),
  targetProvince: ProvinceIdSchema,
});

export const TrainUnitActionSchema = z.object({
  type: z.literal('TRAIN_UNIT'),
  province: ProvinceIdSchema,
  unitDefinitionId: z.string(),
  quantity: z.number().int().min(1).max(10),
});

export const ResearchTechActionSchema = z.object({
  type: z.literal('RESEARCH_TECH'),
  techId: z.string(),
});

export const DeclareDiplomacyActionSchema = z.object({
  type: z.literal('DECLARE_DIPLOMACY'),
  targetNation: NationIdSchema,
  action: z.enum([
    'declare_war', 'offer_peace', 'propose_alliance', 'break_alliance',
    'impose_sanctions', 'lift_sanctions', 'recognize', 'sever_relations',
  ]),
  terms: z.record(z.string(), z.unknown()).optional(),
});

export const ProposeAgreementActionSchema = z.object({
  type: z.literal('PROPOSE_AGREEMENT'),
  targetNation: NationIdSchema,
  agreementType: AgreementTypeSchema,
  durationTicks: z.number().int().positive().optional(),
  resourcesOffered: z.record(ResourceTypeSchema, z.number()).optional(),
  resourcesRequested: z.record(ResourceTypeSchema, z.number()).optional(),
});

export const LaunchNuclearActionSchema = z.object({
  type: z.literal('LAUNCH_NUCLEAR'),
  targetProvince: ProvinceIdSchema,
  deliverySystem: z.enum(['icbm', 'slbm', 'bomber', 'tactical']),
  authCode: z.string(), // must be validated server-side
});

export const SetProductionActionSchema = z.object({
  type: z.literal('SET_PRODUCTION'),
  province: ProvinceIdSchema,
  queue: z.array(z.object({
    unitDefinitionId: z.string(),
    quantity: z.number().int().positive(),
    priority: z.number().int().min(0).max(10),
  })),
});

export const GameActionSchema = z.discriminatedUnion('type', [
  MoveUnitActionSchema,
  AttackProvinceActionSchema,
  TrainUnitActionSchema,
  ResearchTechActionSchema,
  DeclareDiplomacyActionSchema,
  ProposeAgreementActionSchema,
  LaunchNuclearActionSchema,
  SetProductionActionSchema,
]);
export type GameAction = z.infer<typeof GameActionSchema>;
