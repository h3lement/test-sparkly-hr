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
} from "lucide-react";
import { ApiKeyManagementCard } from "./ApiKeyManagementCard";

interface ConnectionStatus {
  status: "connected" | "disconnected" | "checking" | "error";
  lastChecked: Date | null;
  message: string;
  apiKeyConfigured: boolean;
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
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 5000;
  const { toast } = useToast();

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
      } else {
        setConnectionStatus({
          status: "error",
          lastChecked: new Date(),
          message: data?.error || "API key not configured or invalid",
          apiKeyConfigured: false,
        });
        scheduleReconnect();
      }
    } catch (error: any) {
      console.error("Connection check failed:", error);
      setConnectionStatus({
        status: "error",
        lastChecked: new Date(),
        message: error.message || "Failed to check connection",
        apiKeyConfigured: false,
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
        // Refresh connection status after successful test
        checkConnection(true);
      } else {
        throw new Error(data?.error || "Failed to send test email");
      }
    } catch (error: any) {
      console.error("Test email failed:", error);
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
          {connectionStatus.status !== "connected" && (
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
