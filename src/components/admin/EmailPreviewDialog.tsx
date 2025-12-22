import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Globe, Maximize2, Minimize2, Loader2, Sparkles, X, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Cost per 1K tokens (approximate for gemini-2.5-flash)
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;
const AVG_CHARS_PER_SUBJECT = 60;

interface EmailTemplate {
  id: string;
  version_number: number;
  sender_name: string;
  sender_email: string;
  subjects: Record<string, string>;
  body_content?: Record<string, string>;
  is_live: boolean;
  created_at: string;
}

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
  primary_language: string;
}

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  quiz: Quiz | null;
  defaultEmail?: string;
  initialLanguage?: string;
  emailTranslations: Record<string, {
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
  }>;
}

const ALL_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "es", name: "Spanish" },
  { code: "pl", name: "Polish" },
  { code: "ro", name: "Romanian" },
  { code: "nl", name: "Dutch" },
  { code: "el", name: "Greek" },
  { code: "pt", name: "Portuguese" },
  { code: "cs", name: "Czech" },
  { code: "hu", name: "Hungarian" },
  { code: "sv", name: "Swedish" },
  { code: "bg", name: "Bulgarian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "sk", name: "Slovak" },
  { code: "hr", name: "Croatian" },
  { code: "lt", name: "Lithuanian" },
  { code: "sl", name: "Slovenian" },
  { code: "lv", name: "Latvian" },
  { code: "ga", name: "Irish" },
  { code: "mt", name: "Maltese" },
];

// Get saved dialog size from localStorage
const getSavedDialogSize = () => {
  try {
    const saved = localStorage.getItem("email-preview-dialog-size");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore
  }
  return { width: 900, height: 700 };
};

