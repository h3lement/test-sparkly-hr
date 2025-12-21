import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { HypothesisQuestionEditor } from "./HypothesisQuestionEditor";
import type { HypothesisPage, HypothesisQuestion } from "@/hooks/useHypothesisQuizData";
import {
  Accordion,
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

interface HypothesisPageEditorProps {
  page: HypothesisPage;
  pageIndex: number;
  language: string;
  onUpdatePage: (updates: Partial<HypothesisPage>) => void;
  onDeletePage: () => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (questionId: string, updates: Partial<HypothesisQuestion>) => void;
  onDeleteQuestion: (questionId: string) => void;
}

export function HypothesisPageEditor({
  page,
  pageIndex,
  language,
  onUpdatePage,
  onDeletePage,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
}: HypothesisPageEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getLocalizedValue = (obj: Record<string, string> | undefined, lang: string): string => {
    if (!obj) return "";
    return obj[lang] || obj["en"] || "";
  };

  const setLocalizedValue = (
    field: "title" | "description",
    lang: string,
    value: string
  ) => {
    const current = page[field] || {};
    onUpdatePage({
      [field]: { ...current, [lang]: value },
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
              {page.page_number}
            </div>
            <CardTitle className="text-lg">
              {getLocalizedValue(page.title, language) || `Page ${page.page_number}`}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              ({page.questions.length} hypothesis{page.questions.length !== 1 ? "es" : ""})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Page</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this page and all its hypotheses?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDeletePage}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Page Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Page Title ({language.toUpperCase()})</Label>
              <Input
                value={getLocalizedValue(page.title, language)}
                onChange={(e) => setLocalizedValue("title", language, e.target.value)}
                placeholder={`e.g., Communication Skills`}
              />
            </div>
            <div className="space-y-2">
              <Label>Page Description ({language.toUpperCase()})</Label>
              <Textarea
                value={getLocalizedValue(page.description, language)}
                onChange={(e) => setLocalizedValue("description", language, e.target.value)}
                placeholder="Brief description of this section..."
                rows={2}
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">Hypotheses</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddQuestion}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Hypothesis
              </Button>
            </div>

            {page.questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                No hypotheses yet. Add your first hypothesis to this page.
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {page.questions
                  .sort((a, b) => a.question_order - b.question_order)
                  .map((question, qIndex) => (
                    <HypothesisQuestionEditor
                      key={question.id}
                      question={question}
                      questionIndex={qIndex}
                      language={language}
                      onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
                      onDelete={() => onDeleteQuestion(question.id)}
                    />
                  ))}
              </Accordion>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
