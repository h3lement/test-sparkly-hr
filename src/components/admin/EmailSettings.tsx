import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  AlertTriangle,
  Mail,
  Loader2,
  ExternalLink,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { ApiKeyManagementCard } from "./ApiKeyManagementCard";

interface ConnectionStatus {
  status: "connected" | "disconnected" | "checking" | "error";
  lastChecked: Date | null;
  message: string;
  apiKeyConfigured: boolean;
}

interface EmailError {
  type: "connection" | "send";
  timestamp: Date;
  message: string;
  details?: string;
  code?: string;
}

interface EmailSuccess {
  type: "connection" | "send";
  timestamp: Date;
  message: string;
}

type EmailType = "simple" | "quiz_result" | "notification";

export function EmailSettings() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "checking",
    lastChecked: null,
    message: "Checking connection...",
    apiKeyConfigured: false,
  });
  const [testEmail, setTestEmail] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("simple");
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errors, setErrors] = useState<EmailError[]>([]);
  const [lastSuccess, setLastSuccess] = useState<EmailSuccess | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 5000;
  const { toast } = useToast();

  const addError = (error: Omit<EmailError, "timestamp">) => {
    setErrors((prev) => [{ ...error, timestamp: new Date() }, ...prev].slice(0, 5));
    setLastSuccess(null);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const setSuccess = (success: Omit<EmailSuccess, "timestamp">) => {
    setLastSuccess({ ...success, timestamp: new Date() });
    clearErrors();
  };

  // Pre-fill test email with current admin user's email
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setTestEmail(user.email);
      }
    };
    fetchUserEmail();
  }, []);

  const checkConnection = useCallback(async (silent = false) => {
    if (!silent) {
      setIsChecking(true);
    }
    setConnectionStatus((prev) => ({
      ...prev,
      status: "checking",
      message: "Checking connection...",
    }));

    try {
      const { data, error } = await supabase.functions.invoke("send-quiz-results", {
        body: { action: "check_connection" },
      });

      if (error) {
        throw error;
      }

      if (data?.connected) {
        reconnectAttempts.current = 0;
        setConnectionStatus({
          status: "connected",
          lastChecked: new Date(),
          message: "Resend API connection active",
          apiKeyConfigured: true,
        });
        setSuccess({
          type: "connection",
          message: "Successfully connected to Resend API",
        });
      } else {
        const errorMessage = data?.error || "API key not configured or invalid";
        setConnectionStatus({
          status: "error",
          lastChecked: new Date(),
          message: errorMessage,
          apiKeyConfigured: false,
        });
        addError({
          type: "connection",
          message: "Connection failed",
          details: errorMessage,
          code: data?.code,
        });
        scheduleReconnect();
      }
    } catch (error: any) {
      console.error("Connection check failed:", error);
      const errorMessage = error.message || "Failed to check connection";
      setConnectionStatus({
        status: "error",
        lastChecked: new Date(),
        message: errorMessage,
        apiKeyConfigured: false,
      });
      addError({
        type: "connection",
        message: "Connection check failed",
        details: errorMessage,
        code: error.code,
      });
      scheduleReconnect();
    } finally {
      if (!silent) {
        setIsChecking(false);
      }
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus((prev) => ({
        ...prev,
        status: "disconnected",
        message: `Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Click refresh to try again.`,
      }));
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectAttempts.current += 1;
    const delay = RECONNECT_DELAY_MS * reconnectAttempts.current;

    setConnectionStatus((prev) => ({
      ...prev,
      message: `Reconnecting in ${Math.ceil(delay / 1000)}s (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})...`,
    }));

    reconnectTimerRef.current = setTimeout(() => {
      checkConnection(true);
    }, delay);
  }, [checkConnection]);

  useEffect(() => {
    checkConnection();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [checkConnection]);

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quiz-results", {
        body: {
          action: "test_email",
          testEmail: testEmail.trim(),
          emailType,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const typeLabel = emailType === "quiz_result" ? "Quiz Result" : emailType === "notification" ? "Notification" : "Simple";
        toast({
          title: "Test email sent",
          description: `${typeLabel} email sent to ${testEmail}`,
        });
        setSuccess({
          type: "send",
          message: `${typeLabel} email successfully sent to ${testEmail}`,
        });
        // Refresh connection status after successful test
        checkConnection(true);
      } else {
        const errorMessage = data?.error || "Failed to send test email";
        addError({
          type: "send",
          message: "Failed to send test email",
          details: errorMessage,
          code: data?.code,
        });
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Test email failed:", error);
      if (!errors.some(e => e.details === error.message)) {
        addError({
          type: "send",
          message: "Test email failed",
          details: error.message || "An unexpected error occurred",
        });
      }
      toast({
        title: "Failed to send test email",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleManualReconnect = () => {
    reconnectAttempts.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    clearErrors();
    checkConnection();
  };

  const getStatusBadge = () => {
    switch (connectionStatus.status) {
      case "connected":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <Wifi className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "checking":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Checking...
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case "disconnected":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Test Email Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-base">Send Test Email</CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex gap-2">
            <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple Test</SelectItem>
                <SelectItem value="quiz_result">Quiz Results</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="email"
              placeholder="Enter email address..."
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 h-9"
              disabled={connectionStatus.status !== "connected"}
            />
            <Button
              size="sm"
              onClick={sendTestEmail}
              disabled={isSending || connectionStatus.status !== "connected" || !testEmail.trim()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualReconnect}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Success Message */}
          {lastSuccess && (
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-green-700">
                      {lastSuccess.type === "connection" ? "Connection Successful" : "Email Sent"}
                    </p>
                    <span className="text-xs text-green-600/70">{formatTime(lastSuccess.timestamp)}</span>
                  </div>
                  <p className="text-xs text-green-600 mt-0.5">{lastSuccess.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-destructive">
                  Recent Errors ({errors.length})
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearErrors}
                >
                  Clear
                </Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                  >
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-destructive">
                            {error.type === "connection" ? "Connection Error" : "Send Error"}
                          </p>
                          <span className="text-xs text-destructive/70">{formatTime(error.timestamp)}</span>
                        </div>
                        <p className="text-xs text-destructive/80 mt-0.5">{error.message}</p>
                        {error.details && (
                          <p className="text-xs text-muted-foreground mt-1 break-words">
                            {error.details}
                          </p>
                        )}
                        {error.code && (
                          <Badge variant="outline" className="mt-1.5 text-xs px-1.5 py-0">
                            Code: {error.code}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {connectionStatus.status !== "connected" && !errors.length && (
            <p className="text-xs text-muted-foreground">
              {connectionStatus.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Connection Status - Compact */}
      {connectionStatus.status !== "connected" && connectionStatus.apiKeyConfigured === false && (
        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-sm text-amber-700 mb-2">
            API key not configured or invalid.
          </p>
          <div className="flex gap-3 text-xs">
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Create API Key
            </a>
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Verify Domain
            </a>
          </div>
        </div>
      )}

      {/* API Key Management Card */}
      <ApiKeyManagementCard onApiKeyUpdated={() => checkConnection()} />
    </div>
  );
}