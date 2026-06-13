import { useCallback, useRef, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

interface AutoSaveOptions<T> {
  /** Function to save data to the server */
  saveFn: (data: T) => Promise<void>;
  /** Debounce delay in milliseconds (default: 2000ms) */
  debounceMs?: number;
  /** Callback when save succeeds */
  onSaveSuccess?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
  /** Whether auto-save is enabled */
  enabled?: boolean;
}

interface AutoSaveReturn<T> {
  /** Trigger auto-save with new data (debounced) */
  triggerAutoSave: (data: T) => void;
  /** Trigger immediate save */
  saveNow: (data: T) => Promise<void>;
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Last save timestamp */
  lastSavedAt: Date | null;
  /** Any save error */
  error: Error | null;
  /** Cancel pending auto-save */
  cancelAutoSave: () => void;
}

/**
 * Hook for auto-saving content with debouncing
 * Used by the Self-Study Editor for narrative content
 */
export function useAutoSave<T>({
  saveFn,
  debounceMs = 2000,
  onSaveSuccess,
  onSaveError,
  enabled = true,
}: AutoSaveOptions<T>): AutoSaveReturn<T> {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<T | null>(null);
  // Latest saveFn, captured in a ref so the unmount / tab-hide flush can call it
  // WITHOUT touching React state on an unmounted component.
  const saveFnRef = useRef(saveFn);
  useEffect(() => {
    saveFnRef.current = saveFn;
  }, [saveFn]);

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      // The pending edit has reached the server — clear it so the flush paths
      // below don't redundantly re-save already-persisted content.
      pendingDataRef.current = null;
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      onSaveError?.(error);
    },
  });

  // Fire any unsaved edit immediately through the raw save fn (no React state),
  // for unmount / navigation / tab-hide where the debounce hasn't fired yet.
  const flushPending = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const data = pendingDataRef.current;
    if (data === null) return;
    pendingDataRef.current = null;
    void Promise.resolve(saveFnRef.current(data)).catch(() => {
      /* best-effort flush — a lost network race here is the floor, not the norm */
    });
  }, []);

  const cancelAutoSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const triggerAutoSave = useCallback(
    (data: T) => {
      if (!enabled) return;

      setHasUnsavedChanges(true);
      pendingDataRef.current = data;

      // Cancel existing timer
      cancelAutoSave();

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current !== null) {
          mutation.mutate(pendingDataRef.current);
        }
      }, debounceMs);
    },
    [enabled, debounceMs, mutation, cancelAutoSave]
  );

  const saveNow = useCallback(
    async (data: T) => {
      cancelAutoSave();
      pendingDataRef.current = null;
      await mutation.mutateAsync(data);
    },
    [mutation, cancelAutoSave]
  );

  // FLUSH (not just cancel) any pending edit on unmount. Switching specs,
  // navigating away, or the editor remounting must never drop the last
  // <debounceMs of typing. Previously this only cancelled the timer, so that
  // edit lived solely in the browser and was lost. flushPending fires the raw
  // save fn and touches no React state, so it's safe during teardown.
  useEffect(() => {
    return () => {
      flushPending();
    };
  }, [flushPending]);

  // Flush on tab-hide and unload so a close / tab-switch within the debounce
  // window still reaches the server (a normal request completes on mere hide).
  // beforeunload additionally keeps the browser's "unsaved changes" prompt as a
  // last resort if a hard close interrupts an in-flight flush.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingDataRef.current !== null) {
        flushPending();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [flushPending]);

  return {
    triggerAutoSave,
    saveNow,
    isSaving: mutation.isPending,
    hasUnsavedChanges,
    lastSavedAt,
    error: mutation.error,
    cancelAutoSave,
  };
}

export default useAutoSave;
