import { useSupabaseConnection } from "@/hooks/useSupabaseConnection";
import { Button } from "@/components/ui/button";
import { RefreshCw, WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  onConnectionRestored?: () => void;
  className?: string;
  showWhenConnected?: boolean;
}

export function ConnectionStatus({ 
  onConnectionRestored, 
  className,
  showWhenConnected = false 
}: ConnectionStatusProps) {
  const { isConnected, isRetrying, retryNow, lastError, retryCount } = useSupabaseConnection({
    maxRetries: 5,
    retryDelay: 2000,
    onConnectionRestored,
  });

  // Don't show anything when connected (unless explicitly requested)
  if (isConnected && !showWhenConnected) {
    return null;
  }

  if (isConnected && showWhenConnected) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <Wifi className="h-4 w-4" />
        <span>Connected</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg",
      className
    )}>
      <WifiOff className="h-4 w-4 text-destructive" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">Connection issue</p>
        <p className="text-xs text-muted-foreground">
          {lastError || "Unable to connect to backend"}
          {retryCount > 0 && ` (Retry ${retryCount}/5)`}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={retryNow}
        disabled={isRetrying}
        className="shrink-0"
      >
        <RefreshCw className={cn("h-4 w-4 mr-1", isRetrying && "animate-spin")} />
        {isRetrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}
