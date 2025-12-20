import { useState, useMemo } from "react";
import { Sparkles, FileText, History, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tone intensity labels (10 steps)
const TONE_LABELS = [
  "Very Casual",
  "Casual",
  "Friendly",
  "Warm",
  "Balanced",
  "Professional",
  "Formal",
  "Authoritative",
  "Corporate",
  "Very Formal",
];

// Example phrases for each tone level
const TONE_EXAMPLES: Record<number, { greeting: string; encouragement: string; result: string }> = {
  0: {
    greeting: "Hey! 👋 Ready to find out more about yourself?",
    encouragement: "You're doing awesome! Keep going!",
    result: "Wow, look at you! You totally nailed it!",
  },
  1: {
    greeting: "Hi there! Let's explore what makes you tick.",
    encouragement: "Nice work so far! Almost there.",
    result: "Great job! Your results are really interesting.",
  },
  2: {
    greeting: "Hello! We're excited to help you discover your potential.",
    encouragement: "You're making great progress! Keep it up.",
    result: "Wonderful! Here's what we learned about you.",
  },
  3: {
    greeting: "Welcome! Let's take this journey of self-discovery together.",
    encouragement: "You're doing really well. Just a few more to go.",
    result: "Excellent work! Your insights are truly valuable.",
  },
  4: {
    greeting: "Welcome. This assessment will help reveal your strengths.",
    encouragement: "Good progress. Continue when you're ready.",
    result: "Well done. Here are your comprehensive results.",
  },
  5: {
    greeting: "Thank you for participating in this assessment.",
    encouragement: "You are progressing well through the evaluation.",
    result: "Your assessment is complete. Please review your results.",
  },
  6: {
    greeting: "Welcome to your professional competency evaluation.",
    encouragement: "Please proceed to complete the remaining sections.",
    result: "Your evaluation has been processed. Results are below.",
  },
  7: {
    greeting: "This assessment measures key performance indicators.",
    encouragement: "Continue with the assessment at your convenience.",
    result: "Assessment complete. Review your detailed analysis.",
  },
  8: {
    greeting: "Commence your organizational alignment assessment.",
    encouragement: "Proceed through the assessment methodology.",
    result: "Assessment concluded. Analysis and recommendations follow.",
  },
  9: {
    greeting: "Initiate competency framework evaluation protocol.",
    encouragement: "Continue assessment per established protocols.",
    result: "Evaluation finalized. Strategic findings documented below.",
  },
};

type ToneSource = "ai" | "extracted" | "manual";

interface ToneOfVoiceEditorProps {
  toneOfVoice: string;
  toneSource: ToneSource;
  useToneForAi: boolean;
  toneIntensity: number;
  quizId?: string;
  isPreviewMode?: boolean;
  onToneChange: (tone: string) => void;
  onSourceChange: (source: ToneSource) => void;
  onUseToneChange: (use: boolean) => void;
  onIntensityChange: (intensity: number) => void;
}

export function ToneOfVoiceEditor({
  toneOfVoice,
  toneSource,
  useToneForAi,
  toneIntensity,
  quizId,
  isPreviewMode,
  onToneChange,
  onSourceChange,
  onUseToneChange,
  onIntensityChange,
}: ToneOfVoiceEditorProps) {
  const [showExtractPopover, setShowExtractPopover] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  // Get current tone examples based on intensity
  const currentExamples = useMemo(() => TONE_EXAMPLES[toneIntensity] || TONE_EXAMPLES[4], [toneIntensity]);
  const currentLabel = TONE_LABELS[toneIntensity] || "Balanced";

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
    <div className="space-y-4 p-3 rounded-lg border bg-muted/30">
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

      {/* Tone Intensity Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Tone Intensity</Label>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
            {currentLabel}
          </span>
        </div>
        <Slider
          value={[toneIntensity]}
          onValueChange={(value) => onIntensityChange(value[0])}
          min={0}
          max={9}
          step={1}
          disabled={isPreviewMode}
          className="w-full"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Casual</span>
          <span>Formal</span>
        </div>
      </div>

      {/* Tone Preview Examples */}
      <div className="space-y-2 p-2 rounded bg-background/50 border border-border/50">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Preview Examples</Label>
        <div className="space-y-1.5">
          <div className="text-xs">
            <span className="text-muted-foreground">Greeting: </span>
            <span className="italic">{currentExamples.greeting}</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Encouragement: </span>
            <span className="italic">{currentExamples.encouragement}</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Result: </span>
            <span className="italic">{currentExamples.result}</span>
          </div>
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
