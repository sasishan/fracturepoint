/**
 * AudioManager — singleton audio system for WW3 Strategy.
 *
 * Expected file layout under public/audio/ — see public/audio/README.md.
 *
 * All sounds are loaded lazily on first play and silently skipped if the
 * file is missing, so the game runs fine before any audio assets exist.
 *
 * Usage:
 *   AudioManager.play('combat_victory');
 *   AudioManager.playRandom(...VOICE.selectLand);
 *   AudioManager.playRandom(...WEAPON_SFX['tank']);
 *   const stop = AudioManager.playLoop('unit_move_land_loop');
 *   AudioManager.playMusic('theme_strategic');
 */

import type { UnitType } from './LocalUnit';

export type SfxKey =
  // ── UI ──────────────────────────────────────────────────────────────────────
  | 'ui_click'
  | 'turn_end'
  | 'turn_start'
  // ── Unit selection (domain-specific voice lines) ─────────────────────────────
  | 'unit_select_land_1'   | 'unit_select_land_2'   | 'unit_select_land_3'
  | 'unit_select_air_1'    | 'unit_select_air_2'    | 'unit_select_air_3'
  | 'unit_select_naval_1'  | 'unit_select_naval_2'  | 'unit_select_naval_3'
  // ── Move orders (voice acknowledgment, plays at order time) ──────────────────
  | 'unit_order_move_land_1'  | 'unit_order_move_land_2'  | 'unit_order_move_land_3'
  | 'unit_order_move_air_1'   | 'unit_order_move_air_2'
  | 'unit_order_move_naval_1' | 'unit_order_move_naval_2'
  // ── Movement loops (ambient engine/footstep sound, plays during animation) ───
  | 'unit_infantry_marching'
  | 'unit_move_land_loop'
  | 'unit_move_air_loop'
  | 'unit_move_naval_loop'
  // ── Attack orders (voice) ────────────────────────────────────────────────────
  | 'unit_order_attack_1' | 'unit_order_attack_2' | 'unit_order_attack_3'
  // ── Weapon fire sounds (play on all attacks, player and AI) ──────────────────
  | 'weapon_infantry_1'    | 'weapon_infantry_2'
  | 'weapon_tank_1'        | 'weapon_tank_2'
  | 'weapon_artillery_1'   | 'weapon_artillery_2'
  | 'weapon_air_defense_1'
  | 'weapon_jet_1'         | 'weapon_jet_2'
  | 'weapon_bomber_1'
  | 'weapon_helicopter_1'  | 'weapon_helicopter_2'
  | 'weapon_naval_1'       | 'weapon_naval_2'
  | 'weapon_torpedo_1'
  | 'weapon_general_1'     | 'weapon_general_2'
  // ── Combat results ───────────────────────────────────────────────────────────
  | 'unit_under_attack'
  | 'combat_victory'
  | 'combat_defeat'
  // ── Fortify orders ───────────────────────────────────────────────────────────
  | 'unit_order_fortify_1' | 'unit_order_fortify_2'
  // ── Building selection ───────────────────────────────────────────────────────
  | 'building_select_1' | 'building_select_2' | 'building_select_3'
  // ── Production ───────────────────────────────────────────────────────────────
  | 'production_order_1'    | 'production_order_2'
  | 'production_complete_1' | 'production_complete_2';

export type MusicKey =
  | 'theme_menu'
  | 'theme_strategic'
  | 'theme_tension';

/**
 * Pre-built variant groups — pass to playRandom() to pick one at random.
 * Groups are domain-aware so land/air/naval units get distinct voice actors.
 */
export const VOICE = {
  selectLand:   ['unit_select_land_1',  'unit_select_land_2',  'unit_select_land_3']  as SfxKey[],
  selectAir:    ['unit_select_air_1',   'unit_select_air_2',   'unit_select_air_3']   as SfxKey[],
  selectNaval:  ['unit_select_naval_1', 'unit_select_naval_2', 'unit_select_naval_3'] as SfxKey[],
  moveLand:     ['unit_order_move_land_1',  'unit_order_move_land_2',  'unit_order_move_land_3']  as SfxKey[],
  moveAir:      ['unit_order_move_air_1',   'unit_order_move_air_2']   as SfxKey[],
  moveNaval:    ['unit_order_move_naval_1', 'unit_order_move_naval_2'] as SfxKey[],
  attack:       ['unit_order_attack_1', 'unit_order_attack_2', 'unit_order_attack_3'] as SfxKey[],
  fortify:      ['unit_order_fortify_1', 'unit_order_fortify_2'] as SfxKey[],
  production:      ['production_order_1',    'production_order_2']    as SfxKey[],
  complete:        ['production_complete_1', 'production_complete_2'] as SfxKey[],
  selectBuilding:  ['building_select_1', 'building_select_2', 'building_select_3'] as SfxKey[],
} as const;

