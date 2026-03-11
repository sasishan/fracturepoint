import { z } from 'zod';
import {
  HexCoordSchema, NationIdSchema, ProvinceIdSchema, GameClockSchema,
  TerrainTypeSchema, ClimateTypeSchema, WeatherConditionSchema
} from './core.js';
import { ResourceDepositSchema, ResourceStockpileSchema, TradeRouteSchema } from './resources.js';
import { UnitStateSchema } from './military.js';
import { RelationStateSchema, DiplomaticStatusSchema, AllianceGroupSchema } from './diplomacy.js';
import { GameEventSchema } from './events.js';

export const ProvinceStateSchema = z.object({
  id: ProvinceIdSchema,
  name: z.string(),
  controlledBy: NationIdSchema,
  coreNation: NationIdSchema,     // historically belongs to
  hexCoords: z.array(HexCoordSchema),
  centroidHex: HexCoordSchema,
  adjacentProvinces: z.array(ProvinceIdSchema),
  terrain: TerrainTypeSchema,
  climate: ClimateTypeSchema,
  resources: z.array(ResourceDepositSchema),
  population: z.number().int().nonnegative(),
  infrastructure: z.object({
    roads: z.number().int().min(0).max(5),
    ports: z.number().int().min(0).max(5),
    airports: z.number().int().min(0).max(5),
    rail: z.number().int().min(0).max(5),
    fortification: z.number().int().min(0).max(5),
  }),
  isCoastal: z.boolean(),
  isCapital: z.boolean(),
  strategicValue: z.number().int().min(1).max(10),
  stability: z.number().min(0).max(100),
  suppression: z.number().min(0).max(100),
  isRadioactive: z.boolean().default(false),
  radiationLevel: z.number().min(0).max(10).default(0),
  weather: WeatherConditionSchema,
});
export type ProvinceState = z.infer<typeof ProvinceStateSchema>;

export const NationStateSchema = z.object({
  id: NationIdSchema,
  name: z.string(),
  isPlayable: z.boolean(),
  isPlayerControlled: z.boolean(),
  playerId: z.string().uuid().optional(),
  allianceGroup: AllianceGroupSchema,
  capitalProvince: ProvinceIdSchema,
  controlledProvinces: z.array(ProvinceIdSchema),
  // Economy
  gdp: z.number().nonnegative(),
  gdpGrowthRate: z.number(),      // can be negative
  inflationRate: z.number(),
  debtRatio: z.number(),          // debt / GDP
  stockpile: ResourceStockpileSchema,
  tradeRoutes: z.array(TradeRouteSchema),
  // Military
  militaryBudget: z.number().nonnegative(),
  warExhaustion: z.number().min(0).max(100),
  // Politics
  stability: z.number().min(0).max(100),
  globalReputation: z.number().min(-100).max(100),
  unSecurityCouncil: z.boolean(),  // P5 member
  // Research
  researchPoints: z.number().nonnegative(),
  completedTechs: z.array(z.string()),
  currentResearch: z.string().optional(),
  researchProgress: z.number().min(0).max(100),
  // Nuclear
  nuclearWarheads: z.number().int().nonnegative(),
  defconLevel: z.number().int().min(1).max(5),
  // Special
  specialAbilities: z.array(z.string()),
});
export type NationState = z.infer<typeof NationStateSchema>;

export const GamePhaseSchema = z.enum([
  'lobby', 'starting', 'active', 'paused', 'armistice_negotiation',
  'victory', 'defeat', 'draw', 'nuclear_winter',
]);
export type GamePhase = z.infer<typeof GamePhaseSchema>;

export const GameStateSchema = z.object({
  gameId: z.string().uuid(),
  phase: GamePhaseSchema,
  clock: GameClockSchema,
  provinces: z.record(ProvinceIdSchema, ProvinceStateSchema),
  nations: z.record(NationIdSchema, NationStateSchema),
  units: z.record(z.string(), UnitStateSchema), // UnitId -> UnitState
  diplomaticMatrix: z.record(z.string(), RelationStateSchema), // "NAT_A:NAT_B" -> RelationState
  tradeRoutes: z.record(z.string(), TradeRouteSchema),
  globalTension: z.number().min(0).max(100),
  nuclearWinterProgress: z.number().min(0).max(100),
  totalNuclearDetonations: z.number().int().nonnegative(),
  events: z.array(GameEventSchema),    // cleared each tick
  rngSeed: z.number().int(),
  rngState: z.number().int(),          // current Mulberry32 state
  victoryCheckTick: z.number().int().nonnegative(),
});
export type GameState = z.infer<typeof GameStateSchema>;
