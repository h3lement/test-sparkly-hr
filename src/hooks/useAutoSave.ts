import { useRef, useCallback, useEffect, useState } from "react";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  onSave: () => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutoSave({ onSave, debounceMs = 1500, enabled = true }: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const pendingChangesRef = useRef(false);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const executeSave = useCallback(async () => {
    // If already saving, mark that we have pending changes
    if (savePromiseRef.current) {
      pendingChangesRef.current = true;
      return;
    }

    setStatus("saving");
    pendingChangesRef.current = false;

    try {
      savePromiseRef.current = onSave();
      await savePromiseRef.current;
      setStatus("saved");

      // Reset to idle after showing "saved" briefly
      setTimeout(() => {
        setStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, 2000);
    } catch (error) {
      console.error("Auto-save error:", error);
      setStatus("error");
    } finally {
      savePromiseRef.current = null;

      // If changes came in while saving, save again
      if (pendingChangesRef.current) {
        pendingChangesRef.current = false;
        executeSave();
      }
    }
  }, [onSave]);

  const triggerSave = useCallback(() => {
    if (!enabled) return;

    clearPendingTimeout();
    setStatus("pending");

    timeoutRef.current = setTimeout(() => {
      executeSave();
    }, debounceMs);
  }, [enabled, debounceMs, clearPendingTimeout, executeSave]);

  const saveNow = useCallback(async () => {
    if (!enabled) return;
    clearPendingTimeout();
    await executeSave();
  }, [enabled, clearPendingTimeout, executeSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  return {
    status,
    triggerSave,
    saveNow,
    isPending: status === "pending" || status === "saving",
  };
}
