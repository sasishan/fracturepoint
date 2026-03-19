/**
 * TutorialStore — tracks tutorial progress across sessions.
 * Persisted to localStorage so the tutorial can be resumed after a page reload.
 */

import { create } from 'zustand';

const LS_KEY = 'ww3_tutorial';

interface PersistedState {
  stepIndex: number;
  dismissed: boolean;
  completed: boolean;
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch { /* ignore */ }
  return { stepIndex: 0, dismissed: false, completed: false };
}

function savePersisted(s: PersistedState): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface TutorialStore {
  active:    boolean;
  stepIndex: number;
  dismissed: boolean;
  completed: boolean;

  resetTutorial:   () => void;
  startTutorial:    () => void;
  advanceStep:      (totalSteps: number) => void;
  dismissTutorial:  () => void;
  completeTutorial: () => void;
  /** Call once on app mount to restore persisted state. */
  hydrate:          () => void;
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  active:    false,
  stepIndex: 0,
  dismissed: false,
  completed: false,

  resetTutorial: () => {
    set({ active: false, stepIndex: 0, dismissed: false, completed: false });
    savePersisted({ stepIndex: 0, dismissed: false, completed: false });
  },

  hydrate: () => {
    const p = loadPersisted();
    set({ stepIndex: p.stepIndex, dismissed: p.dismissed, completed: p.completed });
  },

  startTutorial: () => {
    const p = loadPersisted();
    const stepIndex = p.completed ? 0 : p.stepIndex;
    set({ active: true, stepIndex, dismissed: false });
    savePersisted({ stepIndex, dismissed: false, completed: p.completed });
  },

  advanceStep: (totalSteps) => {
    const next = get().stepIndex + 1;
    if (next >= totalSteps) return; // completeTutorial handles the final step
    set({ stepIndex: next });
    savePersisted({ stepIndex: next, dismissed: false, completed: false });
  },

  dismissTutorial: () => {
    const { stepIndex } = get();
    set({ active: false, dismissed: true });
    savePersisted({ stepIndex, dismissed: true, completed: false });
  },

  completeTutorial: () => {
    set({ active: false, completed: true, stepIndex: 0 });
    savePersisted({ stepIndex: 0, dismissed: false, completed: true });
  },
}));
