import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const AVAILABLE_LANGUAGES = [
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "et", name: "Estonian", nativeName: "Eesti" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "da", name: "Danish", nativeName: "Dansk" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά" },
  { code: "cs", name: "Czech", nativeName: "Čeština" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar" },
  { code: "bg", name: "Bulgarian", nativeName: "Български" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge" },
  { code: "mt", name: "Maltese", nativeName: "Malti" },
];

interface BatchTranslateButtonProps {
  onComplete?: () => void;
}

export function BatchTranslateButton({ onComplete }: BatchTranslateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["ru", "uk"]);
  const [progress, setProgress] = useState<string>("");

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) {
      toast({
        title: "No languages selected",
        description: "Please select at least one language to translate to.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);
    setProgress("Starting batch translation...");

    try {
      const { data, error } = await supabase.functions.invoke("batch-translate-quizzes", {
        body: { targetLanguages: selectedLanguages },
      });

      if (error) throw error;

      toast({
        title: "Translation Complete",
        description: `Successfully translated content to ${selectedLanguages.join(", ").toUpperCase()}`,
      });

      setIsOpen(false);
      onComplete?.();
    } catch (error) {
      console.error("Batch translation error:", error);
      toast({
        title: "Translation Failed",
        description: error instanceof Error ? error.message : "An error occurred during translation",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Languages className="h-4 w-4" />
          Batch Translate All
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Translate All Quizzes</DialogTitle>
          <DialogDescription>
            Translate all quizzes, CTAs, email templates, and web results to the selected languages.
            This uses AI to generate translations from English content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select target languages:</Label>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto border rounded-md p-3">
              {AVAILABLE_LANGUAGES.map((lang) => (
                <div key={lang.code} className="flex items-center space-x-2">
                  <Checkbox
                    id={lang.code}
                    checked={selectedLanguages.includes(lang.code)}
                    onCheckedChange={() => toggleLanguage(lang.code)}
                    disabled={isTranslating}
                  />
                  <Label
                    htmlFor={lang.code}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {lang.nativeName} ({lang.code.toUpperCase()})
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {progress && (
            <div className="text-sm text-muted-foreground animate-pulse">
              {progress}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isTranslating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTranslate}
              disabled={isTranslating || selectedLanguages.length === 0}
              className="gap-2"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Languages className="h-4 w-4" />
                  Translate ({selectedLanguages.length} languages)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
