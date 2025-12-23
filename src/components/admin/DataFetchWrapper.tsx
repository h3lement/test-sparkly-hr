import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataFetchWrapperProps {
  loading: boolean;
  error: string | null;
  retrying?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  children: ReactNode;
  loadingMessage?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
  className?: string;
}

export function DataFetchWrapper({
  loading,
  error,
  retrying = false,
  onRetry,
  onRefresh,
  children,
  loadingMessage = "Loading...",
  emptyMessage = "No data found",
  isEmpty = false,
  className,
}: DataFetchWrapperProps) {
  // Loading state
  if (loading && !retrying) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    const isNetworkError = error.toLowerCase().includes("network") || 
                           error.toLowerCase().includes("fetch") ||
                           error.toLowerCase().includes("offline");
    
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <div className="bg-destructive/10 rounded-full p-4 mb-4">
          {isNetworkError ? (
            <WifiOff className="h-8 w-8 text-destructive" />
          ) : (
            <AlertCircle className="h-8 w-8 text-destructive" />
          )}
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {isNetworkError ? "Connection Error" : "Something went wrong"}
        </h3>
        <p className="text-muted-foreground text-center max-w-md mb-4">
          {error}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={retrying}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
            {retrying ? "Retrying..." : "Try Again"}
          </Button>
        )}
      </div>
    );
  }

  // Empty state (when data loaded but empty)
  if (isEmpty && !loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <p className="text-muted-foreground mb-4">{emptyMessage}</p>
        {onRefresh && (
          <Button variant="outline" onClick={onRefresh} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  // Content with optional retry indicator
  return (
    <div className={cn("relative", className)}>
      {retrying && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-lg border">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">Refreshing...</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
