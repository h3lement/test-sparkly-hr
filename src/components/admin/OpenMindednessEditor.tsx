import { useState, useEffect } from "react";
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

interface OpenMindednessEditorProps {
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  displayLanguage: string;
  isPreviewMode: boolean;
  includeOpenMindedness: boolean;
}

export function OpenMindednessEditor({
  questions,
  setQuestions,
  displayLanguage,
  isPreviewMode,
  includeOpenMindedness,
}: OpenMindednessEditorProps) {
  const openMindednessQuestion = questions.find(q => q.question_type === "open_mindedness");

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

  if (!includeOpenMindedness) {
    return null;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">Open-Mindedness Question</h3>
        <span className="text-xs text-muted-foreground">(Multi-select checkboxes)</span>
      </div>

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
              <Label className="text-xs">Options (users can select multiple)</Label>
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

            {openMindednessQuestion.answers.map((answer, index) => (
              <div
                key={answer.id}
                className="flex items-center gap-2 p-2 bg-background rounded border"
              >
                <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <Checkbox disabled className="opacity-50" />
                <Input
                  value={getLocalizedValue(answer.answer_text, displayLanguage)}
                  onChange={(e) => {
                    const updated = { ...jsonToRecord(answer.answer_text), [displayLanguage]: e.target.value };
                    updateOption(index, { answer_text: updated });
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 h-7 text-sm"
                  disabled={isPreviewMode}
                />
                {!isPreviewMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteOption(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
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
