import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Lock, MessageSquare, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnswerValue = boolean | null;

interface RowAnswer {
  answer: AnswerValue;
  revealed: boolean;
}

export function HypothesisQuestionScreen() {
  const {
    quizData,
    pages,
    getCurrentPage,
    getQuestionsForPage,
    currentPageIndex,
    setCurrentPageIndex,
    addResponse,
    responses,
    sessionId,
    setCurrentStep,
    getProgress,
  } = useHypothesisQuiz();
  const { language } = useLanguage();

  const [rowAnswers, setRowAnswers] = useState<Record<string, RowAnswer>>({});
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPage = getCurrentPage();
  const progress = getProgress();
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const pageQuestions = currentPage ? getQuestionsForPage(currentPage.id) : [];

  // Initialize row answers when page changes
  useEffect(() => {
    if (!currentPage) return;
    
    const initialAnswers: Record<string, RowAnswer> = {};
    let firstUnanswered = 0;
    
    pageQuestions.forEach((q, idx) => {
      const existingResponse = responses.find(r => r.questionId === q.id);
      if (existingResponse) {
        // Use the woman answer as the single answer (they should be the same)
        initialAnswers[q.id] = {
          answer: existingResponse.answerWoman,
          revealed: true,
        };
        firstUnanswered = idx + 1;
      } else {
        initialAnswers[q.id] = { answer: null, revealed: false };
      }
    });
    
    setRowAnswers(initialAnswers);
    setActiveRowIndex(Math.min(firstUnanswered, pageQuestions.length - 1));
  }, [currentPage?.id, pageQuestions.length]);

  // Handle single answer selection
  const handleAnswer = async (questionId: string, value: boolean) => {
    const currentAnswer = rowAnswers[questionId] || { answer: null, revealed: false };
    
    if (currentAnswer.revealed) return; // Already answered

    setRowAnswers(prev => ({
      ...prev,
      [questionId]: { answer: value, revealed: false },
    }));

    // Immediately reveal after selecting an answer
    await revealInterview(questionId, value);
  };

  const revealInterview = async (questionId: string, answer: boolean) => {
    const questionIndex = pageQuestions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return;

    setIsSubmitting(true);

    try {
      // Save response to database - same answer for both woman and man
      await supabase.from('hypothesis_responses').insert({
        quiz_id: quizData?.id,
        session_id: sessionId,
        question_id: questionId,
        answer_woman: answer,
        answer_man: answer,
      });

      // Check correctness - answer is correct if it matches BOTH correct answers
      const question = pageQuestions.find(q => q.id === questionId);
      const womanIsCorrect = answer === (question?.correct_answer_woman ?? false);
      const manIsCorrect = answer === (question?.correct_answer_man ?? false);
      const isCorrect = womanIsCorrect && manIsCorrect;

      addResponse({
        questionId,
        answerWoman: answer,
        answerMan: answer,
        isCorrect,
      });

      // Reveal interview question and move to next row
      setRowAnswers(prev => ({
        ...prev,
        [questionId]: { answer, revealed: true },
      }));

      // Move to next row
      if (questionIndex < pageQuestions.length - 1) {
        setActiveRowIndex(questionIndex + 1);
      }
    } catch (error) {
      console.error('Error saving response:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextPage = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (currentPageIndex < sortedPages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      setActiveRowIndex(0);
    } else {
      // All pages complete, go to email capture
      setCurrentStep('email');
    }
  };

  const allRowsAnswered = pageQuestions.every(q => rowAnswers[q.id]?.revealed);

  if (!currentPage) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <main className="animate-fade-in max-w-3xl mx-auto px-4" role="main">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-foreground">{getText(currentPage.title)}</h1>
          <span className="text-sm text-muted-foreground">
            Page {currentPageIndex + 1} of {sortedPages.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{getText(currentPage.description)}</p>
        
        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {progress.current} of {progress.total} hypotheses answered
        </p>
      </div>

      {/* Questions List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        {/* Header */}
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            Rate each hypothesis: Is it True or False?
          </p>
        </div>

        {/* Question Rows */}
        <div className="divide-y divide-border">
          {pageQuestions.map((question, idx) => {
            const rowAnswer = rowAnswers[question.id] || { answer: null, revealed: false };
            const isActive = idx === activeRowIndex;
            const isLocked = idx > activeRowIndex && !rowAnswer.revealed;
            const isComplete = rowAnswer.revealed;

            // Check correctness - correct if answer matches both
            const isCorrect = rowAnswer.answer === question.correct_answer_woman && 
                             rowAnswer.answer === question.correct_answer_man;

            // Get gender-specific hypothesis text, fallback to generic
            const womanHypothesis = getText(question.hypothesis_text_woman) || getText(question.hypothesis_text);
            const manHypothesis = getText(question.hypothesis_text_man) || getText(question.hypothesis_text);

            // Get shared interview question
            const interviewQuestion = getText(question.interview_question);

            // Calculate overall question number
            const previousPagesQuestions = sortedPages
              .slice(0, currentPageIndex)
              .reduce((sum, page) => sum + getQuestionsForPage(page.id).length, 0);
            const overallNumber = previousPagesQuestions + idx + 1;

            return (
              <div key={question.id} className="relative">
                {/* Question Number */}
                <div className={cn(
                  "px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground",
                  isLocked && "opacity-50"
                )}>
                  {overallNumber}. Hypothesis
                </div>

                {/* Main Row */}
                <div
                  className={cn(
                    "px-4 pb-4 transition-all",
                    isActive && "bg-primary/5",
                    isLocked && "opacity-50",
                    isComplete && "bg-green-500/5"
                  )}
                >
                  {/* Hypotheses Display - Both in same box */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Women Hypothesis */}
                    <div className="p-3 bg-pink-50/50 dark:bg-pink-950/10 rounded-lg border border-pink-200/50 dark:border-pink-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">👩</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-400">Women 50+</span>
                      </div>
                      <p className={cn(
                        "text-sm leading-relaxed font-medium",
                        isLocked && "text-muted-foreground"
                      )}>
                        {womanHypothesis}
                      </p>
                    </div>

                    {/* Men Hypothesis */}
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">👨</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Men 50+</span>
                      </div>
                      <p className={cn(
                        "text-sm leading-relaxed font-medium",
                        isLocked && "text-muted-foreground"
                      )}>
                        {manHypothesis}
                      </p>
                    </div>
                  </div>

                  {/* Single Answer Buttons - Centered */}
                  <div className="flex justify-center">
                    {isLocked ? (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    ) : isComplete ? (
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-sm font-semibold px-4 py-2 rounded-lg",
                          rowAnswer.answer === true 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                        )}>
                          Your answer: {rowAnswer.answer ? "True" : "False"}
                        </span>
                        {isCorrect ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="w-5 h-5" />
                            <span className="text-sm font-medium">Correct!</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-500">
                            <X className="w-5 h-5" />
                            <span className="text-sm font-medium">Incorrect</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button
                          size="lg"
                          variant={rowAnswer.answer === true ? "default" : "outline"}
                          className={cn(
                            "h-12 px-8 text-base font-semibold",
                            rowAnswer.answer === true && "bg-blue-600 hover:bg-blue-700"
                          )}
                          onClick={() => handleAnswer(question.id, true)}
                          disabled={isSubmitting}
                        >
                          True
                        </Button>
                        <Button
                          size="lg"
                          variant={rowAnswer.answer === false ? "default" : "outline"}
                          className={cn(
                            "h-12 px-8 text-base font-semibold",
                            rowAnswer.answer === false && "bg-orange-600 hover:bg-orange-700"
                          )}
                          onClick={() => handleAnswer(question.id, false)}
                          disabled={isSubmitting}
                        >
                          False
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shared Interview Question - Full Width Below */}
                {isComplete && interviewQuestion && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                            Interview Question
                          </p>
                          <p className="text-sm text-foreground/90 italic">
                            "{interviewQuestion}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Page Button */}
      {allRowsAnswered && (
        <div className="mt-6 animate-fade-in">
          <Button
            onClick={handleNextPage}
            size="lg"
            className="w-full h-14 text-lg font-semibold"
          >
            {currentPageIndex < sortedPages.length - 1 ? (
              <>
                Next Page
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Complete & See Results
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </main>
  );
}
