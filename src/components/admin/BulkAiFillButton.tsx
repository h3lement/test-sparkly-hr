import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
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

interface BulkAiFillButtonProps {
  quizId: string;
  language: string;
  model?: string;
  resultLevels: ResultLevel[];
  onUpdateLevel: (index: number, updates: Partial<ResultLevel>) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

export function BulkAiFillButton({
  quizId,
  language,
  model,
  resultLevels,
  onUpdateLevel,
  getLocalizedValue,
  jsonToRecord,
}: BulkAiFillButtonProps) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [filling, setFilling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentLevel, setCurrentLevel] = useState("");
  const { toast } = useToast();

  // Find empty levels (no title in current language)
  const emptyLevels = resultLevels
    .map((level, index) => ({ level, index }))
    .filter(({ level }) => !getLocalizedValue(level.title, language).trim());

  const handleBulkFill = async () => {
    if (emptyLevels.length === 0) {
      toast({
        title: "No empty levels",
        description: "All result levels already have content",
      });
      return;
    }

    setFilling(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emptyLevels.length; i++) {
      const { level, index } = emptyLevels[i];
      setCurrentLevel(`${level.min_score}–${level.max_score} pts`);
      setProgress(((i) / emptyLevels.length) * 100);

      try {
        const { data, error } = await supabase.functions.invoke("fill-result-level", {
          body: {
            quizId,
            minScore: level.min_score,
            maxScore: level.max_score,
            instructions,
            language,
            model,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        onUpdateLevel(index, {
          title: { ...jsonToRecord(level.title), [language]: data.title },
          description: { ...jsonToRecord(level.description), [language]: data.description },
          emoji: data.emoji || level.emoji,
          insights: data.insights || [],
        });

        successCount++;
      } catch (error: any) {
        console.error(`Error filling level ${index}:`, error);
        errorCount++;
      }
    }

    setProgress(100);

    toast({
      title: "Bulk fill complete",
      description: `Filled ${successCount} level${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    setFilling(false);
    setProgress(0);
    setCurrentLevel("");
    setOpen(false);
    setInstructions("");
  };

  if (emptyLevels.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1.5"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Fill Empty ({emptyLevels.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              Bulk AI Fill
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Fill {emptyLevels.length} empty level{emptyLevels.length !== 1 ? 's' : ''} with AI-generated content
            </p>
          </div>

          {!filling ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Shared Instructions (optional)</Label>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., Keep tone encouraging, focus on actionable advice..."
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <p className="font-medium mb-1">Empty levels to fill:</p>
                <div className="flex flex-wrap gap-1">
                  {emptyLevels.map(({ level }) => (
                    <span
                      key={level.id}
                      className="px-1.5 py-0.5 bg-secondary rounded text-xs"
                    >
                      {level.min_score}–{level.max_score}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleBulkFill}
                className="w-full gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill All Empty Levels
              </Button>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Generating content...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Filling: {currentLevel}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
