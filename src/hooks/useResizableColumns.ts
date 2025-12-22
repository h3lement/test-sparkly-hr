import { useState, useCallback, useRef, useEffect } from "react";

interface ColumnWidth {
  [key: string]: number;
}

interface UseResizableColumnsProps {
  defaultWidths: ColumnWidth;
  storageKey?: string;
  minWidth?: number;
}

export function useResizableColumns({
  defaultWidths,
  storageKey,
  minWidth = 60,
}: UseResizableColumnsProps) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        // Ignore parse errors
      }
    }
    return defaultWidths;
  });

  const isResizing = useRef(false);
  const currentColumn = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Save to localStorage when widths change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    }
  }, [columnWidths, storageKey]);

  const handleMouseDown = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault();
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

  const resetWidths = useCallback(() => {
    setColumnWidths(defaultWidths);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [defaultWidths, storageKey]);

  return {
    columnWidths,
    handleMouseDown,
    resetWidths,
    isResizing: isResizing.current,
  };
}
