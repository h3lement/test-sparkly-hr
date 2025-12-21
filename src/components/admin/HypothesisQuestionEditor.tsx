import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, GripVertical, MessageSquare, Lightbulb, HelpCircle, CheckCircle2 } from "lucide-react";
import type { HypothesisQuestion } from "@/hooks/useHypothesisQuizData";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface HypothesisQuestionEditorProps {
  question: HypothesisQuestion;
  questionIndex: number;
  language: string;
  onUpdate: (updates: Partial<HypothesisQuestion>) => void;
  onDelete: () => void;
}

export function HypothesisQuestionEditor({
  question,
  questionIndex,
  language,
  onUpdate,
  onDelete,
}: HypothesisQuestionEditorProps) {
  const getLocalizedValue = (obj: Record<string, string> | undefined, lang: string): string => {
    if (!obj) return "";
    return obj[lang] || obj["en"] || "";
  };

  const setLocalizedValue = (
    field: "hypothesis_text" | "interview_question" | "truth_explanation",
    lang: string,
    value: string
  ) => {
    const current = question[field] || {};
    onUpdate({
      [field]: { ...current, [lang]: value },
    });
  };

  const hypothesisPreview = getLocalizedValue(question.hypothesis_text, language);

  return (
    <AccordionItem value={question.id} className="border rounded-lg bg-secondary/30">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 text-left">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <span className="font-medium text-sm text-muted-foreground w-6">
            #{questionIndex + 1}
          </span>
          <span className="flex-1 truncate text-foreground">
            {hypothesisPreview || "New hypothesis..."}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4 pt-2">
          {/* Hypothesis Text */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-500" />
              <Label className="font-medium">Hypothesis ({language.toUpperCase()})</Label>
            </div>
            <Textarea
              value={getLocalizedValue(question.hypothesis_text, language)}
              onChange={(e) => setLocalizedValue("hypothesis_text", language, e.target.value)}
              placeholder="Enter the hypothesis statement that quiz takers will evaluate..."
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This is the statement users will answer True/False to for both Women and Men.
            </p>
          </div>

          {/* Correct Answers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <Label className="font-medium">Correct Answers</Label>
            </div>
            <div className="flex gap-6 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">👩 Women 50+:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!question.correct_answer_woman ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    False
                  </span>
                  <Switch
                    checked={question.correct_answer_woman}
                    onCheckedChange={(checked) => onUpdate({ correct_answer_woman: checked })}
                  />
                  <span className={`text-sm ${question.correct_answer_woman ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    True
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">👨 Men 50+:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!question.correct_answer_man ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    False
                  </span>
                  <Switch
                    checked={question.correct_answer_man}
                    onCheckedChange={(checked) => onUpdate({ correct_answer_man: checked })}
                  />
                  <span className={`text-sm ${question.correct_answer_man ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    True
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Set the correct answer for each gender. Users will see if they got it right after answering.
            </p>
          </div>

          {/* Interview Question */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <Label className="font-medium">Interview Question ({language.toUpperCase()})</Label>
            </div>
            <Textarea
              value={getLocalizedValue(question.interview_question, language)}
              onChange={(e) => setLocalizedValue("interview_question", language, e.target.value)}
              placeholder="The actual interview question recruiters should ask..."
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This is shown after the user answers, as the recommended interview question.
            </p>
          </div>

          {/* Truth Explanation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-green-500" />
              <Label className="font-medium">The Truth ({language.toUpperCase()})</Label>
            </div>
            <Textarea
              value={getLocalizedValue(question.truth_explanation, language)}
              onChange={(e) => setLocalizedValue("truth_explanation", language, e.target.value)}
              placeholder="Explain why this hypothesis is actually wrong and what the reality is..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Detailed explanation shown after email capture. Explains the reality behind the myth.
            </p>
          </div>

          {/* Delete Button */}
          <div className="flex justify-end pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Hypothesis
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Hypothesis</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this hypothesis?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
