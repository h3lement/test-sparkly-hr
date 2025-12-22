import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  ChevronDown,
  ChevronRight,
  Settings,
  ExternalLink,
  Loader2,
  ListChecks,
  TrendingUp,
  Bell,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { logActivity } from "@/hooks/useActivityLog";
import { AdminCard, AdminCardHeader, AdminCardContent } from "./AdminCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DNSBLResult {
  name: string;
  server: string;
  description: string;
  listed: boolean;
  error?: string;
}

interface VirusTotalResult {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
  lastAnalysisDate: string | null;
  reputation: number;
  categories: Record<string, string>;
  error?: string;
}

interface DomainReputationResult {
  domain: string;
  checkedAt: string;
  dnsbl: {
    results: DNSBLResult[];
    listedCount: number;
    checkedCount: number;
  };
  virusTotal: VirusTotalResult | null;
  overallStatus: "clean" | "warning" | "danger" | "error";
  recommendations: string[];
  notificationSent?: boolean;
}

interface HistoryRecord {
  id: string;
  domain: string;
  checked_at: string;
  overall_status: string;
  dnsbl_listed_count: number;
  dnsbl_checked_count: number;
  vt_malicious: number;
  vt_suspicious: number;
  vt_harmless: number;
  vt_reputation: number;
  notification_sent: boolean;
}

interface ReputationCheckPrefs {
  intervalDays: number;
  intervalHours: number;
  intervalMinutes: number;
  periodicCheckEnabled: boolean;
  lastCheckAt: string | null;
  lastResult: DomainReputationResult | null;
}

interface DomainReputationMonitorProps {
  domain: string;
}

