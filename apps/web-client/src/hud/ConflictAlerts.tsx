/**
 * ConflictAlerts — floating conflict toast notifications.
 *
 * Stacks in the top-center of the screen, below the TopBar.
 * Click the alert body to jump the camera to the conflict province.
 * Click ✕ to dismiss.
 * Alerts auto-dismiss after 12 seconds.
 */

import React, { useEffect } from 'react';
import { useNotificationStore } from '../game/NotificationStore';
import type { AlertKind }        from '../game/NotificationStore';
import { cameraService }         from '../game/cameraService';

const KIND_COLOR: Record<AlertKind, string> = {
  war:      '#cf4444',
  attack:   '#e8a020',
  captured: '#cf4444',
  peace:    '#3fb950',
  alliance: '#58a6ff',
};

const KIND_BG: Record<AlertKind, string> = {
  war:      'rgba(207,68,68,0.12)',
  attack:   'rgba(232,160,32,0.10)',
  captured: 'rgba(207,68,68,0.18)',
  peace:    'rgba(63,185,80,0.10)',
  alliance: 'rgba(88,166,255,0.10)',
};

const AUTO_DISMISS_MS = 12_000;

export function ConflictAlerts(): React.ReactElement | null {
  const alerts  = useNotificationStore((s) => s.alerts);
  const dismiss = useNotificationStore((s) => s.dismiss);

  // Auto-dismiss old alerts
  useEffect(() => {
    if (alerts.length === 0) return;
    const oldest = alerts[0]!;
    const age    = Date.now() - oldest.ts;
    const delay  = Math.max(0, AUTO_DISMISS_MS - age);
    const timer  = setTimeout(() => dismiss(oldest.id), delay);
    return () => clearTimeout(timer);
  }, [alerts, dismiss]);

  if (alerts.length === 0) return null;

  const visible = alerts.slice(-3);

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      {visible.map(alert => {
        const color = KIND_COLOR[alert.kind];
        const bg    = KIND_BG[alert.kind];
        const canFocus = alert.provinceId !== undefined;

        return (
          <div
            key={alert.id}
            style={{
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              background: bg,
              border: `1px solid ${color}55`,
              boxShadow: `0 2px 16px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
              fontFamily: 'Rajdhani, sans-serif',
              minWidth: 320,
              maxWidth: 480,
              animation: 'alertSlideIn 0.18s ease',
            }}
          >
            {/* Colored left bar */}
            <div style={{ width: 3, alignSelf: 'stretch', background: color, flexShrink: 0 }} />

            {/* Main body — click to focus */}
            <button
              onClick={() => {
                if (alert.provinceId !== undefined) cameraService.focusOnId(alert.provinceId);
                dismiss(alert.id);
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                cursor: canFocus ? 'pointer' : 'default',
                padding: '9px 12px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ color, fontSize: 20, letterSpacing: 2, fontWeight: 700 }}>
                {alert.msg}
              </div>
              {canFocus && (
                <div style={{ color: '#7d8fa0', fontSize: 15, letterSpacing: 1.5 }}>
                  CLICK TO GO TO CONFLICT ZONE
                </div>
              )}
            </button>

            {/* Dismiss button */}
            <button
              onClick={() => dismiss(alert.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${color}33`,
                color: '#7d8fa0',
                cursor: 'pointer',
                width: 32,
                alignSelf: 'stretch',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
