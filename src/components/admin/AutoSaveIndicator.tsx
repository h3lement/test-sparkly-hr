import { Cloud, CloudOff, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function AutoSaveIndicator({ status, className }: AutoSaveIndicatorProps) {
  const getContent = () => {
    switch (status) {
      case "idle":
        return (
          <>
            <Cloud className="w-3.5 h-3.5" />
            <span>Auto-save on</span>
          </>
        );
      case "pending":
        return (
          <>
            <Cloud className="w-3.5 h-3.5 animate-pulse" />
            <span>Unsaved changes</span>
          </>
        );
      case "saving":
        return (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Saving...</span>
          </>
        );
      case "saved":
        return (
          <>
            <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span className="text-green-600 dark:text-green-400">Saved</span>
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-destructive">Save failed</span>
          </>
        );
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded bg-muted/50",
        className
      )}
    >
      {getContent()}
    </div>
  );
}
