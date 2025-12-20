import { useState, useEffect } from "react";
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
import { Plus, Trash2, GripVertical, Brain } from "lucide-react";
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

interface SortableOptionProps {
  answer: Answer;
  index: number;
  displayLanguage: string;
  isPreviewMode: boolean;
  enableScoring: boolean;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
  onUpdate: (index: number, updates: Partial<Answer>) => void;
  onDelete: (index: number) => void;
}

function SortableOption({
  answer,
  index,
  displayLanguage,
  isPreviewMode,
  enableScoring,
  getLocalizedValue,
  jsonToRecord,
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
          const updated = { ...jsonToRecord(answer.answer_text), [displayLanguage]: e.target.value };
          onUpdate(index, { answer_text: updated });
        }}
        placeholder={`Option ${index + 1}`}
        className="flex-1 h-7 text-sm"
        disabled={isPreviewMode}
      />
      {enableScoring && (
        <Input
          type="number"
          value={answer.score_value}
          onChange={(e) => onUpdate(index, { score_value: parseInt(e.target.value) || 0 })}
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
          onClick={() => onDelete(index)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

interface OpenMindednessEditorProps {
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  displayLanguage: string;
  isPreviewMode: boolean;
  includeOpenMindedness: boolean;
  enableScoring?: boolean;
}

export function OpenMindednessEditor({
  questions,
  setQuestions,
  displayLanguage,
  isPreviewMode,
  includeOpenMindedness,
  enableScoring = true,
}: OpenMindednessEditorProps) {
  const openMindednessQuestion = questions.find(q => q.question_type === "open_mindedness");

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

  const jsonToRecord = (json: Json | undefined): Record<string, string> => {
    if (!json) return {};
    if (typeof json === "string") return { en: json };
    if (typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, string>;
    }
    return {};
  };

  const getLocalizedValue = (obj: Json | Record<string, string>, lang: string): string => {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, string>)[lang] || "";
    }
    return "";
  };

  const createOpenMindednessQuestion = () => {
    const maxOrder = questions.length > 0 
      ? Math.max(...questions.map(q => q.question_order)) + 1 
      : 1;
    
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      question_text: { 
        en: "Which of the following methods would you be open to exploring?",
        et: "Milliseid järgmistest meetoditest oleksite avatud uurima?"
      },
      question_order: maxOrder,
      question_type: "open_mindedness",
      answers: [
        { id: `new-${Date.now()}-1`, answer_text: { en: "1:1 Coaching", et: "1:1 Coaching" }, answer_order: 1, score_value: 1 },
        { id: `new-${Date.now()}-2`, answer_text: { en: "Group workshops", et: "Rühmatöötoad" }, answer_order: 2, score_value: 1 },
        { id: `new-${Date.now()}-3`, answer_text: { en: "Online courses", et: "Veebikursused" }, answer_order: 3, score_value: 1 },
        { id: `new-${Date.now()}-4`, answer_text: { en: "Mentoring programs", et: "Mentorlusprogrammid" }, answer_order: 4, score_value: 1 },
      ],
    };
    
    setQuestions(prev => [...prev, newQuestion]);
  };

  const updateQuestion = (updates: Partial<Question>) => {
    if (!openMindednessQuestion) return;
    setQuestions(prev => 
      prev.map(q => q.id === openMindednessQuestion.id ? { ...q, ...updates } : q)
    );
  };

  const addOption = () => {
    if (!openMindednessQuestion) return;
    const maxOrder = openMindednessQuestion.answers.length > 0
      ? Math.max(...openMindednessQuestion.answers.map(a => a.answer_order)) + 1
      : 1;
    
    const newAnswer: Answer = {
      id: `new-${Date.now()}`,
      answer_text: { en: "", et: "" },
      answer_order: maxOrder,
      score_value: 1,
    };
    
    updateQuestion({ answers: [...openMindednessQuestion.answers, newAnswer] });
  };

  const updateOption = (index: number, updates: Partial<Answer>) => {
    if (!openMindednessQuestion) return;
    const newAnswers = [...openMindednessQuestion.answers];
    newAnswers[index] = { ...newAnswers[index], ...updates };
    updateQuestion({ answers: newAnswers });
  };

  const deleteOption = (index: number) => {
    if (!openMindednessQuestion) return;
    updateQuestion({ answers: openMindednessQuestion.answers.filter((_, i) => i !== index) });
  };

  const deleteQuestion = () => {
    if (!openMindednessQuestion) return;
    setQuestions(prev => prev.filter(q => q.id !== openMindednessQuestion.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!openMindednessQuestion || !over || active.id === over.id) return;

    const oldIndex = openMindednessQuestion.answers.findIndex(a => a.id === active.id);
    const newIndex = openMindednessQuestion.answers.findIndex(a => a.id === over.id);

    const reorderedAnswers = arrayMove(openMindednessQuestion.answers, oldIndex, newIndex).map(
      (answer, idx) => ({
        ...answer,
        answer_order: idx + 1,
      })
    );

    updateQuestion({ answers: reorderedAnswers });
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

  return (
    <div>

      {!openMindednessQuestion ? (
        <div className="text-center py-6 border rounded-lg border-dashed">
          <p className="text-sm text-muted-foreground mb-3">
            No open-mindedness question configured yet.
          </p>
          {!isPreviewMode && (
            <Button onClick={createOpenMindednessQuestion} variant="outline" size="sm">
              <Plus className="w-3 h-3 mr-1" />
              Create Open-Mindedness Question
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div>
            <Label className="text-xs">Question Text ({displayLanguage.toUpperCase()})</Label>
            <Textarea
              value={getLocalizedValue(openMindednessQuestion.question_text, displayLanguage)}
              onChange={(e) => {
                const updated = { ...jsonToRecord(openMindednessQuestion.question_text), [displayLanguage]: e.target.value };
                updateQuestion({ question_text: updated });
              }}
              placeholder="Enter question text"
              rows={2}
              className="resize-none text-sm"
              disabled={isPreviewMode}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Options (users can select multiple) — drag to reorder</Label>
              {!isPreviewMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={addOption}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Option
                </Button>
              )}
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={openMindednessQuestion.answers.map(a => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {openMindednessQuestion.answers.map((answer, index) => (
                    <SortableOption
                      key={answer.id}
                      answer={answer}
                      index={index}
                      displayLanguage={displayLanguage}
                      isPreviewMode={isPreviewMode}
                      enableScoring={enableScoring}
                      getLocalizedValue={getLocalizedValue}
                      jsonToRecord={jsonToRecord}
                      onUpdate={updateOption}
                      onDelete={deleteOption}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <p className="text-xs text-muted-foreground">
            This question appears after all regular questions and allows users to select multiple options.
          </p>

          {!isPreviewMode && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={deleteQuestion}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remove Open-Mindedness Question
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
