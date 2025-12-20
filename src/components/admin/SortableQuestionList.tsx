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
} from "@dnd-kit/sortable";
import { Accordion } from "@/components/ui/accordion";
import { SortableQuestion } from "./SortableQuestion";
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

interface SortableQuestionListProps {
  questions: Question[];
  displayLanguage: string;
  isPreviewMode: boolean;
  enableScoring: boolean;
  onReorderQuestions: (questions: Question[]) => void;
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

export function SortableQuestionList({
  questions,
  displayLanguage,
  isPreviewMode,
  enableScoring,
  onReorderQuestions,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onAddAnswer,
  onUpdateAnswer,
  onDeleteAnswer,
  onReorderAnswers,
  getLocalizedValue,
  jsonToRecord,
}: SortableQuestionListProps) {
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

  // Filter out open_mindedness questions for the main list
  const regularQuestions = questions.filter((q) => q.question_type !== "open_mindedness");

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = regularQuestions.findIndex((q) => q.id === active.id);
      const newIndex = regularQuestions.findIndex((q) => q.id === over.id);

      // Reorder only regular questions
      const reorderedRegular = arrayMove(regularQuestions, oldIndex, newIndex).map(
        (question, idx) => ({
          ...question,
          question_order: idx + 1,
        })
      );

      // Merge back with open_mindedness questions (keep at end)
      const openMindednessQuestions = questions.filter(
        (q) => q.question_type === "open_mindedness"
      );

      onReorderQuestions([...reorderedRegular, ...openMindednessQuestions]);
    }
  };

  if (regularQuestions.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed rounded-lg">
        <p className="text-muted-foreground text-sm">No questions yet. Add your first question!</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={regularQuestions.map((q) => q.id)}
        strategy={verticalListSortingStrategy}
      >
        <Accordion type="single" collapsible className="space-y-0 border rounded-lg overflow-hidden">
          {regularQuestions.map((question, filteredIndex) => {
            const qIndex = questions.findIndex((q) => q.id === question.id);
            return (
              <SortableQuestion
                key={question.id}
                question={question}
                index={filteredIndex}
                isEven={filteredIndex % 2 === 1}
                displayLanguage={displayLanguage}
                isPreviewMode={isPreviewMode}
                enableScoring={enableScoring}
                onUpdateQuestion={(_, updates) => onUpdateQuestion(qIndex, updates)}
                onDeleteQuestion={() => onDeleteQuestion(qIndex)}
                onDuplicateQuestion={() => onDuplicateQuestion(qIndex)}
                onAddAnswer={() => onAddAnswer(qIndex)}
                onUpdateAnswer={(_, answerIndex, updates) =>
                  onUpdateAnswer(qIndex, answerIndex, updates)
                }
                onDeleteAnswer={(_, answerIndex) => onDeleteAnswer(qIndex, answerIndex)}
                onReorderAnswers={(_, answers) => onReorderAnswers(qIndex, answers)}
                getLocalizedValue={getLocalizedValue}
                jsonToRecord={jsonToRecord}
              />
            );
          })}
        </Accordion>
      </SortableContext>
    </DndContext>
  );
}
