/**
 * TutorialOverlay — renders the spotlight mask, callout card, and progress bar
 * for the in-game tutorial.
 *
 * Sits outside the zoom wrapper so spotlight rects are unaffected by compact mode.
 * Uses 100ms polling to detect action-step completion rather than coupling into game stores.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTutorialStore }  from '../game/TutorialStore';
import { TUTORIAL_STEPS, TUTORIAL_STEP_COUNT } from '../game/TutorialSteps';

// ── Rect helpers ───────────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number; }

function getTargetRect(query: string | null): Rect | null {
  if (!query) return null;
  const el = document.querySelector(query);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ── Spotlight mask (four-panel technique) ─────────────────────────────────────

function SpotlightMask({ rect }: { rect: Rect | null }): React.ReactElement | null {
  const base: React.CSSProperties = {
    position: 'fixed',
    background: 'rgba(5,8,15,0.82)',
    zIndex: 1000,
    pointerEvents: 'none',
    transition: 'all 0.25s ease',
  };

  if (!rect) return null;

  const PAD = 6;
  const { top, left, width, height } = rect;

  return (
    <>
      {/* Top */}
      <div style={{ ...base, top: 0, left: 0, right: 0, height: Math.max(0, top - PAD) }} />
      {/* Bottom */}
      <div style={{ ...base, top: top + height + PAD, left: 0, right: 0, bottom: 0 }} />
      {/* Left */}
      <div style={{ ...base, top: top - PAD, left: 0, width: Math.max(0, left - PAD), height: height + PAD * 2 }} />
      {/* Right */}
      <div style={{ ...base, top: top - PAD, left: left + width + PAD, right: 0, height: height + PAD * 2 }} />
    </>
  );
}

// ── Callout card ──────────────────────────────────────────────────────────────

const CALLOUT_W = 300;
const CALLOUT_GAP = 16;

function CalloutCard({
  step,
  stepIndex,
  rect,
  onContinue,
  onSkip,
  onComplete,
  isFinalStep,
}: {
  step: (typeof TUTORIAL_STEPS)[0];
  stepIndex: number;
  rect: Rect | null;
  onContinue: () => void;
  onSkip: () => void;
  onComplete: () => void;
  isFinalStep: boolean;
}): React.ReactElement {

  const style = computeCalloutStyle(step.calloutSide, rect);

  return (
    <div style={{
      position: 'fixed',
      zIndex: 1001,
      width: CALLOUT_W,
      background: 'rgba(10,14,20,0.98)',
      border: '1px solid #1E2D45',
      borderLeft: '3px solid #e8a020',
      fontFamily: 'Rajdhani, sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      pointerEvents: 'all',
      animation: 'tutFadeIn 0.2s ease',
      ...style,
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px',
        borderBottom: '1px solid #1e2d45',
        background: 'rgba(232,160,32,0.07)',
      }}>
        <div style={{ color: '#e8a020', fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>
          TUTORIAL
        </div>
        <div style={{ color: '#e8a02099', fontSize: 11, letterSpacing: 2 }}>
          STEP {stepIndex + 1} / {TUTORIAL_STEP_COUNT}
        </div>
      </div>

      {/* Headline */}
      <div style={{
        padding: '4px 14px 0',
        color: '#cdd9e5', fontSize: 20, letterSpacing: 2, fontWeight: 700,
        lineHeight: 1.2,
      }}>
        {step.headline}
      </div>

      {/* Body */}
      <div style={{
        padding: '8px 14px 12px',
        color: '#7d8fa0', fontSize: 15, letterSpacing: 0.5, lineHeight: 1.6,
      }}>
        {step.body}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px',
        borderTop: '1px solid #1e2d45',
      }}>
        <button onClick={onSkip} style={skipStyle}>
          ✕ CLOSE
        </button>

        <button
          onClick={isFinalStep ? onComplete : onContinue}
          style={continueStyle}
        >
          {isFinalStep ? 'BEGIN CAMPAIGN ▶' : 'CONTINUE ▶'}
        </button>
      </div>
    </div>
  );
}

