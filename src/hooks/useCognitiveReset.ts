import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'flowday_cognitive_reset';
const MAX_PER_DAY = 6;
const MIN_SPACING_MS = 5 * 60 * 1000; // 5 minutes
const RAPID_TASK_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

interface ResetMetrics {
  date: string; // YYYY-MM-DD
  shownCount: number;
  skippedCount: number;
  totalTimeMs: number;
  lastShownAt: number; // timestamp
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadMetrics(): ResetMetrics {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ResetMetrics;
      if (parsed.date === todayStr()) return parsed;
    }
  } catch { /* ignore */ }
  return { date: todayStr(), shownCount: 0, skippedCount: 0, totalTimeMs: 0, lastShownAt: 0 };
}

function saveMetrics(m: ResetMetrics): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

export function useCognitiveReset() {
  const [isVisible, setIsVisible] = useState(false);
  const openedAt = useRef<number>(0);
  const metricsRef = useRef<ResetMetrics>(loadMetrics());

  /** Returns true if the reset should be shown (checks all gate conditions). */
  const shouldShow = useCallback((taskDurationMs?: number): boolean => {
    // Check settings toggle
    const settingsRaw = localStorage.getItem('flowday_settings');
    if (settingsRaw) {
      try {
        const s = JSON.parse(settingsRaw);
        if (s.cognitiveResetEnabled === false) return false;
      } catch { /* ignore */ }
    }

    const m = loadMetrics();
    metricsRef.current = m;

    // Max per day
    if (m.shownCount >= MAX_PER_DAY) return false;

    // Min spacing
    if (Date.now() - m.lastShownAt < MIN_SPACING_MS) return false;

    // Rapid micro-task filter
    if (taskDurationMs !== undefined && taskDurationMs < RAPID_TASK_THRESHOLD_MS) return false;

    return true;
  }, []);

  const show = useCallback(() => {
    const m = loadMetrics();
    m.shownCount += 1;
    m.lastShownAt = Date.now();
    m.date = todayStr();
    saveMetrics(m);
    metricsRef.current = m;
    openedAt.current = Date.now();
    setIsVisible(true);
  }, []);

  const dismiss = useCallback((skipped: boolean) => {
    const m = loadMetrics();
    if (skipped) {
      m.skippedCount += 1;
    }
    if (openedAt.current > 0) {
      m.totalTimeMs += Date.now() - openedAt.current;
    }
    saveMetrics(m);
    metricsRef.current = m;
    openedAt.current = 0;
    setIsVisible(false);
  }, []);

  /** Convenience: check + show in one call. Returns true if shown. */
  const trigger = useCallback((taskDurationMs?: number): boolean => {
    if (!shouldShow(taskDurationMs)) return false;
    show();
    return true;
  }, [shouldShow, show]);

  /** Force-show without any gating (used after block completion). */
  const forceShow = useCallback((): boolean => {
    // Only check settings toggle, skip spacing/frequency/duration gates
    const settingsRaw = localStorage.getItem('flowday_settings');
    if (settingsRaw) {
      try {
        const s = JSON.parse(settingsRaw);
        if (s.cognitiveResetEnabled === false) return false;
      } catch { /* ignore */ }
    }
    show();
    return true;
  }, [show]);

  return { isVisible, trigger, forceShow, dismiss };
}
