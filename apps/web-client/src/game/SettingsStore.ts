import { create } from 'zustand';
import { AudioManager } from './AudioManager';

type ToggleKey = 'showCountryNames' | 'hudCompact' | 'sfxEnabled' | 'musicEnabled';

export type AIMoveSpeed = 'slow' | 'normal' | 'fast';

/** Milliseconds to pause between consecutive AI move animations. */
export const AI_MOVE_DELAY: Record<AIMoveSpeed, number> = {
  slow:   1200,
  normal:  600,
  fast:    150,
};

interface SettingsStore {
  showCountryNames: boolean;
  hudCompact:       boolean;
  sfxEnabled:       boolean;
  musicEnabled:     boolean;
  aiMoveSpeed:      AIMoveSpeed;
  toggle:           (key: ToggleKey) => void;
  cycleAIMoveSpeed: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  showCountryNames: true,
  hudCompact:       false,
  sfxEnabled:       true,
  musicEnabled:     true,
  aiMoveSpeed:      'normal',
  toggle: (key) => {
    const next = !get()[key];
    set({ [key]: next });
    if (key === 'sfxEnabled')   AudioManager.setSfxEnabled(next);
    if (key === 'musicEnabled') AudioManager.setMusicEnabled(next);
  },
  cycleAIMoveSpeed: () => {
    const order: AIMoveSpeed[] = ['slow', 'normal', 'fast'];
    const cur = get().aiMoveSpeed;
    const next = order[(order.indexOf(cur) + 1) % order.length] ?? 'normal';
    set({ aiMoveSpeed: next });
  },
}));
