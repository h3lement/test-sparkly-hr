import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Lock, Unlock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnswerValue = boolean | null;

interface RowAnswer {
  woman: AnswerValue;
  man: AnswerValue;
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
        initialAnswers[q.id] = {
          woman: existingResponse.answerWoman,
          man: existingResponse.answerMan,
          revealed: true,
        };
        firstUnanswered = idx + 1;
      } else {
        initialAnswers[q.id] = { woman: null, man: null, revealed: false };
      }
    });
    
    setRowAnswers(initialAnswers);
    setActiveRowIndex(Math.min(firstUnanswered, pageQuestions.length - 1));
  }, [currentPage?.id, pageQuestions.length]);

  const handleAnswer = (questionId: string, type: 'woman' | 'man', value: boolean) => {
    setRowAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [type]: value,
      },
    }));
  };

  const handleRevealInterview = async (questionId: string, questionIndex: number) => {
    const answer = rowAnswers[questionId];
    if (answer.woman === null || answer.man === null) return;

    setIsSubmitting(true);

    try {
      // Save response to database
      await supabase.from('hypothesis_responses').insert({
        quiz_id: quizData?.id,
        session_id: sessionId,
        question_id: questionId,
        answer_woman: answer.woman,
        answer_man: answer.man,
      });

      // The correct answer is always FALSE for both
      const isCorrect = answer.woman === false && answer.man === false;

      addResponse({
        questionId,
        answerWoman: answer.woman,
        answerMan: answer.man,
        isCorrect,
      });

      // Reveal interview question and move to next row
      setRowAnswers(prev => ({
        ...prev,
        [questionId]: { ...prev[questionId], revealed: true },
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

      {/* Questions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-6">Hypothesis</div>
          <div className="col-span-3 text-center">👩 Women 50+</div>
          <div className="col-span-3 text-center">👨 Men 50+</div>
        </div>

        {/* Question Rows */}
        <div className="divide-y divide-border">
          {pageQuestions.map((question, idx) => {
            const answer = rowAnswers[question.id] || { woman: null, man: null, revealed: false };
            const isActive = idx === activeRowIndex;
            const isLocked = idx > activeRowIndex && !answer.revealed;
            const isComplete = answer.revealed;
            const canReveal = answer.woman !== null && answer.man !== null && !answer.revealed;

            return (
              <div key={question.id} className="relative">
                {/* Main Row */}
                <div 
                  className={cn(
                    "grid grid-cols-12 gap-2 px-4 py-4 transition-all",
                    isActive && "bg-primary/5",
                    isLocked && "opacity-50",
                    isComplete && "bg-green-500/5"
                  )}
                >
                  {/* Hypothesis Text */}
                  <div className="col-span-6 flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground mt-1 w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <p className={cn(
                      "text-sm leading-relaxed",
                      isLocked && "text-muted-foreground"
                    )}>
                      {getText(question.hypothesis_text)}
                    </p>
                  </div>

                  {/* Women Answer */}
                  <div className="col-span-3 flex justify-center gap-1">
                    {isLocked ? (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant={answer.woman === true ? "default" : "outline"}
                          className={cn(
                            "h-8 px-3 text-xs",
                            answer.woman === true && "bg-blue-600 hover:bg-blue-700",
                            isComplete && "pointer-events-none"
                          )}
                          onClick={() => !isComplete && handleAnswer(question.id, 'woman', true)}
                          disabled={isComplete}
                        >
                          T
                        </Button>
                        <Button
                          size="sm"
                          variant={answer.woman === false ? "default" : "outline"}
                          className={cn(
                            "h-8 px-3 text-xs",
                            answer.woman === false && "bg-orange-600 hover:bg-orange-700",
                            isComplete && "pointer-events-none"
                          )}
                          onClick={() => !isComplete && handleAnswer(question.id, 'woman', false)}
                          disabled={isComplete}
                        >
                          F
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Men Answer */}
                  <div className="col-span-3 flex justify-center gap-1">
                    {isLocked ? (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant={answer.man === true ? "default" : "outline"}
                          className={cn(
                            "h-8 px-3 text-xs",
                            answer.man === true && "bg-blue-600 hover:bg-blue-700",
                            isComplete && "pointer-events-none"
                          )}
                          onClick={() => !isComplete && handleAnswer(question.id, 'man', true)}
                          disabled={isComplete}
                        >
                          T
                        </Button>
                        <Button
                          size="sm"
                          variant={answer.man === false ? "default" : "outline"}
                          className={cn(
                            "h-8 px-3 text-xs",
                            answer.man === false && "bg-orange-600 hover:bg-orange-700",
                            isComplete && "pointer-events-none"
                          )}
                          onClick={() => !isComplete && handleAnswer(question.id, 'man', false)}
                          disabled={isComplete}
                        >
                          F
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reveal Button (when both answered but not yet revealed) */}
                {canReveal && (
                  <div className="px-4 pb-4">
                    <Button
                      onClick={() => handleRevealInterview(question.id, idx)}
                      disabled={isSubmitting}
                      size="sm"
                      className="w-full"
                    >
                      {isSubmitting ? 'Saving...' : (
                        <>
                          <Unlock className="w-4 h-4 mr-2" />
                          Reveal Interview Question
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Interview Question Reward (revealed after answering) */}
                {isComplete && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                            Interview Question
                          </p>
                          <p className="text-sm text-foreground/90 italic">
                            "{getText(question.interview_question)}"
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