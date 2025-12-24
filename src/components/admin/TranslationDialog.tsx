import { useState, useEffect } from "react";
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
import { Loader2, Languages, Globe, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
  { code: "ru", name: "Russian" },
  { code: "uk", name: "Ukrainian" },
];

interface TranslationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTranslate: (options: TranslationOptions) => Promise<void>;
  primaryLanguage: string;
  translating: boolean;
}

export interface TranslationOptions {
  targetLanguages: string[];
  includeUiText: boolean;
  /** If set, the UI will call translation in smaller batches to avoid timeouts. */
  batchSize?: number;
}

export function TranslationDialog({
  open,
  onOpenChange,
  onTranslate,
  primaryLanguage,
  translating,
}: TranslationDialogProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [includeUiText, setIncludeUiText] = useState(true);
  const [safeMode, setSafeMode] = useState(true);
  const [selectAll, setSelectAll] = useState(false);

  const availableLanguages = ALL_LANGUAGES.filter(
    (lang) => lang.code !== primaryLanguage
  );

  // Default to a safe selection to avoid long-running requests that can time out
  useEffect(() => {
    if (open) {
      const defaultLang = availableLanguages[0]?.code;
      setSelectedLanguages(defaultLang ? [defaultLang] : []);
      setSelectAll(false);
      setSafeMode(true);
      setIncludeUiText(true);
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

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) return;

    await onTranslate({
      targetLanguages: selectedLanguages,
      includeUiText,
      batchSize: safeMode ? 1 : undefined,
    });
  };

  const primaryLangName = ALL_LANGUAGES.find(l => l.code === primaryLanguage)?.name || primaryLanguage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            AI Translation Settings
          </DialogTitle>
          <DialogDescription>
            Configure which languages to translate to and what content to include.
            Source language: <strong>{primaryLangName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* UI Text Option */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="includeUiText"
              checked={includeUiText}
              onCheckedChange={(checked) => setIncludeUiText(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="includeUiText" className="font-medium cursor-pointer">
                <Globe className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                Include static UI text
              </Label>
              <p className="text-xs text-muted-foreground">
                Translate buttons, labels, and other static website text so the entire page appears in the selected language.
              </p>
            </div>
          </div>

          {/* Reliability Option */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="safeMode"
              checked={safeMode}
              onCheckedChange={(checked) => setSafeMode(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="safeMode" className="font-medium cursor-pointer">
                <Clock className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                Avoid timeouts (recommended)
              </Label>
              <p className="text-xs text-muted-foreground">
                Translates one language per request (slower, but reliable). Bulk translating many languages at once can time out.
              </p>
            </div>
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
                  <div
                    key={lang.code}
                    className="flex items-center gap-2 py-1"
                  >
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
              {selectedLanguages.length} language{selectedLanguages.length !== 1 ? "s" : ""} selected
            </p>
          </div>
        </div>

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
                Translate ({selectedLanguages.length} languages)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