/** Loop key for each unit domain — domain-level fallback. */
export const MOVE_LOOP: Record<'land' | 'air' | 'naval', SfxKey> = {
  land:  'unit_move_land_loop',
  air:   'unit_move_air_loop',
  naval: 'unit_move_naval_loop',
};

/**
 * Per-unit-type movement loop overrides.
 * Falls back to MOVE_LOOP[domain] if a type isn't listed here.
 */
export const UNIT_MOVE_LOOP: Partial<Record<UnitType, SfxKey>> = {
  infantry:       'unit_infantry_marching',
  special_forces: 'unit_infantry_marching',
  reserves:       'unit_infantry_marching',
  engineers:      'unit_infantry_marching',
};

/**
 * Weapon fire sounds per unit type — plays on every attack (player and AI).
 * Each entry is an array so playRandom() picks a variant automatically.
 */
export const WEAPON_SFX: Record<UnitType, SfxKey[]> = {
  // ── Land ────────────────────────────────────────────────────────────────────
  infantry:       ['weapon_infantry_1',   'weapon_infantry_2'],
  special_forces: ['weapon_infantry_1',   'weapon_infantry_2'],
  reserves:       ['weapon_infantry_1',   'weapon_infantry_2'],
  tank:           ['weapon_tank_1',       'weapon_tank_2'],
  artillery:      ['weapon_artillery_1',  'weapon_artillery_2'],
  multi_launcher: ['weapon_artillery_1',  'weapon_artillery_2'],
  launcher:       ['weapon_artillery_1'],
  air_defense:    ['weapon_air_defense_1'],
  engineers:      ['weapon_infantry_1'],
  logistics:      ['weapon_general_1'],
  // ── Air ─────────────────────────────────────────────────────────────────────
  stealth_fighter:['weapon_jet_1',        'weapon_jet_2'],
  combat_drone:   ['weapon_jet_1'],
  recon_drone:    ['weapon_general_1'],
  bomber:         ['weapon_bomber_1'],
  helicopter:     ['weapon_helicopter_1', 'weapon_helicopter_2'],
  transport_heli: ['weapon_general_1'],
  // ── Naval ────────────────────────────────────────────────────────────────────
  carrier:        ['weapon_naval_1',      'weapon_naval_2'],
  destroyer:      ['weapon_naval_1',      'weapon_naval_2'],
  warship:        ['weapon_naval_1',      'weapon_naval_2'],
  assault_ship:   ['weapon_naval_1'],
  nuclear_sub:    ['weapon_torpedo_1'],
};

// How many pooled HTMLAudioElements per key — keys not listed default to 1.
const POOL_SIZE: Partial<Record<SfxKey, number>> = {
  weapon_infantry_1:   3,
  weapon_infantry_2:   3,
  weapon_tank_1:       2,
  weapon_tank_2:       2,
  weapon_artillery_1:  2,
  weapon_artillery_2:  2,
  weapon_jet_1:        2,
  weapon_jet_2:        2,
  weapon_naval_1:      2,
  weapon_naval_2:      2,
  weapon_helicopter_1: 2,
  weapon_helicopter_2: 2,
};

class AudioManagerClass {
  private sfxCache   = new Map<SfxKey, HTMLAudioElement[]>();
  private sfxVol     = 0.7;
  private musicVol   = 0.35;
  private sfxOn      = true;
  private musicOn    = true;

  private currentMusic:    HTMLAudioElement | null = null;
  private currentMusicKey: MusicKey | null         = null;
  private fadeTimer:       ReturnType<typeof setInterval> | null = null;

  /** Track queued while browser autoplay is still locked. */
  private pendingMusicKey: MusicKey | null = null;
  private unlocked = false;

  constructor() {
    // One-shot unlock listener — plays any pending music on first user gesture.
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown',     unlock);
      if (this.pendingMusicKey) {
        const key = this.pendingMusicKey;
        this.pendingMusicKey = null;
        this.currentMusicKey = null; // allow re-play
        this.playMusic(key);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown',     unlock, { passive: true });
  }

  // ── SFX ──────────────────────────────────────────────────────────────────────

  private getPool(key: SfxKey): HTMLAudioElement[] {
    if (!this.sfxCache.has(key)) {
      const size = POOL_SIZE[key] ?? 1;
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < size; i++) {
        const el = new Audio(`/audio/sfx/${key}.mp3`);
        el.preload = 'none';
        el.volume  = this.sfxVol;
        pool.push(el);
      }
      this.sfxCache.set(key, pool);
    }
    return this.sfxCache.get(key)!;
  }

