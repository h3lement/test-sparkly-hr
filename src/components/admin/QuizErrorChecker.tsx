import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { logActivity } from "@/hooks/useActivityLog";
import type { Json } from "@/integrations/supabase/types";

interface Question {
  id: string;
  question_text: Json;
  question_order: number;
  question_type: string;
  answers: Answer[];
}

interface Answer {
  id: string;
  answer_text: Json;
  answer_order: number;
  score_value: number;
}

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

interface QuizError {
  tab: "general" | "questions" | "mindedness" | "results";
  message: string;
}

interface QuizErrorCheckerProps {
  quizId: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  headline: Record<string, string>;
  headlineHighlight: Record<string, string>;
  ctaText: Record<string, string>;
  ctaTemplateId: string | null;
  durationText: Record<string, string>;
  questions: Question[];
  resultLevels: ResultLevel[];
  includeOpenMindedness: boolean;
  primaryLanguage: string;
  getLocalizedValue: (obj: Json | Record<string, string>, lang: string) => string;
}

export interface CheckErrorsResult {
  errors: QuizError[];
  timestamp: string;
  isValid: boolean;
}

export function QuizErrorChecker({
  quizId,
  slug,
  title,
  description,
  headline,
  headlineHighlight,
  ctaText,
  ctaTemplateId,
  durationText,
  questions,
  resultLevels,
  includeOpenMindedness,
  primaryLanguage,
  getLocalizedValue,
}: QuizErrorCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckErrorsResult | null>(null);

  const checkErrors = async () => {
    setIsChecking(true);
    const errors: QuizError[] = [];

    // === GENERAL TAB VALIDATIONS ===
    
    // Slug is required
    if (!slug.trim()) {
      errors.push({ tab: "general", message: "Quiz slug is required" });
    }

    // Title is required in primary language
    if (!getLocalizedValue(title, primaryLanguage)) {
      errors.push({ tab: "general", message: `Quiz title is required (${primaryLanguage.toUpperCase()})` });
    }

    // Headline is required in primary language
    if (!getLocalizedValue(headline, primaryLanguage)) {
      errors.push({ tab: "general", message: `Headline text is required (${primaryLanguage.toUpperCase()})` });
    }

    // Headline highlight is required
    if (!getLocalizedValue(headlineHighlight, primaryLanguage)) {
      errors.push({ tab: "general", message: `Headline highlight is required (${primaryLanguage.toUpperCase()})` });
    }

    // CTA text is required
    if (!getLocalizedValue(ctaText, primaryLanguage)) {
      errors.push({ tab: "general", message: `CTA button text is required (${primaryLanguage.toUpperCase()})` });
    }

    // CTA template is recommended
    if (!ctaTemplateId) {
      errors.push({ tab: "general", message: "CTA template is not linked" });
    }

    // Duration text is recommended
    if (!getLocalizedValue(durationText, primaryLanguage)) {
      errors.push({ tab: "general", message: `Duration text is recommended (${primaryLanguage.toUpperCase()})` });
    }

    // Description is recommended
    if (!getLocalizedValue(description, primaryLanguage)) {
      errors.push({ tab: "general", message: `Quiz description is recommended (${primaryLanguage.toUpperCase()})` });
    }

    // === QUESTIONS TAB VALIDATIONS ===

    // At least one question is required
    const regularQuestions = questions.filter(q => q.question_type !== "open_mindedness");
    if (regularQuestions.length === 0) {
      errors.push({ tab: "questions", message: "At least one question is required" });
    }

    // Each question must have text
    regularQuestions.forEach((q, index) => {
      const questionText = getLocalizedValue(q.question_text, primaryLanguage);
      if (!questionText) {
        errors.push({ 
          tab: "questions", 
          message: `Question ${index + 1} is missing text (${primaryLanguage.toUpperCase()})` 
        });
      }

      // Each question must have at least 2 answers
      if (q.answers.length < 2) {
        errors.push({ 
          tab: "questions", 
          message: `Question ${index + 1} needs at least 2 answers (has ${q.answers.length})` 
        });
      }

      // Each answer must have text
      q.answers.forEach((a, aIndex) => {
        const answerText = getLocalizedValue(a.answer_text, primaryLanguage);
        if (!answerText) {
          errors.push({ 
            tab: "questions", 
            message: `Question ${index + 1}, Answer ${aIndex + 1} is missing text (${primaryLanguage.toUpperCase()})` 
          });
        }
      });
    });

    // === OPEN-MINDEDNESS TAB VALIDATIONS ===
    
    if (includeOpenMindedness) {
      const openMindednessQuestion = questions.find(q => q.question_type === "open_mindedness");
      if (!openMindednessQuestion) {
        errors.push({ 
          tab: "mindedness", 
          message: "Open-Mindedness module is enabled but no question is configured" 
        });
      } else {
        const omQuestionText = getLocalizedValue(openMindednessQuestion.question_text, primaryLanguage);
        if (!omQuestionText) {
          errors.push({ 
            tab: "mindedness", 
            message: `Open-Mindedness question text is missing (${primaryLanguage.toUpperCase()})` 
          });
        }
        if (openMindednessQuestion.answers.length < 3) {
          errors.push({ 
            tab: "mindedness", 
            message: `Open-Mindedness question needs at least 3 options (has ${openMindednessQuestion.answers.length})` 
          });
        }
        openMindednessQuestion.answers.forEach((a, aIndex) => {
          const answerText = getLocalizedValue(a.answer_text, primaryLanguage);
          if (!answerText) {
            errors.push({ 
              tab: "mindedness", 
              message: `Open-Mindedness option ${aIndex + 1} is missing text (${primaryLanguage.toUpperCase()})` 
            });
          }
        });
      }
    }

    // === RESULTS TAB VALIDATIONS ===

    // At least one result level is required
    if (resultLevels.length === 0) {
      errors.push({ tab: "results", message: "At least one result level is required" });
    }

    // Each result level must have title and description
    resultLevels.forEach((level, index) => {
      const levelTitle = getLocalizedValue(level.title, primaryLanguage);
      const levelDesc = getLocalizedValue(level.description, primaryLanguage);
      
      if (!levelTitle) {
        errors.push({ 
          tab: "results", 
          message: `Result level ${index + 1} is missing title (${primaryLanguage.toUpperCase()})` 
        });
      }
      if (!levelDesc) {
        errors.push({ 
          tab: "results", 
          message: `Result level ${index + 1} is missing description (${primaryLanguage.toUpperCase()})` 
        });
      }

      // Check insights
      const insights = Array.isArray(level.insights) ? level.insights : [];
      if (insights.length === 0) {
        errors.push({ 
          tab: "results", 
          message: `Result level ${index + 1} has no insights` 
        });
      }
    });

    // Validate point ranges coverage
    if (resultLevels.length > 0 && regularQuestions.length > 0) {
      let maxPossibleScore = 0;
      let minPossibleScore = 0;
      
      for (const q of regularQuestions) {
        if (q.answers.length > 0) {
          const scores = q.answers.map(a => a.score_value);
          maxPossibleScore += Math.max(...scores);
          minPossibleScore += Math.min(...scores);
        }
      }

      const sortedLevels = [...resultLevels].sort((a, b) => a.min_score - b.min_score);
      
      // Check start coverage
      if (sortedLevels[0]?.min_score > minPossibleScore) {
        errors.push({ 
          tab: "results", 
          message: `Score gap: points ${minPossibleScore}-${sortedLevels[0].min_score - 1} have no result level` 
        });
      }

      // Check gaps and overlaps between levels
      for (let i = 0; i < sortedLevels.length - 1; i++) {
        const current = sortedLevels[i];
        const next = sortedLevels[i + 1];
        
        if (current.max_score + 1 < next.min_score) {
          errors.push({ 
            tab: "results", 
            message: `Score gap: points ${current.max_score + 1}-${next.min_score - 1} have no result level` 
          });
        } else if (current.max_score >= next.min_score) {
          errors.push({ 
            tab: "results", 
            message: `Score overlap: points ${next.min_score}-${current.max_score} covered by multiple levels` 
          });
        }
      }

      // Check end coverage
      const lastLevel = sortedLevels[sortedLevels.length - 1];
      if (lastLevel?.max_score < maxPossibleScore) {
        errors.push({ 
          tab: "results", 
          message: `Score gap: points ${lastLevel.max_score + 1}-${maxPossibleScore} have no result level` 
        });
      }
    }

    const timestamp = new Date().toISOString();
    const result: CheckErrorsResult = {
      errors,
      timestamp,
      isValid: errors.length === 0,
    };

    setLastCheck(result);

    // Log to activity log
    await logActivity({
      actionType: "STATUS_CHANGE",
      tableName: "quizzes",
      recordId: quizId,
      fieldName: "error_check",
      oldValue: null,
      newValue: JSON.stringify({
        errorCount: errors.length,
        isValid: result.isValid,
        errors: errors.map(e => `[${e.tab}] ${e.message}`),
      }),
      description: result.isValid 
        ? "Error check passed - quiz is ready to launch" 
        : `Error check found ${errors.length} issue(s)`,
    });

    setIsChecking(false);
    return result;
  };

  return {
    isChecking,
    lastCheck,
    checkErrors,
  };
}