function computeCalloutStyle(
  side: (typeof TUTORIAL_STEPS)[0]['calloutSide'],
  rect: Rect | null,
): React.CSSProperties {
  if (side === 'center' || !rect) {
    return {
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const PAD = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (side === 'right') {
    const left = Math.min(rect.left + rect.width + CALLOUT_GAP, vw - CALLOUT_W - PAD);
    const top  = Math.max(PAD, Math.min(rect.top, vh - 200));
    return { top, left };
  }
  if (side === 'left') {
    const left = Math.max(PAD, rect.left - CALLOUT_W - CALLOUT_GAP);
    const top  = Math.max(PAD, Math.min(rect.top, vh - 200));
    return { top, left };
  }
  if (side === 'below') {
    const top  = rect.top + rect.height + CALLOUT_GAP;
    const left = Math.max(PAD, Math.min(rect.left, vw - CALLOUT_W - PAD));
    return { top, left };
  }
  if (side === 'above') {
    const top  = Math.max(PAD, rect.top - CALLOUT_GAP - 200); // approx card height
    const left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - CALLOUT_W / 2, vw - CALLOUT_W - PAD));
    return { top, left };
  }
  return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function TutorialProgressBar({ stepIndex }: { stepIndex: number }): React.ReactElement {
  const pct = ((stepIndex) / (TUTORIAL_STEP_COUNT - 1)) * 100;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 3,
      background: 'rgba(30,45,69,0.8)',
      zIndex: 1002, pointerEvents: 'none',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'linear-gradient(to right, #c8601a, #e8a020)',
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function TutorialOverlay(): React.ReactElement | null {
  const { active, stepIndex, advanceStep, dismissTutorial, completeTutorial } = useTutorialStore();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = TUTORIAL_STEPS[stepIndex];
  const isFinalStep = stepIndex === TUTORIAL_STEP_COUNT - 1;

  // Re-measure target rect whenever step changes or on resize
  const measureRect = useCallback(() => {
    if (!step) return;
    setTargetRect(getTargetRect(step.spotlightQuery));
  }, [step]);

  useEffect(() => {
    measureRect();
    const observer = new ResizeObserver(measureRect);
    observer.observe(document.body);
    window.addEventListener('resize', measureRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureRect);
    };
  }, [measureRect]);

  // Call onActivate when step changes
  useEffect(() => {
    if (!active || !step) return;
    step.onActivate?.();
    // Re-measure after onActivate (panel may have been restored)
    setTimeout(measureRect, 50);
  }, [active, stepIndex, step, measureRect]);

  // Auto-advance for 'auto' steps
  useEffect(() => {
    if (!active || !step || step.completionMode !== 'auto') return;
    autoTimerRef.current = setTimeout(() => {
      if (!isFinalStep) advanceStep(TUTORIAL_STEP_COUNT);
    }, step.autoDelay ?? 4000);
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [active, stepIndex, step, isFinalStep, advanceStep]);

  // Poll completion for 'action' steps
  useEffect(() => {
    if (!active || !step || step.completionMode !== 'action' || !step.completionCheck) return;
    pollRef.current = setInterval(() => {
      if (step.completionCheck?.()) {
        clearInterval(pollRef.current!);
        if (!isFinalStep) advanceStep(TUTORIAL_STEP_COUNT);
      }
    }, 100);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active, stepIndex, step, isFinalStep, advanceStep]);

  if (!active || !step) return null;

  return (
    <>
      <style>{`
        @keyframes tutFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <TutorialProgressBar stepIndex={stepIndex} />

      {step.spotlightQuery && <SpotlightMask rect={targetRect} />}

      <CalloutCard
        step={step}
        stepIndex={stepIndex}
        rect={targetRect}
        onContinue={() => advanceStep(TUTORIAL_STEP_COUNT)}
        onSkip={dismissTutorial}
        onComplete={completeTutorial}
        isFinalStep={isFinalStep}
      />
    </>
  );
}

// ── Reopen button (shown when tutorial is dismissed mid-way) ──────────────────

export function TutorialReopenButton(): React.ReactElement | null {
  const { active, dismissed, completed, startTutorial } = useTutorialStore();
  if (active || completed || !dismissed) return null;
  return (
    <button
      onClick={startTutorial}
      style={{
        position: 'fixed', top: 52, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10,14,20,0.95)',
        border: '1px solid #e8a020',
        color: '#e8a020',
        fontSize: 13, fontWeight: 700, letterSpacing: 2,
        fontFamily: 'Rajdhani, sans-serif',
        padding: '5px 18px',
        cursor: 'pointer', zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,160,32,0.28)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,160,32,0.15)'; }}
    >
      ▶ RESUME TUTORIAL
    </button>
  );
}

// ── Button styles ─────────────────────────────────────────────────────────────

const skipStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#3a4a5a', fontSize: 12, letterSpacing: 1.5,
  fontFamily: 'Rajdhani, sans-serif', padding: 0,
  textTransform: 'uppercase',
};

const continueStyle: React.CSSProperties = {
  background: 'rgba(232,160,32,0.12)',
  border: '1px solid #e8a020',
  color: '#e8a020',
  fontSize: 13, letterSpacing: 2, fontWeight: 700,
  fontFamily: 'Rajdhani, sans-serif',
  padding: '5px 14px', cursor: 'pointer',
  textTransform: 'uppercase',
};
