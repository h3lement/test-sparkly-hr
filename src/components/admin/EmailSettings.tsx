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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { logActivity } from "@/hooks/useActivityLog";
import { DomainReputationMonitor } from "./DomainReputationMonitor";

import { Json } from "@/integrations/supabase/types";

interface Quiz {
  id: string;
  title: Json;
  slug: string;
  primary_language: string;
}

interface EmailTemplate {
  id: string;
  version_number: number;
  sender_name: string;
  sender_email: string;
  subjects: Json;
  is_live: boolean;
  created_at: string;
  quiz_id: string | null;
}

const EMAIL_TRANSLATIONS: Record<string, {
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  visitSparkly: string;
  leadershipOpenMindedness: string;
  openMindednessOutOf: string;
  sampleResultTitle: string;
  sampleResultDescription: string;
  sampleInsight1: string;
  sampleInsight2: string;
  sampleInsight3: string;
}> = {
  en: {
    yourResults: "Your Quiz Results",
    outOf: "out of",
    points: "points",
    keyInsights: "Key Insights",
    wantToImprove: "Want to improve your leadership skills?",
    visitSparkly: "Visit Sparkly.hr",
    leadershipOpenMindedness: "Leadership Open-Mindedness",
    openMindednessOutOf: "out of 5 points",
    sampleResultTitle: "Strategic Thinker",
    sampleResultDescription: "You demonstrate strong strategic thinking skills with a balanced approach to leadership challenges.",
    sampleInsight1: "You excel at long-term planning and vision setting",
    sampleInsight2: "Consider developing more agile decision-making processes",
    sampleInsight3: "Your analytical skills are a strong asset for the team",
  },
  et: {
    yourResults: "Sinu tulemused",
    outOf: "punktist",
    points: "punkti",
    keyInsights: "Peamised järeldused",
    wantToImprove: "Soovid oma juhtimisoskusi arendada?",
    visitSparkly: "Külasta Sparkly.hr",
    leadershipOpenMindedness: "Juhtimise avatus",
    openMindednessOutOf: "5 punktist",
    sampleResultTitle: "Strateegiline mõtleja",
    sampleResultDescription: "Näitad tugevaid strateegilise mõtlemise oskusi tasakaalustatud lähenemisega juhtimisprobleemidele.",
    sampleInsight1: "Oled tugev pikaajalises planeerimises ja visiooni seadmises",
    sampleInsight2: "Kaalu agiilsemate otsustusprotsesside arendamist",
    sampleInsight3: "Sinu analüütilised oskused on meeskonnale suureks varaks",
  },
};

interface DomainInfo {
  name: string;
  status: string;
  region: string;
}

interface SpfAnalysis {
  hasValidSyntax: boolean;
  includes: string[];
  policy: string | null;
  isStrict: boolean;
}

interface DkimAnalysis {
  hasValidSyntax: boolean;
  keyType: string | null;
  hasPublicKey: boolean;
}

interface DmarcAnalysis {
  hasValidSyntax: boolean;
  policy: string | null;
  subdomainPolicy: string | null;
  reportEmail: string | null;
  percentage: number | null;
  isStrict: boolean;
}

interface DnsValidation {
  spf: { 
    valid: boolean; 
    record: string | null; 
    allRecords?: string[];
    inUse: boolean;
    analysis?: SpfAnalysis | null;
  };
  dkim: { 
    valid: boolean; 
    configured: boolean; 
    inUse: boolean; 
    selector: string | null;
    record?: string | null;
    allRecords?: string[];
    analysis?: DkimAnalysis | null;
  };
  dmarc: { 
    valid: boolean; 
    record: string | null; 
    allRecords?: string[];
    inUse: boolean;
    analysis?: DmarcAnalysis | null;
  };
  domain?: string;
}

