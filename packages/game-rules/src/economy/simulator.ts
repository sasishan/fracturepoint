import type { GameState, NationId, NationState, ResourceType } from '@ww3/shared-types';
import type { SeededRNG } from '@ww3/game-math';

const UNIT_UPKEEP: Record<string, Partial<Record<ResourceType, number>>> = {
  infantry:    { oil: 0.1,  manpower: 0.05, currency: 0.5 },
  armor:       { oil: 0.5,  manpower: 0.03, currency: 2.0 },
  artillery:   { oil: 0.3,  manpower: 0.04, currency: 1.5 },
  air_defense: { oil: 0.2,  manpower: 0.04, currency: 1.0 },
  fighter:     { oil: 1.0,  manpower: 0.02, currency: 5.0 },
  bomber:      { oil: 1.5,  manpower: 0.02, currency: 7.0 },
  carrier:     { oil: 3.0,  manpower: 0.10, currency: 20.0 },
  destroyer:   { oil: 1.2,  manpower: 0.06, currency: 8.0 },
  submarine:   { oil: 0.8,  manpower: 0.04, currency: 6.0 },
};

export function simulateEconomyTick(state: GameState, rng: SeededRNG): GameState {
  const updatedNations: GameState['nations'] = { ...state.nations };

  for (const [nationId, nation] of Object.entries(state.nations)) {
    const nId = nationId as NationId;
    const updatedNation = simulateNationEconomy(nId, nation, state, rng);
    updatedNations[nId] = updatedNation;
  }

  // Process trade routes
  return processTradeRoutes({ ...state, nations: updatedNations });
}

function simulateNationEconomy(
  nationId: NationId,
  nation: NationState,
  state: GameState,
  rng: SeededRNG,
): NationState {
  const stockpile = { ...nation.stockpile };

  // 1. Resource extraction from controlled provinces
  for (const provinceId of nation.controlledProvinces) {
    const province = state.provinces[provinceId];
    if (!province) continue;
    for (const deposit of province.resources) {
      const infraBonus = 1 + (province.infrastructure.roads / 10);
      const popModifier = Math.max(0.1, province.population / 1_000_000) * 0.01;
      const output = deposit.richness * infraBonus * popModifier;
      const type = deposit.type as ResourceType;
      stockpile[type] = (stockpile[type] ?? 0) + output;
    }
  }

  // 2. Military upkeep costs
  const nationUnits = Object.values(state.units).filter(u => u.nation === nationId && u.status !== 'destroyed');
  for (const unit of nationUnits) {
    // Determine unit class from definitionId
    const defId = unit.definitionId.toLowerCase();
    let upkeepKey = 'infantry';
    if (defId.includes('armor') || defId.includes('mbt')) upkeepKey = 'armor';
    else if (defId.includes('artillery') || defId.includes('spg')) upkeepKey = 'artillery';
    else if (defId.includes('fighter')) upkeepKey = 'fighter';
    else if (defId.includes('bomber')) upkeepKey = 'bomber';
    else if (defId.includes('carrier') || defId.includes('cvn')) upkeepKey = 'carrier';
    else if (defId.includes('destroyer') || defId.includes('ddg')) upkeepKey = 'destroyer';
    else if (defId.includes('submarine') || defId.includes('ssn')) upkeepKey = 'submarine';
    else if (defId.includes('air_defense')) upkeepKey = 'air_defense';

    const upkeep = UNIT_UPKEEP[upkeepKey] ?? UNIT_UPKEEP['infantry']!;
    for (const [res, cost] of Object.entries(upkeep) as [ResourceType, number][]) {
      stockpile[res] = Math.max(0, (stockpile[res] ?? 0) - cost);
    }
  }

  // 3. GDP growth
  let gdpGrowth = 0.002; // base 0.2% per tick ≈ 3.6% annual
  if (nation.warExhaustion > 50) gdpGrowth *= 0.5;
  if (nation.stability < 30) gdpGrowth *= 0.3;
  if (nation.inflationRate > 0.10) gdpGrowth *= 0.7;
  // Slight random variance
  gdpGrowth *= 0.9 + rng.next() * 0.2;
  const newGdp = nation.gdp * (1 + gdpGrowth);

  // 4. Inflation calculation
  let inflation = nation.inflationRate;
  const militarySpendRatio = nation.militaryBudget / Math.max(nation.gdp, 1);
  if (militarySpendRatio > 0.40) inflation += 0.0001;
  if ((stockpile['oil'] ?? 0) < 10) inflation += 0.0002;
  // Natural decay toward 2% baseline
  inflation = inflation * 0.999 + 0.02 * 0.001;
  inflation = Math.max(0, Math.min(0.5, inflation));

  // 5. Stability effects
  let stability = nation.stability;
  if (inflation > 0.15) stability = Math.max(0, stability - 0.1);
  if (nation.warExhaustion > 70) stability = Math.max(0, stability - 0.2);
  if (nation.globalReputation > 50) stability = Math.min(100, stability + 0.05);

  return {
    ...nation,
    stockpile,
    gdp: newGdp,
    inflationRate: inflation,
    stability,
  };
}

function processTradeRoutes(state: GameState): GameState {
  const nations = { ...state.nations };

  for (const route of Object.values(state.tradeRoutes)) {
    if (!route.isActive || route.isBlocked) continue;

    const fromNation = nations[route.fromNation];
    const toNation = nations[route.toNation];
    if (!fromNation || !toNation) continue;

    const available = fromNation.stockpile[route.resource] ?? 0;
    const transfer = Math.min(route.volumePerTick, available);
    if (transfer <= 0) continue;

    const payment = transfer * route.pricePerUnit;

    // Transfer resource
    const fromStockpile = { ...fromNation.stockpile };
    const toStockpile = { ...toNation.stockpile };
    fromStockpile[route.resource] = (fromStockpile[route.resource] ?? 0) - transfer;
    toStockpile[route.resource] = (toStockpile[route.resource] ?? 0) + transfer;
    // Payment in currency
    fromStockpile['currency'] = (fromStockpile['currency'] ?? 0) + payment;
    toStockpile['currency'] = (toStockpile['currency'] ?? 0) - payment;

    nations[route.fromNation] = { ...fromNation, stockpile: fromStockpile };
    nations[route.toNation] = { ...toNation, stockpile: toStockpile };
  }

  return { ...state, nations };
}
