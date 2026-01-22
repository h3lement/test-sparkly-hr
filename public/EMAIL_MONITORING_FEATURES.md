# Email System Monitoring Features Documentation

This document covers three key monitoring features for email systems:
1. **Connection Status Monitoring** - Real-time Supabase connection health
2. **Domain Reputation Checking** - DNSBL and VirusTotal monitoring
3. **Template Testing** - Email preview and test sending

---

## 1. Connection Status Monitoring

### Overview
Real-time monitoring of backend (Supabase) connection with automatic retry logic and user notifications.

### Database Requirements
None - uses Supabase auth session check as health indicator.

### Hook: useSupabaseConnection

```typescript
// src/hooks/useSupabaseConnection.ts

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
```

### Component: ConnectionStatus

```typescript
// src/components/admin/ConnectionStatus.tsx

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
```

### Usage Example

```tsx
import { ConnectionStatus } from "@/components/admin/ConnectionStatus";

function EmailSettings() {
  const handleConnectionRestored = () => {
    // Refetch data when connection is restored
    refetchEmailConfig();
  };

  return (
    <div>
      <ConnectionStatus 
        onConnectionRestored={handleConnectionRestored}
        showWhenConnected={true}
      />
      {/* Rest of your component */}
    </div>
  );
}
```

---

## 2. Domain Reputation Checking

### Overview
Monitors email sending domain reputation via DNSBL (DNS Blacklists) and VirusTotal. Sends admin notifications when reputation degrades.

### Database Schema

```sql
-- Domain reputation history table
CREATE TABLE public.domain_reputation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  overall_status TEXT NOT NULL, -- 'clean', 'warning', 'critical'
  dnsbl_listed_count INTEGER DEFAULT 0,
  dnsbl_checked_count INTEGER DEFAULT 0,
  vt_reputation INTEGER,
  vt_malicious INTEGER,
  vt_suspicious INTEGER,
  vt_harmless INTEGER,
  recommendations JSONB,
  full_result JSONB,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.domain_reputation_history ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can view domain reputation history"
ON public.domain_reputation_history FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert domain reputation history"
ON public.domain_reputation_history FOR INSERT
WITH CHECK (true);

-- Index for faster queries
CREATE INDEX idx_domain_reputation_domain_checked 
ON public.domain_reputation_history(domain, checked_at DESC);
```

### Required Secrets

```
VIRUSTOTAL_API_KEY - Get from https://www.virustotal.com/gui/my-apikey
```

### Edge Function: check-domain-reputation

