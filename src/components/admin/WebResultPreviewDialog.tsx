import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, Sparkles, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

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

// Cost per 1K tokens (approximate for gemini-2.5-flash)
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

interface ResultLevel {
  title: Record<string, string>;
  description: Record<string, string>;
  insights: Record<string, string[]>;
  min_score: number;
  max_score: number;
}

interface WebResultPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: {
    id: string;
    version_number: number;
    result_levels: ResultLevel[];
    quiz_id: string;
    is_live?: boolean;
  } | null;
  quizTitle?: string;
  primaryLanguage?: string;
  onTranslateComplete?: () => void;
}

// Get saved dialog size from localStorage
const getSavedDialogSize = () => {
  try {
    const saved = localStorage.getItem("web-preview-dialog-size");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore
  }
  return { width: 900, height: 700 };
};

export function WebResultPreviewDialog({
  open,
  onOpenChange,
  version,
  quizTitle,
  primaryLanguage = "en",
  onTranslateComplete,
}: WebResultPreviewDialogProps) {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [dialogSize, setDialogSize] = useState(getSavedDialogSize);
  const [isMaximized, setIsMaximized] = useState(false);
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
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset to first level when dialog opens or version changes
  useEffect(() => {
    if (open) {
      setCurrentLevelIndex(0);
      setSelectedLanguage(primaryLanguage || "en");
      setTranslationProgress(null);
    }
  }, [open, version?.id, primaryLanguage]);

  // Save dialog size to localStorage
  useEffect(() => {
    if (!isMaximized) {
      localStorage.setItem("web-preview-dialog-size", JSON.stringify(dialogSize));
    }
  }, [dialogSize, isMaximized]);

  if (!version) return null;

  const levels = version.result_levels || [];
  const currentLevel = levels[currentLevelIndex];

  // Get available languages from all levels
  const getAvailableLanguages = (): string[] => {
    const available = new Set<string>();
    for (const level of levels) {
      Object.keys(level.title || {}).forEach(lang => {
        if (level.title[lang]?.trim()) available.add(lang);
      });
    }
    return Array.from(available);
  };

  const availableLanguages = getAvailableLanguages();
  const missingLanguages = ALL_LANGUAGE_CODES.filter(l => !availableLanguages.includes(l.code));

  // Estimate translation cost for missing languages
  const estimateTranslationCost = () => {
    if (missingLanguages.length === 0) return 0;
    // Estimate based on content length
    const avgTitleLength = 50;
    const avgDescLength = 200;
    const avgInsightsLength = 300;
    const contentPerLevel = avgTitleLength + avgDescLength + avgInsightsLength;
    const totalContent = contentPerLevel * levels.length;
    
    const promptBase = 600;
    const languageList = missingLanguages.length * 20;
    const inputChars = promptBase + languageList + totalContent;
    const outputChars = missingLanguages.length * totalContent * 1.2;
    
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    
    const costUsd = (inputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                    (outputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    return costUsd * 0.92; // Convert to EUR
  };

  const translationCostEur = estimateTranslationCost();

  const handleTranslate = async () => {
    if (!version) return;
    
    setTranslating(true);
    setTranslationProgress({
      stage: "starting",
      message: "Initializing translation...",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/translate-web-results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          versionId: version.id,
          sourceLanguage: primaryLanguage,
          stream: true,
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
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          
          const eventMatch = line.match(/^event: (\w+)/);
          const dataMatch = line.match(/data: (.+)/);
          
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
                onTranslateComplete?.();
                onOpenChange(false);
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
      if (error.name === 'AbortError') {
        toast({
          title: "Translation cancelled",
          description: "The translation was stopped",
        });
      } else {
        console.error("Translation error:", error);
        toast({
          title: "Translation failed",
          description: error.message || "Failed to translate web results",
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

  const getLocalizedText = (
    textObj: Record<string, string> | undefined,
    fallback: string = ""
  ): string => {
    if (!textObj) return fallback;
    return textObj[selectedLanguage] || textObj["en"] || textObj["et"] || fallback;
  };

  const getLocalizedInsights = (
    insightsObj: Record<string, string[]> | undefined
  ): string[] => {
    if (!insightsObj) return [];
    return insightsObj[selectedLanguage] || insightsObj["en"] || insightsObj["et"] || [];
  };

  const goToPrevLevel = () => {
    setCurrentLevelIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextLevel = () => {
    setCurrentLevelIndex((prev) => Math.min(levels.length - 1, prev + 1));
  };

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
              <Globe className="w-5 h-5 text-primary" />
              <span>Web Result Preview</span>
              {version && (
                <Badge variant={version.is_live ? "default" : "secondary"}>
                  Version {version.version_number}
                  {version.is_live && " • LIVE"}
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
          {quizTitle && (
            <p className="text-sm text-muted-foreground">
              Quiz: {quizTitle}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 p-6">
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
                      disabled={translating || !version}
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

          {/* Level Navigation */}
          <div className="flex items-center justify-between py-2 px-4 bg-muted/50 rounded-lg border flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevLevel}
              disabled={currentLevelIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Level {currentLevelIndex + 1} of {levels.length}
              </span>
              <Badge variant="secondary" className="font-mono text-xs">
                Score: {currentLevel?.min_score}-{currentLevel?.max_score}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextLevel}
              disabled={currentLevelIndex === levels.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Level Content Preview */}
          <ScrollArea className="flex-1">
            {currentLevel && (
              <div className="py-4 space-y-6 pr-4">
                {/* Title Preview */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 text-center">
                  <h2 className="text-2xl font-bold text-foreground">
                    {getLocalizedText(currentLevel.title, "Untitled")}
                  </h2>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Description
                  </h3>
                  <p className="text-foreground leading-relaxed">
                    {getLocalizedText(currentLevel.description, "No description")}
                  </p>
                </div>

                {/* Insights */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Key Insights
                  </h3>
                  <ul className="space-y-2">
                    {getLocalizedInsights(currentLevel.insights).map(
                      (insight, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-foreground"
                        >
                          <span className="text-primary mt-1">•</span>
                          <span>{insight}</span>
                        </li>
                      )
                    )}
                    {getLocalizedInsights(currentLevel.insights).length === 0 && (
                      <li className="text-muted-foreground italic">
                        No insights available
                      </li>
                    )}
                  </ul>
                </div>

                {/* All Levels Quick Navigation */}
                <div className="pt-4 border-t space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    All Levels
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {levels.map((level, idx) => (
                      <Button
                        key={idx}
                        variant={idx === currentLevelIndex ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentLevelIndex(idx)}
                        className="h-8 text-xs"
                      >
                        {level.min_score}-{level.max_score}:{" "}
                        {getLocalizedText(level.title, "Level " + (idx + 1)).slice(0, 20)}
                        {getLocalizedText(level.title, "").length > 20 ? "..." : ""}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
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
