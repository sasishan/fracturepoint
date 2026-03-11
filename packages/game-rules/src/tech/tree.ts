import type { GameState, NationId } from '@ww3/shared-types';

export interface TechEffect {
  type: 'unit_modifier' | 'unlock_unit' | 'gdp_modifier' | 'research_speed' | 'unlock_operation';
  unitClass?: string;
  unitId?: string;
  stat?: string;
  value?: number;
}

export interface TechNode {
  id: string;
  name: string;
  domain: string;
  tier: number;
  prerequisites: string[];
  cost: number;
  researchTime: number;
  effects: TechEffect[];
  availableToNations?: string[];
}

export function resolveTechPrerequisites(
  techId: string,
  completedTechs: string[],
  techTree: TechNode[],
): boolean {
  const tech = techTree.find(t => t.id === techId);
  if (!tech) return false;
  return tech.prerequisites.every(prereq => completedTechs.includes(prereq));
}

export function applyTechEffects(
  state: GameState,
  nation: NationId,
  techId: string,
  techTree: TechNode[],
): GameState {
  const tech = techTree.find(t => t.id === techId);
  if (!tech) return state;

  const nations = { ...state.nations };
  const n = nations[nation];
  if (!n) return state;

  // Mark as completed
  nations[nation] = {
    ...n,
    completedTechs: [...n.completedTechs, techId],
    currentResearch: undefined,
    researchProgress: 0,
  };

  return { ...state, nations };
}

export function simulateTechResearch(state: GameState): GameState {
  const nations = { ...state.nations };

  for (const [nationId, nation] of Object.entries(nations)) {
    if (!nation.currentResearch) continue;

    // Research progress per tick based on research points
    const rpGain = Math.max(1, nation.researchPoints / 100);
    const newProgress = Math.min(100, nation.researchProgress + rpGain);

    if (newProgress >= 100) {
      // Tech complete — apply effects next tick
      nations[nationId as NationId] = {
        ...nation,
        completedTechs: [...nation.completedTechs, nation.currentResearch],
        currentResearch: undefined,
        researchProgress: 0,
      };
    } else {
      nations[nationId as NationId] = { ...nation, researchProgress: newProgress };
    }
  }

  return { ...state, nations };
}
