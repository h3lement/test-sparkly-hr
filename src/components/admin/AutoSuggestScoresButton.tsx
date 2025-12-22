import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    
    // If no scored questions exist, expand range to fit all levels
    const effectiveMax = Math.max(maxPossibleScore, minPossibleScore + (numLevels - 1));
    const totalRange = effectiveMax - minPossibleScore + 1;
    const rangePerLevel = Math.floor(totalRange / numLevels);
    const remainder = totalRange % numLevels;

    // Sort levels by current min_score to maintain order
    const sortedLevels = [...resultLevels].sort((a, b) => a.min_score - b.min_score);

    let currentMin = minPossibleScore;
    const updatedLevels = sortedLevels.map((level, index) => {
      // Distribute remainder points to earlier levels
      const extraPoint = index < remainder ? 1 : 0;
      const levelRange = Math.max(1, rangePerLevel + extraPoint);
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

    toast({
      title: "Scores distributed",
      description: `${numLevels} levels distributed across ${minPossibleScore}–${effectiveMax}`,
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs gap-1"
      title={`Auto-distribute scores (${minPossibleScore}–${maxPossibleScore})`}
      onClick={handleDistribute}
      disabled={resultLevels.length === 0}
    >
      <Calculator className="w-3.5 h-3.5" />
      Distribute
    </Button>
  );
}
