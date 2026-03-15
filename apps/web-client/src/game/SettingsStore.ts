import { create } from 'zustand';
import { AudioManager } from './AudioManager';

type ToggleKey = 'showCountryNames' | 'hudCompact' | 'sfxEnabled' | 'musicEnabled';

interface SettingsStore {
  showCountryNames: boolean;
  hudCompact:       boolean;
  sfxEnabled:       boolean;
  musicEnabled:     boolean;
  toggle: (key: ToggleKey) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  showCountryNames: true,
  hudCompact:       false,
  sfxEnabled:       true,
  musicEnabled:     true,
  toggle: (key) => {
    const next = !get()[key];
    set({ [key]: next });
    if (key === 'sfxEnabled')   AudioManager.setSfxEnabled(next);
    if (key === 'musicEnabled') AudioManager.setMusicEnabled(next);
  },
}));
