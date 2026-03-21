/// <reference types="vite/client" />

/**
 * Analytics — thin Mixpanel wrapper.
 *
 * All calls are no-ops when VITE_MIXPANEL_TOKEN is not set, so local dev
 * stays silent by default. Set the token in .env to enable it in dev too.
 *
 * Usage:
 *   import { track, setGameContext } from '../analytics';
 *   track('Game Started', { nation: 'USA', opponents_mode: 'major' });
 */

import mixpanel from 'mixpanel-browser';
import type { EventName } from './events';

const TOKEN = (import.meta.env['VITE_MIXPANEL_TOKEN'] as string | undefined) ?? '';

/** Call once at app startup (before createRoot). */
export function initAnalytics(): void {
  if (!TOKEN) return;
  mixpanel.init(TOKEN, {
    persistence:    'localStorage',
    track_pageview: false,
    autocapture:    false,
  });
}

/** Fire a typed analytics event. Silent no-op when no token. */
export function track(event: EventName, props?: Record<string, unknown>): void {
  if (!TOKEN) return;
  try { mixpanel.track(event, props); } catch { /* ignore */ }
}

/**
 * Register super-properties that are automatically attached to every
 * subsequent event for the duration of the session.
 * Call at game start / load to stamp nation + opponents_mode on all events.
 */
export function setGameContext(props: {
  nation?:        string;
  opponents_mode?: string;
  turn?:          number;
}): void {
  if (!TOKEN) return;
  try { mixpanel.register(props); } catch { /* ignore */ }
}

/** Clear game-scoped super-properties when returning to the main menu. */
export function clearGameContext(): void {
  if (!TOKEN) return;
  try {
    mixpanel.unregister('nation');
    mixpanel.unregister('opponents_mode');
    mixpanel.unregister('turn');
  } catch { /* ignore */ }
}
