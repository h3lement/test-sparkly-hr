import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, MessageSquare, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnswerValue = boolean | null;

interface PageAnswers {
  [questionId: string]: AnswerValue;
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

  const [pageAnswers, setPageAnswers] = useState<PageAnswers>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPage = getCurrentPage();
  const progress = getProgress();
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const pageQuestions = currentPage ? getQuestionsForPage(currentPage.id) : [];

  // Initialize or reset answers when page changes
  useEffect(() => {
    if (!currentPage) return;
    
    const initialAnswers: PageAnswers = {};
    let hasExistingResponses = false;
    
    pageQuestions.forEach((q) => {
      const existingResponse = responses.find(r => r.questionId === q.id);
      if (existingResponse) {
        initialAnswers[q.id] = existingResponse.answerWoman;
        hasExistingResponses = true;
      } else {
        initialAnswers[q.id] = null;
      }
    });
    
    setPageAnswers(initialAnswers);
    // If all questions on this page have responses, consider it submitted
    setIsSubmitted(hasExistingResponses && pageQuestions.every(q => responses.some(r => r.questionId === q.id)));
  }, [currentPage?.id, pageQuestions.length]);

  const handleAnswer = (questionId: string, value: boolean) => {
    if (isSubmitted) return;
    
    setPageAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const allQuestionsAnswered = pageQuestions.every(q => pageAnswers[q.id] !== null && pageAnswers[q.id] !== undefined);

  const handleSubmitPage = async () => {
    if (!allQuestionsAnswered || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Save all responses to database
      const inserts = pageQuestions.map(q => ({
        quiz_id: quizData?.id,
        session_id: sessionId,
        question_id: q.id,
        answer_woman: pageAnswers[q.id],
        answer_man: pageAnswers[q.id],
      }));

      await supabase.from('hypothesis_responses').insert(inserts);

      // Add to context responses
      pageQuestions.forEach(q => {
        const answer = pageAnswers[q.id]!;
        const isCorrect = answer === q.correct_answer_woman && answer === q.correct_answer_man;
        
        addResponse({
          questionId: q.id,
          answerWoman: answer,
          answerMan: answer,
          isCorrect,
        });
      });

      setIsSubmitted(true);
    } catch (error) {
      console.error('Error saving responses:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextPage = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (currentPageIndex < sortedPages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    } else {
      setCurrentStep('email');
    }
  };

  // Count answered questions for progress display
  const answeredCount = Object.values(pageAnswers).filter(v => v !== null).length;

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
          {progress.current} of {progress.total} hypotheses completed
        </p>
      </div>

      {/* Page Progress Indicator */}
      {!isSubmitted && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            This page: {answeredCount} of {pageQuestions.length} answered
          </span>
          {allQuestionsAnswered && (
            <span className="text-sm text-green-600 font-medium">Ready to submit!</span>
          )}
        </div>
      )}

      {/* Questions List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        {/* Header */}
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            {isSubmitted ? 'Results' : 'Rate each hypothesis: True or False?'}
          </p>
        </div>

        {/* Question Rows */}
        <div className="divide-y divide-border">
          {pageQuestions.map((question, idx) => {
            const answer = pageAnswers[question.id];
            const hasAnswer = answer !== null && answer !== undefined;

            // Check correctness
            const isCorrect = answer === question.correct_answer_woman && 
                             answer === question.correct_answer_man;

            // Get gender-specific hypothesis text
            const womanHypothesis = getText(question.hypothesis_text_woman) || getText(question.hypothesis_text);
            const manHypothesis = getText(question.hypothesis_text_man) || getText(question.hypothesis_text);
            const interviewQuestion = getText(question.interview_question);

            // Calculate overall question number
            const previousPagesQuestions = sortedPages
              .slice(0, currentPageIndex)
              .reduce((sum, page) => sum + getQuestionsForPage(page.id).length, 0);
            const overallNumber = previousPagesQuestions + idx + 1;

            return (
              <div key={question.id} className="relative">
                {/* Question Number */}
                <div className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                  {overallNumber}. Hypothesis
                </div>

                {/* Main Row */}
                <div className={cn(
                  "px-4 pb-4 transition-all",
                  isSubmitted && isCorrect && "bg-green-500/5",
                  isSubmitted && !isCorrect && "bg-red-500/5"
                )}>
                  {/* Hypotheses with inline answers */}
                  <div className="space-y-3">
                    {/* Women Hypothesis Row */}
                    <div className="flex items-center gap-3 p-3 bg-pink-50/50 dark:bg-pink-950/10 rounded-lg border border-pink-200/50 dark:border-pink-800/50">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-lg">👩</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-400 hidden sm:inline">Women 50+</span>
                      </div>
                      <p className="flex-1 text-sm leading-relaxed font-medium">
                        {womanHypothesis}
                      </p>
                      {!isSubmitted && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant={answer === true ? "default" : "outline"}
                            className={cn(
                              "h-9 px-4 text-sm font-semibold transition-all",
                              answer === true && "bg-blue-600 hover:bg-blue-700"
                            )}
                            onClick={() => handleAnswer(question.id, true)}
                          >
                            True
                          </Button>
                          <Button
                            size="sm"
                            variant={answer === false ? "default" : "outline"}
                            className={cn(
                              "h-9 px-4 text-sm font-semibold transition-all",
                              answer === false && "bg-orange-600 hover:bg-orange-700"
                            )}
                            onClick={() => handleAnswer(question.id, false)}
                          >
                            False
                          </Button>
                        </div>
                      )}
                      {isSubmitted && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded",
                            answer === true 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                          )}>
                            {answer ? "True" : "False"}
                          </span>
                          {isCorrect ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Men Hypothesis Row */}
                    <div className="flex items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-lg">👨</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 hidden sm:inline">Men 50+</span>
                      </div>
                      <p className="flex-1 text-sm leading-relaxed font-medium">
                        {manHypothesis}
                      </p>
                      {/* No buttons for men row - same answer applies */}
                      {isSubmitted && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded",
                            answer === true 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                          )}>
                            {answer ? "True" : "False"}
                          </span>
                          {isCorrect ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interview Question - Only shown after submission */}
                {isSubmitted && interviewQuestion && (
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

      {/* Action Buttons */}
      <div className="mt-6">
        {!isSubmitted ? (
          <Button
            onClick={handleSubmitPage}
            disabled={!allQuestionsAnswered || isSubmitting}
            size="lg"
            className="w-full h-14 text-lg font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Answers ({answeredCount}/{pageQuestions.length})
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNextPage}
            size="lg"
            className="w-full h-14 text-lg font-semibold animate-fade-in"
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
        )}
      </div>
    </main>
  );
}
