/**
 * TutorialSteps — data definitions for all 11 tutorial steps.
 *
 * completionMode:
 *   'action'   → advances when completionCheck() returns true (polled every 100ms)
 *   'auto'     → advances automatically after autoDelay ms
 *   'continue' → advances when the player clicks the Continue button
 */

import { useUnitStore }       from './UnitStore';
import { useGameStateStore }  from './GameStateStore';
import { useProductionStore } from './ProductionStore';
import { usePanelStore }      from './PanelStore';

export interface TutorialStep {
  id:               string;
  headline:         string;
  body:             string;
  /** CSS selector for the element to spotlight. null = no spotlight (full-screen callout). */
  spotlightQuery:   string | null;
  /** Where to position the callout relative to the spotlight: 'right' | 'left' | 'below' | 'center' */
  calloutSide:      'right' | 'left' | 'below' | 'above' | 'center';
  completionMode:   'action' | 'auto' | 'continue';
  autoDelay?:       number;
  completionCheck?: () => boolean;
  /** Called once when this step activates (e.g. restore a minimized panel). */
  onActivate?:      () => void;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id:             'map',
    headline:       'THE WORLD MAP',
    body:           'Each colored region is a province controlled by a nation. Provinces hold resources, cities, and military bases. Click any province to inspect it.',
    spotlightQuery: null,
    calloutSide:    'center',
    completionMode: 'action',
    completionCheck: () => {
      // Any province click selects it — detect via selectedUnitId changing or province info panel opening.
      // We use a simple proxy: the user clicked the canvas at least once (selectedUnitId set, or provinceOwnership polled).
      // Instead we check if any province panel is visible via a DOM query.
      return !!document.querySelector('[data-tutorial="province-selected"]');
    },
  },
  {
    id:             'topbar',
    headline:       'YOUR COMMAND CENTER',
    body:           'Your nation is shown top-right. DEFCON tracks global nuclear tension — it starts at 5 (peace). If it reaches 1, nuclear strikes become possible. The date advances each turn.',
    spotlightQuery: '[data-tutorial="topbar"]',
    calloutSide:    'below',
    completionMode: 'auto',
    autoDelay:      5000,
  },
  {
    id:             'roster',
    headline:       'YOUR FORCES',
    body:           'This panel lists all units under your command. Click any unit to select it and see its full details. Units are grouped by domain: Land, Air, and Naval.',
    spotlightQuery: '[data-tutorial="unit-roster"]',
    calloutSide:    'right',
    completionMode: 'action',
    onActivate: () => usePanelStore.getState().restore('unitRoster'),
    completionCheck: () => !!useUnitStore.getState().selectedUnitId,
  },
  {
    id:             'move',
    headline:       'MOVE A UNIT',
    body:           'Blue-tinted provinces show where this unit can move. Red-tinted provinces contain enemies — moving there triggers combat. Click any highlighted province to move.',
    spotlightQuery: null,
    calloutSide:    'center',
    completionMode: 'action',
    completionCheck: (() => {
      // Track the initial province of the selected unit, advance when it changes.
      let initialProvinceId: number | null = null;
      return () => {
        const { units, selectedUnitId, moveRange } = useUnitStore.getState();
        if (!moveRange) return false; // no unit selected with range shown
        const unit = selectedUnitId ? units.get(selectedUnitId) : null;
        if (unit && initialProvinceId === null) initialProvinceId = unit.provinceId;
        // Detect a completed move: unit has no range (cleared after move) and province changed
        if (!selectedUnitId && initialProvinceId !== null) return true;
        return false;
      };
    })(),
  },
  {
    id:             'unit-panel',
    headline:       'UNIT DETAILS',
    body:           'STRENGTH shows combat health (0 = destroyed). MOVEMENT points reset each turn. EXPERIENCE grows in battle, improving combat performance. STANCE controls fortify and other postures.',
    spotlightQuery: '[data-tutorial="unit-panel"]',
    calloutSide:    'left',
    completionMode: 'continue',
    onActivate: () => usePanelStore.getState().restore('unitPanel'),
  },
  {
    id:             'end-turn',
    headline:       'END YOUR TURN',
    body:           'When your units have moved, end your turn. Enemy nations act, then resources are collected and movement resets. Watch the AI move — you can intervene on your next turn.',
    spotlightQuery: '[data-tutorial="turnbar"]',
    calloutSide:    'above',
    completionMode: 'action',
    completionCheck: (() => {
      const initialTurn = useGameStateStore.getState().turn;
      return () => useGameStateStore.getState().turn > initialTurn;
    })(),
  },
  {
    id:             'economy',
    headline:       'YOUR ECONOMY',
    body:           'Every turn you earn treasury income and collect Oil, Food, Rare Earth, and Political Power. Expand your economy panel to see all resources. Running out of oil cripples your military.',
    spotlightQuery: '[data-tutorial="economy-panel"]',
    calloutSide:    'left',
    completionMode: 'action',
    onActivate: () => usePanelStore.getState().restore('economy'),
    completionCheck: () => !!document.querySelector('[data-tutorial="economy-expanded"]'),
  },
  {
    id:             'production',
    headline:       'BUILD YOUR FORCES',
    body:           'Queue a unit or building here. Each unit type requires a specific structure — infantry needs a Barracks, fighters need an Air Base. Production completes in a set number of turns.',
    spotlightQuery: '[data-tutorial="production-panel"]',
    calloutSide:    'left',
    completionMode: 'action',
    onActivate: () => usePanelStore.getState().restore('production'),
    completionCheck: (() => {
      const initial = Object.keys(useProductionStore.getState().queues).length;
      return () => Object.values(useProductionStore.getState().queues)
        .reduce((sum, q) => sum + q.length, 0) > initial;
    })(),
  },
  {
    id:             'diplomacy',
    headline:       'DIPLOMACY',
    body:           'Declaring war costs Political Power. So does making peace. Alliances protect you but obligate you to join allied wars. Civilian casualties from bombing hurt your reputation globally.',
    spotlightQuery: '[data-tutorial="diplomacy-btn"]',
    calloutSide:    'below',
    completionMode: 'action',
    completionCheck: () => !!document.querySelector('[data-tutorial="diplomacy-panel"]'),
  },
  {
    id:             'defcon',
    headline:       'ESCALATION & DEFCON',
    body:           'Every battle raises global tension slightly. At DEFCON 2 nations enter armed readiness. At DEFCON 1 nuclear strikes become possible. Diplomacy reduces tension — war is costly even when you are winning.',
    spotlightQuery: '[data-tutorial="defcon"]',
    calloutSide:    'below',
    completionMode: 'auto',
    autoDelay:      6000,
  },
  {
    id:             'complete',
    headline:       'YOU ARE READY, COMMANDER',
    body:           'The world is yours to shape — or to preserve. Remember: diplomacy wins more wars than brute force. Civilian lives have weight. Good luck.',
    spotlightQuery: null,
    calloutSide:    'center',
    completionMode: 'continue',
  },
];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;
