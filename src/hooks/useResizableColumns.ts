import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ColumnWidth {
  [key: string]: number;
}

interface UseResizableColumnsProps {
  defaultWidths: ColumnWidth;
  storageKey: string;
  minWidth?: number;
}

export function useResizableColumns({
  defaultWidths,
  storageKey,
  minWidth = 60,
}: UseResizableColumnsProps) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(defaultWidths);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isResizing = useRef(false);
  const currentColumn = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Load preferences from database
  useEffect(() => {
    if (!userId) return;

    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("preference_value")
          .eq("user_id", userId)
          .eq("preference_key", storageKey)
          .maybeSingle();

        if (error) throw error;

        if (data?.preference_value && typeof data.preference_value === "object") {
          setColumnWidths({ ...defaultWidths, ...(data.preference_value as ColumnWidth) });
        }
      } catch (error) {
        console.error("Error loading column widths:", error);
      } finally {
        setLoaded(true);
      }
    };

    loadPreferences();
  }, [userId, storageKey, defaultWidths]);

  // Save to database (debounced)
  const saveToDatabase = useCallback(
    async (widths: ColumnWidth) => {
      if (!userId) return;

      try {
        await supabase
          .from("user_preferences")
          .upsert(
            {
              user_id: userId,
              preference_key: storageKey,
              preference_value: widths,
            },
            { onConflict: "user_id,preference_key" }
          );
      } catch (error) {
        console.error("Error saving column widths:", error);
      }
    },
    [userId, storageKey]
  );

  // Debounced save when widths change
  useEffect(() => {
    if (!loaded || !userId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToDatabase(columnWidths);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [columnWidths, loaded, userId, saveToDatabase]);

  const handleMouseDown = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      currentColumn.current = columnKey;
      startX.current = e.clientX;
      startWidth.current = columnWidths[columnKey] || defaultWidths[columnKey];
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnWidths, defaultWidths]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current || !currentColumn.current) return;

      const diff = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);

      setColumnWidths((prev) => ({
        ...prev,
        [currentColumn.current!]: newWidth,
      }));
    },
    [minWidth]
  );

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    currentColumn.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const resetWidths = useCallback(async () => {
    setColumnWidths(defaultWidths);
    if (userId) {
      try {
        await supabase
          .from("user_preferences")
          .delete()
          .eq("user_id", userId)
          .eq("preference_key", storageKey);
      } catch (error) {
        console.error("Error resetting column widths:", error);
      }
    }
  }, [defaultWidths, userId, storageKey]);

  return {
    columnWidths,
    handleMouseDown,
    resetWidths,
    isResizing: isResizing.current,
    loaded,
  };
}
