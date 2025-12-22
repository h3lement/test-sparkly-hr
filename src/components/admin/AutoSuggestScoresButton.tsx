import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface AutoSuggestScoresButtonProps {
  resultLevels: ResultLevel[];
  minPossibleScore: number;
  maxPossibleScore: number;
  onUpdateLevels: (levels: ResultLevel[]) => void;
}

export function AutoSuggestScoresButton({
  resultLevels,
  minPossibleScore,
  maxPossibleScore,
  onUpdateLevels,
}: AutoSuggestScoresButtonProps) {
  const { toast } = useToast();

  const handleDistribute = () => {
    if (resultLevels.length === 0) {
      toast({
        title: "No levels",
        description: "Add result levels first before distributing scores",
        variant: "destructive",
      });
      return;
    }

    const numLevels = resultLevels.length;
    
    // Smart range calculation:
    // - Use actual min/max from quiz parameters
    // - If range is too small for levels, expand max to fit
    const effectiveMin = minPossibleScore;
    const effectiveMax = Math.max(maxPossibleScore, minPossibleScore + numLevels - 1);
    const totalRange = effectiveMax - effectiveMin + 1;
    
    // Calculate points per level (floor) and remainder
    const pointsPerLevel = Math.floor(totalRange / numLevels);
    const remainder = totalRange % numLevels;

    // Sort levels by current min_score to maintain order
    const sortedLevels = [...resultLevels].sort((a, b) => a.min_score - b.min_score);

    let currentMin = effectiveMin;
    const updatedLevels = sortedLevels.map((level, index) => {
      // Distribute remainder points to later levels (higher scores get extra)
      const extraPoint = index >= (numLevels - remainder) ? 1 : 0;
      const levelRange = Math.max(1, pointsPerLevel + extraPoint);
      const levelMax = index === numLevels - 1 ? effectiveMax : currentMin + levelRange - 1;

      const updated = {
        ...level,
        min_score: currentMin,
        max_score: levelMax,
      };

      currentMin = levelMax + 1;
      return updated;
    });

    onUpdateLevels(updatedLevels);

    const avgRange = Math.round(totalRange / numLevels);
    toast({
      title: "Scores auto-distributed",
      description: `${numLevels} levels × ~${avgRange} pts each (${effectiveMin}–${effectiveMax})`,
    });
  };

  // Calculate what distribution would look like
  const numLevels = resultLevels.length;
  const effectiveMax = Math.max(maxPossibleScore, minPossibleScore + numLevels - 1);
  const totalRange = effectiveMax - minPossibleScore + 1;
  const avgPointsPerLevel = numLevels > 0 ? Math.round(totalRange / numLevels) : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleDistribute}
            disabled={resultLevels.length === 0}
          >
            <Calculator className="w-3.5 h-3.5" />
            Distribute
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p className="font-medium">Auto-distribute score ranges</p>
            <p className="text-muted-foreground">
              {numLevels} levels × ~{avgPointsPerLevel} pts = {minPossibleScore}–{effectiveMax}
            </p>
            <p className="text-muted-foreground">
              Based on: {maxPossibleScore} max questions/pts
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
