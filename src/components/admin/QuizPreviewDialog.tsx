import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronRight
} from "lucide-react";

// All supported languages
const ALL_LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "et", label: "ET" },
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

// Quiz page shortcuts
const QUIZ_PAGES = [
  { id: "welcome", label: "Welcome", icon: Home, path: "/welcome" },
  { id: "q1", label: "Q1", icon: HelpCircle, path: "/q1" },
  { id: "q2", label: "Q2", icon: HelpCircle, path: "/q2" },
  { id: "q3", label: "Q3", icon: HelpCircle, path: "/q3" },
  { id: "mindedness", label: "Mindedness", icon: HelpCircle, path: "/mindedness" },
  { id: "email", label: "Email", icon: Mail, path: "/email" },
  { id: "results", label: "Results", icon: Trophy, path: "/results" },
];

interface QuizPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizSlug: string;
  quizTitle?: string;
  quizType?: "standard" | "hypothesis" | "emotional";
  questionCount?: number;
}

export function QuizPreviewDialog({
  open,
  onOpenChange,
  quizSlug,
  quizTitle,
  quizType = "standard",
  questionCount = 6,
}: QuizPreviewDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentPage, setCurrentPage] = useState("welcome");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Build quiz pages based on question count
  const quizPages = [
    { id: "welcome", label: "Welcome", icon: Home, path: "/welcome" },
    ...Array.from({ length: questionCount }, (_, i) => ({
      id: `q${i + 1}`,
      label: `Q${i + 1}`,
      icon: HelpCircle,
      path: `/q${i + 1}`,
    })),
    { id: "mindedness", label: "Mindedness", icon: HelpCircle, path: "/mindedness" },
    { id: "email", label: "Email", icon: Mail, path: "/email" },
    { id: "results", label: "Results", icon: Trophy, path: "/results" },
  ];

  // Get current page index for navigation
  const currentPageIndex = quizPages.findIndex(p => p.id === currentPage);
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < quizPages.length - 1;

  // Build iframe URL
  const getIframeUrl = () => {
    const basePath = `/${quizSlug}`;
    const pagePath = quizPages.find(p => p.id === currentPage)?.path || "/welcome";
    return `${basePath}${pagePath}?lang=${selectedLanguage}&preview=true`;
  };

  // Reset to welcome on open
  useEffect(() => {
    if (open) {
      setCurrentPage("welcome");
      setIframeKey(prev => prev + 1);
    }
  }, [open]);

  // Refresh iframe when language or page changes
  useEffect(() => {
    setIframeKey(prev => prev + 1);
  }, [selectedLanguage, currentPage]);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(getIframeUrl(), "_blank");
  };

  const handlePrevPage = () => {
    if (canGoPrev) {
      setCurrentPage(quizPages[currentPageIndex - 1].id);
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage(quizPages[currentPageIndex + 1].id);
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
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base font-semibold">
                Preview: {quizTitle || quizSlug}
              </DialogTitle>
              {quizType && (
                <Badge variant="outline" className="text-xs capitalize">
                  {quizType}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Refresh preview"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
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
                className="gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Language Tabs */}
        <div className="px-4 py-2 border-b bg-muted/30 flex-shrink-0">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1">
              {ALL_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap",
                    selectedLanguage === lang.code
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Page Navigation Shortcuts */}
        <div className="px-4 py-2 border-b bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
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
              <ScrollArea className="max-w-[calc(100%-80px)]">
                <div className="flex items-center gap-1">
                  {quizPages.map(page => {
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.id}
                        onClick={() => setCurrentPage(page.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap",
                          currentPage === page.id
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {page.label}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextPage}
                disabled={!canGoNext}
                className="h-7 w-7"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {currentPageIndex + 1} / {quizPages.length}
            </span>
          </div>
        </div>

        {/* Quiz Preview Iframe */}
        <div className="flex-1 overflow-hidden bg-background">
          <iframe
            key={iframeKey}
            src={getIframeUrl()}
            className="w-full h-full border-0"
            title="Quiz Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
