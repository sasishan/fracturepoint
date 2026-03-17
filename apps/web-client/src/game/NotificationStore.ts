/**
 * NotificationStore — conflict alerts shown as dismissible toasts.
 *
 * Push from AISystem (attacks/captures) and DiplomacyStore (war declarations).
 * Optional provinceId enables "jump to" camera focus via cameraService.
 */

import { create } from 'zustand';

export type AlertKind = 'war' | 'attack' | 'captured' | 'peace' | 'alliance';

export interface ConflictAlert {
  id:           number;
  kind:         AlertKind;
  msg:          string;
  provinceId?:  number;
  /** Unix ms — used for auto-dismiss */
  ts:           number;
}

let _id = 0;

interface NotificationStore {
  alerts: ConflictAlert[];
  push:       (alert: Omit<ConflictAlert, 'id' | 'ts'>) => void;
  dismiss:    (id: number) => void;
  dismissAll: () => void;
  reset:      () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  alerts: [],

  push(alert) {
    const next = [...get().alerts, { ...alert, id: _id++, ts: Date.now() }];
    // Keep last 50 entries in history
    set({ alerts: next.slice(-50) });
  },

  dismiss(id) {
    set({ alerts: get().alerts.filter(a => a.id !== id) });
  },

  dismissAll() {
    set({ alerts: [] });
  },

  reset() {
    set({ alerts: [] });
  },
}));
