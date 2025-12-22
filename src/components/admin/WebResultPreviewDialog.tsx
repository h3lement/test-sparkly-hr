import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  } | null;
  quizTitle?: string;
}

export function WebResultPreviewDialog({
  open,
  onOpenChange,
  version,
  quizTitle,
}: WebResultPreviewDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);

  // Reset to first level when dialog opens or version changes
  useEffect(() => {
    if (open) {
      setCurrentLevelIndex(0);
      setSelectedLanguage("en");
    }
  }, [open, version?.id]);

  if (!version) return null;

  const levels = version.result_levels || [];
  const currentLevel = levels[currentLevelIndex];

  // Get available languages from the first level
  const availableLanguages = currentLevel
    ? Object.keys(currentLevel.title || {}).filter(
        (lang) => currentLevel.title[lang]?.trim()
      )
    : [];

  const filteredLanguageCodes = ALL_LANGUAGE_CODES.filter((l) =>
    availableLanguages.includes(l.code)
  );

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Web Result Preview
              <Badge variant="outline" className="ml-2">
                v{version.version_number}
              </Badge>
            </DialogTitle>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredLanguageCodes.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {quizTitle && (
            <p className="text-sm text-muted-foreground mt-1">{quizTitle}</p>
          )}
        </DialogHeader>

        {/* Level Navigation */}
        <div className="flex items-center justify-between py-2 border-b flex-shrink-0">
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
        <ScrollArea className="flex-1 pr-4">
          {currentLevel && (
            <div className="py-4 space-y-6">
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
      </DialogContent>
    </Dialog>
  );
}
