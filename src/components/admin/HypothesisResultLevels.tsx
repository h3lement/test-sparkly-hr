import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  GripVertical,
  Check,
  Trophy,
  Percent,
  Hash,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Json } from "@/integrations/supabase/types";

// All languages for selection
const ALL_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "es", label: "Spanish" },
  { code: "pl", label: "Polish" },
  { code: "ro", label: "Romanian" },
  { code: "nl", label: "Dutch" },
  { code: "el", label: "Greek" },
  { code: "pt", label: "Portuguese" },
  { code: "cs", label: "Czech" },
  { code: "hu", label: "Hungarian" },
  { code: "sv", label: "Swedish" },
  { code: "bg", label: "Bulgarian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "sk", label: "Slovak" },
  { code: "hr", label: "Croatian" },
  { code: "lt", label: "Lithuanian" },
  { code: "sl", label: "Slovenian" },
  { code: "lv", label: "Latvian" },
  { code: "ga", label: "Irish" },
  { code: "mt", label: "Maltese" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
];

interface HypothesisResultLevel {
  id: string;
  min_score: number;
  max_score: number;
  title: Json;
  description: Json;
  emoji: string;
  color_class: string;
}

interface SortableLevelProps {
  level: HypothesisResultLevel;
  index: number;
  displayLanguage: string;
  isPreviewMode: boolean;
  quizId?: string;
  model?: string;
  showPercentage: boolean;
  maxScore: number;
  onUpdate: (index: number, updates: Partial<HypothesisResultLevel>) => void;
  onDelete: (index: number) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

function SortableLevel({
  level,
  index,
  displayLanguage,
  isPreviewMode,
  quizId,
  model,
  showPercentage,
  maxScore,
  onUpdate,
  onDelete,
  getLocalizedValue,
  jsonToRecord,
}: SortableLevelProps) {
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

  const handleAiFill = async () => {
    if (!quizId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fill-result-level", {
        body: {
          quizId,
          minScore: level.min_score,
          maxScore: level.max_score,
          instructions: `For hypothesis quiz result level. ${aiInstructions}`,
          language: displayLanguage,
          model,
          isHypothesis: true,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onUpdate(index, {
        title: { ...jsonToRecord(level.title), [displayLanguage]: data.title },
        description: { ...jsonToRecord(level.description), [displayLanguage]: data.description },
        emoji: data.emoji || level.emoji,
      });

      toast({ title: "Content generated", description: "AI filled in the result level" });
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

  const toPercent = (val: number) => maxScore > 0 ? Math.round((val / maxScore) * 100) : 0;
  const fromPercent = (pct: number) => maxScore > 0 ? Math.round((pct / 100) * maxScore) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-4 py-4 border-b last:border-b-0 list-row-interactive ${index % 2 === 1 ? "list-row-odd" : "list-row-even"}`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <Input
          value={level.emoji}
          onChange={(e) => onUpdate(index, { emoji: e.target.value })}
          className="h-7 w-10 text-center text-base px-1"
          title="Emoji"
          disabled={isPreviewMode}
        />
        <Input
          value={getLocalizedValue(level.title, displayLanguage)}
          onChange={(e) => {
            const updated = { ...jsonToRecord(level.title), [displayLanguage]: e.target.value };
            onUpdate(index, { title: updated });
          }}
          placeholder={`Title (${displayLanguage.toUpperCase()})`}
          className="h-7 text-sm w-40"
          disabled={isPreviewMode}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0 bg-secondary/50 rounded px-2 py-0.5">
          <input
            type="number"
            value={showPercentage ? toPercent(level.min_score) : level.min_score}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              onUpdate(index, { min_score: showPercentage ? fromPercent(val) : val });
            }}
            className="h-6 w-12 text-xs text-center rounded border border-input bg-background px-1"
            disabled={isPreviewMode}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="number"
            value={showPercentage ? toPercent(level.max_score) : level.max_score}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              onUpdate(index, { max_score: showPercentage ? fromPercent(val) : val });
            }}
            className="h-6 w-12 text-xs text-center rounded border border-input bg-background px-1"
            disabled={isPreviewMode}
          />
          <span className="text-xs text-muted-foreground">{showPercentage ? "%" : "pts"}</span>
        </div>

        <Textarea
          value={getLocalizedValue(level.description, displayLanguage)}
          onChange={(e) => {
            const updated = { ...jsonToRecord(level.description), [displayLanguage]: e.target.value };
            onUpdate(index, { description: updated });
          }}
          placeholder={`Description (${displayLanguage.toUpperCase()})`}
          rows={1}
          className="resize-none text-sm h-7 min-h-7 py-1.5 flex-1 w-[60%]"
          disabled={isPreviewMode}
        />

        {!isPreviewMode && quizId && (
          <Popover open={showAiPopover} onOpenChange={setShowAiPopover}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
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
                    Generate title & description for score range {level.min_score}–{level.max_score}%
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Instructions (optional)</Label>
                  <Textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="e.g., Focus on bias awareness..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <Button size="sm" onClick={handleAiFill} disabled={generating} className="w-full gap-1.5">
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
            className="h-7 w-7 text-destructive flex-shrink-0"
            onClick={() => onDelete(index)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface HypothesisResultLevelsProps {
  quizId: string;
  maxScore: number;
  primaryLanguage: string;
  model?: string;
}

export function HypothesisResultLevels({
  quizId,
  maxScore,
  primaryLanguage,
  model,
}: HypothesisResultLevelsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resultLevels, setResultLevels] = useState<HypothesisResultLevel[]>([]);
  const [showPercentage, setShowPercentage] = useState(true); // Default to percentage for hypothesis
  const [selectedLanguage, setSelectedLanguage] = useState(primaryLanguage);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getLocalizedValue = (obj: Json | Record<string, string>, lang: string): string => {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, string>)[lang] || (obj as Record<string, string>)["en"] || "";
    }
    return "";
  };

  const jsonToRecord = (json: Json | undefined): Record<string, string> => {
    if (!json) return {};
    if (typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, string>;
    }
    return {};
  };

  // Fetch existing levels
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const { data, error } = await supabase
          .from("hypothesis_result_levels")
          .select("*")
          .eq("quiz_id", quizId)
          .order("min_score", { ascending: false }); // Highest first

        if (error) throw error;
        setResultLevels(data || []);
      } catch (error) {
        console.error("Error fetching hypothesis result levels:", error);
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      fetchLevels();
    }
  }, [quizId]);

  // Save levels
  const saveLevels = async () => {
    setSaving(true);
    try {
      // Delete existing levels
      await supabase
        .from("hypothesis_result_levels")
        .delete()
        .eq("quiz_id", quizId);

      // Insert new levels
      if (resultLevels.length > 0) {
        const { error } = await supabase.from("hypothesis_result_levels").insert(
          resultLevels.map((level) => ({
            quiz_id: quizId,
            min_score: level.min_score,
            max_score: level.max_score,
            title: level.title,
            description: level.description,
            emoji: level.emoji,
            color_class: level.color_class,
          }))
        );
        if (error) throw error;
      }

      toast({ title: "Saved", description: "Hypothesis result levels saved" });
    } catch (error: any) {
      console.error("Error saving levels:", error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save result levels",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addLevel = () => {
    const newLevel: HypothesisResultLevel = {
      id: crypto.randomUUID(),
      min_score: 0,
      max_score: 100,
      title: {},
      description: {},
      emoji: "🏆",
      color_class: "text-green-500 bg-green-500/10",
    };
    setResultLevels([...resultLevels, newLevel]);
  };

  const updateLevel = (index: number, updates: Partial<HypothesisResultLevel>) => {
    setResultLevels((prev) =>
      prev.map((level, i) => (i === index ? { ...level, ...updates } : level))
    );
  };

  const deleteLevel = (index: number) => {
    setResultLevels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = resultLevels.findIndex((l) => l.id === active.id);
      const newIndex = resultLevels.findIndex((l) => l.id === over.id);
      setResultLevels(arrayMove(resultLevels, oldIndex, newIndex));
    }
  };

  // Count filled languages for a level
  const getFilledLanguages = (level: HypothesisResultLevel): string[] => {
    const titleObj = jsonToRecord(level.title);
    const descObj = jsonToRecord(level.description);
    const allLangs = new Set([...Object.keys(titleObj), ...Object.keys(descObj)]);
    return Array.from(allLangs).filter(lang => titleObj[lang] || descObj[lang]);
  };

  if (loading) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading result levels...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with language selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">Hypothesis Result Levels</Label>
          </div>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            Score: 0–100%
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Language:</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-[200px]">
                  {ALL_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code} className="text-xs">
                      {lang.label}
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>

          {/* Points/Percent Toggle */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
            <Hash className="w-3 h-3" />
            <span>pts</span>
            <Switch
              checked={showPercentage}
              onCheckedChange={setShowPercentage}
              className="h-4 w-7 data-[state=checked]:bg-primary"
            />
            <Percent className="w-3 h-3" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addLevel}
            className="gap-1 h-7 text-xs px-2"
          >
            <Plus className="w-3 h-3" />
            Add
          </Button>
          <Button
            size="sm"
            onClick={saveLevels}
            disabled={saving}
            className="gap-1 h-7 text-xs px-2"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Save
          </Button>
        </div>
      </div>

      {/* Translation status */}
      {resultLevels.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {resultLevels.map((level, idx) => {
            const filledLangs = getFilledLanguages(level);
            return (
              <div key={level.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{level.emoji}</span>
                <span className="text-[10px] px-1 py-0.5 bg-muted rounded">
                  {filledLangs.length} langs
                </span>
              </div>
            );
          })}
        </div>
      )}

      {resultLevels.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No result levels yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add levels to define how results are displayed based on score percentage.
          </p>
          <Button onClick={addLevel} size="sm" className="mt-3 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add First Level
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={resultLevels.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="border rounded-lg overflow-hidden">
              {resultLevels.map((level, index) => (
                <SortableLevel
                  key={level.id}
                  level={level}
                  index={index}
                  displayLanguage={selectedLanguage}
                  isPreviewMode={false}
                  quizId={quizId}
                  model={model}
                  showPercentage={showPercentage}
                  maxScore={100} // Always 100 for percentage-based
                  onUpdate={updateLevel}
                  onDelete={deleteLevel}
                  getLocalizedValue={getLocalizedValue}
                  jsonToRecord={jsonToRecord}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
