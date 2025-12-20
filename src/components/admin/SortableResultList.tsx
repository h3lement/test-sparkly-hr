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
import { SortableResultLevel } from "./SortableResultLevel";
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

interface SortableResultListProps {
  resultLevels: ResultLevel[];
  displayLanguage: string;
  isPreviewMode: boolean;
  quizId?: string;
  model?: string;
  onReorderLevels: (levels: ResultLevel[]) => void;
  onUpdateLevel: (index: number, updates: Partial<ResultLevel>) => void;
  onDeleteLevel: (index: number) => void;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
  jsonToRecord: (json: Json | undefined) => Record<string, string>;
}

export function SortableResultList({
  resultLevels,
  displayLanguage,
  isPreviewMode,
  quizId,
  model,
  onReorderLevels,
  onUpdateLevel,
  onDeleteLevel,
  getLocalizedValue,
  jsonToRecord,
}: SortableResultListProps) {
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
      const oldIndex = resultLevels.findIndex((l) => l.id === active.id);
      const newIndex = resultLevels.findIndex((l) => l.id === over.id);

      const reorderedLevels = arrayMove(resultLevels, oldIndex, newIndex);
      onReorderLevels(reorderedLevels);
    }
  };

  if (resultLevels.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed rounded-lg">
        <p className="text-muted-foreground text-sm">No result levels yet. Add your first level!</p>
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
        items={resultLevels.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="border rounded-lg overflow-hidden">
          {resultLevels.map((level, index) => (
            <SortableResultLevel
              key={level.id}
              level={level}
              index={index}
              isEven={index % 2 === 1}
              displayLanguage={displayLanguage}
              isPreviewMode={isPreviewMode}
              quizId={quizId}
              model={model}
              onUpdateLevel={onUpdateLevel}
              onDeleteLevel={onDeleteLevel}
              getLocalizedValue={getLocalizedValue}
              jsonToRecord={jsonToRecord}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
