import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, GripVertical, MessageSquare, Lightbulb, HelpCircle } from "lucide-react";
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
  overallNumber: number;
  language: string;
  onUpdate: (updates: Partial<HypothesisQuestion>) => void;
  onDelete: () => void;
}

export function HypothesisQuestionEditor({
  question,
  questionIndex,
  overallNumber,
  language,
  onUpdate,
  onDelete,
}: HypothesisQuestionEditorProps) {
  const getLocalizedValue = (obj: Record<string, string> | undefined, lang: string): string => {
    if (!obj) return "";
    return obj[lang] || obj["en"] || "";
  };

  const setLocalizedValue = (
    field: "hypothesis_text" | "hypothesis_text_woman" | "hypothesis_text_man" | "interview_question" | "interview_question_woman" | "interview_question_man" | "truth_explanation",
    lang: string,
    value: string
  ) => {
    const current = question[field] || {};
    onUpdate({
      [field]: { ...current, [lang]: value },
    });
  };

  // Show woman's hypothesis in preview, fallback to generic
  const hypothesisPreviewWoman = getLocalizedValue(question.hypothesis_text_woman, language);
  const hypothesisPreviewMan = getLocalizedValue(question.hypothesis_text_man, language);
  const hypothesisPreview = hypothesisPreviewWoman || hypothesisPreviewMan || getLocalizedValue(question.hypothesis_text, language);

  return (
    <AccordionItem value={question.id} className="border rounded-lg bg-secondary/30">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 text-left">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <span className="font-medium text-sm text-muted-foreground w-8">
            {overallNumber}. Hypothesis
          </span>
          <span className="flex-1 truncate text-foreground">
            {hypothesisPreview || "New hypothesis..."}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4 pt-2">
          {/* Women and Men Columns - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Women Column */}
            <div className="space-y-4 p-4 bg-pink-50 dark:bg-pink-950/20 rounded-lg border border-pink-200 dark:border-pink-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">👩</span>
                <Label className="font-semibold text-pink-700 dark:text-pink-300">Women 50+</Label>
              </div>
              
              {/* Hypothesis for Women */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-pink-500" />
                  <Label className="text-sm font-medium">Hypothesis ({language.toUpperCase()})</Label>
                </div>
                <Textarea
                  value={getLocalizedValue(question.hypothesis_text_woman, language)}
                  onChange={(e) => setLocalizedValue("hypothesis_text_woman", language, e.target.value)}
                  placeholder="e.g. Cannot maintain long pace"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* Correct Answer with Points */}
              <div className="flex items-center justify-between p-2 bg-pink-100 dark:bg-pink-900/30 rounded">
                <span className="text-sm font-medium">Correct:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!question.correct_answer_woman ? 'font-bold text-red-600' : 'text-muted-foreground'}`}>
                    False (0pt)
                  </span>
                  <Switch
                    checked={question.correct_answer_woman}
                    onCheckedChange={(checked) => onUpdate({ correct_answer_woman: checked })}
                  />
                  <span className={`text-sm ${question.correct_answer_woman ? 'font-bold text-green-600' : 'text-muted-foreground'}`}>
                    True (1pt)
                  </span>
                </div>
              </div>
            </div>

            {/* Men Column */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">👨</span>
                <Label className="font-semibold text-blue-700 dark:text-blue-300">Men 50+</Label>
              </div>
              
              {/* Hypothesis for Men */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium">Hypothesis ({language.toUpperCase()})</Label>
                </div>
                <Textarea
                  value={getLocalizedValue(question.hypothesis_text_man, language)}
                  onChange={(e) => setLocalizedValue("hypothesis_text_man", language, e.target.value)}
                  placeholder="e.g. Is slow"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* Correct Answer with Points */}
              <div className="flex items-center justify-between p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                <span className="text-sm font-medium">Correct:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!question.correct_answer_man ? 'font-bold text-red-600' : 'text-muted-foreground'}`}>
                    False (0pt)
                  </span>
                  <Switch
                    checked={question.correct_answer_man}
                    onCheckedChange={(checked) => onUpdate({ correct_answer_man: checked })}
                  />
                  <span className={`text-sm ${question.correct_answer_man ? 'font-bold text-green-600' : 'text-muted-foreground'}`}>
                    True (1pt)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Shared Interview Question */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <Label className="font-medium">Interview Question ({language.toUpperCase()})</Label>
            </div>
            <Textarea
              value={getLocalizedValue(question.interview_question, language)}
              onChange={(e) => setLocalizedValue("interview_question", language, e.target.value)}
              placeholder="The interview question to ask candidates..."
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This interview question applies to both women and men.
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
