import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConnectionState {
  isConnected: boolean;
  isChecking: boolean;
  lastError: string | null;
  retryCount: number;
}

interface UseSupabaseConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
  onConnectionRestored?: () => void;
}

export function useSupabaseConnection(options: UseSupabaseConnectionOptions = {}) {
  const { maxRetries = 3, retryDelay = 2000, onConnectionRestored } = options;
  const { toast } = useToast();
  
  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isChecking: false,
    lastError: null,
    retryCount: 0,
  });
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasDisconnectedRef = useRef(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true }));
    
    try {
      // Simple health check - fetch current user session
      const { error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      // Connection restored
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        toast({
          title: "Connection restored",
          description: "Backend connection is back online",
        });
        onConnectionRestored?.();
      }
      
      setState({
        isConnected: true,
        isChecking: false,
        lastError: null,
        retryCount: 0,
      });
      
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      
      setState(prev => ({
        isConnected: false,
        isChecking: false,
        lastError: errorMessage,
        retryCount: prev.retryCount + 1,
      }));
      
      if (!wasDisconnectedRef.current) {
        wasDisconnectedRef.current = true;
        toast({
          title: "Connection issue",
          description: "Having trouble connecting to the backend. Retrying...",
          variant: "destructive",
        });
      }
      
      return false;
    }
  }, [toast, onConnectionRestored]);

  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    if (state.retryCount < maxRetries) {
      retryTimeoutRef.current = setTimeout(async () => {
        const success = await checkConnection();
        if (!success && state.retryCount < maxRetries - 1) {
          scheduleRetry();
        }
      }, retryDelay * (state.retryCount + 1)); // Exponential backoff
    }
  }, [checkConnection, maxRetries, retryDelay, state.retryCount]);

  const retryNow = useCallback(async () => {
    setState(prev => ({ ...prev, retryCount: 0 }));
    return checkConnection();
  }, [checkConnection]);

  // Auto-retry when disconnected
  useEffect(() => {
    if (!state.isConnected && !state.isChecking && state.retryCount < maxRetries) {
      scheduleRetry();
    }
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [state.isConnected, state.isChecking, state.retryCount, maxRetries, scheduleRetry]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };
    
    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        lastError: "Network offline",
      }));
      wasDisconnectedRef.current = true;
    };
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkConnection]);

  return {
    ...state,
    checkConnection,
    retryNow,
    isRetrying: state.isChecking || (state.retryCount > 0 && state.retryCount < maxRetries),
  };
}

// Utility to wrap async operations with retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// Hook for fetching data with automatic retry
export function useRobustFetch<T>(
  fetchFn: () => Promise<T>,
  dependencies: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const { toast } = useToast();
  
  const fetchData = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const result = await withRetry(fetchFn, {
        maxRetries: 2,
        retryDelay: 1000,
        onRetry: (attempt) => {
          console.log(`Retry attempt ${attempt}...`);
        },
      });
      
      setData(result);
      
      if (isRetry) {
        toast({
          title: "Data loaded",
          description: "Successfully fetched data",
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch data";
      setError(errorMessage);
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [fetchFn, toast]);
  
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  
  const retry = useCallback(() => {
    fetchData(true);
  }, [fetchData]);
  
  const refetch = useCallback(() => {
    fetchData(false);
  }, [fetchData]);
  
  return { data, loading, error, retrying, retry, refetch };
}
