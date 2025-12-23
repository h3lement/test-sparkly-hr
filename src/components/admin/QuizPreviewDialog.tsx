import { useState, useEffect, useMemo } from "react";
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
  Brain
} from "lucide-react";

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

interface QuizPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizSlug: string;
  quizTitle?: string;
  quizType?: "standard" | "hypothesis" | "emotional";
  questionCount?: number;
  includeOpenMindedness?: boolean;
}

export function QuizPreviewDialog({
  open,
  onOpenChange,
  quizSlug,
  quizTitle,
  quizType = "standard",
  questionCount = 6,
  includeOpenMindedness = true,
}: QuizPreviewDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentPage, setCurrentPage] = useState("welcome");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

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

  // Build iframe URL - correct format: /:quizSlug/:step?lang=xx
  const iframeUrl = useMemo(() => {
    const page = quizPages.find(p => p.id === currentPage);
    const step = page?.step || "welcome";
    // Format: /quiz-slug/step?lang=en
    return `/${quizSlug}/${step}?lang=${selectedLanguage}`;
  }, [quizSlug, currentPage, selectedLanguage, quizPages]);

  // Reset to welcome on open
  useEffect(() => {
    if (open) {
      setCurrentPage("welcome");
      // Small delay before refreshing iframe
      setTimeout(() => setIframeKey(prev => prev + 1), 50);
    }
  }, [open]);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(iframeUrl, "_blank");
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    // Don't auto-refresh on language change - let user refresh manually if needed
  };

  const handlePageChange = (pageId: string) => {
    if (pageId !== currentPage) {
      setCurrentPage(pageId);
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

        {/* Language Tabs + Page Navigation combined */}
        <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            {/* Language selector */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {ALL_LANGUAGES.slice(0, 8).map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-colors",
                    selectedLanguage === lang.code
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {lang.label}
                </button>
              ))}
              {ALL_LANGUAGES.length > 8 && (
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="px-2 py-1 text-xs font-medium rounded bg-muted border-0 text-muted-foreground"
                >
                  {ALL_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevPage}
                disabled={!canGoPrev}
                className="h-7 w-7"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-0.5">
                {quizPages.map(page => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.id}
                      onClick={() => handlePageChange(page.id)}
                      title={page.label}
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded transition-colors",
                        currentPage === page.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextPage}
                disabled={!canGoNext}
                className="h-7 w-7"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                {currentPageIndex + 1}/{quizPages.length}
              </span>
            </div>
          </div>
        </div>

        {/* Quiz Preview Iframe */}
        <div className="flex-1 overflow-hidden bg-background">
          <iframe
            key={iframeKey}
            src={iframeUrl}
            className="w-full h-full border-0"
            title="Quiz Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
