import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  onUpdateLevel,
  onDeleteLevel,
  getLocalizedValue,
  jsonToRecord,
}: SortableResultLevelProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 border-b last:border-b-0 space-y-3 ${isEven ? 'bg-muted/40' : ''}`}
    >
      {/* Row 1: Title and controls */}
      <div className="flex items-center gap-3">
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
          <Input
            type="number"
            value={level.min_score}
            onChange={(e) =>
              onUpdateLevel(index, { min_score: parseInt(e.target.value) || 0 })
            }
            className="h-7 w-14 text-sm text-center"
            title="Min score"
            disabled={isPreviewMode}
          />
          <span className="text-sm text-muted-foreground">–</span>
          <Input
            type="number"
            value={level.max_score}
            onChange={(e) =>
              onUpdateLevel(index, { max_score: parseInt(e.target.value) || 0 })
            }
            className="h-7 w-14 text-sm text-center"
            title="Max score"
            disabled={isPreviewMode}
          />
        </div>
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
