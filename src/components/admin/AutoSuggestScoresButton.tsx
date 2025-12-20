import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  const [open, setOpen] = useState(false);
  const [customMin, setCustomMin] = useState<string>("");
  const [customMax, setCustomMax] = useState<string>("");
  const { toast } = useToast();

  const effectiveMin = customMin !== "" ? parseInt(customMin, 10) : minPossibleScore;
  const effectiveMax = customMax !== "" ? parseInt(customMax, 10) : maxPossibleScore;

  const handleDistribute = () => {
    if (resultLevels.length === 0) {
      toast({
        title: "No levels",
        description: "Add result levels first before distributing scores",
        variant: "destructive",
      });
      return;
    }

    if (effectiveMax <= effectiveMin) {
      toast({
        title: "Invalid range",
        description: "Maximum score must be greater than minimum score",
        variant: "destructive",
      });
      return;
    }

    const numLevels = resultLevels.length;
    const totalRange = effectiveMax - effectiveMin + 1;
    const rangePerLevel = Math.floor(totalRange / numLevels);
    const remainder = totalRange % numLevels;

    // Sort levels by current min_score to maintain order
    const sortedLevels = [...resultLevels].sort((a, b) => a.min_score - b.min_score);

    let currentMin = effectiveMin;
    const updatedLevels = sortedLevels.map((level, index) => {
      // Distribute remainder points to earlier levels
      const extraPoint = index < remainder ? 1 : 0;
      const levelRange = rangePerLevel + extraPoint;
      const levelMax = currentMin + levelRange - 1;

      const updated = {
        ...level,
        min_score: currentMin,
        max_score: levelMax,
      };

      currentMin = levelMax + 1;
      return updated;
    });

    onUpdateLevels(updatedLevels);
    setOpen(false);

    toast({
      title: "Scores distributed",
      description: `${numLevels} levels evenly distributed across ${effectiveMin}–${effectiveMax}`,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          title="Auto-distribute score ranges"
        >
          <Calculator className="w-3.5 h-3.5" />
          Distribute
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-primary" />
              Auto-Distribute Scores
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Evenly distribute score ranges across {resultLevels.length} levels
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Min Score</Label>
              <Input
                type="number"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                placeholder={String(minPossibleScore)}
                className="h-8 text-sm"
              />
              <span className="text-[10px] text-muted-foreground">
                Quiz min: {minPossibleScore}
              </span>
            </div>
            <div>
              <Label className="text-xs">Max Score</Label>
              <Input
                type="number"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                placeholder={String(maxPossibleScore)}
                className="h-8 text-sm"
              />
              <span className="text-[10px] text-muted-foreground">
                Quiz max: {maxPossibleScore}
              </span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
            Each level will get ~{Math.floor((effectiveMax - effectiveMin + 1) / Math.max(1, resultLevels.length))} points
          </div>

          <Button
            size="sm"
            onClick={handleDistribute}
            className="w-full gap-1.5"
            disabled={resultLevels.length === 0}
          >
            <Calculator className="w-3.5 h-3.5" />
            Apply Distribution
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
