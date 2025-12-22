import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Languages, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

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

interface ResultLevel {
  title: Record<string, string>;
  description: Record<string, string>;
  insights: Record<string, string[]>;
  min_score: number;
  max_score: number;
}

interface WebTranslationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  quizId: string;
  resultLevels: ResultLevel[];
  primaryLanguage: string;
  onTranslationComplete: () => void;
}

interface TranslationProgress {
  currentLanguage: string;
  completedLanguages: number;
  totalLanguages: number;
  cost: number;
}

export function WebTranslationDialog({
  open,
  onOpenChange,
  versionId,
  quizId,
  resultLevels,
  primaryLanguage,
  onTranslationComplete,
}: WebTranslationDialogProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const availableLanguages = ALL_LANGUAGES.filter(
    (lang) => lang.code !== primaryLanguage
  );

  // Initialize with all languages selected
  useEffect(() => {
    if (open) {
      setSelectedLanguages(availableLanguages.map((l) => l.code));
      setSelectAll(true);
      setProgress(null);
    }
  }, [open, primaryLanguage]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedLanguages(availableLanguages.map((l) => l.code));
    } else {
      setSelectedLanguages([]);
    }
  };

  const handleLanguageToggle = (langCode: string) => {
    setSelectedLanguages((prev) => {
      const newSelection = prev.includes(langCode)
        ? prev.filter((c) => c !== langCode)
        : [...prev, langCode];

      setSelectAll(newSelection.length === availableLanguages.length);
      return newSelection;
    });
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) return;

    setTranslating(true);
    setProgress({
      currentLanguage: "",
      completedLanguages: 0,
      totalLanguages: selectedLanguages.length,
      cost: 0,
    });

    abortControllerRef.current = new AbortController();

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/translate-web-results`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            versionId,
            quizId,
            resultLevels,
            sourceLanguage: primaryLanguage,
            targetLanguages: selectedLanguages,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Translation failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "progress") {
                setProgress({
                  currentLanguage: parsed.currentLanguage || "",
                  completedLanguages: parsed.completedLanguages || 0,
                  totalLanguages: parsed.totalLanguages || selectedLanguages.length,
                  cost: parsed.cost || 0,
                });
              } else if (parsed.type === "complete") {
                toast({
                  title: "Translation complete",
                  description: `Translated to ${parsed.completedLanguages} languages. Cost: €${parsed.cost?.toFixed(4) || "0.0000"}`,
                });
                onTranslationComplete();
                onOpenChange(false);
              } else if (parsed.type === "error") {
                throw new Error(parsed.message);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
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
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const primaryLangName =
    ALL_LANGUAGES.find((l) => l.code === primaryLanguage)?.name || primaryLanguage;

  const progressPercent = progress
    ? (progress.completedLanguages / progress.totalLanguages) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            Translate Web Results
          </DialogTitle>
          <DialogDescription>
            Translate result levels from <strong>{primaryLangName}</strong> to selected
            languages using AI.
          </DialogDescription>
        </DialogHeader>

        {translating && progress ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Translating to {progress.currentLanguage}...
                </span>
                <span className="font-medium">
                  {progress.completedLanguages}/{progress.totalLanguages}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-mono text-xs">
                €{progress.cost.toFixed(4)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-6 px-2 text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Info about what will be translated */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                This will translate {resultLevels.length} result level(s) including titles,
                descriptions, and insights.
              </p>
            </div>

            <Separator />

            {/* Language Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Target Languages</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAll"
                    checked={selectAll}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  />
                  <Label htmlFor="selectAll" className="text-xs cursor-pointer">
                    Select all ({availableLanguages.length})
                  </Label>
                </div>
              </div>

              <ScrollArea className="h-[200px] rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  {availableLanguages.map((lang) => (
                    <div key={lang.code} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={`lang-${lang.code}`}
                        checked={selectedLanguages.includes(lang.code)}
                        onCheckedChange={() => handleLanguageToggle(lang.code)}
                      />
                      <Label
                        htmlFor={`lang-${lang.code}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {lang.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({lang.code})
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                {selectedLanguages.length} language
                {selectedLanguages.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={translating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTranslate}
            disabled={translating || selectedLanguages.length === 0}
            className="gap-2"
          >
            {translating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" />
                Translate ({selectedLanguages.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
