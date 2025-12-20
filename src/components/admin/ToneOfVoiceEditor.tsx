import { useState } from "react";
import { Sparkles, FileText, History, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ToneSource = "ai" | "extracted" | "manual";

interface ToneOfVoiceEditorProps {
  toneOfVoice: string;
  toneSource: ToneSource;
  useToneForAi: boolean;
  quizId?: string;
  isPreviewMode?: boolean;
  onToneChange: (tone: string) => void;
  onSourceChange: (source: ToneSource) => void;
  onUseToneChange: (use: boolean) => void;
}

export function ToneOfVoiceEditor({
  toneOfVoice,
  toneSource,
  useToneForAi,
  quizId,
  isPreviewMode,
  onToneChange,
  onSourceChange,
  onUseToneChange,
}: ToneOfVoiceEditorProps) {
  const [showExtractPopover, setShowExtractPopover] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const handleSuggestFromQuizzes = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-tone", {
        body: { mode: "from_quizzes" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onToneChange(data.toneOfVoice);
      onSourceChange("ai");
      toast({
        title: "Tone suggested",
        description: "AI analyzed your existing quizzes to suggest a tone of voice",
      });
    } catch (error: any) {
      console.error("Suggest tone error:", error);
      toast({
        title: "Suggestion failed",
        description: error.message || "Failed to suggest tone",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggestFromCurrentQuiz = async () => {
    if (!quizId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-tone", {
        body: { mode: "from_current_quiz", quizId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onToneChange(data.toneOfVoice);
      onSourceChange("ai");
      toast({
        title: "Tone suggested",
        description: "AI analyzed this quiz to suggest a tone of voice",
      });
    } catch (error: any) {
      console.error("Suggest tone error:", error);
      toast({
        title: "Suggestion failed",
        description: error.message || "Failed to suggest tone",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExtractFromText = async () => {
    if (!extractText.trim()) {
      toast({
        title: "No text provided",
        description: "Paste sample text to extract tone from",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-tone", {
        body: { mode: "from_text", sampleText: extractText },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onToneChange(data.toneOfVoice);
      onSourceChange("extracted");
      setShowExtractPopover(false);
      setExtractText("");
      toast({
        title: "Tone extracted",
        description: "AI analyzed your text to extract tone guidelines",
      });
    } catch (error: any) {
      console.error("Extract tone error:", error);
      toast({
        title: "Extraction failed",
        description: error.message || "Failed to extract tone",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleManualChange = (value: string) => {
    onToneChange(value);
    if (toneSource !== "manual") {
      onSourceChange("manual");
    }
  };

  const getSourceBadge = () => {
    switch (toneSource) {
      case "ai":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            AI Suggested
          </span>
        );
      case "extracted":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <FileText className="w-2.5 h-2.5" />
            Extracted
          </span>
        );
      default:
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Manual
          </span>
        );
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">Tone of Voice</Label>
          {getSourceBadge()}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Use for AI</span>
          <Switch
            checked={useToneForAi}
            onCheckedChange={onUseToneChange}
            disabled={isPreviewMode}
            className="scale-75"
          />
        </div>
      </div>

      <Textarea
        value={toneOfVoice}
        onChange={(e) => handleManualChange(e.target.value)}
        placeholder="e.g., Use a warm, encouraging tone that feels like advice from a supportive mentor. Be direct but kind..."
        rows={3}
        className="text-sm resize-none"
        disabled={isPreviewMode}
      />

      {!isPreviewMode && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggestFromQuizzes}
            disabled={generating}
            className="h-7 px-2 text-xs gap-1.5"
          >
            {generating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <History className="w-3 h-3" />
            )}
            From All Quizzes
          </Button>

          {quizId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggestFromCurrentQuiz}
              disabled={generating}
              className="h-7 px-2 text-xs gap-1.5"
            >
              {generating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              From This Quiz
            </Button>
          )}

          <Popover open={showExtractPopover} onOpenChange={setShowExtractPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5"
              >
                <FileText className="w-3 h-3" />
                Extract from Text
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    Extract Tone from Text
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste sample content and AI will extract the tone of voice
                  </p>
                </div>
                <Textarea
                  value={extractText}
                  onChange={(e) => setExtractText(e.target.value)}
                  placeholder="Paste sample marketing copy, email, or any text that represents your desired tone..."
                  rows={5}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  onClick={handleExtractFromText}
                  disabled={generating || !extractText.trim()}
                  className="w-full gap-1.5"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Extract Tone
                    </>
                  )}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {!useToneForAi && toneOfVoice && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          Note: This tone will not be used for AI generation. Toggle "Use for AI" to enable.
        </p>
      )}
    </div>
  );
}
