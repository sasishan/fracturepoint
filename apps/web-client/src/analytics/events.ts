/**
 * Analytics event name catalog — all Mixpanel events in one place.
 * Import EventName wherever you call track() to get compile-time safety.
 */
export type EventName =
  // ── Acquisition / onboarding ─────────────────────────────────────────────
  | 'Session Started'
  | 'Splash Entered'
  | 'Intro Video Skipped'
  | 'Intro Video Completed'
  // ── Menu navigation ───────────────────────────────────────────────────────
  | 'Menu Nav'
  | 'Scenario Selected'
  | 'Nation Selected'
  | 'Difficulty Selected'
  | 'Opponents Mode Selected'
  // ── Game lifecycle ────────────────────────────────────────────────────────
  | 'Game Started'
  | 'Game Loaded'
  | 'Game Restarted'
  | 'Surrendered'
  // ── Tutorial ─────────────────────────────────────────────────────────────
  | 'Tutorial Started'
  | 'Tutorial Step Viewed'
  | 'Tutorial Dismissed'
  | 'Tutorial Reopened'
  | 'Tutorial Completed'
  // ── Settings ─────────────────────────────────────────────────────────────
  | 'Settings Changed';