export function DomainReputationMonitor({ domain }: DomainReputationMonitorProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [result, setResult] = useState<DomainReputationResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDnsblDetails, setShowDnsblDetails] = useState(false);
  const [showVtDetails, setShowVtDetails] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const periodicCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // User preferences for reputation check settings
  const { preferences, updatePreference, savePreferences, loading: prefsLoading } = useUserPreferences<ReputationCheckPrefs>({
    key: "domain_reputation_settings",
    defaultValue: {
      intervalDays: 1,
      intervalHours: 0,
      intervalMinutes: 0,
      periodicCheckEnabled: true,
      lastCheckAt: null,
      lastResult: null,
    },
  });

  // Calculate interval in milliseconds
  const getIntervalMs = useCallback(() => {
    const days = preferences.intervalDays || 1;
    const hours = preferences.intervalHours || 0;
    const minutes = preferences.intervalMinutes || 0;
    return (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
  }, [preferences.intervalDays, preferences.intervalHours, preferences.intervalMinutes]);

  // Format interval for display
  const formatInterval = useCallback(() => {
    const parts: string[] = [];
    if (preferences.intervalDays > 0) {
      parts.push(`${preferences.intervalDays}d`);
    }
    if (preferences.intervalHours > 0) {
      parts.push(`${preferences.intervalHours}h`);
    }
    if (preferences.intervalMinutes > 0) {
      parts.push(`${preferences.intervalMinutes}m`);
    }
    return parts.length > 0 ? parts.join(' ') : '1d';
  }, [preferences.intervalDays, preferences.intervalHours, preferences.intervalMinutes]);

  // Load history data
  const loadHistory = useCallback(async () => {
    if (!domain) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("domain_reputation_history")
        .select("*")
        .eq("domain", domain)
        .order("checked_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [domain]);

  // Check domain reputation
  const checkReputation = useCallback(async (isPeriodicCheck = false, silent = false) => {
    if (!domain) return;

    if (!silent) {
      setIsChecking(true);
    }

    const checkStartTime = new Date();
    let checkStatus = "unknown";

    try {
      console.log(`Checking domain reputation for: ${domain}`);
      
      const { data, error } = await supabase.functions.invoke("check-domain-reputation", {
        body: { domain },
      });

      if (error) throw error;

      const reputationResult = data as DomainReputationResult;
      setResult(reputationResult);
      checkStatus = reputationResult.overallStatus;

      // Save to preferences
      await savePreferences({
        ...preferences,
        lastCheckAt: reputationResult.checkedAt,
        lastResult: reputationResult,
      });

      // Reload history
      loadHistory();

      if (!silent) {
        const notifMsg = reputationResult.notificationSent 
          ? " Notification sent to admins."
          : "";
        toast({
          title: reputationResult.overallStatus === "clean" 
            ? "Domain Reputation: Clean" 
            : reputationResult.overallStatus === "warning" 
              ? "Domain Reputation: Warning"
              : "Domain Reputation: Issues Detected",
          description: `Checked ${reputationResult.dnsbl.checkedCount} blacklists, ${reputationResult.dnsbl.listedCount} listings found.${notifMsg}`,
          variant: reputationResult.overallStatus === "danger" ? "destructive" : "default",
        });
      }
    } catch (error: any) {
      console.error("Reputation check failed:", error);
      checkStatus = "error";
      if (!silent) {
        toast({
          title: "Reputation Check Failed",
          description: error.message || "Failed to check domain reputation",
          variant: "destructive",
        });
      }
    } finally {
      setIsChecking(false);

      // Log to activity log
      const checkType = isPeriodicCheck ? "Periodic" : "Manual";
      const checkDuration = Date.now() - checkStartTime.getTime();

      logActivity({
        actionType: "STATUS_CHANGE",
        tableName: "domain_reputation",
        recordId: domain,
        fieldName: "reputation_status",
        oldValue: null,
        newValue: checkStatus,
        description: `${checkType} domain reputation check: ${checkStatus} - took ${checkDuration}ms`,
      });
    }
  }, [domain, preferences, savePreferences, toast, loadHistory]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!domain) return;

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-domain-reputation", {
        body: { domain, testNotification: true },
      });

      if (error) throw error;

      toast({
        title: data.success ? "Test Notification Sent" : "Test Notification Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });

      logActivity({
        actionType: "UPDATE",
        tableName: "domain_reputation",
        recordId: domain,
        fieldName: "test_notification",
        oldValue: null,
        newValue: data.success ? "sent" : "failed",
        description: `Test notification ${data.success ? "sent successfully" : "failed"}`,
      });
    } catch (error: any) {
      console.error("Test notification failed:", error);
      toast({
        title: "Test Notification Failed",
        description: error.message || "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  }, [domain, toast]);
  // Load cached result on mount
  useEffect(() => {
    if (!prefsLoading && preferences.lastResult) {
      setResult(preferences.lastResult);
    }
  }, [prefsLoading, preferences.lastResult]);

  // Load history on mount
  useEffect(() => {
    if (domain) {
      loadHistory();
    }
  }, [domain, loadHistory]);

  // Check if we need to run an initial check
  useEffect(() => {
    if (prefsLoading || !domain || !preferences.periodicCheckEnabled) return;

    const lastCheck = preferences.lastCheckAt ? new Date(preferences.lastCheckAt) : null;
    const intervalMs = getIntervalMs();
    const now = Date.now();

    if (!lastCheck || (now - lastCheck.getTime()) > intervalMs) {
      console.log("Running initial reputation check - interval exceeded or no previous check");
      checkReputation(true, true);
    }
  }, [prefsLoading, domain, preferences.periodicCheckEnabled, preferences.lastCheckAt, getIntervalMs, checkReputation]);

  // Set up periodic checks
  useEffect(() => {
    if (!preferences.periodicCheckEnabled || !domain) {
      if (periodicCheckTimerRef.current) {
        clearInterval(periodicCheckTimerRef.current);
        periodicCheckTimerRef.current = null;
      }
      return;
    }

    const intervalMs = getIntervalMs();
    if (intervalMs <= 0) return;

    console.log(`Setting up periodic reputation check every ${formatInterval()}`);

    periodicCheckTimerRef.current = setInterval(() => {
      console.log(`Periodic reputation check (interval: ${formatInterval()})...`);
      checkReputation(true, true);
    }, intervalMs);

    return () => {
      if (periodicCheckTimerRef.current) {
        clearInterval(periodicCheckTimerRef.current);
        periodicCheckTimerRef.current = null;
      }
    };
  }, [preferences.periodicCheckEnabled, domain, getIntervalMs, formatInterval, checkReputation]);

  const getStatusIcon = () => {
    if (isChecking) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    if (!result) return <Shield className="h-5 w-5 text-muted-foreground" />;
    
    switch (result.overallStatus) {
      case "clean":
        return <ShieldCheck className="h-5 w-5 text-green-500" />;
      case "warning":
        return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
      case "danger":
        return <ShieldX className="h-5 w-5 text-red-500" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    if (isChecking) return <Badge variant="secondary">Checking...</Badge>;
    if (!result) return <Badge variant="outline">Not checked</Badge>;

    switch (result.overallStatus) {
      case "clean":
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Clean</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Warning</Badge>;
      case "danger":
        return <Badge variant="destructive">Issues Found</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTimestamp = (isoString: string | null) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const getNextCheckTime = () => {
    if (!preferences.periodicCheckEnabled || !preferences.lastCheckAt) return null;
    const lastCheck = new Date(preferences.lastCheckAt);
    const nextCheck = new Date(lastCheck.getTime() + getIntervalMs());
    return nextCheck;
  };

  // Prepare chart data
  const chartData = [...history].reverse().map((record) => ({
    date: new Date(record.checked_at).toLocaleDateString(),
    time: new Date(record.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    blacklists: record.dnsbl_listed_count,
    vtMalicious: record.vt_malicious,
    vtSuspicious: record.vt_suspicious,
    vtReputation: record.vt_reputation,
    status: record.overall_status,
  }));

  return (
    <AdminCard className="mt-6">
      <AdminCardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="admin-card-title flex items-center gap-2">
              Domain Reputation
              {getStatusBadge()}
              {result?.notificationSent && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Bell className="h-4 w-4 text-yellow-500" />
                    </TooltipTrigger>
                    <TooltipContent>Notification sent to admins</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              <Globe className="h-3 w-3 inline mr-1" />
              {domain || "No domain configured"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="h-8 px-2"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recheck Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkReputation(false, false)}
            disabled={isChecking || !domain}
            className="h-8"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isChecking ? "animate-spin" : ""}`} />
            Check Now
          </Button>
        </div>
      </AdminCardHeader>

      <AdminCardContent>
        {/* Recheck Settings Panel */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent className="mb-4">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Periodic Check Settings
                </h4>
                <div className="flex items-center gap-2">
                  <Label htmlFor="periodic-enabled" className="text-sm text-muted-foreground">
                    Enabled
                  </Label>
                  <Switch
                    id="periodic-enabled"
                    checked={preferences.periodicCheckEnabled}
                    onCheckedChange={(checked) => updatePreference("periodicCheckEnabled", checked)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="interval-days" className="text-xs text-muted-foreground">Days</Label>
                  <Input
                    id="interval-days"
                    type="number"
                    min={0}
                    max={30}
                    value={preferences.intervalDays}
                    onChange={(e) => updatePreference("intervalDays", parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                    disabled={!preferences.periodicCheckEnabled}
                  />
                </div>
                <div>
                  <Label htmlFor="interval-hours" className="text-xs text-muted-foreground">Hours</Label>
                  <Input
                    id="interval-hours"
                    type="number"
                    min={0}
                    max={23}
                    value={preferences.intervalHours}
                    onChange={(e) => updatePreference("intervalHours", parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                    disabled={!preferences.periodicCheckEnabled}
                  />
                </div>
                <div>
                  <Label htmlFor="interval-minutes" className="text-xs text-muted-foreground">Minutes</Label>
                  <Input
                    id="interval-minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={preferences.intervalMinutes}
                    onChange={(e) => updatePreference("intervalMinutes", parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                    disabled={!preferences.periodicCheckEnabled}
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Current interval: <span className="font-medium">{formatInterval()}</span>
                {preferences.periodicCheckEnabled && getNextCheckTime() && (
                  <span className="ml-2">
                    • Next check: {formatTimestamp(getNextCheckTime()?.toISOString() || null)}
                  </span>
                )}
              </div>

              <div className="mt-3 p-2 bg-blue-500/5 rounded border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Bell className="h-3 w-3" />
                    Email notifications are automatically sent to all admins when status changes to warning or danger.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendTestNotification}
                    disabled={isSendingTest || !domain}
                    className="h-7 text-xs ml-2"
                  >
                    {isSendingTest ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Bell className="h-3 w-3 mr-1" />
                        Send Test
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Last Check Timestamp */}
        {result && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Clock className="h-4 w-4" />
            <span>Last checked: {formatTimestamp(result.checkedAt)}</span>
          </div>
        )}

        {/* Results Summary */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Blacklists Checked</div>
              <div className="text-lg font-semibold">
                {result.dnsbl.checkedCount}
              </div>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Listed On</div>
              <div className={`text-lg font-semibold ${result.dnsbl.listedCount > 0 ? "text-red-500" : "text-green-500"}`}>
                {result.dnsbl.listedCount}
              </div>
            </div>

            {result.virusTotal && !result.virusTotal.error && (
              <>
                <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">VT Malicious</div>
                  <div className={`text-lg font-semibold ${result.virusTotal.malicious > 0 ? "text-red-500" : "text-green-500"}`}>
                    {result.virusTotal.malicious}
                  </div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">VT Reputation</div>
                  <div className={`text-lg font-semibold ${result.virusTotal.reputation < 0 ? "text-red-500" : "text-green-500"}`}>
                    {result.virusTotal.reputation}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Historical Trend Chart */}
        {history.length > 1 && (
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Reputation Trend ({history.length} checks)
                </span>
                {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted/20 rounded-lg p-4 border border-border/50 mb-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            return `${label} ${payload[0].payload.time}`;
                          }
                          return label;
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="blacklists" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        name="Blacklists"
                        dot={{ fill: '#ef4444', r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="vtMalicious" 
                        stroke="#f97316" 
                        strokeWidth={2}
                        name="VT Malicious"
                        dot={{ fill: '#f97316', r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="vtReputation" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        name="VT Reputation"
                        dot={{ fill: '#22c55e', r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* History table */}
                <div className="mt-4 max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr className="border-b border-border/50">
                        <th className="text-left p-2">Date</th>
                        <th className="text-center p-2">Status</th>
                        <th className="text-center p-2">Blacklists</th>
                        <th className="text-center p-2">VT Malicious</th>
                        <th className="text-center p-2">VT Rep</th>
                        <th className="text-center p-2">Notified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record) => (
                        <tr key={record.id} className="border-b border-border/30">
                          <td className="p-2 text-muted-foreground">
                            {new Date(record.checked_at).toLocaleString()}
                          </td>
                          <td className="text-center p-2">
                            <Badge 
                              variant={record.overall_status === "clean" ? "secondary" : "destructive"}
                              className={
                                record.overall_status === "clean" 
                                  ? "bg-green-500/10 text-green-600" 
                                  : record.overall_status === "warning"
                                    ? "bg-yellow-500/10 text-yellow-600"
                                    : ""
                              }
                            >
                              {record.overall_status}
                            </Badge>
                          </td>
                          <td className={`text-center p-2 ${record.dnsbl_listed_count > 0 ? "text-red-500" : ""}`}>
                            {record.dnsbl_listed_count}
                          </td>
                          <td className={`text-center p-2 ${record.vt_malicious > 0 ? "text-red-500" : ""}`}>
                            {record.vt_malicious}
                          </td>
                          <td className={`text-center p-2 ${record.vt_reputation < 0 ? "text-red-500" : "text-green-500"}`}>
                            {record.vt_reputation}
                          </td>
                          <td className="text-center p-2">
                            {record.notification_sent && <Bell className="h-3 w-3 text-yellow-500 mx-auto" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* DNSBL Details */}
        {result && (
          <Collapsible open={showDnsblDetails} onOpenChange={setShowDnsblDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                <span className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  DNSBL Results ({result.dnsbl.listedCount}/{result.dnsbl.checkedCount})
                </span>
                {showDnsblDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-2 mb-4">
                {result.dnsbl.results.map((item) => (
                  <div
                    key={item.server}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      item.listed 
                        ? "bg-red-500/5 border-red-500/20" 
                        : "bg-muted/20 border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.listed ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : item.error ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    <Badge variant={item.listed ? "destructive" : "secondary"}>
                      {item.listed ? "Listed" : item.error ? "Error" : "Clean"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* VirusTotal Details */}
        {result?.virusTotal && (
          <Collapsible open={showVtDetails} onOpenChange={setShowVtDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  VirusTotal Analysis
                </span>
                {showVtDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted/20 rounded-lg p-4 border border-border/50 mb-4">
                {result.virusTotal.error ? (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{result.virusTotal.error}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-500">{result.virusTotal.harmless}</div>
                        <div className="text-xs text-muted-foreground">Harmless</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${result.virusTotal.malicious > 0 ? "text-red-500" : ""}`}>
                          {result.virusTotal.malicious}
                        </div>
                        <div className="text-xs text-muted-foreground">Malicious</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${result.virusTotal.suspicious > 0 ? "text-yellow-500" : ""}`}>
                          {result.virusTotal.suspicious}
                        </div>
                        <div className="text-xs text-muted-foreground">Suspicious</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-muted-foreground">{result.virusTotal.undetected}</div>
                        <div className="text-xs text-muted-foreground">Undetected</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-muted-foreground">{result.virusTotal.timeout}</div>
                        <div className="text-xs text-muted-foreground">Timeout</div>
                      </div>
                    </div>

                    {result.virusTotal.lastAnalysisDate && (
                      <div className="text-xs text-muted-foreground">
                        Last VT analysis: {formatTimestamp(result.virusTotal.lastAnalysisDate)}
                      </div>
                    )}

                    {Object.keys(result.virusTotal.categories).length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Categories:</div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(result.virusTotal.categories).map(([vendor, category]) => (
                            <Badge key={vendor} variant="secondary" className="text-xs">
                              {category}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => window.open(`https://www.virustotal.com/gui/domain/${domain}`, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View on VirusTotal
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recommendations */}
        {result && result.recommendations.length > 0 && (
          <Collapsible open={showRecommendations} onOpenChange={setShowRecommendations}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Recommendations ({result.recommendations.length})
                </span>
                {showRecommendations ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {result.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 p-3 rounded-lg border ${
                      result.overallStatus === "clean"
                        ? "bg-green-500/5 border-green-500/20"
                        : result.overallStatus === "warning"
                          ? "bg-yellow-500/5 border-yellow-500/20"
                          : "bg-red-500/5 border-red-500/20"
                    }`}
                  >
                    {result.overallStatus === "clean" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* No result yet */}
        {!result && !isChecking && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click "Check Now" to analyze domain reputation</p>
          </div>
        )}

        {/* Loading state */}
        {isChecking && !result && (
          <div className="text-center py-6 text-muted-foreground">
            <Loader2 className="h-10 w-10 mx-auto mb-2 animate-spin opacity-50" />
            <p className="text-sm">Checking domain reputation...</p>
            <p className="text-xs mt-1">This may take a few moments</p>
          </div>
        )}
      </AdminCardContent>
    </AdminCard>
  );
}
