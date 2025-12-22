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
import { Label } from "@/components/ui/label";
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
  Globe,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Save,
  Pencil,
  Eye,
  EyeOff,
  Key,
  Server,
  Lock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface DomainInfo {
  name: string;
  status: string;
  region: string;
}

interface ConnectionStatus {
  status: "connected" | "disconnected" | "checking" | "error";
  lastChecked: Date | null;
  message: string;
  apiKeyConfigured: boolean;
  domains: DomainInfo[];
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

interface EmailConfig {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  // SMTP settings
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
  // DKIM settings
  dkimSelector: string;
  dkimPrivateKey: string;
  dkimDomain: string;
}

export function EmailSettings() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "checking",
    lastChecked: null,
    message: "Checking connection...",
    apiKeyConfigured: false,
    domains: [],
  });
  const [testEmail, setTestEmail] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("simple");
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errors, setErrors] = useState<EmailError[]>([]);
  const [lastSuccess, setLastSuccess] = useState<EmailSuccess | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    senderName: "Sparkly",
    senderEmail: "noreply@sparkly.hr",
    replyToEmail: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
    dkimSelector: "",
    dkimPrivateKey: "",
    dkimDomain: "",
  });
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<EmailConfig>(emailConfig);
  const [isGeneratingDkim, setIsGeneratingDkim] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 5000;
  const { toast } = useToast();

  // Load email config from app_settings
  useEffect(() => {
    const loadEmailConfig = async () => {
      try {
        const settingKeys = [
          "email_sender_name", "email_sender_email", "email_reply_to",
          "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls",
          "dkim_selector", "dkim_private_key", "dkim_domain"
        ];
        
        const { data, error } = await supabase
          .from("app_settings")
          .select("setting_key, setting_value")
          .in("setting_key", settingKeys);

        if (error) throw error;

        if (data && data.length > 0) {
          const config: Partial<EmailConfig> = {};
          data.forEach((setting) => {
            switch (setting.setting_key) {
              case "email_sender_name": config.senderName = setting.setting_value; break;
              case "email_sender_email": config.senderEmail = setting.setting_value; break;
              case "email_reply_to": config.replyToEmail = setting.setting_value; break;
              case "smtp_host": config.smtpHost = setting.setting_value; break;
              case "smtp_port": config.smtpPort = setting.setting_value; break;
              case "smtp_username": config.smtpUsername = setting.setting_value; break;
              case "smtp_password": config.smtpPassword = setting.setting_value; break;
              case "smtp_tls": config.smtpTls = setting.setting_value === "true"; break;
              case "dkim_selector": config.dkimSelector = setting.setting_value; break;
              case "dkim_private_key": config.dkimPrivateKey = setting.setting_value; break;
              case "dkim_domain": config.dkimDomain = setting.setting_value; break;
            }
          });
          const newConfig = { ...emailConfig, ...config };
          setEmailConfig(newConfig);
          setConfigDraft(newConfig);
        }
      } catch (error) {
        console.error("Failed to load email config:", error);
      }
    };
    loadEmailConfig();
  }, []);

  const saveEmailConfig = async () => {
    setIsSavingConfig(true);
    try {
      const settings = [
        { setting_key: "email_sender_name", setting_value: configDraft.senderName.trim() },
        { setting_key: "email_sender_email", setting_value: configDraft.senderEmail.trim() },
        { setting_key: "email_reply_to", setting_value: configDraft.replyToEmail.trim() },
        { setting_key: "smtp_host", setting_value: configDraft.smtpHost.trim() },
        { setting_key: "smtp_port", setting_value: configDraft.smtpPort.trim() },
        { setting_key: "smtp_username", setting_value: configDraft.smtpUsername.trim() },
        { setting_key: "smtp_password", setting_value: configDraft.smtpPassword },
        { setting_key: "smtp_tls", setting_value: String(configDraft.smtpTls) },
        { setting_key: "dkim_selector", setting_value: configDraft.dkimSelector.trim() },
        { setting_key: "dkim_private_key", setting_value: configDraft.dkimPrivateKey },
        { setting_key: "dkim_domain", setting_value: configDraft.dkimDomain.trim() },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from("app_settings")
          .upsert(setting, { onConflict: "setting_key" });
        if (error) throw error;
      }

      setEmailConfig(configDraft);
      setIsEditingConfig(false);
      toast({
        title: "Settings saved",
        description: "Email configuration has been updated.",
      });
    } catch (error: any) {
      console.error("Failed to save email config:", error);
      toast({
        title: "Failed to save",
        description: error.message || "Could not save email configuration.",
        variant: "destructive",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const cancelEditConfig = () => {
    setConfigDraft(emailConfig);
    setIsEditingConfig(false);
    setShowSmtpPassword(false);
  };

  const generateDkimKeys = async () => {
    setIsGeneratingDkim(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quiz-results", {
        body: { action: "generate_dkim" },
      });

      if (error) throw error;

      if (data?.success && data.privateKey && data.selector) {
        setConfigDraft((prev) => ({
          ...prev,
          dkimSelector: data.selector,
          dkimPrivateKey: data.privateKey,
        }));
        toast({
          title: "DKIM keys generated",
          description: "Private key and selector have been generated. Don't forget to add the DNS record.",
        });
      } else {
        throw new Error(data?.error || "Failed to generate DKIM keys");
      }
    } catch (error: any) {
      console.error("DKIM generation failed:", error);
      toast({
        title: "Failed to generate DKIM",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDkim(false);
    }
  };

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
          message: "SMTP connection active",
          apiKeyConfigured: true,
          domains: data?.domains || [],
        });
        setSuccess({
          type: "connection",
          message: "Successfully connected to SMTP server",
        });
      } else {
        const errorMessage = data?.error || "SMTP not configured";
        setConnectionStatus({
          status: "error",
          lastChecked: new Date(),
          message: errorMessage,
          apiKeyConfigured: false,
          domains: [],
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
        domains: [],
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

          {/* Email Configuration - Always visible for setup */}
          <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Email Configuration</p>
                </div>
                {!isEditingConfig ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setIsEditingConfig(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={cancelEditConfig}
                      disabled={isSavingConfig}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={saveEmailConfig}
                      disabled={isSavingConfig}
                    >
                      {isSavingConfig ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {isEditingConfig ? (
                <div className="space-y-4">
                  {/* Basic Email Settings */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Basic Settings</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="senderName" className="text-xs">Sender Name</Label>
                      <Input
                        id="senderName"
                        value={configDraft.senderName}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, senderName: e.target.value }))}
                        placeholder="Your Company Name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="senderEmail" className="text-xs">Sender Email</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        value={configDraft.senderEmail}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, senderEmail: e.target.value }))}
                        placeholder="noreply@yourdomain.com"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="replyToEmail" className="text-xs">Reply-To Email (optional)</Label>
                      <Input
                        id="replyToEmail"
                        type="email"
                        value={configDraft.replyToEmail}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, replyToEmail: e.target.value }))}
                        placeholder="support@yourdomain.com"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* SMTP Settings */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SMTP Configuration</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure your SMTP server for sending emails.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpHost" className="text-xs">SMTP Host</Label>
                        <Input
                          id="smtpHost"
                          value={configDraft.smtpHost}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpHost: e.target.value }))}
                          placeholder="smtp.example.com"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpPort" className="text-xs">Port</Label>
                        <Input
                          id="smtpPort"
                          value={configDraft.smtpPort}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpPort: e.target.value }))}
                          placeholder="587"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpUsername" className="text-xs">Username</Label>
                      <Input
                        id="smtpUsername"
                        value={configDraft.smtpUsername}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpUsername: e.target.value }))}
                        placeholder="smtp-user@example.com"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPassword" className="text-xs">Password</Label>
                      <div className="relative">
                        <Input
                          id="smtpPassword"
                          type={showSmtpPassword ? "text" : "password"}
                          value={configDraft.smtpPassword}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpPassword: e.target.value }))}
                          placeholder="••••••••"
                          className="h-8 text-sm pr-8"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-8 px-2"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        >
                          {showSmtpPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="smtpTls" className="text-xs">Enable TLS/SSL</Label>
                      </div>
                      <Switch
                        id="smtpTls"
                        checked={configDraft.smtpTls}
                        onCheckedChange={(checked) => setConfigDraft((prev) => ({ ...prev, smtpTls: checked }))}
                      />
                    </div>
                  </div>

                  {/* DKIM Settings */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">DKIM Configuration (Optional)</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={generateDkimKeys}
                        disabled={isGeneratingDkim}
                      >
                        {isGeneratingDkim ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Key className="h-3 w-3 mr-1" />
                        )}
                        Generate Keys
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dkimDomain" className="text-xs">Domain</Label>
                      <Input
                        id="dkimDomain"
                        value={configDraft.dkimDomain}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimDomain: e.target.value }))}
                        placeholder="example.com"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dkimSelector" className="text-xs">Selector</Label>
                      <Input
                        id="dkimSelector"
                        value={configDraft.dkimSelector}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimSelector: e.target.value }))}
                        placeholder="mail"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dkimPrivateKey" className="text-xs">Private Key (PEM format)</Label>
                      <textarea
                        id="dkimPrivateKey"
                        value={configDraft.dkimPrivateKey}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimPrivateKey: e.target.value }))}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                        className="w-full h-20 text-xs font-mono p-2 rounded-md border bg-background resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Add DNS TXT record: <code className="bg-muted px-1 rounded">{configDraft.dkimSelector || "mail"}._domainkey.{configDraft.dkimDomain || "yourdomain.com"}</code>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Basic Settings Display */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Sender Name:</span>
                      <span className="font-medium">{emailConfig.senderName || "Not set"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Sender Email:</span>
                      <span className="font-mono">{emailConfig.senderEmail || "Not set"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Reply-To:</span>
                      <span className="font-mono">{emailConfig.replyToEmail || "Same as sender"}</span>
                    </div>
                  </div>

                  {/* SMTP Settings Display */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">SMTP</p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {emailConfig.smtpHost ? (
                        <>
                          <div className="flex justify-between items-center py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Host:</span>
                            <span className="font-mono">{emailConfig.smtpHost}:{emailConfig.smtpPort}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Username:</span>
                            <span className="font-mono">{emailConfig.smtpUsername || "Not set"}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-border/50">
                            <span className="text-muted-foreground">TLS:</span>
                            <Badge variant="outline" className={`text-xs px-1.5 py-0 ${emailConfig.smtpTls ? "bg-green-500/10 text-green-600" : "bg-muted"}`}>
                              {emailConfig.smtpTls ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground py-1">Not configured</p>
                      )}
                    </div>
                  </div>

                  {/* DKIM Settings Display */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">DKIM</p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {emailConfig.dkimDomain ? (
                        <>
                          <div className="flex justify-between items-center py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Domain:</span>
                            <span className="font-mono">{emailConfig.dkimDomain}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Selector:</span>
                            <span className="font-mono">{emailConfig.dkimSelector}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground">Private Key:</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-500/10 text-green-600">
                              Configured
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground py-1">Not configured</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          {/* SMTP Status */}
          {connectionStatus.status === "connected" && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">SMTP Status</p>
              </div>
              {connectionStatus.domains.length > 0 ? (
                <div className="space-y-1.5">
                  {connectionStatus.domains.map((domain, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                        <span className="font-mono text-xs">{domain.name}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20"
                      >
                        {domain.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  SMTP configured and ready to send emails
                </p>
              )}
            </div>
          )}

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

      {/* SMTP Configuration Warning */}
      {connectionStatus.status !== "connected" && !emailConfig.smtpHost && (
        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-sm text-amber-700 mb-2">
            SMTP not configured. Please set your SMTP host, username, and password in the configuration above.
          </p>
        </div>
      )}
    </div>
  );
}