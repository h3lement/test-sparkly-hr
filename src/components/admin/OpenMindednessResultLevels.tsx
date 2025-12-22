import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  TrendingUp,
  TrendingDown,
  Check,
  Euro,
  RefreshCw,
  ArrowLeft,
  Brain,
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

interface OpenMindednessResultLevel {
  id: string;
  min_score: number;
  max_score: number;
  title: Json;
  description: Json;
  emoji: string;
  color_class: string;
}

interface Question {
  id: string;
  question_text: Json;
  question_order: number;
  question_type: string;
  answers: { id: string; answer_text: Json; answer_order: number; score_value: number }[];
}

interface SortableLevelProps {
  level: OpenMindednessResultLevel;
  index: number;
  displayLanguage: string;
  isPreviewMode: boolean;
  quizId?: string;
  model?: string;
  showPercentage: boolean;
  maxScore: number;
  onUpdate: (index: number, updates: Partial<OpenMindednessResultLevel>) => void;
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
          instructions: `For open-mindedness module. ${aiInstructions}`,
          language: displayLanguage,
          model,
          isOpenMindedness: true,
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
      className={`px-4 py-3 border-b last:border-b-0 list-row-interactive ${index % 2 === 1 ? "list-row-odd" : "list-row-even"}`}
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
                    Generate title & description for score range {level.min_score}–{level.max_score}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Instructions (optional)</Label>
                  <Textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="e.g., Focus on growth mindset..."
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

interface OpenMindednessResultLevelsProps {
  quizId: string;
  questions: Question[];
  displayLanguage: string;
  isPreviewMode: boolean;
  model?: string;
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional & Formal" },
  { value: "friendly", label: "Friendly & Encouraging" },
  { value: "casual", label: "Casual & Conversational" },
  { value: "motivational", label: "Motivational & Inspiring" },
];

export function OpenMindednessResultLevels({
  quizId,
  questions,
  displayLanguage,
  isPreviewMode,
  model,
}: OpenMindednessResultLevelsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resultLevels, setResultLevels] = useState<OpenMindednessResultLevel[]>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dialogStep, setDialogStep] = useState<"config" | "preview">("config");
  const [numberOfLevels, setNumberOfLevels] = useState(3);
  const [toneOfVoice, setToneOfVoice] = useState("friendly");
  const [higherScoreMeaning, setHigherScoreMeaning] = useState<"positive" | "negative">("positive");
  const [previewLevels, setPreviewLevels] = useState<OpenMindednessResultLevel[]>([]);
  const [generationCost, setGenerationCost] = useState(0);
  const [showPercentage, setShowPercentage] = useState(false);
  const { toast } = useToast();

  const openMindednessQuestion = questions.find((q) => q.question_type === "open_mindedness");
  const maxScore = openMindednessQuestion?.answers?.length || 0;

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
          .from("open_mindedness_result_levels")
          .select("*")
          .eq("quiz_id", quizId)
          .order("min_score", { ascending: true });

        if (error) throw error;
        setResultLevels(data || []);
      } catch (error) {
        console.error("Error fetching open-mindedness result levels:", error);
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
        .from("open_mindedness_result_levels")
        .delete()
        .eq("quiz_id", quizId);

      // Insert new levels
      if (resultLevels.length > 0) {
        const { error } = await supabase.from("open_mindedness_result_levels").insert(
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

      toast({ title: "Saved", description: "Open-mindedness result levels saved" });
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
    const newLevel: OpenMindednessResultLevel = {
      id: crypto.randomUUID(),
      min_score: 0,
      max_score: maxScore,
      title: {},
      description: {},
      emoji: "🧠",
      color_class: "from-blue-500 to-indigo-600",
    };
    setResultLevels([...resultLevels, newLevel]);
  };

  const updateLevel = (index: number, updates: Partial<OpenMindednessResultLevel>) => {
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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-open-mindedness-results", {
        body: {
          quizId,
          numberOfLevels,
          toneOfVoice,
          higherScoreMeaning,
          language: displayLanguage,
          model,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPreviewLevels(data.resultLevels);
      setGenerationCost(data.estimatedCostEur || 0);
      setDialogStep("preview");
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

  const applyGeneratedLevels = () => {
    setResultLevels(previewLevels);
    setShowGenerateDialog(false);
    setDialogStep("config");
    setPreviewLevels([]);
    toast({ title: "Applied", description: `Applied ${previewLevels.length} result levels` });
  };

  if (!openMindednessQuestion) {
    return null;
  }

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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">Result Levels</Label>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            Max: {maxScore} pts
          </span>
        </div>
        <div className="flex items-center gap-2">
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
          {!isPreviewMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGenerateDialog(true)}
                className="gap-1 h-6 text-xs px-2"
              >
                <Sparkles className="w-3 h-3" />
                AI
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addLevel}
                className="gap-1 h-6 text-xs px-2"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
              <Button
                size="sm"
                onClick={saveLevels}
                disabled={saving}
                className="gap-1 h-6 text-xs px-2"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {resultLevels.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No result levels yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add levels or use AI to generate them.
          </p>
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
                  displayLanguage={displayLanguage}
                  isPreviewMode={isPreviewMode}
                  quizId={quizId}
                  model={model}
                  showPercentage={showPercentage}
                  maxScore={maxScore}
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

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={(open) => {
        setShowGenerateDialog(open);
        if (!open) {
          setDialogStep("config");
          setPreviewLevels([]);
        }
      }}>
        <DialogContent className={dialogStep === "preview" ? "sm:max-w-2xl" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {dialogStep === "config" ? "Generate Open-Mindedness Results" : "Preview Results"}
            </DialogTitle>
            <DialogDescription>
              {dialogStep === "config"
                ? "AI will create result levels based on the open-mindedness question."
                : "Review the generated results before applying them."}
            </DialogDescription>
          </DialogHeader>

          {dialogStep === "config" ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Number of Result Levels</Label>
                  <Input
                    type="number"
                    min={2}
                    max={maxScore}
                    value={numberOfLevels}
                    onChange={(e) => setNumberOfLevels(Math.min(maxScore, Math.max(2, parseInt(e.target.value) || 3)))}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">Between 2 and {maxScore} levels</p>
                </div>

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

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Higher Scores Mean...</Label>
                  <RadioGroup
                    value={higherScoreMeaning}
                    onValueChange={(v) => setHigherScoreMeaning(v as "positive" | "negative")}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="positive" id="om-positive" />
                      <Label htmlFor="om-positive" className="flex items-center gap-2 cursor-pointer">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm">More Open-Minded</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="negative" id="om-negative" />
                      <Label htmlFor="om-negative" className="flex items-center gap-2 cursor-pointer">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-sm">Less Open-Minded</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)} disabled={generating}>
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
              <div className="py-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                    <Euro className="w-3 h-3" />
                    <span>{generationCost.toFixed(4)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {previewLevels.length} levels generated
                  </span>
                </div>

                <ScrollArea className="max-h-[400px] pr-3">
                  <div className="space-y-3">
                    {previewLevels.map((level, index) => (
                      <div
                        key={level.id}
                        className={`border rounded-lg p-3 ${index % 2 === 0 ? "bg-muted/30" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{level.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-sm">
                                {getLocalizedValue(level.title, displayLanguage)}
                              </h4>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                {level.min_score}–{level.max_score} pts
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getLocalizedValue(level.description, displayLanguage)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => setDialogStep("config")} className="gap-1.5">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="gap-1.5"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Regenerate
                  </Button>
                  <Button onClick={applyGeneratedLevels} className="gap-1.5">
                    <Check className="w-4 h-4" />
                    Apply Results
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
