import { create } from 'zustand';

export type PanelId = 'unitRoster' | 'unitPanel' | 'economy' | 'intelligence' | 'production' | 'diplomacy';

export const PANEL_LABEL: Record<PanelId, string> = {
  unitRoster:   '⚔ FORCES',
  unitPanel:    '◈ UNIT',
  economy:      '$ ECONOMY',
  intelligence: '🔍 INTEL',
  production:   '⚙ PRODUCTION',
  diplomacy:    '★ DIPLOMACY',
};

interface PanelStore {
  minimized: Set<PanelId>;
  minimize:  (id: PanelId) => void;
  restore:   (id: PanelId) => void;
  reset:     () => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  minimized: new Set(),
  minimize:  (id) => set((s) => ({ minimized: new Set([...s.minimized, id]) })),
  restore:   (id) => set((s) => { const n = new Set(s.minimized); n.delete(id); return { minimized: n }; }),
  reset:     ()   => set({ minimized: new Set() }),
}));