export function EmailPreviewDialog({
  open,
  onOpenChange,
  template,
  quiz,
  defaultEmail = "",
  initialLanguage,
  emailTranslations,
}: EmailPreviewDialogProps) {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState(defaultEmail);
  const [testLanguage, setTestLanguage] = useState(initialLanguage || "en");
  const [sendingTest, setSendingTest] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState<{
    stage: string;
    message: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    translatedCount?: number;
    totalLanguages?: number;
  } | null>(null);

  // Keep a local copy of the template so we can refresh it after AI translation
  // (otherwise the dialog keeps showing the old `template` prop and languages stay disabled)
  const [templateData, setTemplateData] = useState<EmailTemplate | null>(template);

  // Global sender config from Email Settings
  const [globalSenderName, setGlobalSenderName] = useState("Sparkly");
  const [globalSenderEmail, setGlobalSenderEmail] = useState("noreply@sparkly.hr");

  const [dialogSize, setDialogSize] = useState(getSavedDialogSize);
  const [isMaximized, setIsMaximized] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeTemplate = templateData ?? template;

  // Fetch global email sender config from app_settings
  const fetchGlobalSenderConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["email_sender_name", "email_sender_email"]);

      if (!error && data) {
        data.forEach((s) => {
          if (s.setting_key === "email_sender_name" && s.setting_value) {
            setGlobalSenderName(s.setting_value);
          }
          if (s.setting_key === "email_sender_email" && s.setting_value) {
            setGlobalSenderEmail(s.setting_value);
          }
        });
      }
    } catch (err) {
      console.error("Failed to fetch global sender config:", err);
    }
  };

  const fetchLatestTemplate = async () => {
    if (!activeTemplate?.id) return;
    const { data, error } = await supabase
      .from("email_templates")
      .select("id, version_number, sender_name, sender_email, subjects, body_content, is_live, created_at")
      .eq("id", activeTemplate.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to refresh email template:", error);
      return;
    }

    if (data) {
      setTemplateData(data as unknown as EmailTemplate);
    }
  };

  // Update language + refresh latest template data when dialog opens
  useEffect(() => {
    if (open) {
      setTestLanguage(initialLanguage || "en");
      setTranslationProgress(null);
      setTemplateData(template);
      void fetchLatestTemplate();
      void fetchGlobalSenderConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLanguage, template?.id]);

  // Save dialog size to localStorage
  useEffect(() => {
    if (!isMaximized) {
      localStorage.setItem("email-preview-dialog-size", JSON.stringify(dialogSize));
    }
  }, [dialogSize, isMaximized]);

  // Get available languages for this template
  const getAvailableLanguages = () => {
    if (!activeTemplate) return [];
    const available = new Set<string>();
    Object.keys(activeTemplate.subjects || {}).forEach((lang) => {
      if (activeTemplate.subjects[lang]?.trim()) available.add(lang);
    });
    Object.keys(activeTemplate.body_content || {}).forEach((lang) => {
      if (activeTemplate.body_content?.[lang]?.trim()) available.add(lang);
    });
    return Array.from(available);
  };

  const availableLanguages = getAvailableLanguages();
  const missingLanguages = ALL_LANGUAGES.filter((l) => !availableLanguages.includes(l.code));

  // Estimate translation cost for missing languages
  const estimateTranslationCost = () => {
    if (missingLanguages.length === 0) return 0;
    // Estimate based on subject translation
    const subjectLength =
      activeTemplate?.subjects?.[quiz?.primary_language || "en"]?.length ||
      AVG_CHARS_PER_SUBJECT;
    const promptBase = 400; // Base prompt characters
    const languageList = missingLanguages.length * 20; // ~20 chars per language listing
    const inputChars = promptBase + languageList + subjectLength;
    const outputChars = missingLanguages.length * (subjectLength + 10); // translation + json overhead
    
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    
    const costUsd = (inputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                    (outputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    return costUsd * 0.92; // Convert to EUR
  };

  // Estimate re-translation cost for ALL languages
  const estimateRetranslationCost = () => {
    const targetCount = ALL_LANGUAGES.length - 1; // Exclude source language
    const subjectLength =
      activeTemplate?.subjects?.[quiz?.primary_language || "en"]?.length ||
      AVG_CHARS_PER_SUBJECT;
    const promptBase = 400;
    const languageList = targetCount * 20;
    const inputChars = promptBase + languageList + subjectLength;
    const outputChars = targetCount * (subjectLength + 10);
    
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    
    const costUsd = (inputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                    (outputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    return costUsd * 0.92;
  };

  const translationCostEur = estimateTranslationCost();
  const retranslationCostEur = estimateRetranslationCost();

  const handleTranslate = async (forceRetranslate = false) => {
    if (!activeTemplate || !quiz) return;

    const sourceLanguage = quiz.primary_language || "en";
    const sourceSubject =
      activeTemplate.subjects?.[sourceLanguage] || activeTemplate.subjects?.en || "";

    if (!sourceSubject.trim()) {
      toast({
        title: "Nothing to translate",
        description: "No subject found in the source language",
        variant: "destructive",
      });
      return;
    }

    setTranslating(true);
    setTranslationProgress({
      stage: "starting",
      message: forceRetranslate
        ? "Re-generating all translations..."
        : "Initializing translation...",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/translate-email-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          templateId: activeTemplate.id,
          sourceLanguage,
          sourceSubject,
          stream: true,
          forceRetranslate,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          if (!block.trim()) continue;

          const eventMatch = block.match(/^event: (\w+)/);
          const dataMatch = block.match(/data: (.+)/);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1];
            try {
              const data = JSON.parse(dataMatch[1]);

              if (eventType === "progress") {
                setTranslationProgress(data);
              } else if (eventType === "complete") {
                toast({
                  title: "Translation complete",
                  description: `Translated to ${data.translatedLanguages?.length || 0} languages (€${data.cost?.toFixed(4) || "0.0000"})`,
                });

                // Refresh template data so the newly translated languages become selectable immediately
                await fetchLatestTemplate();

                // If the currently selected language is still unavailable, fall back to source
                setTestLanguage((prev) =>
                  (data.subjects && data.subjects[prev]) ? prev : sourceLanguage
                );
              } else if (eventType === "error") {
                throw new Error(data.message);
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }
    } catch (error: any) {
      // Don't show error toast if cancelled by user
      if (error.name === "AbortError") {
        toast({
          title: "Translation cancelled",
          description: "The translation was stopped",
        });
      } else {
        console.error("Translation error:", error);
        toast({
          title: "Translation failed",
          description: error.message || "Failed to translate email template",
          variant: "destructive",
        });
      }
    } finally {
      setTranslating(false);
      setTranslationProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const getEmailPreviewHtml = () => {
    if (!activeTemplate) return "";

    const trans = emailTranslations[testLanguage] || emailTranslations.en;
    // Always use global sender config from Email Settings
    const previewSenderName = globalSenderName;
    const previewSenderEmail = globalSenderEmail;
    const currentSubject =
      activeTemplate.subjects?.[testLanguage] || activeTemplate.subjects?.en || trans.yourResults;
    const logoUrl = "/sparkly-logo.png";
    const sampleScore = 15;
    const maxScore = 24;
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="background: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 13px; color: #6b7280;"><strong>From:</strong> ${previewSenderName} &lt;${previewSenderEmail}&gt;</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;"><strong>Subject:</strong> ${currentSubject}: ${trans.sampleResultTitle}</p>
          </div>
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="https://sparkly.hr" target="_blank">
                <img src="${logoUrl}" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
              </a>
              <h1 style="color: #6d28d9; font-size: 28px; margin: 0;">${trans.yourResults}</h1>
            </div>
            
            <div style="text-align: center; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
              <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${sampleScore}</div>
              <div style="opacity: 0.9;">${trans.outOf} ${maxScore} ${trans.points}</div>
            </div>
            
            <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">${trans.sampleResultTitle}</h2>
            
            <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">${trans.sampleResultDescription}</p>
            
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 12px 0;">${trans.leadershipOpenMindedness}</h3>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px; font-weight: bold; color: #6d28d9;">3</span>
                <span style="color: #6b7280;">${trans.openMindednessOutOf}</span>
              </div>
            </div>
            
            <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">${trans.keyInsights}:</h3>
            <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 30px;">
              <li style="margin-bottom: 12px;">1. ${trans.sampleInsight1}</li>
              <li style="margin-bottom: 12px;">2. ${trans.sampleInsight2}</li>
              <li style="margin-bottom: 12px;">3. ${trans.sampleInsight3}</li>
            </ul>
            
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 14px; margin-bottom: 12px;">${trans.wantToImprove}</p>
              <a href="https://sparkly.hr" style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">${trans.visitSparkly}</a>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <a href="https://sparkly.hr" target="_blank">
                <img src="${logoUrl}" alt="Sparkly.hr" style="height: 32px; margin-bottom: 10px;" />
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a test email address",
        variant: "destructive",
      });
      return;
    }

    if (!activeTemplate) {
      toast({
        title: "Error",
        description: "No template selected",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const trans = emailTranslations[testLanguage] || emailTranslations.en;

      const testData = {
        email: testEmail.trim(),
        totalScore: 18,
        maxScore: 24,
        resultTitle: trans.sampleResultTitle,
        resultDescription: trans.sampleResultDescription,
        insights: [trans.sampleInsight1, trans.sampleInsight2, trans.sampleInsight3],
        language: testLanguage,
        opennessScore: 3,
        isTest: true,
        // No templateOverride needed - edge function uses global Email Settings config
      };

      const { error } = await supabase.functions.invoke("send-quiz-results", {
        body: testData,
      });

      if (error) throw error;

      toast({
        title: "Test email sent",
        description: `Email sent to ${testEmail} in ${ALL_LANGUAGES.find((l) => l.code === testLanguage)?.name || testLanguage}`,
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const getQuizTitle = (q: Quiz) => q.title?.en || q.title?.et || q.slug;

  // Handle resize
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dialogSize.width;
    const startHeight = dialogSize.height;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(600, startWidth + (e.clientX - startX));
      const newHeight = Math.max(400, startHeight + (e.clientY - startY));
      setDialogSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const currentSize = isMaximized 
    ? { width: "95vw", height: "95vh" } 
    : { width: `${dialogSize.width}px`, height: `${dialogSize.height}px` };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="overflow-hidden flex flex-col p-0 gap-0"
        style={{ 
          maxWidth: currentSize.width, 
          width: currentSize.width,
          maxHeight: currentSize.height,
          height: currentSize.height,
        }}
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span>Email Preview</span>
              {activeTemplate && (
                <Badge variant={activeTemplate.is_live ? "default" : "secondary"}>
                  Version {activeTemplate.version_number}
                  {activeTemplate.is_live && " • LIVE"}
                </Badge>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMaximize}
              className="h-8 w-8 p-0"
              title={isMaximized ? "Restore size" : "Maximize"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
          <DialogDescription>
            Preview and translate this email template across languages.
          </DialogDescription>
          {quiz && (
            <p className="text-sm text-muted-foreground">
              Quiz: {getQuizTitle(quiz)}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 p-6">
          {/* Language Selector with Translate Button */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {ALL_LANGUAGES.map((lang) => {
                const isAvailable = availableLanguages.includes(lang.code);
                const isSelected = testLanguage === lang.code;
                return (
                  <Button
                    key={lang.code}
                    variant={isSelected ? "default" : isAvailable ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => isAvailable && setTestLanguage(lang.code)}
                    disabled={!isAvailable}
                    className={`h-7 px-2.5 font-mono uppercase text-xs ${!isAvailable ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title={`${lang.name}${!isAvailable ? ' (not available)' : ''}`}
                  >
                    {lang.code}
                  </Button>
                );
              })}
            </div>
            
            {/* AI Translate Button - for missing languages */}
            {missingLanguages.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTranslate(false)}
                      disabled={translating || !activeTemplate}
                      className="gap-1.5 h-7 text-xs"
                    >
                      {translating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      AI Translate
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-mono">
                        ~€{translationCostEur.toFixed(4)}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Translate to {missingLanguages.length} missing languages</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Re-generate Button - regenerate all translations */}
            {availableLanguages.length > 1 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTranslate(true)}
                      disabled={translating || !activeTemplate}
                      className="gap-1.5 h-7 text-xs"
                    >
                      {translating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Re-generate
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-mono">
                        ~€{retranslationCostEur.toFixed(4)}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Re-generate all {ALL_LANGUAGES.length - 1} translations</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Translation Progress Indicator */}
          {translating && translationProgress && (
            <div className="flex-shrink-0 p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">{translationProgress.message}</span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  €{translationProgress.cost.toFixed(4)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelTranslation}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  title="Cancel translation"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {translationProgress.totalLanguages && (
                <Progress 
                  value={(translationProgress.translatedCount || 0) / translationProgress.totalLanguages * 100} 
                  className="h-2"
                />
              )}
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Input: <strong className="text-foreground">{translationProgress.inputTokens}</strong> tokens</span>
                <span>Output: <strong className="text-foreground">{translationProgress.outputTokens}</strong> tokens</span>
                {translationProgress.translatedCount !== undefined && (
                  <span>Languages: <strong className="text-foreground">{translationProgress.translatedCount}/{translationProgress.totalLanguages}</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/50 rounded-lg border flex-shrink-0">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label htmlFor="previewTestEmail" className="text-sm">Send test to</Label>
              <Input
                id="previewTestEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
                className="bg-background"
              />
            </div>
            <Button 
              onClick={sendTestEmail} 
              disabled={sendingTest || !activeTemplate}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {sendingTest ? "Sending..." : "Send Test Email"}
            </Button>
          </div>

          {/* Preview Frame */}
          <div className="flex-1 overflow-hidden border rounded-lg">
            <div className="bg-muted px-4 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Preview</span>
              <Badge variant="outline">
                {ALL_LANGUAGES.find(l => l.code === testLanguage)?.name}
              </Badge>
            </div>
            <iframe
              srcDoc={getEmailPreviewHtml()}
              className="w-full border-0"
              style={{ height: "calc(100% - 40px)", backgroundColor: "#faf7f5" }}
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Resize handle */}
        {!isMaximized && (
          <div
            ref={resizeRef}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-50 hover:opacity-100"
            onMouseDown={handleResizeMouseDown}
            style={{
              background: "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%)",
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}