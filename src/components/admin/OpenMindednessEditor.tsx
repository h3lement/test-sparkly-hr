import { useState } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Brain, Globe, Loader2 } from "lucide-react";
import { useGlobalOpenMindedness, GlobalOMAnswer } from "@/hooks/useGlobalOpenMindedness";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SortableOptionProps {
  answer: GlobalOMAnswer;
  index: number;
  displayLanguage: string;
  isPreviewMode: boolean;
  enableScoring: boolean;
  onUpdate: (answerId: string, updates: Partial<GlobalOMAnswer>) => void;
  onDelete: (answerId: string) => void;
}

function SortableOption({
  answer,
  index,
  displayLanguage,
  isPreviewMode,
  enableScoring,
  onUpdate,
  onDelete,
}: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: answer.id, disabled: isPreviewMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getLocalizedValue = (obj: Record<string, string>, lang: string): string => {
    return obj[lang] || obj['en'] || "";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-background rounded border"
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing touch-none ${isPreviewMode ? 'opacity-30' : ''}`}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </div>
      <Checkbox disabled className="opacity-50" />
      <Input
        value={getLocalizedValue(answer.answer_text, displayLanguage)}
        onChange={(e) => {
          const updated = { ...answer.answer_text, [displayLanguage]: e.target.value };
          onUpdate(answer.id, { answer_text: updated });
        }}
        placeholder={`Option ${index + 1}`}
        className="flex-1 h-7 text-sm"
        disabled={isPreviewMode}
      />
      {enableScoring && (
        <Input
          type="number"
          value={answer.score_value}
          onChange={(e) => onUpdate(answer.id, { score_value: parseInt(e.target.value) || 0 })}
          className="w-14 h-7 text-sm text-center"
          disabled={isPreviewMode}
          min={0}
          title="Points when selected"
        />
      )}
      {!isPreviewMode && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(answer.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

interface OpenMindednessEditorProps {
  displayLanguage: string;
  isPreviewMode: boolean;
  includeOpenMindedness: boolean;
  enableScoring?: boolean;
  // Legacy props - no longer used but kept for backward compatibility
  questions?: any[];
  setQuestions?: any;
}

export function OpenMindednessEditor({
  displayLanguage,
  isPreviewMode,
  includeOpenMindedness,
  enableScoring = true,
}: OpenMindednessEditorProps) {
  const {
    module,
    loading,
    error,
    updateQuestionText,
    updateAnswer,
    addAnswer,
    deleteAnswer,
    reorderAnswers,
    saving,
  } = useGlobalOpenMindedness();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getLocalizedValue = (obj: Record<string, string>, lang: string): string => {
    return obj[lang] || obj['en'] || "";
  };

  const handleAddOption = () => {
    addAnswer({ en: "", [displayLanguage]: "" });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!module || !over || active.id === over.id) return;

    const oldIndex = module.answers.findIndex(a => a.id === active.id);
    const newIndex = module.answers.findIndex(a => a.id === over.id);

    const reordered = arrayMove(module.answers, oldIndex, newIndex);
    reorderAnswers(reordered);
  };

  if (!includeOpenMindedness) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed bg-muted/30">
        <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Enable the Open-Mindedness module above to configure the question.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading global module...</p>
      </div>
    );
  }

  if (error || !module) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Failed to load open-mindedness module'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <Alert className="mb-4 bg-primary/5 border-primary/20">
        <Globe className="w-4 h-4" />
        <AlertDescription className="text-xs">
          <strong>Global Module:</strong> Changes here apply to ALL quizzes. Edit translations for each language using the language selector above.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
        <div>
          <Label className="text-xs">Question Text ({displayLanguage.toUpperCase()})</Label>
          <Textarea
            value={getLocalizedValue(module.question_text, displayLanguage)}
            onChange={(e) => {
              const updated = { ...module.question_text, [displayLanguage]: e.target.value };
              updateQuestionText(updated);
            }}
            placeholder="Enter question text"
            rows={2}
            className="resize-none text-sm"
            disabled={isPreviewMode || saving}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Options (users can select multiple) — drag to reorder</Label>
              {enableScoring && (
                <span className="text-xs text-muted-foreground">
                  • Max pts: <span className="font-medium text-primary">{module.answers.reduce((sum, a) => sum + (a.score_value || 0), 0)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {enableScoring && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">pts</span>
              )}
              {!isPreviewMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={handleAddOption}
                  disabled={saving}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Option
                </Button>
              )}
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={module.answers.map(a => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {module.answers.map((answer, index) => (
                  <SortableOption
                    key={answer.id}
                    answer={answer}
                    index={index}
                    displayLanguage={displayLanguage}
                    isPreviewMode={isPreviewMode || saving}
                    enableScoring={enableScoring}
                    onUpdate={updateAnswer}
                    onDelete={deleteAnswer}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <p className="text-xs text-muted-foreground">
          This question appears after all regular questions and allows users to select multiple options.
          <br />
          <strong>Note:</strong> This module cannot be deleted — only toggled on/off per quiz.
        </p>
      </div>
    </div>
  );
}
