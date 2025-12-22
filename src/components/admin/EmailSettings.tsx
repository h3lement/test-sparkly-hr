import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  AlertTriangle,
  Settings,
  Mail,
  Loader2,
} from "lucide-react";

interface ConnectionStatus {
  status: "connected" | "disconnected" | "checking" | "error";
  lastChecked: Date | null;
  message: string;
  apiKeyConfigured: boolean;
}

export function EmailSettings() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "checking",
    lastChecked: null,
    message: "Checking connection...",
    apiKeyConfigured: false,
  });
  const [testEmail, setTestEmail] = useState("");
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
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Test email sent",
          description: `Email sent successfully to ${testEmail}`,
        });
        setTestEmail("");
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

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "checking":
        return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "disconnected":
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
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
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Resend Connection</CardTitle>
                <CardDescription>Email service connection status</CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            {getStatusIcon()}
            <div className="flex-1">
              <p className="font-medium text-sm">{connectionStatus.message}</p>
              {connectionStatus.lastChecked && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last checked: {connectionStatus.lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualReconnect}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {connectionStatus.status === "connected" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-muted-foreground mb-1">API Status</p>
                <p className="font-medium text-green-600">Active</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Provider</p>
                <p className="font-medium">Resend</p>
              </div>
            </div>
          )}

          {connectionStatus.status !== "connected" && connectionStatus.apiKeyConfigured === false && (
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm text-amber-700">
                The <code className="bg-amber-500/10 px-1 py-0.5 rounded text-xs">RESEND_API_KEY</code> secret may not be configured or is invalid. 
                Please ensure it's properly set in your secrets configuration.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Email Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Send Test Email</CardTitle>
              <CardDescription>Verify your email configuration by sending a test</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Recipient Email</Label>
            <div className="flex gap-2">
              <Input
                id="test-email"
                type="email"
                placeholder="Enter email address..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1"
                disabled={connectionStatus.status !== "connected"}
              />
              <Button
                onClick={sendTestEmail}
                disabled={isSending || connectionStatus.status !== "connected" || !testEmail.trim()}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test
              </Button>
            </div>
          </div>

          {connectionStatus.status !== "connected" && (
            <p className="text-sm text-muted-foreground">
              Connect to Resend first to send test emails.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <AlertTriangle className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Automatic Reconnection</p>
              <p className="text-sm text-muted-foreground">
                If the connection drops, the system will automatically attempt to reconnect up to {MAX_RECONNECT_ATTEMPTS} times 
                with increasing delays. You can also manually refresh the connection at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