```typescript
// supabase/functions/check-domain-reputation/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DNSBL servers to check
const DNSBL_SERVERS = [
  { name: "Spamhaus ZEN", server: "zen.spamhaus.org", description: "Combined Spamhaus blocklist" },
  { name: "Barracuda", server: "b.barracudacentral.org", description: "Barracuda Reputation" },
  { name: "SpamCop", server: "bl.spamcop.net", description: "SpamCop Blocking List" },
  { name: "SORBS", server: "dnsbl.sorbs.net", description: "SORBS Combined" },
  { name: "UCEPROTECT L1", server: "dnsbl-1.uceprotect.net", description: "UCEPROTECT Level 1" },
];

interface DNSBLResult {
  server: string;
  name: string;
  listed: boolean;
  description: string;
  error?: string;
}

interface VirusTotalResult {
  reputation: number;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  lastAnalysisDate: string | null;
  error?: string;
}

interface DomainReputationResult {
  domain: string;
  checkedAt: string;
  overallStatus: "clean" | "warning" | "critical";
  dnsblResults: DNSBLResult[];
  virusTotalResult: VirusTotalResult | null;
  recommendations: string[];
  listedCount: number;
  totalChecked: number;
}

// Check domain against a DNSBL server
async function checkDNSBL(domain: string, dnsbl: { name: string; server: string; description: string }): Promise<DNSBLResult> {
  try {
    // For domain-based blacklists, we query domain.dnsbl.server
    const queryDomain = `${domain}.${dnsbl.server}`;
    
    // Use DNS over HTTPS (Cloudflare)
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${queryDomain}&type=A`, {
      headers: { "Accept": "application/dns-json" }
    });
    
    const data = await response.json();
    
    // If we get an answer, the domain is listed
    const listed = data.Answer && data.Answer.length > 0;
    
    return {
      server: dnsbl.server,
      name: dnsbl.name,
      listed,
      description: dnsbl.description,
    };
  } catch (error) {
    return {
      server: dnsbl.server,
      name: dnsbl.name,
      listed: false,
      description: dnsbl.description,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Check domain on VirusTotal
async function checkVirusTotal(domain: string, apiKey: string): Promise<VirusTotalResult> {
  try {
    const response = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { "x-apikey": apiKey }
    });
    
    if (!response.ok) {
      throw new Error(`VirusTotal API error: ${response.status}`);
    }
    
    const data = await response.json();
    const attrs = data.data?.attributes || {};
    const stats = attrs.last_analysis_stats || {};
    
    return {
      reputation: attrs.reputation || 0,
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      lastAnalysisDate: attrs.last_analysis_date 
        ? new Date(attrs.last_analysis_date * 1000).toISOString() 
        : null,
    };
  } catch (error) {
    return {
      reputation: 0,
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
      lastAnalysisDate: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Generate recommendations based on results
function generateRecommendations(dnsblResults: DNSBLResult[], vtResult: VirusTotalResult | null): string[] {
  const recommendations: string[] = [];
  
  const listedServers = dnsblResults.filter(r => r.listed);
  
  if (listedServers.length > 0) {
    recommendations.push(`Domain is listed on ${listedServers.length} blacklist(s): ${listedServers.map(s => s.name).join(", ")}`);
    recommendations.push("Contact the blacklist operators to request removal");
    recommendations.push("Review your email sending practices and authentication (SPF, DKIM, DMARC)");
  }
  
  if (vtResult) {
    if (vtResult.malicious > 0) {
      recommendations.push(`VirusTotal reports ${vtResult.malicious} security vendor(s) flagged this domain as malicious`);
      recommendations.push("Investigate potential security issues with your domain");
    }
    if (vtResult.suspicious > 0) {
      recommendations.push(`VirusTotal reports ${vtResult.suspicious} vendor(s) marked domain as suspicious`);
    }
    if (vtResult.reputation < 0) {
      recommendations.push(`Domain has negative reputation score (${vtResult.reputation}) on VirusTotal`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Domain reputation looks healthy");
  }
  
  return recommendations;
}

// Get email config for sending notifications
async function getEmailConfig(supabase: any) {
  const { data } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [
      "smtp_host", "smtp_port", "smtp_user", "smtp_pass",
      "smtp_secure", "sender_email", "sender_name", "admin_notification_email"
    ]);
  
  const config: Record<string, string> = {};
  data?.forEach((row: any) => {
    config[row.setting_key] = row.setting_value;
  });
  
  return config;
}

// Send admin notification (simplified - use your SMTP implementation)
async function sendAdminNotification(
  config: Record<string, string>,
  result: DomainReputationResult
): Promise<boolean> {
  // Implement your SMTP sending logic here
  // This is a placeholder - integrate with your email queue system
  console.log("Would send notification to:", config.admin_notification_email);
  console.log("Status:", result.overallStatus);
  return true;
}

// Save results to history
async function saveToHistory(
  supabase: any, 
  result: DomainReputationResult, 
  notificationSent: boolean
): Promise<void> {
  await supabase.from("domain_reputation_history").insert({
    domain: result.domain,
    checked_at: result.checkedAt,
    overall_status: result.overallStatus,
    dnsbl_listed_count: result.listedCount,
    dnsbl_checked_count: result.totalChecked,
    vt_reputation: result.virusTotalResult?.reputation,
    vt_malicious: result.virusTotalResult?.malicious,
    vt_suspicious: result.virusTotalResult?.suspicious,
    vt_harmless: result.virusTotalResult?.harmless,
    recommendations: result.recommendations,
    full_result: result,
    notification_sent: notificationSent,
  });
}

// Get previous status for comparison
async function getPreviousStatus(supabase: any, domain: string): Promise<string | null> {
  const { data } = await supabase
    .from("domain_reputation_history")
    .select("overall_status")
    .eq("domain", domain)
    .order("checked_at", { ascending: false })
    .limit(1)
    .single();
  
  return data?.overall_status || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, skipVirusTotal, skipNotification, testNotification } = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vtApiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
    
    // Handle test notification request
    if (testNotification) {
      const config = await getEmailConfig(supabase);
      const testResult: DomainReputationResult = {
        domain,
        checkedAt: new Date().toISOString(),
        overallStatus: "warning",
        dnsblResults: [],
        virusTotalResult: null,
        recommendations: ["This is a test notification"],
        listedCount: 1,
        totalChecked: 5,
      };
      
      await sendAdminNotification(config, testResult);
      
      return new Response(
        JSON.stringify({ success: true, message: "Test notification sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check all DNSBL servers in parallel
    const dnsblResults = await Promise.all(
      DNSBL_SERVERS.map(server => checkDNSBL(domain, server))
    );

    // Check VirusTotal if API key is available and not skipped
    let vtResult: VirusTotalResult | null = null;
    if (vtApiKey && !skipVirusTotal) {
      vtResult = await checkVirusTotal(domain, vtApiKey);
    }

    // Calculate overall status
    const listedCount = dnsblResults.filter(r => r.listed).length;
    const totalChecked = dnsblResults.length;
    
    let overallStatus: "clean" | "warning" | "critical" = "clean";
    
    if (listedCount >= 3 || (vtResult && vtResult.malicious >= 3)) {
      overallStatus = "critical";
    } else if (listedCount >= 1 || (vtResult && (vtResult.malicious > 0 || vtResult.suspicious >= 3))) {
      overallStatus = "warning";
    }

    const recommendations = generateRecommendations(dnsblResults, vtResult);

    const result: DomainReputationResult = {
      domain,
      checkedAt: new Date().toISOString(),
      overallStatus,
      dnsblResults,
      virusTotalResult: vtResult,
      recommendations,
      listedCount,
      totalChecked,
    };

    // Check if status degraded and send notification
    let notificationSent = false;
    if (!skipNotification) {
      const previousStatus = await getPreviousStatus(supabase, domain);
      const statusDegraded = 
        (previousStatus === "clean" && overallStatus !== "clean") ||
        (previousStatus === "warning" && overallStatus === "critical");
      
      if (statusDegraded) {
        const config = await getEmailConfig(supabase);
        if (config.admin_notification_email) {
          notificationSent = await sendAdminNotification(config, result);
        }
      }
    }

    // Save to history
    await saveToHistory(supabase, result, notificationSent);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking domain reputation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Config.toml Entry

```toml
[functions.check-domain-reputation]
verify_jwt = true
```

### Frontend Component: DomainReputationMonitor

```typescript
// Key features of the DomainReputationMonitor component:

// 1. Manual check button
// 2. Periodic automatic checks (configurable interval)
// 3. Historical chart showing reputation over time
// 4. Status badges (Clean/Warning/Critical)
// 5. Detailed DNSBL and VirusTotal results
// 6. Recommendations display
// 7. Test notification button
// 8. Settings persistence via user preferences

// Usage:
<DomainReputationMonitor domain="yourdomain.com" />
```

### User Preferences for Periodic Checks

```typescript
// Store check preferences using useUserPreferences hook
interface ReputationCheckPrefs {
  enablePeriodicCheck: boolean;
  checkIntervalHours: number;
  lastCheckTime: string | null;
}

// Default: Check every 24 hours
const defaultPrefs: ReputationCheckPrefs = {
  enablePeriodicCheck: true,
  checkIntervalHours: 24,
  lastCheckTime: null,
};
```

---

## 3. Template Testing Feature

### Overview
Preview and send test emails using configured SMTP settings before going live.

### Database Requirements
Uses `app_settings` table for SMTP configuration (from EMAIL_SYSTEM_BLUEPRINT.md).

### Key Settings

```sql
-- Required app_settings entries
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('smtp_host', 'smtp.example.com'),
  ('smtp_port', '587'),
  ('smtp_user', 'your-smtp-user'),
  ('smtp_pass', 'your-smtp-password'),
  ('smtp_secure', 'true'),
  ('sender_email', 'noreply@yourdomain.com'),
  ('sender_name', 'Your App Name'),
  ('email_sending_enabled', 'true');
```

### Test Email Flow

```typescript
// 1. Check connection status
const checkConnection = async () => {
  const { data, error } = await supabase.functions.invoke('send-quiz-results', {
    body: { action: 'check_connection' }
  });
  return { connected: !error, status: data };
};

// 2. Send test email
const sendTestEmail = async (testEmail: string, quizId: string, templateId: string) => {
  const { data, error } = await supabase.functions.invoke('send-quiz-results', {
    body: {
      action: 'test_email',
      email: testEmail,
      quizId,
      templateId,
      language: 'en'
    }
  });
  
  if (error) throw error;
  return data;
};
```

### EmailSettings Component Features

```typescript
// Key features in EmailSettings:

// 1. SMTP Configuration Form
interface EmailConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  sender_email: string;
  sender_name: string;
}

// 2. Connection Status Display
// - Shows connected/disconnected state
// - Auto-reconnect with exponential backoff
// - Manual reconnect button

// 3. DNS Validation
// - SPF record check
// - DKIM record check  
// - DMARC record check
// - Copy-to-clipboard for DNS records

// 4. Test Email Section
// - Quiz selector dropdown
// - Template selector dropdown
// - Test email input field
// - Send test button with rate limiting
// - Preview dialog before sending

// 5. Rate Limiting
// - Prevents spam during testing
// - Configurable cooldown period
// - Visual countdown timer
```

### Preview Dialog Component

```typescript
// EmailPreviewDialog props
interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewHtml: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  onSend: () => Promise<void>;
  isSending: boolean;
}

// Features:
// - Full HTML preview in iframe
// - Subject line display
// - Sender/recipient info
// - Send confirmation button
// - Loading state during send
```

### Sample Placeholders for Preview

```typescript
const SAMPLE_DATA = {
  userName: "Test User",
  userEmail: "test@example.com",
  quizTitle: "Sample Quiz",
  score: 85,
  totalQuestions: 10,
  resultTitle: "Great Performance!",
  resultDescription: "You demonstrated excellent knowledge...",
  ctaUrl: "https://example.com/next-steps",
  ctaText: "Continue Learning",
};

// Replace placeholders in template
const renderPreview = (template: string, data: typeof SAMPLE_DATA) => {
  return template
    .replace(/{{userName}}/g, data.userName)
    .replace(/{{score}}/g, String(data.score))
    // ... etc
};
```

---

## Quick Integration Checklist

### Connection Monitoring
- [ ] Add `useSupabaseConnection` hook to your hooks folder
- [ ] Add `ConnectionStatus` component to your admin components
- [ ] Use in layouts that need connection awareness

### Domain Reputation
- [ ] Run database migration for `domain_reputation_history`
- [ ] Add `VIRUSTOTAL_API_KEY` secret
- [ ] Deploy `check-domain-reputation` edge function
- [ ] Add config.toml entry
- [ ] Integrate `DomainReputationMonitor` component

### Template Testing
- [ ] Configure SMTP settings in `app_settings`
- [ ] Ensure `send-quiz-results` function supports test mode
- [ ] Add `EmailPreviewDialog` component
- [ ] Integrate into email settings page

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Admin Dashboard                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Connection     │  │  Domain         │  │  Template       │ │
│  │  Status         │  │  Reputation     │  │  Testing        │ │
│  │  Component      │  │  Monitor        │  │  Component      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                     │          │
└───────────┼────────────────────┼─────────────────────┼──────────┘
            │                    │                     │
            ▼                    ▼                     ▼
┌───────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│ Supabase Auth     │  │ check-domain-   │  │ send-quiz-results   │
│ Session Check     │  │ reputation      │  │ (test mode)         │
│                   │  │ Edge Function   │  │ Edge Function       │
└───────────────────┘  └────────┬────────┘  └──────────┬──────────┘
                                │                      │
                                ▼                      ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ External APIs   │    │ SMTP Server     │
                       │ - DNSBL         │    │                 │
                       │ - VirusTotal    │    │                 │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────────────────────────┐
                       │        Supabase Database            │
                       │  - domain_reputation_history        │
                       │  - app_settings                     │
                       │  - email_logs                       │
                       └─────────────────────────────────────┘
```

---

## Support

For questions or issues, refer to:
- Supabase documentation: https://supabase.com/docs
- VirusTotal API: https://developers.virustotal.com/reference
- DNSBL information: https://www.dnsbl.info/

---

*Documentation generated for email system monitoring features.*
*Last updated: 2026-01-22*