  play(key: SfxKey): void {
    if (!this.sfxOn) return;
    const pool = this.getPool(key);
    const el = pool.find(e => e.paused || e.ended) ?? pool[0];
    if (!el) return;
    el.volume      = this.sfxVol;
    el.currentTime = 0;
    el.play().catch(() => { /* file missing or autoplay blocked */ });
  }

  /** Pick one key at random and play it. */
  playRandom(...keys: SfxKey[]): void {
    if (keys.length === 0) return;
    this.play(keys[Math.floor(Math.random() * keys.length)]!);
  }

  /**
   * Start a looping ambient sound (e.g. engine noise during movement animation).
   * Returns a stop function — call it when the animation completes.
   */
  playLoop(key: SfxKey): () => void {
    if (!this.sfxOn) return () => {};
    const el = new Audio(`/audio/sfx/${key}.mp3`);
    el.loop   = true;
    el.volume = 0;
    el.play().catch(() => {});

    const target    = this.sfxVol * 0.6;
    const fadeSteps = 6;
    let   inStep    = 0;
    const inTimer   = setInterval(() => {
      inStep++;
      el.volume = Math.min(target, target * (inStep / fadeSteps));
      if (inStep >= fadeSteps) clearInterval(inTimer);
    }, 25);

    return () => {
      clearInterval(inTimer);
      const startVol = el.volume;
      const outSteps = 8;
      let   outStep  = 0;
      const outTimer = setInterval(() => {
        outStep++;
        el.volume = Math.max(0, startVol * (1 - outStep / outSteps));
        if (outStep >= outSteps) { clearInterval(outTimer); el.pause(); }
      }, 25);
    };
  }

  // ── Music ─────────────────────────────────────────────────────────────────────

  playMusic(key: MusicKey): void {
    if (!this.musicOn) return;
    if (this.currentMusicKey === key) return;
    this.stopMusic(800);
    const el   = new Audio(`/audio/music/${key}.mp3`);
    el.loop    = true;
    el.volume  = 0;
    const target = this.musicVol;
    const steps  = 20;
    let   step   = 0;
    el.play().then(() => {
      // Autoplay succeeded — start fade-in.
      this.pendingMusicKey = null;
      const timer = setInterval(() => {
        step++;
        el.volume = Math.min(target, target * (step / steps));
        if (step >= steps) clearInterval(timer);
      }, 50);
    }).catch(() => {
      // Autoplay blocked — queue and play on first user interaction.
      this.pendingMusicKey = key;
      this.currentMusic    = null;
      this.currentMusicKey = null;
    });
    this.currentMusic    = el;
    this.currentMusicKey = key;
  }

  stopMusic(fadeMs = 1000): void {
    if (!this.currentMusic) return;
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const el         = this.currentMusic;
    const startVol   = el.volume;
    const totalSteps = Math.max(1, Math.round(fadeMs / 50));
    let   step       = 0;
    this.fadeTimer   = setInterval(() => {
      step++;
      el.volume = Math.max(0, startVol * (1 - step / totalSteps));
      if (step >= totalSteps) {
        clearInterval(this.fadeTimer!);
        this.fadeTimer = null;
        el.pause();
      }
    }, 50);
    this.currentMusic    = null;
    this.currentMusicKey = null;
  }

  // ── Volume / enable ───────────────────────────────────────────────────────────

  setSfxVolume(v: number): void {
    this.sfxVol = Math.max(0, Math.min(1, v));
    for (const pool of this.sfxCache.values()) {
      for (const el of pool) el.volume = this.sfxVol;
    }
  }

  setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.currentMusic) this.currentMusic.volume = this.musicVol;
  }

  setSfxEnabled(v: boolean): void { this.sfxOn = v; }

  setMusicEnabled(v: boolean): void {
    this.musicOn = v;
    if (!v) this.stopMusic(300);
    // Caller is responsible for (re)playing the appropriate track after enabling.
  }

  getSfxEnabled():   boolean { return this.sfxOn; }
  getMusicEnabled(): boolean { return this.musicOn; }
}

export const AudioManager = new AudioManagerClass();
