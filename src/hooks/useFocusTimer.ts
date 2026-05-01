import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FocusSession, 
  loadFocusSession, 
  saveFocusSession, 
  clearFocusSession 
} from '@/lib/focusSession';

interface UseFocusTimerReturn {
  session: FocusSession | null;
  remainingMs: number;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  startSession: (sliceId: string, taskId: string, durationMinutes: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  finishSession: () => void;
  clearSession: () => void;
}

export function useFocusTimer(): UseFocusTimerReturn {
  const [session, setSession] = useState<FocusSession | null>(() => loadFocusSession());
  const [remainingMs, setRemainingMs] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate remaining time
  const calculateRemainingMs = useCallback((sess: FocusSession): number => {
    if (sess.isPaused && sess.pausedRemainingMs !== undefined) {
      return sess.pausedRemainingMs;
    }
    const now = Date.now();
    return Math.max(0, sess.sessionEndAt - now);
  }, []);

  // Start the timer interval
  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setSession(currentSession => {
        if (!currentSession || currentSession.isPaused) {
          return currentSession;
        }
        
        const remaining = calculateRemainingMs(currentSession);
        setRemainingMs(remaining);
        
        if (remaining <= 0) {
          setIsCompleted(true);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        
        return currentSession;
      });
    }, 1000);
  }, [calculateRemainingMs]);

  // Initialize on mount and handle existing session
  useEffect(() => {
    const existingSession = loadFocusSession();
    if (existingSession) {
      setSession(existingSession);
      const remaining = calculateRemainingMs(existingSession);
      setRemainingMs(remaining);
      
      if (remaining <= 0 && !existingSession.isPaused) {
        setIsCompleted(true);
      } else if (!existingSession.isPaused) {
        startInterval();
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [calculateRemainingMs, startInterval]);

  const startSession = useCallback((sliceId: string, taskId: string, durationMinutes: number) => {
    const now = Date.now();
    const newSession: FocusSession = {
      sliceId,
      taskId,
      sessionStartAt: now,
      sessionEndAt: now + durationMinutes * 60 * 1000,
      durationMinutes,
      isPaused: false,
      startSource: 'user',
    };
    
    saveFocusSession(newSession);
    setSession(newSession);
    setRemainingMs(durationMinutes * 60 * 1000);
    setIsCompleted(false);
    startInterval();
  }, [startInterval]);

  const pauseSession = useCallback(() => {
    if (!session || session.isPaused) return;
    
    const remaining = calculateRemainingMs(session);
    const pausedSession: FocusSession = {
      ...session,
      isPaused: true,
      pausedAt: Date.now(),
      pausedRemainingMs: remaining,
    };
    
    saveFocusSession(pausedSession);
    setSession(pausedSession);
    setRemainingMs(remaining);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [session, calculateRemainingMs]);

  const resumeSession = useCallback(() => {
    if (!session || !session.isPaused || !session.pausedRemainingMs) return;
    
    const now = Date.now();
    const resumedSession: FocusSession = {
      ...session,
      isPaused: false,
      sessionEndAt: now + session.pausedRemainingMs,
      pausedAt: undefined,
      pausedRemainingMs: undefined,
    };
    
    saveFocusSession(resumedSession);
    setSession(resumedSession);
    startInterval();
  }, [session, startInterval]);

  const finishSession = useCallback(() => {
    setIsCompleted(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearFocusSession();
    setSession(null);
    setRemainingMs(0);
    setIsCompleted(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const isRunning = session !== null && !session.isPaused && remainingMs > 0;
  const isPaused = session?.isPaused ?? false;

  return {
    session,
    remainingMs,
    isRunning,
    isPaused,
    isCompleted,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
    clearSession,
  };
}
