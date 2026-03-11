export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAction(
  action: unknown,
  playerId: string,
  playerNation: string,
  state: { phase: string; nations: Record<string, unknown>; units: Record<string, unknown>; provinces: Record<string, unknown> },
): ValidationResult {
  if (state.phase !== 'active' && state.phase !== 'lobby') {
    return { valid: false, reason: `Game phase '${state.phase}' does not accept actions` };
  }
  if (!action || typeof action !== 'object') {
    return { valid: false, reason: 'Action must be an object' };
  }

  const a = action as Record<string, unknown>;

  switch (a['type']) {
    case 'MOVE_UNIT': {
      const unitId = a['unitId'] as string;
      const unit = state.units[unitId] as Record<string, unknown> | undefined;
      if (!unit) return { valid: false, reason: `Unit ${unitId} not found` };
      if (unit['nation'] !== playerNation) return { valid: false, reason: 'Not your unit' };
      if (unit['status'] === 'destroyed') return { valid: false, reason: 'Unit destroyed' };
      if (!state.provinces[a['targetProvince'] as string]) return { valid: false, reason: 'Province not found' };
      return { valid: true };
    }

    case 'ATTACK_PROVINCE': {
      const unitIds = a['attackingUnitIds'] as string[] | undefined;
      if (!Array.isArray(unitIds) || unitIds.length === 0) return { valid: false, reason: 'No units specified' };
      for (const uid of unitIds) {
        const u = state.units[uid] as Record<string, unknown> | undefined;
        if (!u) return { valid: false, reason: `Unit ${uid} not found` };
        if (u['nation'] !== playerNation) return { valid: false, reason: `Unit ${uid} not yours` };
      }
      const target = state.provinces[a['targetProvince'] as string] as Record<string, unknown> | undefined;
      if (!target) return { valid: false, reason: 'Target province not found' };
      if (target['controlledBy'] === playerNation) return { valid: false, reason: 'Cannot attack own province' };
      return { valid: true };
    }

    case 'LAUNCH_NUCLEAR': {
      const nation = state.nations[playerNation] as Record<string, unknown> | undefined;
      if (!nation) return { valid: false, reason: 'Nation not found' };
      if ((nation['nuclearWarheads'] as number) <= 0) return { valid: false, reason: 'No warheads' };
      return { valid: true };
    }

    case 'RESEARCH_TECH':
    case 'TRAIN_UNIT':
    case 'DECLARE_DIPLOMACY':
    case 'PROPOSE_AGREEMENT':
    case 'SET_PRODUCTION':
      return { valid: true };

    default:
      return { valid: false, reason: `Unknown action type: ${a['type']}` };
  }
}
