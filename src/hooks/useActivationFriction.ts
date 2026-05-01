import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'flowday_friction_sessions';
const FRICTION_CARD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_RESET_MS = 2 * 60 * 1000; // 2 minutes

interface FrictionSession {
  sessionId: string;
  date: string;
  activationFrictionSeconds: number;
  activityStartedType: 'focus_timer' | 'task_start' | 'session_start';
  sessionDurationSeconds: number;
  sessionCompleted: boolean;
}

interface FrictionState {
  appOpenedAt: number | null;       // timestamp when app opened / foregrounded
  activityStartedAt: number | null; // timestamp when user started a session
  frictionSeconds: number | null;   // computed friction
  lastCardShownAt: number;          // last time we showed the card
}

function loadState(): FrictionState {
  return {
    appOpenedAt: null,
    activityStartedAt: null,
    frictionSeconds: null,
    lastCardShownAt: 0,
  };
}

function saveFrictionSession(session: FrictionSession): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const sessions: FrictionSession[] = raw ? JSON.parse(raw) : [];
    sessions.push(session);
    // Keep only last 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cy = cutoff.getFullYear();
    const cm = String(cutoff.getMonth() + 1).padStart(2, '0');
    const cd = String(cutoff.getDate()).padStart(2, '0');
    const cutoffStr = `${cy}-${cm}-${cd}`;
    const filtered = sessions.filter(s => s.date >= cutoffStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

function isTrackingEnabled(): boolean {
  try {
    const raw = localStorage.getItem('flowday_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.activationFrictionEnabled === false) return false;
    }
  } catch { /* ignore */ }
  return true;
}

export type FrictionMessage = {
  text: string;
  tone: 'quick' | 'normal' | 'slow';
};

function getFrictionMessage(seconds: number): FrictionMessage {
  if (seconds < 15) {
    return { text: 'Nice — you moved into focus quickly.', tone: 'quick' };
  }
  if (seconds <= 60) {
    return { text: 'Small warm-up — totally normal.', tone: 'normal' };
  }
  return { text: 'It took a bit to get started today. That happens.', tone: 'slow' };
}

export function useActivationFriction() {
  const stateRef = useRef<FrictionState>(loadState());
  const [showCard, setShowCard] = useState(false);
  const [frictionResult, setFrictionResult] = useState<FrictionMessage | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  // Mark app as opened on mount
  useEffect(() => {
    if (!isTrackingEnabled()) return;
    stateRef.current.appOpenedAt = Date.now();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App going to background
        backgroundedAt.current = Date.now();
      } else {
        // App returning to foreground
        const bg = backgroundedAt.current;
        backgroundedAt.current = null;
        if (bg && Date.now() - bg > BACKGROUND_RESET_MS) {
          // Reset timer — user was away > 2 min
          stateRef.current.appOpenedAt = Date.now();
          stateRef.current.activityStartedAt = null;
          stateRef.current.frictionSeconds = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  /** Call when user presses Start on a focus session */
  const recordActivityStart = useCallback(() => {
    if (!isTrackingEnabled()) return;
    const state = stateRef.current;
    if (!state.appOpenedAt) return;
    if (state.activityStartedAt) return; // already recorded

    state.activityStartedAt = Date.now();
    state.frictionSeconds = Math.round((state.activityStartedAt - state.appOpenedAt) / 1000);
  }, []);

  /** Call when session completes or user finishes early. Returns true if card should show. */
  const evaluateAndShow = useCallback((sessionDurationSeconds: number, completed: boolean): boolean => {
    if (!isTrackingEnabled()) return false;

    const state = stateRef.current;
    const friction = state.frictionSeconds;

    // Guard: no friction recorded
    if (friction === null || friction === undefined) return false;

    // Guard: session too short (< 5 min)
    if (sessionDurationSeconds < 300) return false;

    // Guard: friction too low (< 5 sec)
    if (friction < 5) return false;

    // Guard: cooldown
    if (Date.now() - state.lastCardShownAt < FRICTION_CARD_COOLDOWN_MS) return false;

    // Store session data
    saveFrictionSession({
      sessionId: crypto.randomUUID(),
      date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
      activationFrictionSeconds: friction,
      activityStartedType: 'focus_timer',
      sessionDurationSeconds,
      sessionCompleted: completed,
    });

    state.lastCardShownAt = Date.now();
    setFrictionResult(getFrictionMessage(friction));
    setShowCard(true);
    return true;
  }, []);

  const dismissCard = useCallback(() => {
    setShowCard(false);
    setFrictionResult(null);
    // Reset for next cycle
    stateRef.current.appOpenedAt = Date.now();
    stateRef.current.activityStartedAt = null;
    stateRef.current.frictionSeconds = null;
  }, []);

  return {
    showCard,
    frictionResult,
    recordActivityStart,
    evaluateAndShow,
    dismissCard,
  };
}
