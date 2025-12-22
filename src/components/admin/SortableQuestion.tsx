import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SortableAnswerList } from "./SortableAnswerList";
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

interface SortableQuestionProps {
  question: Question;
  index: number;
  isEven: boolean;
  displayLanguage: string;
  isPreviewMode: boolean;
  enableScoring: boolean;
  onUpdateQuestion: (index: number, updates: Partial<Question>) => void;
  onDeleteQuestion: (index: number) => void;
  onDuplicateQuestion: (index: number) => void;
  onAddAnswer: (questionIndex: number) => void;
  onUpdateAnswer: (questionIndex: number, answerIndex: number, updates: Partial<Answer>) => void;
  onDeleteAnswer: (questionIndex: number, answerIndex: number) => void;
  onReorderAnswers: (questionIndex: number, answers: Answer[]) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

export function SortableQuestion({
  question,
  index,
  isEven,
  displayLanguage,
  isPreviewMode,
  enableScoring,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onAddAnswer,
  onUpdateAnswer,
  onDeleteAnswer,
  onReorderAnswers,
  getLocalizedValue,
  jsonToRecord,
}: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled: isPreviewMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      style={style}
      value={question.id}
      className={`border-b last:border-b-0 px-3 py-0 list-row-interactive ${isEven ? 'list-row-odd' : 'list-row-even'}`}
    >
      <AccordionTrigger className="hover:no-underline py-2">
        <div className="flex items-center gap-1.5 text-left text-sm">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
          <span className="font-medium">
            Q{index + 1}: {getLocalizedValue(question.question_text, displayLanguage) || "New Question"}
          </span>
          <span className="text-xs text-muted-foreground">
            ({question.answers.length})
          </span>
          {enableScoring && question.answers.length > 0 && (
            <span className="text-xs text-primary/70 font-medium ml-1">
              {Math.max(...question.answers.map(a => a.score_value))} pts
            </span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-2 pt-2 pb-3">
        <div>
          <Label className="text-xs">Question ({displayLanguage.toUpperCase()})</Label>
          <Textarea
            value={getLocalizedValue(question.question_text, displayLanguage)}
            onChange={(e) => {
              const updated = { ...jsonToRecord(question.question_text), [displayLanguage]: e.target.value };
              onUpdateQuestion(index, { question_text: updated });
            }}
            placeholder="Enter question text"
            rows={2}
            className="resize-none text-sm"
            disabled={isPreviewMode}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Answers</Label>
            {!isPreviewMode && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => onAddAnswer(index)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            )}
          </div>

          <SortableAnswerList
            answers={question.answers}
            questionIndex={index}
            displayLanguage={displayLanguage}
            isPreviewMode={isPreviewMode}
            enableScoring={enableScoring}
            onUpdateAnswer={onUpdateAnswer}
            onDeleteAnswer={onDeleteAnswer}
            onReorderAnswers={onReorderAnswers}
            getLocalizedValue={getLocalizedValue}
            jsonToRecord={jsonToRecord}
          />
        </div>

        {!isPreviewMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onDuplicateQuestion(index)}
            >
              <Copy className="w-3 h-3 mr-1" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onDeleteQuestion(index)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
