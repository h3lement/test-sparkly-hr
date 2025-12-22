import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sparkles, TrendingUp, TrendingDown, ArrowLeft, Check, Euro, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface ResultLevel {
  id: string;
  min_score: number;
  max_score: number;
  title: Json;
  description: Json;
  insights: Json;
  emoji: string;
  color_class: string;
}

interface GenerateResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  language: string;
  model?: string;
  onResultsGenerated: (levels: ResultLevel[]) => void;
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional & Formal" },
  { value: "friendly", label: "Friendly & Encouraging" },
  { value: "casual", label: "Casual & Conversational" },
  { value: "motivational", label: "Motivational & Inspiring" },
  { value: "humorous", label: "Light & Humorous" },
];

type DialogStep = "config" | "preview";

export function GenerateResultsDialog({
  open,
  onOpenChange,
  quizId,
  language,
  model,
  onResultsGenerated,
}: GenerateResultsDialogProps) {
  const [step, setStep] = useState<DialogStep>("config");
  const [generating, setGenerating] = useState(false);
  const [numberOfLevels, setNumberOfLevels] = useState(4);
  const [toneOfVoice, setToneOfVoice] = useState("friendly");
  const [higherScoreMeaning, setHigherScoreMeaning] = useState<"positive" | "negative">("positive");
  const [generatedLevels, setGeneratedLevels] = useState<ResultLevel[]>([]);
  const [generationCost, setGenerationCost] = useState<number>(0);
  const [versionNumber, setVersionNumber] = useState<number>(0);
  const { toast } = useToast();

  const resetDialog = () => {
    setStep("config");
    setGeneratedLevels([]);
    setGenerationCost(0);
    setVersionNumber(0);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetDialog();
    }
    onOpenChange(isOpen);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-results", {
        body: {
          quizId,
          numberOfLevels,
          toneOfVoice,
          higherScoreMeaning,
          language,
          model,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setGeneratedLevels(data.resultLevels);
      setGenerationCost(data.estimatedCostEur);
      setVersionNumber(data.version.version_number);
      setStep("preview");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate results",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    onResultsGenerated(generatedLevels);
    toast({
      title: "Results applied",
      description: `Applied ${generatedLevels.length} result levels (v${versionNumber}). Cost: €${generationCost.toFixed(4)}`,
    });
    handleOpenChange(false);
  };

  const handleRegenerate = async () => {
    await handleGenerate();
  };

  // Estimate tokens for cost preview
  const estimateTokenCost = () => {
    const inputEstimate = 1500 + (numberOfLevels * 100);
    const outputEstimate = numberOfLevels * 200;
    const costUsd = (inputEstimate * 0.000000075) + (outputEstimate * 0.0000003);
    return (costUsd * 0.92).toFixed(4);
  };

  const getLocalizedValue = (obj: Json, lang: string): string => {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, string>)[lang] || "";
    }
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`${step === "preview" ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[85vh] overflow-hidden flex flex-col`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {step === "config" ? "Generate Results with AI" : "Preview Generated Results"}
          </DialogTitle>
          <DialogDescription>
            {step === "config" 
              ? "AI will analyze your quiz questions and answers to create meaningful result levels."
              : `Review the generated results before applying them. Version ${versionNumber}.`
            }
          </DialogDescription>
        </DialogHeader>

        {step === "config" ? (
          <>
            <div className="space-y-4 py-4">
              {/* Number of levels */}
              <div className="space-y-2">
                <Label htmlFor="levels" className="text-sm font-medium">Number of Result Levels</Label>
                <Input
                  id="levels"
                  type="number"
                  min={2}
                  max={10}
                  value={numberOfLevels}
                  onChange={(e) => setNumberOfLevels(Math.min(10, Math.max(2, parseInt(e.target.value) || 4)))}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">Between 2 and 10 levels</p>
              </div>

              {/* Tone of voice */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tone of Voice</Label>
                <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Score meaning */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Higher Scores Mean...</Label>
                <RadioGroup
                  value={higherScoreMeaning}
                  onValueChange={(v) => setHigherScoreMeaning(v as "positive" | "negative")}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="positive" id="positive" />
                    <Label htmlFor="positive" className="flex items-center gap-2 cursor-pointer">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Better Results</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="negative" id="negative" />
                    <Label htmlFor="negative" className="flex items-center gap-2 cursor-pointer">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-sm">Worse Results</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Cost estimate */}
              <div className="bg-muted/50 rounded-lg p-3 border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated cost:</span>
                  <span className="font-medium">~€{estimateTokenCost()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on quiz content size and {numberOfLevels} levels
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={generating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Preview Step */}
            <div className="flex-1 min-h-0 py-2 flex flex-col">
              {/* Cost badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                  <Euro className="w-3 h-3" />
                  <span>{generationCost.toFixed(4)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {generatedLevels.length} levels generated
                </span>
              </div>

              {/* Results Preview */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-3">
                <div className="space-y-3">
                  {generatedLevels.map((level, index) => (
                    <div
                      key={level.id}
                      className={`border rounded-lg p-3 list-row-interactive ${index % 2 === 0 ? "list-row-even" : "list-row-odd"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{level.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm">
                              {getLocalizedValue(level.title, language)}
                            </h4>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                              {level.min_score}–{level.max_score} pts
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getLocalizedValue(level.description, language)}
                          </p>
                          {Array.isArray(level.insights) && level.insights.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(level.insights as string[]).slice(0, 3).map((insight, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                                >
                                  {insight}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("config")}
                className="gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={generating}
                  className="gap-1.5"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Regenerate
                </Button>
                <Button onClick={handleApply} className="gap-1.5">
                  <Check className="w-4 h-4" />
                  Apply Results
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
