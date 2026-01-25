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

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      onSaveError?.(error);
    },
  });

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAutoSave();
    };
  }, [cancelAutoSave]);

  // Save pending changes on beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

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