// Component to display errors under tabs
export function QuizErrorDisplay({ 
  errors, 
  activeTab 
}: { 
  errors: QuizError[]; 
  activeTab: string;
}) {
  const tabErrors = errors.filter(e => e.tab === activeTab);
  
  if (tabErrors.length === 0) return null;

  return (
    <div className="bg-destructive text-destructive-foreground rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold mb-2">
            {tabErrors.length} issue{tabErrors.length > 1 ? "s" : ""} found in this section:
          </h4>
          <ol className="list-decimal list-inside space-y-1">
            {tabErrors.map((error, index) => (
              <li key={index} className="text-sm">
                {error.message}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// Button component for triggering check
export function CheckErrorsButton({
  onClick,
  isChecking,
  lastCheck,
  onFixClick,
}: {
  onClick: () => void;
  isChecking: boolean;
  lastCheck: CheckErrorsResult | null;
  onFixClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={lastCheck?.isValid === false ? "destructive" : "outline"}
        size="sm"
        onClick={onClick}
        disabled={isChecking}
        className="gap-2"
      >
        {isChecking ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : lastCheck?.isValid === true ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : lastCheck?.isValid === false ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
        {isChecking ? "Checking..." : lastCheck?.isValid === false ? `${lastCheck.errors.length} Issues` : "Check Errors"}
      </Button>
      
      {/* Fix button - only show when there are errors */}
      {lastCheck?.isValid === false && onFixClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFixClick}
          className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Fix
        </Button>
      )}
    </div>
  );
}

// Helper to get first tab with errors
export function getFirstErrorTab(errors: QuizError[]): "general" | "questions" | "mindedness" | "results" | null {
  const tabOrder: Array<"general" | "questions" | "mindedness" | "results"> = ["general", "questions", "mindedness", "results"];
  for (const tab of tabOrder) {
    if (errors.some(e => e.tab === tab)) {
      return tab;
    }
  }
  return null;
}
