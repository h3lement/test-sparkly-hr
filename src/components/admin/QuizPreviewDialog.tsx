import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  ExternalLink, 
  Home, 
  HelpCircle, 
  Mail, 
  Trophy,
  Maximize2,
  Minimize2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Brain,
  Loader2,
  Languages
} from "lucide-react";
import { TranslationDialog, TranslationOptions } from "./TranslationDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Primary languages shown first
const PRIMARY_LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "et", label: "ET" },
];

// Other EU languages
const OTHER_LANGUAGES = [
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
  { code: "it", label: "IT" },
  { code: "es", label: "ES" },
  { code: "pl", label: "PL" },
  { code: "ro", label: "RO" },
  { code: "nl", label: "NL" },
  { code: "el", label: "EL" },
  { code: "pt", label: "PT" },
  { code: "cs", label: "CS" },
  { code: "hu", label: "HU" },
  { code: "sv", label: "SV" },
  { code: "bg", label: "BG" },
  { code: "da", label: "DA" },
  { code: "fi", label: "FI" },
  { code: "sk", label: "SK" },
  { code: "hr", label: "HR" },
  { code: "lt", label: "LT" },
  { code: "sl", label: "SL" },
  { code: "lv", label: "LV" },
  { code: "ga", label: "GA" },
  { code: "mt", label: "MT" },
];

const ALL_LANGUAGES = [...PRIMARY_LANGUAGES, ...OTHER_LANGUAGES];

const STORAGE_KEY = "quiz-preview-language";

interface QuizPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizSlug: string;
  quizId: string;
  quizTitle?: string;
  quizType?: "standard" | "hypothesis" | "emotional";
  primaryLanguage?: string;
  questionCount?: number;
  includeOpenMindedness?: boolean;
  onTranslationComplete?: () => void;
}

export function QuizPreviewDialog({
  open,
  onOpenChange,
  quizSlug,
  quizId,
  quizTitle,
  quizType = "standard",
  primaryLanguage = "en",
  questionCount = 6,
  includeOpenMindedness = true,
  onTranslationComplete,
}: QuizPreviewDialogProps) {
  // Initialize language from localStorage
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "en";
    } catch {
      return "en";
    }
  });
  const [currentPage, setCurrentPage] = useState("welcome");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showTranslationDialog, setShowTranslationDialog] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Build quiz pages based on question count - memoized for performance
  const quizPages = useMemo(() => {
    const pages = [
      { id: "welcome", label: "Welcome", icon: Home, step: "welcome" },
    ];
    
    // Add question pages
    for (let i = 1; i <= questionCount; i++) {
      pages.push({
        id: `q${i}`,
        label: `Q${i}`,
        icon: HelpCircle,
        step: `q${i}`,
      });
    }
    
    // Add open-mindedness if enabled
    if (includeOpenMindedness) {
      pages.push({ id: "mindedness", label: "Open Mind", icon: Brain, step: "mindedness" });
    }
    
    // Add email and results
    pages.push(
      { id: "email", label: "Email", icon: Mail, step: "email" },
      { id: "results", label: "Results", icon: Trophy, step: "results" }
    );
    
    return pages;
  }, [questionCount, includeOpenMindedness]);

  // Get current page index for navigation
  const currentPageIndex = quizPages.findIndex(p => p.id === currentPage);
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < quizPages.length - 1;

  // Build iframe URL - correct format: /:quizSlug/:step?lang=xx&preview=1
  const iframeUrl = useMemo(() => {
    const page = quizPages.find(p => p.id === currentPage);
    const step = page?.step || "welcome";
    // Format: /quiz-slug/step?lang=en&preview=1 (preview mode allows direct page access)
    return `/${quizSlug}/${step}?lang=${selectedLanguage}&preview=1`;
  }, [quizSlug, currentPage, selectedLanguage, quizPages]);

  // Reset to welcome on open
  useEffect(() => {
    if (open) {
      setCurrentPage("welcome");
      setIsLoading(true);
      // Small delay before refreshing iframe
      setTimeout(() => setIframeKey(prev => prev + 1), 50);
    }
  }, [open]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(iframeUrl, "_blank");
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, langCode);
    } catch {
      // Ignore storage errors
    }
  };

  const handleTranslate = async (options: TranslationOptions) => {
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-quiz", {
        body: {
          quizId,
          sourceLanguage: primaryLanguage,
          targetLanguages: options.targetLanguages,
          includeUiText: options.includeUiText,
        },
      });

      if (error) throw error;

      toast.success(`Quiz translated to ${options.targetLanguages.length} languages`);
      setShowTranslationDialog(false);
      onTranslationComplete?.();
      handleRefresh();
    } catch (err) {
      console.error("Translation error:", err);
      toast.error("Translation failed");
    } finally {
      setTranslating(false);
    }
  };

  const handlePageChange = (pageId: string) => {
    if (pageId !== currentPage) {
      setCurrentPage(pageId);
      setIsLoading(true);
      setIframeKey(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (canGoPrev) {
      handlePageChange(quizPages[currentPageIndex - 1].id);
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      handlePageChange(quizPages[currentPageIndex + 1].id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 flex flex-col",
          isFullscreen 
            ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none" 
            : "max-w-6xl w-[95vw] h-[90vh] max-h-[90vh]"
        )}
      >
        {/* Header */}
        <DialogHeader className="px-4 py-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">
                {quizTitle || quizSlug}
              </DialogTitle>
              {quizType && (
                <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                  {quizType}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Refresh preview"
                className="h-8 w-8"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTranslationDialog(true)}
                title="AI Translate Quiz"
                className="h-8 w-8"
              >
                <Languages className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="h-8 w-8"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="gap-1.5 h-8"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Page Navigation - Primary row for testing */}
        <div className="px-3 py-2 border-b bg-muted/50 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevPage}
                disabled={!canGoPrev}
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1 bg-background rounded-md p-1 border">
                {quizPages.map(page => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.id}
                      onClick={() => handlePageChange(page.id)}
                      title={page.label}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors",
                        currentPage === page.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{page.label}</span>
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextPage}
                disabled={!canGoNext}
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {currentPageIndex + 1} / {quizPages.length}
            </span>
          </div>
        </div>

        {/* Language selector row */}
        <div className="px-3 py-1.5 border-b bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {ALL_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded transition-colors flex-shrink-0",
                  selectedLanguage === lang.code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>


        {/* Quiz Preview Iframe */}
        <div className="flex-1 overflow-hidden bg-background relative">
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading preview...</span>
              </div>
            </div>
          )}
          <iframe
            key={iframeKey}
            src={iframeUrl}
            className="w-full h-full border-0"
            title="Quiz Preview"
            onLoad={handleIframeLoad}
          />
        </div>

        {/* Translation Dialog */}
        <TranslationDialog
          open={showTranslationDialog}
          onOpenChange={setShowTranslationDialog}
          onTranslate={handleTranslate}
          primaryLanguage={primaryLanguage}
          translating={translating}
        />
      </DialogContent>
    </Dialog>
  );
}
