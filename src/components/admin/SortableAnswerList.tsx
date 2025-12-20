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
import { SortableAnswer } from "./SortableAnswer";
import type { Json } from "@/integrations/supabase/types";

interface Answer {
  id: string;
  answer_text: Json;
  answer_order: number;
  score_value: number;
}

interface SortableAnswerListProps {
  answers: Answer[];
  questionIndex: number;
  displayLanguage: string;
  isPreviewMode: boolean;
  enableScoring: boolean;
  onUpdateAnswer: (questionIndex: number, answerIndex: number, updates: Partial<Answer>) => void;
  onDeleteAnswer: (questionIndex: number, answerIndex: number) => void;
  onReorderAnswers: (questionIndex: number, answers: Answer[]) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

export function SortableAnswerList({
  answers,
  questionIndex,
  displayLanguage,
  isPreviewMode,
  enableScoring,
  onUpdateAnswer,
  onDeleteAnswer,
  onReorderAnswers,
  getLocalizedValue,
  jsonToRecord,
}: SortableAnswerListProps) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = answers.findIndex((a) => a.id === active.id);
      const newIndex = answers.findIndex((a) => a.id === over.id);

      const reorderedAnswers = arrayMove(answers, oldIndex, newIndex).map(
        (answer, idx) => ({
          ...answer,
          answer_order: idx + 1,
        })
      );

      onReorderAnswers(questionIndex, reorderedAnswers);
    }
  };

  if (answers.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded">
        No answers yet
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={answers.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-0 border rounded overflow-hidden">
          {answers.map((answer, aIndex) => (
            <SortableAnswer
              key={answer.id}
              answer={answer}
              questionIndex={questionIndex}
              answerIndex={aIndex}
              isEven={aIndex % 2 === 1}
              displayLanguage={displayLanguage}
              isPreviewMode={isPreviewMode}
              enableScoring={enableScoring}
              onUpdateAnswer={onUpdateAnswer}
              onDeleteAnswer={onDeleteAnswer}
              getLocalizedValue={getLocalizedValue}
              jsonToRecord={jsonToRecord}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