interface ConnectionStatus {
  status: "connected" | "disconnected" | "checking" | "error";
  lastChecked: Date | null;
  message: string;
  apiKeyConfigured: boolean;
  domains: DomainInfo[];
  dnsValidation?: DnsValidation;
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
  dkimPublicKey: string;
  dkimDnsRecord: string;
  // SPF settings
  spfIncludeDomains: string;
  spfPolicy: string;
  // DMARC settings
  dmarcPolicy: string;
  dmarcReportEmail: string;
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
    dkimPublicKey: "",
    dkimDnsRecord: "",
    spfIncludeDomains: "",
    spfPolicy: "~all",
    dmarcPolicy: "quarantine",
    dmarcReportEmail: "",
  });
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<EmailConfig>(emailConfig);
  const [isGeneratingDkim, setIsGeneratingDkim] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ lastSentAt: Date | null; emailsPerMinute: number }>({
    lastSentAt: null,
    emailsPerMinute: 1,
  });
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [isRefreshingDns, setIsRefreshingDns] = useState(false);
  const [lastDnsCheck, setLastDnsCheck] = useState<Date | null>(null);
  const [lastConfigUpdate, setLastConfigUpdate] = useState<{ timestamp: Date | null; userEmail: string | null }>({
    timestamp: null,
    userEmail: null,
  });
  
  // Quiz and template selection for test emails
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [allowedTestEmails, setAllowedTestEmails] = useState<string[]>([]);
  
  // DNS section collapse preferences
  interface DnsSectionPrefs {
    spfExpanded: boolean;
    dmarcExpanded: boolean;
    dkimExpanded: boolean;
  }
  const { preferences: dnsSectionPrefs, updatePreference: updateDnsPref } = useUserPreferences<DnsSectionPrefs>({
    key: "email_dns_sections",
    defaultValue: { spfExpanded: true, dmarcExpanded: true, dkimExpanded: true },
  });

  // Connection recheck settings preferences
  interface RecheckSettingsPrefs {
    fastReconnectAttempts: number;
    fastReconnectDelayMs: number;
    slowReconnectDelayMs: number;
    maxReconnectAttempts: number;
    autoReconnectEnabled: boolean;
    // Periodic health check interval
    intervalDays: number;
    intervalHours: number;
    intervalMinutes: number;
    periodicCheckEnabled: boolean;
  }
  const { preferences: recheckSettings, updatePreference: updateRecheckSetting, savePreferences: saveRecheckSettings } = useUserPreferences<RecheckSettingsPrefs>({
    key: "email_recheck_settings",
    defaultValue: {
      fastReconnectAttempts: 5,
      fastReconnectDelayMs: 3000,
      slowReconnectDelayMs: 30000,
      maxReconnectAttempts: 10,
      autoReconnectEnabled: true,
      intervalDays: 0,
      intervalHours: 1,
      intervalMinutes: 0,
      periodicCheckEnabled: true,
    },
  });
  const [showRecheckSettings, setShowRecheckSettings] = useState(false);
  
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const { toast } = useToast();

  // Calculate interval in milliseconds
  const getIntervalMs = useCallback(() => {
    const days = recheckSettings.intervalDays || 0;
    const hours = recheckSettings.intervalHours || 0;
    const minutes = recheckSettings.intervalMinutes || 0;
    return (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
  }, [recheckSettings.intervalDays, recheckSettings.intervalHours, recheckSettings.intervalMinutes]);

  // Format interval for display
  const formatInterval = useCallback(() => {
    const parts: string[] = [];
    if (recheckSettings.intervalDays > 0) {
      parts.push(`${recheckSettings.intervalDays}d`);
    }
    if (recheckSettings.intervalHours > 0) {
      parts.push(`${recheckSettings.intervalHours}h`);
    }
    if (recheckSettings.intervalMinutes > 0) {
      parts.push(`${recheckSettings.intervalMinutes}m`);
    }
    return parts.length > 0 ? parts.join(' ') : 'Not set';
  }, [recheckSettings.intervalDays, recheckSettings.intervalHours, recheckSettings.intervalMinutes]);

  // Fetch quizzes on mount
  useEffect(() => {
    const fetchQuizzes = async () => {
      setIsLoadingQuizzes(true);
      try {
        const { data, error } = await supabase
          .from("quizzes")
          .select("id, title, slug, primary_language")
          .order("display_order", { ascending: true });
        
        if (error) throw error;
        setQuizzes(data || []);
        
        // Auto-select first quiz if available
        if (data && data.length > 0 && !selectedQuizId) {
          setSelectedQuizId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch quizzes:", error);
      } finally {
        setIsLoadingQuizzes(false);
      }
    };
    fetchQuizzes();

    // Subscribe to realtime updates for quizzes
    const quizChannel = supabase
      .channel("quizzes-email-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quizzes" },
        () => fetchQuizzes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quizChannel);
    };
  }, []);

  // Fetch allowed test email addresses (sender email + admin emails)
  useEffect(() => {
    const fetchAllowedTestEmails = async () => {
      try {
        const emails = new Set<string>();

        // Add sender email from current config
        if (emailConfig.senderEmail) {
          emails.add(emailConfig.senderEmail.toLowerCase().trim());
        }

        // Fetch admin emails
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          const adminUserIds = adminRoles.map((r) => r.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("email")
            .in("user_id", adminUserIds);

          if (profiles) {
            profiles.forEach((p) => {
              if (p.email) {
                emails.add(p.email.toLowerCase().trim());
              }
            });
          }
        }

        setAllowedTestEmails(Array.from(emails));
      } catch (err) {
        console.error("Failed to fetch allowed test emails:", err);
      }
    };
    fetchAllowedTestEmails();
  }, [emailConfig.senderEmail]);

  // Check if current test email is allowed
  const isTestEmailAllowed = () => {
    if (!testEmail.trim()) return true;
    return allowedTestEmails.includes(testEmail.toLowerCase().trim());
  };

  // Fetch templates when quiz is selected
  useEffect(() => {
    if (!selectedQuizId) {
      setTemplates([]);
      setSelectedTemplateId("");
      return;
    }

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const { data, error } = await supabase
          .from("email_templates")
          .select("*")
          .eq("quiz_id", selectedQuizId)
          .order("version_number", { ascending: false });
        
        if (error) throw error;
        setTemplates(data || []);
        
        // Auto-select live template or first template
        const liveTemplate = data?.find(t => t.is_live);
        if (liveTemplate) {
          setSelectedTemplateId(liveTemplate.id);
        } else if (data && data.length > 0) {
          setSelectedTemplateId(data[0].id);
        } else {
          setSelectedTemplateId("");
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    fetchTemplates();

    // Subscribe to realtime updates for templates
    const templateChannel = supabase
      .channel(`templates-${selectedQuizId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_templates", filter: `quiz_id=eq.${selectedQuizId}` },
        () => fetchTemplates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(templateChannel);
    };
  }, [selectedQuizId]);

  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId) || null;
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  // Load email config from app_settings
  useEffect(() => {
    const loadEmailConfig = async () => {
      try {
        const settingKeys = [
          "email_sender_name", "email_sender_email", "email_reply_to",
          "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls",
          "dkim_selector", "dkim_private_key", "dkim_domain", "dkim_public_key", "dkim_dns_record",
          "spf_include_domains", "spf_policy", "dmarc_policy", "dmarc_report_email",
          "email_config_updated_at", "email_config_updated_by"
        ];
        
        const { data, error } = await supabase
          .from("app_settings")
          .select("setting_key, setting_value, updated_at")
          .in("setting_key", settingKeys);

        if (error) throw error;

        if (data && data.length > 0) {
          const config: Partial<EmailConfig> = {};
          let latestUpdate: { timestamp: Date | null; userEmail: string | null } = { timestamp: null, userEmail: null };
          
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
              case "dkim_public_key": config.dkimPublicKey = setting.setting_value; break;
              case "dkim_dns_record": config.dkimDnsRecord = setting.setting_value; break;
              case "spf_include_domains": config.spfIncludeDomains = setting.setting_value; break;
              case "spf_policy": config.spfPolicy = setting.setting_value; break;
              case "dmarc_policy": config.dmarcPolicy = setting.setting_value; break;
              case "dmarc_report_email": config.dmarcReportEmail = setting.setting_value; break;
              case "email_config_updated_at": 
                latestUpdate.timestamp = setting.setting_value ? new Date(setting.setting_value) : null; 
                break;
              case "email_config_updated_by": 
                latestUpdate.userEmail = setting.setting_value || null; 
                break;
            }
          });
          const newConfig = { ...emailConfig, ...config };
          setEmailConfig(newConfig);
          setConfigDraft(newConfig);
          setLastConfigUpdate(latestUpdate);
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
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || 'Unknown';
      const now = new Date().toISOString();
      
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
        { setting_key: "dkim_public_key", setting_value: configDraft.dkimPublicKey },
        { setting_key: "dkim_dns_record", setting_value: configDraft.dkimDnsRecord },
        { setting_key: "spf_include_domains", setting_value: configDraft.spfIncludeDomains.trim() },
        { setting_key: "spf_policy", setting_value: configDraft.spfPolicy },
        { setting_key: "dmarc_policy", setting_value: configDraft.dmarcPolicy },
        { setting_key: "dmarc_report_email", setting_value: configDraft.dmarcReportEmail.trim() },
        { setting_key: "email_config_updated_at", setting_value: now },
        { setting_key: "email_config_updated_by", setting_value: userEmail },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from("app_settings")
          .upsert(setting, { onConflict: "setting_key" });
        if (error) throw error;
      }

      setEmailConfig(configDraft);
      setIsEditingConfig(false);
      setLastConfigUpdate({ timestamp: new Date(now), userEmail });
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

  // Refresh DNS records only (without SMTP connection check)
  const refreshDnsRecords = async () => {
    setIsRefreshingDns(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quiz-results", {
        body: { action: "check_dns" },
      });

      if (error) throw error;

      if (data?.dnsValidation) {
        setConnectionStatus((prev) => ({
          ...prev,
          dnsValidation: data.dnsValidation,
        }));
        setLastDnsCheck(new Date());
        toast({
          title: "DNS refreshed",
          description: "DNS records have been re-validated.",
        });
      }
    } catch (error: any) {
      console.error("Failed to refresh DNS:", error);
      toast({
        title: "DNS refresh failed",
        description: error.message || "Could not refresh DNS records.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingDns(false);
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
          dkimPublicKey: data.publicKey || "",
          dkimDnsRecord: data.dnsRecord || "",
        }));
        toast({
          title: "DKIM keys generated",
          description: "Both private and public keys generated. Save to persist, then add DNS record.",
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

  // Helper functions for generating DNS records
  const getSpfRecord = useCallback(() => {
    const includes = configDraft.spfIncludeDomains || `_spf.${configDraft.smtpHost?.split('.').slice(-2).join('.') || 'yourmailserver.com'}`;
    const parts = includes.split(',').map(d => `include:${d.trim()}`).join(' ');
    return `v=spf1 ${parts} ${configDraft.spfPolicy || '~all'}`;
  }, [configDraft.spfIncludeDomains, configDraft.smtpHost, configDraft.spfPolicy]);

  const getDmarcRecord = useCallback(() => {
    const reportEmail = configDraft.dmarcReportEmail || `dmarc@${configDraft.dkimDomain || configDraft.senderEmail?.split('@')[1] || 'yourdomain.com'}`;
    return `v=DMARC1; p=${configDraft.dmarcPolicy || 'quarantine'}; rua=mailto:${reportEmail}`;
  }, [configDraft.dmarcReportEmail, configDraft.dkimDomain, configDraft.senderEmail, configDraft.dmarcPolicy]);

  const getDefaultSpfInclude = useCallback(() => {
    return `_spf.${configDraft.smtpHost?.split('.').slice(-2).join('.') || 'yourmailserver.com'}`;
  }, [configDraft.smtpHost]);

  const getDefaultDmarcEmail = useCallback(() => {
    return `dmarc@${configDraft.dkimDomain || configDraft.senderEmail?.split('@')[1] || 'yourdomain.com'}`;
  }, [configDraft.dkimDomain, configDraft.senderEmail]);

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

  const checkConnection = useCallback(async (silent = false, isPeriodicCheck = false) => {
    if (!silent) {
      setIsChecking(true);
    }
    setConnectionStatus((prev) => ({
      ...prev,
      status: "checking",
      message: "Checking connection...",
    }));

    const checkStartTime = new Date();
    let checkResult: { status: string; message: string; details?: string } = {
      status: "unknown",
      message: "Check in progress",
    };

    try {
      const { data, error } = await supabase.functions.invoke("send-quiz-results", {
        body: { action: "check_connection" },
      });

      if (error) {
        throw error;
      }

      if (data?.connected) {
        reconnectAttempts.current = 0;
        checkResult = {
          status: "connected",
          message: "SMTP connection active",
          details: `Domains: ${data?.domains?.map((d: any) => d.name).join(", ") || "none"}`,
        };
        setConnectionStatus({
          status: "connected",
          lastChecked: new Date(),
          message: "SMTP connection active",
          apiKeyConfigured: true,
          domains: data?.domains || [],
          dnsValidation: data?.dnsValidation,
        });
        setSuccess({
          type: "connection",
          message: "Successfully connected to SMTP server",
        });
      } else {
        const errorMessage = data?.error || "SMTP not configured";
        checkResult = {
          status: "error",
          message: errorMessage,
          details: data?.code ? `Error code: ${data.code}` : undefined,
        };
        setConnectionStatus({
          status: "error",
          lastChecked: new Date(),
          message: errorMessage,
          apiKeyConfigured: false,
          domains: [],
          dnsValidation: data?.dnsValidation,
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
      checkResult = {
        status: "failed",
        message: errorMessage,
        details: error.code ? `Error code: ${error.code}` : undefined,
      };
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

      // Log SMTP check to activity log
      const checkType = isPeriodicCheck ? "Periodic" : silent ? "Auto-retry" : "Manual";
      const checkDuration = Date.now() - checkStartTime.getTime();
      
      logActivity({
        actionType: "STATUS_CHANGE",
        tableName: "smtp_connection",
        recordId: "smtp_check",
        fieldName: "connection_status",
        oldValue: null,
        newValue: checkResult.status,
        description: `${checkType} SMTP check: ${checkResult.message}${checkResult.details ? ` (${checkResult.details})` : ""} - took ${checkDuration}ms`,
      });
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!recheckSettings.autoReconnectEnabled) {
      return;
    }
    
    if (reconnectAttempts.current >= recheckSettings.maxReconnectAttempts) {
      setConnectionStatus((prev) => ({
        ...prev,
        status: "disconnected",
        message: `Connection failed after ${recheckSettings.maxReconnectAttempts} attempts. Click refresh to try again.`,
      }));
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectAttempts.current += 1;
    
    // Use fast delay for first N attempts, then slow delay
    const isFastPhase = reconnectAttempts.current <= recheckSettings.fastReconnectAttempts;
    const baseDelay = isFastPhase ? recheckSettings.fastReconnectDelayMs : recheckSettings.slowReconnectDelayMs;
    const delay = isFastPhase ? baseDelay : baseDelay * (reconnectAttempts.current - recheckSettings.fastReconnectAttempts);

    setConnectionStatus((prev) => ({
      ...prev,
      message: `Reconnecting in ${Math.ceil(delay / 1000)}s (attempt ${reconnectAttempts.current}/${recheckSettings.maxReconnectAttempts})...`,
    }));

    reconnectTimerRef.current = setTimeout(() => {
      checkConnection(true);
    }, delay);
  }, [checkConnection, recheckSettings]);

  // Rate limit countdown effect
  useEffect(() => {
    if (rateLimitCountdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setRateLimitCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [rateLimitCountdown]);

  useEffect(() => {
    checkConnection();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [checkConnection]);

  // Periodic health check interval
  useEffect(() => {
    if (periodicCheckTimerRef.current) {
      clearInterval(periodicCheckTimerRef.current);
    }

    if (!recheckSettings.periodicCheckEnabled) {
      return;
    }

    const intervalMs = getIntervalMs();
    if (intervalMs < 60000) { // Minimum 1 minute
      return;
    }

    periodicCheckTimerRef.current = setInterval(() => {
      console.log(`Periodic connection health check (interval: ${formatInterval()})...`);
      checkConnection(true, true); // silent=true, isPeriodicCheck=true
    }, intervalMs);

    return () => {
      if (periodicCheckTimerRef.current) {
        clearInterval(periodicCheckTimerRef.current);
      }
    };
  }, [recheckSettings.periodicCheckEnabled, getIntervalMs, checkConnection]);

  const canSendEmail = useCallback(() => {
    if (!rateLimitInfo.lastSentAt) return true;
    const cooldownMs = (60 / rateLimitInfo.emailsPerMinute) * 1000;
    const timeSinceLastSend = Date.now() - rateLimitInfo.lastSentAt.getTime();
    return timeSinceLastSend >= cooldownMs;
  }, [rateLimitInfo]);

  const getRateLimitWaitTime = useCallback(() => {
    if (!rateLimitInfo.lastSentAt) return 0;
    const cooldownMs = (60 / rateLimitInfo.emailsPerMinute) * 1000;
    const timeSinceLastSend = Date.now() - rateLimitInfo.lastSentAt.getTime();
    return Math.max(0, Math.ceil((cooldownMs - timeSinceLastSend) / 1000));
  }, [rateLimitInfo]);

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (!isTestEmailAllowed()) {
      toast({
        title: "Restricted",
        description: `Test emails can only be sent to admin accounts or the sender email (${emailConfig.senderEmail})`,
        variant: "destructive",
      });
      return;
    }

    // Check rate limit
    if (!canSendEmail()) {
      const waitTime = getRateLimitWaitTime();
      toast({
        title: "Rate limited",
        description: `Please wait ${waitTime} seconds before sending another email`,
        variant: "destructive",
      });
      setRateLimitCountdown(waitTime);
      return;
    }

    // Ensure connection before sending - check directly without relying on state
    if (connectionStatus.status !== "connected") {
      toast({
        title: "Not connected",
        description: "Please connect to SMTP server first by clicking the refresh button.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      if (!selectedTemplate) {
        throw new Error("No template selected");
      }
      
      const trans = EMAIL_TRANSLATIONS[selectedQuiz?.primary_language || "en"] || EMAIL_TRANSLATIONS.en;
      const subjects = selectedTemplate.subjects as Record<string, string>;
      
      const testData = {
        email: testEmail.trim(),
        totalScore: 18,
        maxScore: 24,
        resultTitle: trans.sampleResultTitle,
        resultDescription: trans.sampleResultDescription,
        insights: [
          trans.sampleInsight1,
          trans.sampleInsight2,
          trans.sampleInsight3,
        ],
        language: selectedQuiz?.primary_language || "en",
        opennessScore: 3,
        isTest: true,
        templateOverride: {
          sender_name: selectedTemplate.sender_name,
          sender_email: selectedTemplate.sender_email,
          subject: subjects[selectedQuiz?.primary_language || "en"] || subjects.en || "Your Quiz Results",
        },
      };

      const { data, error } = await supabase.functions.invoke("send-quiz-results", {
        body: testData,
      });

      if (error) throw error;

      if (data?.success) {
        const quizTitle = getQuizTitle(selectedQuiz);
        
        // Update rate limit info
        setRateLimitInfo((prev) => ({ ...prev, lastSentAt: new Date() }));
        const cooldownSeconds = Math.ceil(60 / rateLimitInfo.emailsPerMinute);
        setRateLimitCountdown(cooldownSeconds);
        
        toast({
          title: "Test email sent",
          description: `Template v${selectedTemplate.version_number} for "${quizTitle}" sent to ${testEmail}`,
        });
        setSuccess({
          type: "send",
          message: `Test email sent to ${testEmail}`,
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

  const getQuizTitle = (quiz: Quiz | null): string => {
    if (!quiz) return "";
    const title = quiz.title as Record<string, string>;
    return title?.en || title?.et || quiz.slug || "";
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
    <div className="space-y-3">
      {/* Header Row: Status + Test Email */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
        {/* Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
          connectionStatus.status === "connected" 
            ? "bg-green-500/10 text-green-700" 
            : connectionStatus.status === "error" 
              ? "bg-amber-500/10 text-amber-700"
              : connectionStatus.status === "checking"
                ? "bg-muted text-muted-foreground"
                : "bg-red-500/10 text-red-700"
        }`}>
          {connectionStatus.status === "connected" ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : connectionStatus.status === "checking" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : connectionStatus.status === "error" ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">
            {connectionStatus.status === "connected" ? "Connected" : 
             connectionStatus.status === "checking" ? "Checking..." :
             connectionStatus.status === "error" ? "Error" : "Disconnected"}
          </span>
        </div>

        {/* Reconnect info */}
        {reconnectAttempts.current > 0 && reconnectAttempts.current < recheckSettings.maxReconnectAttempts && connectionStatus.status !== "connected" && (
          <span className="text-xs text-muted-foreground">
            Retry {reconnectAttempts.current}/{recheckSettings.maxReconnectAttempts}
          </span>
        )}

        <div className="flex-1" />

        {/* Test Email Controls - Quiz and Template Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quiz Selection */}
          <Select 
            value={selectedQuizId} 
            onValueChange={setSelectedQuizId}
            disabled={isLoadingQuizzes}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              {isLoadingQuizzes ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <SelectValue placeholder="Select quiz" />
              )}
            </SelectTrigger>
            <SelectContent>
              {quizzes.map((quiz) => (
                <SelectItem key={quiz.id} value={quiz.id}>
                  {getQuizTitle(quiz)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Template Selection */}
          <Select 
            value={selectedTemplateId} 
            onValueChange={setSelectedTemplateId}
            disabled={!selectedQuizId || isLoadingTemplates}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              {isLoadingTemplates ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <SelectValue placeholder="Template" />
              )}
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <SelectItem value="_none" disabled>No templates</SelectItem>
              ) : (
                templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    v{template.version_number}{template.is_live ? " ★" : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Preview Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => setShowPreviewDialog(true)}
            disabled={!selectedTemplate}
            title="Preview template"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>

          {/* Email Input */}
          <Input
            type="email"
            placeholder="test@email.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="w-[160px] h-8 text-sm"
            disabled={connectionStatus.status !== "connected"}
          />

          {/* Send Button */}
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={sendTestEmail}
            disabled={isSending || connectionStatus.status !== "connected" || !testEmail.trim() || !selectedTemplate || rateLimitCountdown > 0}
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : rateLimitCountdown > 0 ? (
              <span className="text-xs">{rateLimitCountdown}s</span>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send
              </>
            )}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={handleManualReconnect}
            disabled={isChecking}
            title="Refresh connection"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Rate Limit Warning */}
      {rateLimitCountdown > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 bg-amber-500/5 border border-amber-500/20 rounded-md">
          <AlertTriangle className="h-3 w-3" />
          Rate limit: Wait {rateLimitCountdown}s before next send
        </div>
      )}

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        template={selectedTemplate ? {
          ...selectedTemplate,
          subjects: selectedTemplate.subjects as Record<string, string>
        } : null}
        quiz={selectedQuiz ? {
          ...selectedQuiz,
          title: selectedQuiz.title as Record<string, string>
        } : null}
        defaultEmail={testEmail}
        emailTranslations={EMAIL_TRANSLATIONS}
      />

      {/* Success/Error Messages - Compact */}
      {lastSuccess && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-green-700 bg-green-500/5 border border-green-500/20 rounded-md">
          <CheckCircle2 className="h-3 w-3" />
          {lastSuccess.message}
          <span className="text-green-600/60 ml-auto">{formatTime(lastSuccess.timestamp)}</span>
        </div>
      )}

      {errors.length > 0 && (
        <div className="px-3 py-2 bg-destructive/5 border border-destructive/20 rounded-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-destructive">Errors ({errors.length})</span>
            <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={clearErrors}>
              Clear
            </Button>
          </div>
          <div className="space-y-1 max-h-[80px] overflow-y-auto">
            {errors.slice(0, 2).map((error, index) => (
              <div key={index} className="flex items-start gap-2 text-xs text-destructive">
                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="truncate">{error.details || error.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content: Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: SMTP Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">SMTP Configuration</h3>
            {!isEditingConfig ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditingConfig(true)}
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Configure
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEditConfig} disabled={isSavingConfig}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={saveEmailConfig} disabled={isSavingConfig}>
                  {isSavingConfig ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
                </Button>
              </div>
            )}
          </div>

          {isEditingConfig ? (
            <div className="space-y-4 p-4 rounded-lg border bg-background">
              {/* Basic Settings */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sender Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={configDraft.senderName}
                      onChange={(e) => setConfigDraft((prev) => ({ ...prev, senderName: e.target.value }))}
                      placeholder="Company Name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={configDraft.senderEmail}
                      onChange={(e) => setConfigDraft((prev) => ({ ...prev, senderEmail: e.target.value }))}
                      placeholder="noreply@domain.com"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reply-To (optional)</Label>
                  <Input
                    type="email"
                    value={configDraft.replyToEmail}
                    onChange={(e) => setConfigDraft((prev) => ({ ...prev, replyToEmail: e.target.value }))}
                    placeholder="support@domain.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* SMTP Settings */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SMTP Server</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Host</Label>
                    <Input
                      value={configDraft.smtpHost}
                      onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpHost: e.target.value }))}
                      placeholder="smtp.example.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Port</Label>
                    <Input
                      value={configDraft.smtpPort}
                      onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpPort: e.target.value }))}
                      placeholder="587"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Username</Label>
                    <Input
                      value={configDraft.smtpUsername}
                      onChange={(e) => setConfigDraft((prev) => ({ ...prev, smtpUsername: e.target.value }))}
                      placeholder="user@example.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Input
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
                </div>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">TLS/SSL</Label>
                  </div>
                  <Switch
                    checked={configDraft.smtpTls}
                    onCheckedChange={(checked) => setConfigDraft((prev) => ({ ...prev, smtpTls: checked }))}
                  />
                </div>
              </div>

              {/* DNS Records Section */}
              <div className="space-y-4 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">DNS Records</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={refreshDnsRecords}
                    disabled={isRefreshingDns}
                  >
                    {isRefreshingDns ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Refresh DNS
                  </Button>
                </div>
                
                {/* DNS Check Status & Propagation Info */}
                {lastDnsCheck && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Last checked: {lastDnsCheck.toLocaleTimeString()}</span>
                    {(!connectionStatus.dnsValidation?.spf.valid || 
                      !connectionStatus.dnsValidation?.dmarc.valid || 
                      (connectionStatus.dnsValidation?.dkim.configured && !connectionStatus.dnsValidation?.dkim.valid)) && (
                      <span className="text-amber-600">• DNS changes can take up to 48-72 hours to propagate</span>
                    )}
                  </div>
                )}

                {/* SPF Record */}
                <Collapsible 
                  open={dnsSectionPrefs.spfExpanded} 
                  onOpenChange={(open) => updateDnsPref("spfExpanded", open)}
                  className={`rounded-lg border ${connectionStatus.dnsValidation?.spf.valid ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-2">
                        {dnsSectionPrefs.spfExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {connectionStatus.dnsValidation?.spf.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                        )}
                        <span className={`text-xs font-medium ${connectionStatus.dnsValidation?.spf.valid ? 'text-green-700' : 'text-amber-700'}`}>
                          SPF Record {connectionStatus.dnsValidation?.spf.valid ? 'Valid' : 'Missing'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(getSpfRecord());
                          toast({ title: "Copied!", description: "SPF record copied to clipboard." });
                        }}
                      >
                        Copy Suggested
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      SPF (Sender Policy Framework) tells receiving servers which IPs can send email for your domain.
                    </p>
                    
                    {/* Show current DNS record if found */}
                    {connectionStatus.dnsValidation?.spf.valid && connectionStatus.dnsValidation.spf.record && (
                      <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-green-700">Current DNS Record:</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-xs text-green-700"
                            onClick={() => {
                              navigator.clipboard.writeText(connectionStatus.dnsValidation?.spf.record || '');
                              toast({ title: "Copied!", description: "Current SPF record copied." });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="p-2 bg-background rounded text-xs font-mono break-all border">
                          {connectionStatus.dnsValidation.spf.record}
                        </div>
                        {connectionStatus.dnsValidation.spf.analysis && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-muted-foreground">Policy:</div>
                            <div className="font-medium">
                              {connectionStatus.dnsValidation.spf.analysis.policy || 'Not set'}
                              {connectionStatus.dnsValidation.spf.analysis.isStrict && (
                                <Badge variant="outline" className="ml-1 text-xs px-1 py-0 bg-green-500/10 text-green-600">Strict</Badge>
                              )}
                            </div>
                            {connectionStatus.dnsValidation.spf.analysis.includes.length > 0 && (
                              <>
                                <div className="text-muted-foreground">Includes:</div>
                                <div className="font-mono text-xs break-all">
                                  {connectionStatus.dnsValidation.spf.analysis.includes.join(', ')}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {(connectionStatus.dnsValidation.spf.allRecords?.length || 0) > 1 && (
                          <div className="flex items-start gap-1 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700">
                              Warning: {connectionStatus.dnsValidation.spf.allRecords?.length} SPF records found. Only one should exist.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Include Domains (comma-separated)</Label>
                        <Input
                          value={configDraft.spfIncludeDomains}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, spfIncludeDomains: e.target.value }))}
                          placeholder={getDefaultSpfInclude()}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Policy</Label>
                        <Select
                          value={configDraft.spfPolicy || "~all"}
                          onValueChange={(value) => setConfigDraft((prev) => ({ ...prev, spfPolicy: value }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="~all">~all (Soft Fail)</SelectItem>
                            <SelectItem value="-all">-all (Hard Fail)</SelectItem>
                            <SelectItem value="?all">?all (Neutral)</SelectItem>
                            <SelectItem value="+all">+all (Pass All)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Suggested Record:</p>
                      <div className="p-2 bg-background rounded text-xs font-mono break-all border">
                        {getSpfRecord()}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      Host: @ (or your domain) • Type: TXT
                    </p>
                  </CollapsibleContent>
                </Collapsible>

                {/* DMARC Record */}
                <Collapsible 
                  open={dnsSectionPrefs.dmarcExpanded} 
                  onOpenChange={(open) => updateDnsPref("dmarcExpanded", open)}
                  className={`rounded-lg border ${connectionStatus.dnsValidation?.dmarc.valid ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-2">
                        {dnsSectionPrefs.dmarcExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {connectionStatus.dnsValidation?.dmarc.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                        )}
                        <span className={`text-xs font-medium ${connectionStatus.dnsValidation?.dmarc.valid ? 'text-green-700' : 'text-amber-700'}`}>
                          DMARC Record {connectionStatus.dnsValidation?.dmarc.valid ? 'Valid' : 'Missing'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(getDmarcRecord());
                          toast({ title: "Copied!", description: "DMARC record copied to clipboard." });
                        }}
                      >
                        Copy Suggested
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      DMARC (Domain-based Message Authentication) protects against email spoofing.
                    </p>
                    
                    {/* Show current DNS record if found */}
                    {connectionStatus.dnsValidation?.dmarc.valid && connectionStatus.dnsValidation.dmarc.record && (
                      <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-green-700">Current DNS Record:</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-xs text-green-700"
                            onClick={() => {
                              navigator.clipboard.writeText(connectionStatus.dnsValidation?.dmarc.record || '');
                              toast({ title: "Copied!", description: "Current DMARC record copied." });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="p-2 bg-background rounded text-xs font-mono break-all border">
                          {connectionStatus.dnsValidation.dmarc.record}
                        </div>
                        {connectionStatus.dnsValidation.dmarc.analysis && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-muted-foreground">Policy:</div>
                            <div className="font-medium">
                              {connectionStatus.dnsValidation.dmarc.analysis.policy || 'Not set'}
                              {connectionStatus.dnsValidation.dmarc.analysis.isStrict && (
                                <Badge variant="outline" className="ml-1 text-xs px-1 py-0 bg-green-500/10 text-green-600">Strict</Badge>
                              )}
                            </div>
                            {connectionStatus.dnsValidation.dmarc.analysis.subdomainPolicy && (
                              <>
                                <div className="text-muted-foreground">Subdomain Policy:</div>
                                <div className="font-medium">{connectionStatus.dnsValidation.dmarc.analysis.subdomainPolicy}</div>
                              </>
                            )}
                            {connectionStatus.dnsValidation.dmarc.analysis.reportEmail && (
                              <>
                                <div className="text-muted-foreground">Reports to:</div>
                                <div className="font-mono text-xs break-all">{connectionStatus.dnsValidation.dmarc.analysis.reportEmail}</div>
                              </>
                            )}
                            <div className="text-muted-foreground">Percentage:</div>
                            <div className="font-medium">{connectionStatus.dnsValidation.dmarc.analysis.percentage}%</div>
                          </div>
                        )}
                        {(connectionStatus.dnsValidation.dmarc.allRecords?.length || 0) > 1 && (
                          <div className="flex items-start gap-1 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700">
                              Warning: {connectionStatus.dnsValidation.dmarc.allRecords?.length} DMARC records found. Only one should exist.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Policy</Label>
                        <Select
                          value={configDraft.dmarcPolicy || "quarantine"}
                          onValueChange={(value) => setConfigDraft((prev) => ({ ...prev, dmarcPolicy: value }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none (Monitor Only)</SelectItem>
                            <SelectItem value="quarantine">quarantine (Mark as Spam)</SelectItem>
                            <SelectItem value="reject">reject (Block)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Report Email</Label>
                        <Input
                          value={configDraft.dmarcReportEmail}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, dmarcReportEmail: e.target.value }))}
                          placeholder={getDefaultDmarcEmail()}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Suggested Record:</p>
                      <div className="p-2 bg-background rounded text-xs font-mono break-all border">
                        {getDmarcRecord()}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      Host: _dmarc • Type: TXT
                    </p>
                  </CollapsibleContent>
                </Collapsible>

                {/* DKIM Record */}
                <Collapsible 
                  open={dnsSectionPrefs.dkimExpanded} 
                  onOpenChange={(open) => updateDnsPref("dkimExpanded", open)}
                  className={`rounded-lg border ${connectionStatus.dnsValidation?.dkim.valid ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'}`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-2">
                        {dnsSectionPrefs.dkimExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {connectionStatus.dnsValidation?.dkim.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <p className={`text-xs font-medium uppercase tracking-wide ${connectionStatus.dnsValidation?.dkim.valid ? 'text-green-700' : 'text-muted-foreground'}`}>
                          DKIM {connectionStatus.dnsValidation?.dkim.valid ? 'Valid' : '(Optional)'}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 px-2 text-xs" 
                        onClick={(e) => {
                          e.stopPropagation();
                          generateDkimKeys();
                        }} 
                        disabled={isGeneratingDkim}
                      >
                        {isGeneratingDkim ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3 mr-1" />}
                        {configDraft.dkimPrivateKey ? 'Regenerate' : 'Generate'}
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      DKIM (DomainKeys Identified Mail) adds a digital signature to emails, proving they haven't been altered. Click "Generate" to create keys, then add the public key to your DNS.
                    </p>

                    {/* Show current DNS record if found */}
                    {connectionStatus.dnsValidation?.dkim.valid && connectionStatus.dnsValidation.dkim.record && (
                      <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-green-700">Current DNS Record:</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-xs text-green-700"
                            onClick={() => {
                              navigator.clipboard.writeText(connectionStatus.dnsValidation?.dkim.record || '');
                              toast({ title: "Copied!", description: "Current DKIM record copied." });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="p-2 bg-background rounded text-xs font-mono break-all border max-h-20 overflow-y-auto">
                          {connectionStatus.dnsValidation.dkim.record}
                        </div>
                        {connectionStatus.dnsValidation.dkim.analysis && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-muted-foreground">Key Type:</div>
                            <div className="font-medium">{connectionStatus.dnsValidation.dkim.analysis.keyType || 'RSA'}</div>
                            <div className="text-muted-foreground">Public Key:</div>
                            <div>
                              {connectionStatus.dnsValidation.dkim.analysis.hasPublicKey ? (
                                <Badge variant="outline" className="text-xs px-1 py-0 bg-green-500/10 text-green-600">Present</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs px-1 py-0 bg-amber-500/10 text-amber-600">Missing</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show warning if DKIM is configured but DNS not found */}
                    {configDraft.dkimPrivateKey && configDraft.dkimSelector && configDraft.dkimDomain && !connectionStatus.dnsValidation?.dkim.valid && (
                      <div className="flex items-start gap-1 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                        <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">
                          DKIM keys are configured locally but no matching DNS record found at {configDraft.dkimSelector}._domainkey.{configDraft.dkimDomain}. Add the DNS record below.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Domain</Label>
                        <Input
                          value={configDraft.dkimDomain}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimDomain: e.target.value }))}
                          placeholder="example.com"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Selector</Label>
                        <Input
                          value={configDraft.dkimSelector}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimSelector: e.target.value }))}
                          placeholder="mail"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Private Key (stored securely, never exposed)</Label>
                        {configDraft.dkimPrivateKey && !configDraft.dkimPublicKey && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Missing public key
                          </span>
                        )}
                      </div>
                      <textarea
                        value={configDraft.dkimPrivateKey}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimPrivateKey: e.target.value }))}
                        placeholder="-----BEGIN RSA PRIVATE KEY----- (Use 'Generate' button above to create a new key pair)"
                        className="w-full h-16 text-xs font-mono p-2 rounded-md border bg-background resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Use the "Generate" button to create a matching key pair. If you paste a private key manually, you must also provide the public key below.
                      </p>
                    </div>

                    {/* Public Key Field - Always visible when private key exists */}
                    {configDraft.dkimPrivateKey && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Public Key (for DNS record)</Label>
                          {configDraft.dkimPublicKey && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(configDraft.dkimPublicKey);
                                toast({ title: "Copied!", description: "Public key copied to clipboard." });
                              }}
                            >
                              Copy
                            </Button>
                          )}
                        </div>
                        <textarea
                          value={configDraft.dkimPublicKey}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, dkimPublicKey: e.target.value }))}
                          placeholder="Base64-encoded public key (without headers)"
                          className="w-full h-16 text-xs font-mono p-2 rounded-md border bg-background resize-none"
                        />
                        {!configDraft.dkimPublicKey && (
                          <div className="flex items-start gap-1 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700">
                              <strong>Public key required:</strong> If you pasted a private key from another source, you must also paste the corresponding public key here. 
                              It's cryptographically impossible to derive the public key from the private key in the browser. 
                              Use "Generate" to create a new matching pair.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {configDraft.dkimSelector && configDraft.dkimDomain && (
                      <div className="p-3 bg-muted rounded-lg space-y-2 border">
                        <p className="text-xs font-medium text-foreground">DNS Record to Add:</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Host (Name):</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(`${configDraft.dkimSelector}._domainkey.${configDraft.dkimDomain}`);
                                toast({ title: "Copied!", description: "Host name copied to clipboard." });
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                          <div className="p-2 bg-background rounded text-xs font-mono break-all border">
                            {configDraft.dkimSelector}._domainkey.{configDraft.dkimDomain}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Type: <span className="font-medium text-foreground">TXT</span></p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Value (paste this entire string):</p>
                            {(configDraft.dkimDnsRecord || configDraft.dkimPublicKey) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  const dnsValue = configDraft.dkimDnsRecord || `v=DKIM1; k=rsa; p=${configDraft.dkimPublicKey}`;
                                  navigator.clipboard.writeText(dnsValue);
                                  toast({ title: "Copied!", description: "DNS record value copied to clipboard." });
                                }}
                              >
                                Copy
                              </Button>
                            )}
                          </div>
                          {configDraft.dkimDnsRecord ? (
                            <div className="p-2 bg-background rounded text-xs font-mono break-all border max-h-24 overflow-y-auto">
                              {configDraft.dkimDnsRecord}
                            </div>
                          ) : configDraft.dkimPublicKey ? (
                            <div className="p-2 bg-background rounded text-xs font-mono break-all border max-h-24 overflow-y-auto">
                              v=DKIM1; k=rsa; p={configDraft.dkimPublicKey}
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 italic">
                              Click "Generate" to create keys, or enter the public key above to see the DNS record.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
                
                {/* All Valid Message */}
                {connectionStatus.dnsValidation?.spf.valid && 
                 connectionStatus.dnsValidation?.dmarc.valid && 
                 (connectionStatus.dnsValidation?.dkim.valid || !configDraft.dkimPrivateKey) && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">All DNS records are properly configured!</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg border bg-background space-y-3">
              {/* Sender Info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-muted-foreground">Sender Name</div>
                <div className="font-medium truncate">{emailConfig.senderName || "—"}</div>
                <div className="text-muted-foreground">Sender Email</div>
                <div className="font-mono truncate">{emailConfig.senderEmail || "—"}</div>
                <div className="text-muted-foreground">Reply-To</div>
                <div className="font-mono truncate">{emailConfig.replyToEmail || "Same as sender"}</div>
              </div>

              {/* SMTP */}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">SMTP</span>
                </div>
                {emailConfig.smtpHost ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">Server</div>
                    <div className="font-mono truncate">{emailConfig.smtpHost}:{emailConfig.smtpPort}</div>
                    <div className="text-muted-foreground">Username</div>
                    <div className="font-mono truncate">{emailConfig.smtpUsername || "—"}</div>
                    <div className="text-muted-foreground">TLS</div>
                    <div>
                      <Badge variant="outline" className={`text-xs px-1 py-0 ${emailConfig.smtpTls ? "bg-green-500/10 text-green-600" : ""}`}>
                        {emailConfig.smtpTls ? "On" : "Off"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Not configured</p>
                )}
              </div>

              {/* DKIM */}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">DKIM</span>
                </div>
                {emailConfig.dkimDomain ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">Domain</div>
                    <div className="font-mono truncate">{emailConfig.dkimDomain}</div>
                    <div className="text-muted-foreground">Selector</div>
                    <div className="font-mono">{emailConfig.dkimSelector}</div>
                    <div className="text-muted-foreground">Key</div>
                    <div><Badge variant="outline" className="text-xs px-1 py-0 bg-green-500/10 text-green-600">Set</Badge></div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Not configured</p>
                )}
              </div>
            </div>
          )}
          
          {/* Last Update Info - Outside the block */}
          {lastConfigUpdate.timestamp && (
            <div className="text-xs text-muted-foreground text-left mt-2">
              Last updated: {lastConfigUpdate.timestamp.toLocaleString()}
              {lastConfigUpdate.userEmail && <span> by {lastConfigUpdate.userEmail}</span>}
            </div>
          )}
        </div>

        {/* Right: Connection Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Connection Status</h3>
            <Collapsible open={showRecheckSettings} onOpenChange={setShowRecheckSettings}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Recheck Settings
                  {showRecheckSettings ? (
                    <ChevronDown className="h-3 w-3 ml-1" />
                  ) : (
                    <ChevronRight className="h-3 w-3 ml-1" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          {/* Recheck Settings Panel - pushes content down when open */}
          <Collapsible open={showRecheckSettings} onOpenChange={setShowRecheckSettings}>
            <CollapsibleContent className="p-3 rounded-lg border border-border bg-card space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Auto Reconnect</Label>
                    <p className="text-[10px] text-muted-foreground">Automatically retry on connection failure</p>
                  </div>
                  <Switch
                    checked={recheckSettings.autoReconnectEnabled}
                    onCheckedChange={(checked) => updateRecheckSetting("autoReconnectEnabled", checked)}
                  />
                </div>

                {recheckSettings.autoReconnectEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Fast Retry Count</Label>
                        <Select
                          value={String(recheckSettings.fastReconnectAttempts)}
                          onValueChange={(val) => updateRecheckSetting("fastReconnectAttempts", parseInt(val))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 7, 10].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n} attempts</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Quick retries before slowing down</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Attempts</Label>
                        <Select
                          value={String(recheckSettings.maxReconnectAttempts)}
                          onValueChange={(val) => updateRecheckSetting("maxReconnectAttempts", parseInt(val))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 10, 15, 20, 30, 50].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n} total</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Stop after this many failures</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Fast Delay</Label>
                        <Select
                          value={String(recheckSettings.fastReconnectDelayMs)}
                          onValueChange={(val) => updateRecheckSetting("fastReconnectDelayMs", parseInt(val))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1000">1 second</SelectItem>
                            <SelectItem value="2000">2 seconds</SelectItem>
                            <SelectItem value="3000">3 seconds</SelectItem>
                            <SelectItem value="5000">5 seconds</SelectItem>
                            <SelectItem value="10000">10 seconds</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Delay between fast retries</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Slow Delay</Label>
                        <Select
                          value={String(recheckSettings.slowReconnectDelayMs)}
                          onValueChange={(val) => updateRecheckSetting("slowReconnectDelayMs", parseInt(val))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10000">10 seconds</SelectItem>
                            <SelectItem value="20000">20 seconds</SelectItem>
                            <SelectItem value="30000">30 seconds</SelectItem>
                            <SelectItem value="60000">1 minute</SelectItem>
                            <SelectItem value="120000">2 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Delay after fast phase</p>
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground pt-2 border-t">
                      <p><strong>Failure retry:</strong> {recheckSettings.fastReconnectAttempts} fast retries at {recheckSettings.fastReconnectDelayMs / 1000}s intervals, 
                      then slower retries at {recheckSettings.slowReconnectDelayMs / 1000}s (max {recheckSettings.maxReconnectAttempts} total attempts)</p>
                    </div>
                  </>
                )}

                {/* Periodic Health Check Interval */}
                <div className="pt-3 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-medium">Periodic Health Check</Label>
                      <p className="text-[10px] text-muted-foreground">Automatically verify connection at intervals</p>
                    </div>
                    <Switch
                      checked={recheckSettings.periodicCheckEnabled}
                      onCheckedChange={(checked) => updateRecheckSetting("periodicCheckEnabled", checked)}
                    />
                  </div>

                  {recheckSettings.periodicCheckEnabled && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Check Interval</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Select
                              value={String(recheckSettings.intervalDays || 0)}
                              onValueChange={(val) => updateRecheckSetting("intervalDays", parseInt(val))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 7, 14, 30].map((n) => (
                                  <SelectItem key={n} value={String(n)}>{n} days</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Select
                              value={String(recheckSettings.intervalHours || 0)}
                              onValueChange={(val) => updateRecheckSetting("intervalHours", parseInt(val))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 6, 8, 12, 24].map((n) => (
                                  <SelectItem key={n} value={String(n)}>{n} hrs</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Select
                              value={String(recheckSettings.intervalMinutes || 0)}
                              onValueChange={(val) => updateRecheckSetting("intervalMinutes", parseInt(val))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 5, 10, 15, 30, 45].map((n) => (
                                  <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {getIntervalMs() >= 60000 
                            ? `Checks every ${formatInterval()}` 
                            : <span className="text-amber-600">Minimum interval is 1 minute</span>
                          }
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => {
                    reconnectAttempts.current = 0;
                    if (reconnectTimerRef.current) {
                      clearTimeout(reconnectTimerRef.current);
                    }
                    checkConnection(false, false); // Manual test - not silent, not periodic
                    toast({ title: "Testing Connection", description: "Manual connection check started." });
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Test Connection Now
                </Button>
              </CollapsibleContent>
          </Collapsible>
          
          <div className={`p-4 rounded-lg border ${
            connectionStatus.status === "connected" 
              ? "bg-green-500/5 border-green-500/20" 
              : connectionStatus.status === "error" 
                ? "bg-amber-500/5 border-amber-500/20"
                : connectionStatus.status === "checking"
                  ? "bg-muted/30"
                  : "bg-red-500/5 border-red-500/20"
          }`}>
            <div className="space-y-3">
              {/* Status Header */}
              <div className="flex items-center gap-2">
                {connectionStatus.status === "connected" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : connectionStatus.status === "checking" ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : connectionStatus.status === "error" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  connectionStatus.status === "connected" ? "text-green-700" :
                  connectionStatus.status === "error" ? "text-amber-700" :
                  connectionStatus.status === "checking" ? "text-muted-foreground" :
                  "text-red-700"
                }`}>
                  {connectionStatus.message}
                </span>
              </div>

              {/* Domains List */}
              {connectionStatus.status === "connected" && connectionStatus.domains.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-green-500/20">
                  <p className="text-xs text-muted-foreground">Verified Domains</p>
                  {connectionStatus.domains.map((domain, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-green-600" />
                        <span className="font-mono">{domain.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs px-1 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                        {domain.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* DNS Security Validation */}
              {connectionStatus.dnsValidation && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground">Email Security (DNS Records)</p>
                  
                  {/* SPF */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {connectionStatus.dnsValidation.spf.valid ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-amber-500" />
                      )}
                      <span>SPF</span>
                      {connectionStatus.dnsValidation.spf.inUse && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Active
                        </Badge>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1.5 py-0 ${
                        connectionStatus.dnsValidation.spf.valid 
                          ? "bg-green-500/10 text-green-600 border-green-500/20" 
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {connectionStatus.dnsValidation.spf.valid ? "Valid" : "Missing"}
                    </Badge>
                  </div>
                  {connectionStatus.dnsValidation.spf.record && (
                    <p className="text-[10px] text-muted-foreground font-mono truncate pl-5">
                      {connectionStatus.dnsValidation.spf.record.substring(0, 60)}...
                    </p>
                  )}
                  
                  {/* DKIM */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {connectionStatus.dnsValidation.dkim.valid ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : connectionStatus.dnsValidation.dkim.configured ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>DKIM</span>
                      {connectionStatus.dnsValidation.dkim.inUse && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Active
                        </Badge>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1.5 py-0 ${
                        connectionStatus.dnsValidation.dkim.valid 
                          ? "bg-green-500/10 text-green-600 border-green-500/20" 
                          : connectionStatus.dnsValidation.dkim.configured
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {connectionStatus.dnsValidation.dkim.valid 
                        ? "Valid" 
                        : connectionStatus.dnsValidation.dkim.configured 
                          ? "DNS Missing" 
                          : "Not Set"}
                    </Badge>
                  </div>
                  {connectionStatus.dnsValidation.dkim.selector && (
                    <p className="text-[10px] text-muted-foreground font-mono pl-5">
                      Selector: {connectionStatus.dnsValidation.dkim.selector}
                    </p>
                  )}
                  
                  {/* DMARC */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {connectionStatus.dnsValidation.dmarc.valid ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-amber-500" />
                      )}
                      <span>DMARC</span>
                      {connectionStatus.dnsValidation.dmarc.inUse && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Active
                        </Badge>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1.5 py-0 ${
                        connectionStatus.dnsValidation.dmarc.valid 
                          ? "bg-green-500/10 text-green-600 border-green-500/20" 
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {connectionStatus.dnsValidation.dmarc.valid ? "Valid" : "Missing"}
                    </Badge>
                  </div>
                  {connectionStatus.dnsValidation.dmarc.record && (
                    <p className="text-[10px] text-muted-foreground font-mono truncate pl-5">
                      {connectionStatus.dnsValidation.dmarc.record.substring(0, 60)}...
                    </p>
                  )}

                  {/* Info about what's in use */}
                  <div className="pt-2 mt-2 border-t text-[10px] text-muted-foreground">
                    <p><span className="font-medium">Active</span> = checked by receiving servers when sending</p>
                  </div>
                </div>
              )}

              {/* Meta Info */}
              {connectionStatus.lastChecked && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Last checked: {formatTime(connectionStatus.lastChecked)}
                </div>
              )}
            </div>
          </div>


          {/* Setup Warning */}
          {connectionStatus.status !== "connected" && !emailConfig.smtpHost && (
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium mb-1">SMTP not configured</p>
                  <p>Set your SMTP host, username, and password in the configuration panel to start sending emails.</p>
                </div>
              </div>
            </div>
          )}

          {/* DNS Recommendations */}
          {connectionStatus.dnsValidation && (
            !connectionStatus.dnsValidation.spf.valid || 
            !connectionStatus.dnsValidation.dmarc.valid ||
            (connectionStatus.dnsValidation.dkim.configured && !connectionStatus.dnsValidation.dkim.valid)
          ) && (
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-medium">DNS Records Missing</p>
                  {!connectionStatus.dnsValidation.spf.valid && (
                    <p>• Add SPF record to improve deliverability</p>
                  )}
                  {!connectionStatus.dnsValidation.dmarc.valid && (
                    <p>• Add DMARC record for email authentication</p>
                  )}
                  {connectionStatus.dnsValidation.dkim.configured && !connectionStatus.dnsValidation.dkim.valid && (
                    <p>• Add DKIM DNS record (key configured but DNS missing)</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Domain Reputation Monitor */}
          {emailConfig.senderEmail && (
            <DomainReputationMonitor 
              domain={emailConfig.senderEmail.split('@')[1] || ''} 
            />
          )}
        </div>
      </div>
    </div>
  );
}