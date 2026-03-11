import type { HexCoord, NationId, ProvinceId, TerrainType, ClimateType, ResourceDeposit, AllianceGroup } from '@ww3/shared-types';

export interface ProvinceDefinition {
  id: ProvinceId;
  name: string;
  nation: NationId;
  hexCoords: HexCoord[];
  centroidHex: HexCoord;
  adjacentProvinces: ProvinceId[];
  terrain: TerrainType;
  climate: ClimateType;
  resources: ResourceDeposit[];
  population: number;
  isCoastal: boolean;
  isCapital: boolean;
  infrastructure: {
    roads: 0|1|2|3|4|5;
    ports: number;
    airports: number;
    rail: 0|1|2|3|4|5;
  };
  strategicValue: number; // 1–10
}

export interface NationDefinition {
  id: NationId;
  name: string;
  fullName: string;
  isPlayable: boolean;
  capitalProvince: ProvinceId;
  provinces: ProvinceId[];
  allianceGroup: AllianceGroup;
  // Starting stats
  startGdp: number;          // billion USD
  startMilitary: number;     // military budget billion USD
  startStability: number;    // 0–100
  startReputation: number;   // -100 to +100
  nuclearWarheads: number;
  unSecurityCouncil: boolean;
  // Identity
  flagEmoji: string;
  color: string;             // primary hex color
  accentColor: string;
  specialAbilities: string[];
  description: string;
}

export interface SeaZoneDefinition {
  id: string;                // "SEA_MEDITERRANEAN"
  name: string;
  adjacentNations: NationId[];
  adjacentProvinces: ProvinceId[];
  isStrategic: boolean;
  controlledBy: NationId | null; // null = contested
}
