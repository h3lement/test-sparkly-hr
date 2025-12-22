import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, Maximize2, Minimize2, Loader2, Sparkles, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

const ALL_LANGUAGE_CODES = [
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

// Cost estimation
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
  cta_title: Record<string, string>;
  cta_description: Record<string, string>;
  cta_text: Record<string, string>;
  cta_url: string | null;
  primary_language: string;
}

interface CTAPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quiz: Quiz | null;
  onTranslateComplete?: () => void;
}

export function CTAPreviewDialog({
  open,
  onOpenChange,
  quiz,
  onTranslateComplete,
}: CTAPreviewDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isMaximized, setIsMaximized] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (open && quiz) {
      setSelectedLanguage(quiz.primary_language || "en");
    }
  }, [open, quiz]);

  if (!quiz) return null;

  // Get available languages (those with translations)
  const getAvailableLanguages = (): string[] => {
    const available = new Set<string>();
    Object.keys(quiz.cta_title || {}).forEach(lang => {
      if (quiz.cta_title[lang]?.trim()) available.add(lang);
    });
    Object.keys(quiz.cta_description || {}).forEach(lang => {
      if (quiz.cta_description[lang]?.trim()) available.add(lang);
    });
    Object.keys(quiz.cta_text || {}).forEach(lang => {
      if (quiz.cta_text[lang]?.trim()) available.add(lang);
    });
    return Array.from(available);
  };

  const availableLanguages = getAvailableLanguages();
  const missingLanguages = ALL_LANGUAGE_CODES.filter(l => !availableLanguages.includes(l.code));

  // Estimate translation cost
  const estimateTranslationCost = () => {
    if (missingLanguages.length === 0) return 0;
    const avgTitleLength = 50;
    const avgDescLength = 200;
    const avgButtonLength = 30;
    const totalContent = avgTitleLength + avgDescLength + avgButtonLength;
    
    const promptBase = 500;
    const languageList = missingLanguages.length * 15;
    const inputChars = promptBase + languageList + totalContent;
    const outputChars = missingLanguages.length * totalContent * 1.2;
    
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    
    const costUsd = (inputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                    (outputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    return costUsd * 0.92;
  };

  const translationCostEur = estimateTranslationCost();

  const handleTranslate = async () => {
    if (!quiz) return;
    
    setTranslating(true);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/translate-cta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          quizId: quiz.id,
          sourceLanguage: quiz.primary_language || "en",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Translation failed");
      }

      toast.success(`Translated CTA to ${data.translatedCount} languages (€${data.costEur?.toFixed(4) || "0.0000"})`);
      onTranslateComplete?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Translation error:", error);
      toast.error(error.message || "Failed to translate CTA content");
    } finally {
      setTranslating(false);
    }
  };

  const getLocalizedText = (textObj: Record<string, string> | undefined, fallback: string = ""): string => {
    if (!textObj) return fallback;
    return textObj[selectedLanguage] || textObj["en"] || textObj["et"] || fallback;
  };

  const toggleMaximize = () => setIsMaximized(!isMaximized);

  const currentSize = isMaximized 
    ? { width: "95vw", height: "80vh" } 
    : { width: "700px", height: "auto" };

  const quizTitle = quiz.title?.en || quiz.title?.et || quiz.slug;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="overflow-hidden flex flex-col p-0 gap-0"
        style={{ 
          maxWidth: currentSize.width, 
          width: currentSize.width,
          maxHeight: currentSize.height,
        }}
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-primary" />
              <span>CTA Preview</span>
              <Badge variant="secondary">{quizTitle}</Badge>
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
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col gap-4 p-6">
          {/* Language Selector with Translate Button */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {ALL_LANGUAGE_CODES.map((lang) => {
                const isAvailable = availableLanguages.includes(lang.code);
                const isSelected = selectedLanguage === lang.code;
                return (
                  <Button
                    key={lang.code}
                    variant={isSelected ? "default" : isAvailable ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => isAvailable && setSelectedLanguage(lang.code)}
                    disabled={!isAvailable}
                    className={`h-7 px-2.5 font-mono uppercase text-xs ${!isAvailable ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title={`${lang.name}${!isAvailable ? ' (not available)' : ''}`}
                  >
                    {lang.code}
                  </Button>
                );
              })}
            </div>
            
            {/* AI Translate Button */}
            {missingLanguages.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTranslate}
                      disabled={translating}
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
          </div>

          {/* CTA Preview */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-8">
            <h3 className="text-xl font-semibold mb-3 text-foreground">
              {getLocalizedText(quiz.cta_title, "Ready for Precise Employee Assessment?")}
            </h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              {getLocalizedText(quiz.cta_description, "This quiz provides a general overview. For accurate, in-depth analysis of your team's performance and actionable improvement strategies, continue with professional testing.")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2">
                {getLocalizedText(quiz.cta_text, "Continue to Sparkly.hr")}
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button variant="outline">
                Take Quiz Again
              </Button>
            </div>
            {quiz.cta_url && (
              <p className="mt-4 text-xs text-muted-foreground">
                Link: {quiz.cta_url}
              </p>
            )}
          </div>

          {/* Language Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>
              {availableLanguages.length} of {ALL_LANGUAGE_CODES.length} languages available
            </span>
            <span>
              Currently viewing: {ALL_LANGUAGE_CODES.find(l => l.code === selectedLanguage)?.name}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
