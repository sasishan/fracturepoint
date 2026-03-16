/**
 * AIMoveQueue — sequential queue for AI unit moves/attacks.
 *
 * tickAI() enqueues actions here instead of executing them directly.
 * VoronoiMapScene drains the queue one-by-one, panning the camera to
 * the unit's province before playing each move animation, then calling
 * execute() to commit the store change.
 */

import { create } from 'zustand';

export interface AIAction {
  unitId:         string;
  fromProvinceId: number;
  toProvinceId:   number;
  nationCode:     string;
  /** Commits the move/attack in UnitStore + ownership. Called after animation. */
  execute:        () => void;
}

interface AIMoveQueueStore {
  queue:         AIAction[];
  processing:    boolean;
  enqueue:       (action: AIAction) => void;
  dequeue:       () => AIAction | undefined;
  setProcessing: (v: boolean) => void;
  clear:         () => void;
}

export const useAIMoveQueue = create<AIMoveQueueStore>((set, get) => ({
  queue:      [],
  processing: false,

  enqueue: (action) => set((s) => ({ queue: [...s.queue, action] })),

  dequeue: () => {
    const [head, ...rest] = get().queue;
    set({ queue: rest });
    return head;
  },

  setProcessing: (v) => set({ processing: v }),

  clear: () => set({ queue: [], processing: false }),
}));
