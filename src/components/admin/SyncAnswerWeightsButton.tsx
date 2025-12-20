import { useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface Answer {
  id: string;
  answer_text: Json;
  answer_order: number;
  score_value: number;
}

interface Question {
  id: string;
  question_text: Json;
  question_order: number;
  question_type: string;
  answers: Answer[];
}

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

interface SyncAnswerWeightsButtonProps {
  quizId: string;
  questions: Question[];
  resultLevels: ResultLevel[];
  language: string;
  onUpdateQuestions: (questions: Question[]) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
}

export function SyncAnswerWeightsButton({
  quizId,
  questions,
  resultLevels,
  language,
  onUpdateQuestions,
  getLocalizedValue,
}: SyncAnswerWeightsButtonProps) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [instructions, setInstructions] = useState("");
  const { toast } = useToast();

  // Calculate current and target score ranges
  const scoringQuestions = questions.filter(q => q.question_type !== "open_mindedness");
  const currentMaxScore = scoringQuestions.reduce((sum, q) => {
    if (q.answers.length === 0) return sum;
    return sum + Math.max(...q.answers.map(a => a.score_value));
  }, 0);
  const currentMinScore = scoringQuestions.reduce((sum, q) => {
    if (q.answers.length === 0) return sum;
    return sum + Math.min(...q.answers.map(a => a.score_value));
  }, 0);

  // Target based on result levels
  const targetMinScore = resultLevels.length > 0
    ? Math.min(...resultLevels.map(l => l.min_score))
    : 0;
  const targetMaxScore = resultLevels.length > 0
    ? Math.max(...resultLevels.map(l => l.max_score))
    : 100;

  const handleSync = async () => {
    if (scoringQuestions.length === 0) {
      toast({
        title: "No questions",
        description: "Add questions with answers first",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-answer-weights", {
        body: {
          quizId,
          targetMinScore,
          targetMaxScore,
          instructions,
          language,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Update questions with new weights
      const updatedQuestions = questions.map(q => {
        if (q.question_type === "open_mindedness") return q;
        
        const questionWeights = data.weights[q.id];
        if (!questionWeights) return q;

        return {
          ...q,
          answers: q.answers.map(a => ({
            ...a,
            score_value: questionWeights[a.id] ?? a.score_value,
          })),
        };
      });

      onUpdateQuestions(updatedQuestions);
      setOpen(false);

      toast({
        title: "Weights synchronized",
        description: `Answer weights adjusted for target range ${targetMinScore}–${targetMaxScore}`,
      });
    } catch (error: any) {
      console.error("Sync weights error:", error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to synchronize weights",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          title="AI sync answer weights to match result ranges"
        >
          <Scale className="w-3.5 h-3.5" />
          Sync Weights
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-primary" />
              AI Sync Answer Weights
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Adjust answer weights so total scores align with result level ranges
            </p>
          </div>

          <div className="text-xs space-y-1 p-2 bg-muted/50 rounded">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current score range:</span>
              <span className="font-medium">{currentMinScore}–{currentMaxScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target range (from levels):</span>
              <span className="font-medium text-primary">{targetMinScore}–{targetMaxScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Questions:</span>
              <span>{scoringQuestions.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Instructions (optional)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Higher weights for more positive answers, keep minimum at 0..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || scoringQuestions.length === 0}
            className="w-full gap-1.5"
          >
            {syncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Scale className="w-3.5 h-3.5" />
                Sync Weights
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
