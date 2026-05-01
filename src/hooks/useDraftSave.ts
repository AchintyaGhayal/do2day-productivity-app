import { useState, useEffect, useRef, useCallback } from 'react';

export type DraftStatus = 'idle' | 'saving' | 'saved';

/**
 * Hook for continuous autosave with debounced writes.
 * No draft restore prompts — always saves seamlessly.
 */
export function useDraftSave<T extends Record<string, unknown>>(
  type: string,
  id: string,
  currentData: T,
  onSave: (data: T) => void | Promise<void>,
  intervalMs = 600,
) {
  const [status, setStatus] = useState<DraftStatus>('idle');
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const currentDataRef = useRef(currentData);

  // Keep refs current
  onSaveRef.current = onSave;
  currentDataRef.current = currentData;

  const serialized = JSON.stringify(currentData);

  // Auto-save with debounce
  useEffect(() => {
    if (!id) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (serialized !== lastSavedRef.current) {
        setStatus('saving');
        try {
          await onSaveRef.current(currentDataRef.current);
          lastSavedRef.current = serialized;
          setStatus('saved');
        } catch {
          setStatus('idle');
        }
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [serialized, id, intervalMs]);

  // Mark initial data as "saved"
  useEffect(() => {
    lastSavedRef.current = serialized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      const currentSerialized = JSON.stringify(currentDataRef.current);
      if (currentSerialized !== lastSavedRef.current) {
        onSaveRef.current(currentDataRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clearDraft = useCallback(() => {
    // no-op, kept for API compat
  }, []);

  /** Immediately flush any pending save (for explicit "Save" button). */
  const flushSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const currentSerialized = JSON.stringify(currentDataRef.current);
    if (currentSerialized !== lastSavedRef.current) {
      setStatus('saving');
      try {
        await onSaveRef.current(currentDataRef.current);
        lastSavedRef.current = currentSerialized;
        setStatus('saved');
      } catch {
        setStatus('idle');
      }
    } else {
      // Already saved — just flash confirmation
      setStatus('saved');
    }
  }, []);

  return { status, clearDraft, flushSave };
}

// Legacy exports kept for compatibility but no-ops
export function getDraft<T>(_type: string, _id: string): null {
  return null;
}

export function removeDraft(_type: string, _id: string) {
  // no-op
}

export function getAllDraftKeys(_type: string): string[] {
  return [];
}
