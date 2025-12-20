import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
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
  onResultsGenerated: (levels: ResultLevel[]) => void;
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional & Formal" },
  { value: "friendly", label: "Friendly & Encouraging" },
  { value: "casual", label: "Casual & Conversational" },
  { value: "motivational", label: "Motivational & Inspiring" },
  { value: "humorous", label: "Light & Humorous" },
];

export function GenerateResultsDialog({
  open,
  onOpenChange,
  quizId,
  language,
  onResultsGenerated,
}: GenerateResultsDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [numberOfLevels, setNumberOfLevels] = useState(4);
  const [toneOfVoice, setToneOfVoice] = useState("friendly");
  const [higherScoreMeaning, setHigherScoreMeaning] = useState<"positive" | "negative">("positive");
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const { toast } = useToast();

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
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setEstimatedCost(data.estimatedCostEur);
      
      toast({
        title: "Results generated",
        description: `Created ${data.resultLevels.length} result levels (v${data.version.version_number}). Cost: €${data.estimatedCostEur.toFixed(4)}`,
      });

      onResultsGenerated(data.resultLevels);
      onOpenChange(false);
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

  // Estimate tokens for cost preview
  const estimateTokenCost = () => {
    const inputEstimate = 1500 + (numberOfLevels * 100);
    const outputEstimate = numberOfLevels * 200;
    const costUsd = (inputEstimate * 0.000000075) + (outputEstimate * 0.0000003);
    return (costUsd * 0.92).toFixed(4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate Results with AI
          </DialogTitle>
          <DialogDescription>
            AI will analyze your quiz questions and answers to create meaningful result levels.
          </DialogDescription>
        </DialogHeader>

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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
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
      </DialogContent>
    </Dialog>
  );
}
