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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Globe, Maximize2, Minimize2 } from "lucide-react";

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
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "uk", name: "Ukrainian" },
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
  const [dialogSize, setDialogSize] = useState(getSavedDialogSize);
  const [isMaximized, setIsMaximized] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // Update language when dialog opens
  useEffect(() => {
    if (open) {
      setTestLanguage(initialLanguage || "en");
    }
  }, [open, initialLanguage]);

  // Save dialog size to localStorage
  useEffect(() => {
    if (!isMaximized) {
      localStorage.setItem("email-preview-dialog-size", JSON.stringify(dialogSize));
    }
  }, [dialogSize, isMaximized]);

  // Get available languages for this template
  const getAvailableLanguages = () => {
    if (!template) return [];
    const available = new Set<string>();
    Object.keys(template.subjects || {}).forEach(lang => {
      if (template.subjects[lang]?.trim()) available.add(lang);
    });
    Object.keys(template.body_content || {}).forEach(lang => {
      if (template.body_content?.[lang]?.trim()) available.add(lang);
    });
    return Array.from(available);
  };

  const availableLanguages = getAvailableLanguages();

  const getEmailPreviewHtml = () => {
    if (!template) return "";
    
    const trans = emailTranslations[testLanguage] || emailTranslations.en;
    const previewSenderName = template.sender_name || "Sparkly.hr";
    const previewSenderEmail = template.sender_email || "support@sparkly.hr";
    const currentSubject = template.subjects?.[testLanguage] || template.subjects?.en || trans.yourResults;
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

    if (!template) {
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
        insights: [
          trans.sampleInsight1,
          trans.sampleInsight2,
          trans.sampleInsight3,
        ],
        language: testLanguage,
        opennessScore: 3,
        isTest: true,
        templateOverride: {
          sender_name: template.sender_name,
          sender_email: template.sender_email,
          subject: template.subjects[testLanguage] || template.subjects.en || "Your Quiz Results",
        },
      };

      const { error } = await supabase.functions.invoke("send-quiz-results", {
        body: testData,
      });

      if (error) throw error;

      toast({
        title: "Test email sent",
        description: `Email sent to ${testEmail} in ${ALL_LANGUAGES.find(l => l.code === testLanguage)?.name || testLanguage}`,
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
              {template && (
                <Badge variant={template.is_live ? "default" : "secondary"}>
                  Version {template.version_number}
                  {template.is_live && " • LIVE"}
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
          {quiz && (
            <p className="text-sm text-muted-foreground">
              Quiz: {getQuizTitle(quiz)}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 p-6">
          {/* Horizontal Language Selector */}
          <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
            <Globe className="w-4 h-4 text-muted-foreground mr-1" />
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
              disabled={sendingTest || !template}
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