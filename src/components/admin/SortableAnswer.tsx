import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Json } from "@/integrations/supabase/types";

interface Answer {
  id: string;
  answer_text: Json;
  answer_order: number;
  score_value: number;
}

interface SortableAnswerProps {
  answer: Answer;
  questionIndex: number;
  answerIndex: number;
  isEven: boolean;
  displayLanguage: string;
  isPreviewMode: boolean;
  enableScoring: boolean;
  onUpdateAnswer: (questionIndex: number, answerIndex: number, updates: Partial<Answer>) => void;
  onDeleteAnswer: (questionIndex: number, answerIndex: number) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

export function SortableAnswer({
  answer,
  questionIndex,
  answerIndex,
  isEven,
  displayLanguage,
  isPreviewMode,
  enableScoring,
  onUpdateAnswer,
  onDeleteAnswer,
  getLocalizedValue,
  jsonToRecord,
}: SortableAnswerProps) {
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
      className={`flex items-center gap-2 p-2 border-b last:border-b-0 list-row-interactive ${isEven ? 'list-row-odd' : 'list-row-even'}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </div>
      <Input
        value={getLocalizedValue(answer.answer_text, displayLanguage)}
        onChange={(e) => {
          const updated = { ...jsonToRecord(answer.answer_text), [displayLanguage]: e.target.value };
          onUpdateAnswer(questionIndex, answerIndex, { answer_text: updated });
        }}
        placeholder={`Answer ${answerIndex + 1}`}
        className="flex-1 h-7 text-sm"
        disabled={isPreviewMode}
      />
      {enableScoring && (
        <Input
          type="number"
          value={answer.score_value}
          onChange={(e) =>
            onUpdateAnswer(questionIndex, answerIndex, {
              score_value: parseInt(e.target.value) || 0,
            })
          }
          className="w-14 h-7 text-sm text-center"
          title="Score"
          disabled={isPreviewMode}
        />
      )}
      {!isPreviewMode && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDeleteAnswer(questionIndex, answerIndex)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
