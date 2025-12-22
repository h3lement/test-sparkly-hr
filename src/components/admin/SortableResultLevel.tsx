import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
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

interface SortableResultLevelProps {
  level: ResultLevel;
  index: number;
  isEven: boolean;
  displayLanguage: string;
  isPreviewMode: boolean;
  quizId?: string;
  model?: string;
  onUpdateLevel: (index: number, updates: Partial<ResultLevel>) => void;
  onDeleteLevel: (index: number) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

export function SortableResultLevel({
  level,
  index,
  isEven,
  displayLanguage,
  isPreviewMode,
  quizId,
  model,
  onUpdateLevel,
  onDeleteLevel,
  getLocalizedValue,
  jsonToRecord,
}: SortableResultLevelProps) {
  const [showAiPopover, setShowAiPopover] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id, disabled: isPreviewMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Handle score input - allow empty string for clearing
  const handleScoreChange = (field: 'min_score' | 'max_score', value: string) => {
    // Allow empty input while typing
    if (value === '' || value === '-') {
      onUpdateLevel(index, { [field]: 0 });
      return;
    }
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      onUpdateLevel(index, { [field]: parsed });
    }
  };

  const handleAiFill = async () => {
    if (!quizId) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fill-result-level", {
        body: {
          quizId,
          minScore: level.min_score,
          maxScore: level.max_score,
          instructions: aiInstructions,
          language: displayLanguage,
          model,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onUpdateLevel(index, {
        title: { ...jsonToRecord(level.title), [displayLanguage]: data.title },
        description: { ...jsonToRecord(level.description), [displayLanguage]: data.description },
        emoji: data.emoji || level.emoji,
        insights: data.insights || [],
      });

      toast({
        title: "Content generated",
        description: `AI filled in the result level content`,
      });
      setShowAiPopover(false);
      setAiInstructions("");
    } catch (error: any) {
      console.error("AI fill error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-4 py-4 border-b last:border-b-0 space-y-3 list-row-interactive ${isEven ? 'list-row-odd' : 'list-row-even'}`}
    >
      {/* Row 1: Title and controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground w-5 text-center flex-shrink-0">
          {index + 1}.
        </span>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <Input
          value={level.emoji}
          onChange={(e) => onUpdateLevel(index, { emoji: e.target.value })}
          className="h-8 w-12 text-center text-base"
          title="Emoji"
          disabled={isPreviewMode}
        />
        <Input
          value={getLocalizedValue(level.title, displayLanguage)}
          onChange={(e) => {
            const updated = { ...jsonToRecord(level.title), [displayLanguage]: e.target.value };
            onUpdateLevel(index, { title: updated });
          }}
          placeholder={`Result title (${displayLanguage.toUpperCase()})`}
          className="h-8 text-sm flex-1"
          disabled={isPreviewMode}
        />
        <div className="flex items-center gap-2 flex-shrink-0 bg-secondary/50 rounded px-2 py-1">
          <span className="text-xs text-muted-foreground">Score:</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={level.min_score}
            onChange={(e) => handleScoreChange('min_score', e.target.value)}
            onFocus={(e) => e.target.select()}
            className="h-7 w-14 text-sm text-center rounded border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
            title="Min score"
            disabled={isPreviewMode}
          />
          <span className="text-sm text-muted-foreground">–</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={level.max_score}
            onChange={(e) => handleScoreChange('max_score', e.target.value)}
            onFocus={(e) => e.target.select()}
            className="h-7 w-14 text-sm text-center rounded border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
            title="Max score"
            disabled={isPreviewMode}
          />
        </div>
        
        {/* AI Fill Button */}
        {!isPreviewMode && quizId && (
          <Popover open={showAiPopover} onOpenChange={setShowAiPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary flex-shrink-0"
                title="AI fill content"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI Fill Content
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate title, description & emoji for score range {level.min_score}–{level.max_score}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Instructions (optional)</Label>
                  <Textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="e.g., Make it encouraging, focus on growth potential..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAiFill}
                  disabled={generating}
                  className="w-full gap-1.5"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {!isPreviewMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive flex-shrink-0"
            onClick={() => onDeleteLevel(index)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Row 2: Description */}
      <Textarea
        value={getLocalizedValue(level.description, displayLanguage)}
        onChange={(e) => {
          const updated = { ...jsonToRecord(level.description), [displayLanguage]: e.target.value };
          onUpdateLevel(index, { description: updated });
        }}
        placeholder={`Description (${displayLanguage.toUpperCase()})`}
        rows={2}
        className="resize-none text-sm"
        disabled={isPreviewMode}
      />
    </div>
  );
}
