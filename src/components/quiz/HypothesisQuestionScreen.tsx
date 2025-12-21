import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
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
    
    pageQuestions.forEach((q) => {
      const existingResponse = responses.find(r => r.questionId === q.id);
      if (existingResponse) {
        initialAnswers[q.id] = existingResponse.answerWoman;
      } else {
        initialAnswers[q.id] = null;
      }
    });
    
    setPageAnswers(initialAnswers);
  }, [currentPage?.id, pageQuestions.length]);

  const handleAnswer = (questionId: string, value: boolean) => {
    setPageAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const allQuestionsAnswered = pageQuestions.every(q => pageAnswers[q.id] !== null && pageAnswers[q.id] !== undefined);

  const handleSubmitAndContinue = async () => {
    if (!allQuestionsAnswered || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const inserts = pageQuestions.map(q => ({
        quiz_id: quizData?.id,
        session_id: sessionId,
        question_id: q.id,
        answer_woman: pageAnswers[q.id],
        answer_man: pageAnswers[q.id],
      }));

      await supabase.from('hypothesis_responses').insert(inserts);

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

      // Immediately proceed to next page or complete
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      if (currentPageIndex < sortedPages.length - 1) {
        setCurrentPageIndex(currentPageIndex + 1);
      } else {
        setCurrentStep('email');
      }
    } catch (error) {
      console.error('Error saving responses:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  const answeredCount = Object.values(pageAnswers).filter(v => v !== null).length;

  if (!currentPage) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <main className="animate-fade-in max-w-4xl mx-auto px-4" role="main">
      {/* Progress bar - at top */}
      <div className="mb-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {progress.current} of {progress.total} hypotheses completed
        </p>
      </div>

      {/* Page Header - Title and Description */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-foreground">{getText(currentPage.title)}</h1>
          <span className="text-sm text-muted-foreground">
            Page {currentPageIndex + 1} of {sortedPages.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{getText(currentPage.description)}</p>
      </div>

      {/* Questions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        {/* Table Header with Status Bar & Bulk Actions */}
        <div className="grid grid-cols-[1fr_1fr_140px] gap-2 px-4 py-3 bg-muted/50 border-b border-border text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="text-base">👩</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Women 50+</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-base">👨</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Men 50+</span>
          </div>
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Answer
            </span>
          </div>
        </div>

        {/* Status Bar with Bulk Actions - inside table, before questions */}
        <div className="grid grid-cols-[1fr_1fr_140px] gap-2 px-4 py-2 bg-muted/30 border-b border-border items-center">
          <div className="col-span-2 flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              This page: {answeredCount} of {pageQuestions.length} answered
            </span>
            {allQuestionsAnswered && (
              <span className="text-sm text-green-600 font-medium">Ready to submit!</span>
            )}
          </div>
          
          {/* Bulk True/False Buttons - aligned with answer column */}
          <div className="flex justify-center items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs font-semibold border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
              onClick={() => {
                const newAnswers: PageAnswers = {};
                pageQuestions.forEach(q => { newAnswers[q.id] = true; });
                setPageAnswers(newAnswers);
              }}
            >
              All True
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs font-semibold border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
              onClick={() => {
                const newAnswers: PageAnswers = {};
                pageQuestions.forEach(q => { newAnswers[q.id] = false; });
                setPageAnswers(newAnswers);
              }}
            >
              All False
            </Button>
          </div>
        </div>

        {/* Question Rows */}
        <div className="divide-y divide-border">
          {pageQuestions.map((question, idx) => {
            const answer = pageAnswers[question.id];

            const isCorrect = answer === question.correct_answer_woman && 
                             answer === question.correct_answer_man;

            const womanHypothesis = getText(question.hypothesis_text_woman) || getText(question.hypothesis_text);
            const manHypothesis = getText(question.hypothesis_text_man) || getText(question.hypothesis_text);
            const interviewQuestion = getText(question.interview_question);

            const previousPagesQuestions = sortedPages
              .slice(0, currentPageIndex)
              .reduce((sum, page) => sum + getQuestionsForPage(page.id).length, 0);
            const overallNumber = previousPagesQuestions + idx + 1;

            return (
              <div key={question.id} className="relative transition-all">
                {/* Single Row: Women | Men | Answer */}
                <div className="grid grid-cols-[1fr_1fr_140px] gap-2 px-4 py-3 items-start">
                  {/* Women Hypothesis */}
                  <div className="p-2 bg-pink-50/50 dark:bg-pink-950/10 rounded-lg border border-pink-200/30 dark:border-pink-800/30">
                    <p className="text-sm leading-snug font-medium">
                      <span className="text-muted-foreground mr-1">{overallNumber}.</span>
                      {womanHypothesis}
                    </p>
                  </div>

                  {/* Men Hypothesis */}
                  <div className="p-2 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
                    <p className="text-sm leading-snug font-medium">
                      <span className="text-muted-foreground mr-1">{overallNumber}.</span>
                      {manHypothesis}
                    </p>
                  </div>

                  {/* Answer Buttons with Feedback */}
                  <div className="flex justify-center items-start pt-2 gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={answer === true ? "default" : "outline"}
                        className={cn(
                          "h-9 px-3 text-sm font-semibold",
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
                          "h-9 px-3 text-sm font-semibold",
                          answer === false && "bg-orange-600 hover:bg-orange-700"
                        )}
                        onClick={() => handleAnswer(question.id, false)}
                      >
                        False
                      </Button>
                      {answer !== null && (
                        isCorrect ? (
                          <ThumbsUp className="w-5 h-5 text-green-600 animate-fade-in ml-1" />
                        ) : (
                          <ThumbsDown className="w-5 h-5 text-red-500 animate-fade-in ml-1" />
                        )
                      )}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        {currentPageIndex > 0 && (
          <Button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setCurrentPageIndex(currentPageIndex - 1);
            }}
            variant="outline"
            size="lg"
            className="h-14 px-6 text-lg font-semibold"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Previous
          </Button>
        )}
        <Button
          onClick={handleSubmitAndContinue}
          disabled={!allQuestionsAnswered || isSubmitting}
          size="lg"
          className="flex-1 h-14 text-lg font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              {currentPageIndex < sortedPages.length - 1 ? (
                <>
                  Submit & Next Page ({answeredCount}/{pageQuestions.length})
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                <>
                  Submit & See Results ({answeredCount}/{pageQuestions.length})
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </main>
  );
}
