import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, ArrowRight, Lightbulb, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnswerValue = boolean | null;

export function HypothesisQuestionScreen() {
  const {
    quizData,
    pages,
    getCurrentPage,
    getCurrentQuestion,
    getQuestionsForPage,
    currentPageIndex,
    currentQuestionIndex,
    setCurrentPageIndex,
    setCurrentQuestionIndex,
    showTruth,
    setShowTruth,
    addResponse,
    responses,
    sessionId,
    setCurrentStep,
    getProgress,
  } = useHypothesisQuiz();
  const { language } = useLanguage();

  const [answerWoman, setAnswerWoman] = useState<AnswerValue>(null);
  const [answerMan, setAnswerMan] = useState<AnswerValue>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPage = getCurrentPage();
  const currentQuestion = getCurrentQuestion();
  const progress = getProgress();

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  // Reset answers when moving to a new question
  useEffect(() => {
    const existingResponse = responses.find(r => r.questionId === currentQuestion?.id);
    if (existingResponse) {
      setAnswerWoman(existingResponse.answerWoman);
      setAnswerMan(existingResponse.answerMan);
      setShowTruth(true);
    } else {
      setAnswerWoman(null);
      setAnswerMan(null);
      setShowTruth(false);
    }
  }, [currentQuestion?.id, responses, setShowTruth]);

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || answerWoman === null || answerMan === null) return;

    setIsSubmitting(true);

    // The correct answer is always FALSE for both (these are biases/wrong beliefs)
    const isCorrect = answerWoman === false && answerMan === false;

    try {
      // Save response to database
      await supabase.from('hypothesis_responses').insert({
        quiz_id: quizData?.id,
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_woman: answerWoman,
        answer_man: answerMan,
      });

      addResponse({
        questionId: currentQuestion.id,
        answerWoman,
        answerMan,
        isCorrect,
      });

      setShowTruth(true);
    } catch (error) {
      console.error('Error saving response:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!currentPage) return;

    const pageQuestions = getQuestionsForPage(currentPage.id);
    const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

    if (currentQuestionIndex < pageQuestions.length - 1) {
      // Next question in same page
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentPageIndex < sortedPages.length - 1) {
      // Move to next page
      setCurrentPageIndex(currentPageIndex + 1);
      setCurrentQuestionIndex(0);
    } else {
      // Quiz complete, go to email capture
      setCurrentStep('email');
    }
    setShowTruth(false);
  };

  if (!currentPage || !currentQuestion) {
    return <div className="text-center p-8">Loading question...</div>;
  }

  const hypothesisText = getText(currentQuestion.hypothesis_text);
  const interviewQuestion = getText(currentQuestion.interview_question);
  const truthExplanation = getText(currentQuestion.truth_explanation);

  return (
    <main className="animate-fade-in max-w-2xl mx-auto px-4" role="main">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span className="font-medium">{getText(currentPage.title)}</span>
          <span className="tabular-nums">{progress.current} / {progress.total}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        
        {/* The Belief/Hypothesis */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
            Common Belief #{progress.current}
          </p>
          <blockquote className="text-lg md:text-xl font-medium text-foreground leading-relaxed">
            "{hypothesisText}"
          </blockquote>
        </div>

        <div className="p-6">
          {!showTruth ? (
            /* ANSWERING PHASE */
            <div className="space-y-6">
              {/* Question */}
              <div className="text-center pb-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  Do you think this belief is true?
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Answer separately for each group
                </p>
              </div>

              {/* Two Column Answers */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Women 50+ */}
                <div className={cn(
                  "rounded-xl p-5 border-2 transition-all",
                  answerWoman !== null 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-muted/30"
                )}>
                  <div className="text-center mb-4">
                    <span className="text-3xl block mb-1">👩</span>
                    <span className="font-semibold text-foreground">For Women 50+</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={answerWoman === true ? "default" : "outline"}
                      className={cn(
                        "h-12 text-base font-medium",
                        answerWoman === true && "bg-blue-600 hover:bg-blue-700 border-blue-600"
                      )}
                      onClick={() => setAnswerWoman(true)}
                    >
                      True
                    </Button>
                    <Button
                      variant={answerWoman === false ? "default" : "outline"}
                      className={cn(
                        "h-12 text-base font-medium",
                        answerWoman === false && "bg-orange-600 hover:bg-orange-700 border-orange-600"
                      )}
                      onClick={() => setAnswerWoman(false)}
                    >
                      False
                    </Button>
                  </div>
                </div>

                {/* Men 50+ */}
                <div className={cn(
                  "rounded-xl p-5 border-2 transition-all",
                  answerMan !== null 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-muted/30"
                )}>
                  <div className="text-center mb-4">
                    <span className="text-3xl block mb-1">👨</span>
                    <span className="font-semibold text-foreground">For Men 50+</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={answerMan === true ? "default" : "outline"}
                      className={cn(
                        "h-12 text-base font-medium",
                        answerMan === true && "bg-blue-600 hover:bg-blue-700 border-blue-600"
                      )}
                      onClick={() => setAnswerMan(true)}
                    >
                      True
                    </Button>
                    <Button
                      variant={answerMan === false ? "default" : "outline"}
                      className={cn(
                        "h-12 text-base font-medium",
                        answerMan === false && "bg-orange-600 hover:bg-orange-700 border-orange-600"
                      )}
                      onClick={() => setAnswerMan(false)}
                    >
                      False
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSubmitAnswer}
                disabled={answerWoman === null || answerMan === null || isSubmitting}
                size="lg"
                className="w-full h-14 text-lg font-semibold"
              >
                {isSubmitting ? 'Checking...' : 'Submit My Answer'}
              </Button>
            </div>
          ) : (
            /* TRUTH REVEAL PHASE */
            <div className="space-y-5 animate-fade-in">
              {/* Result Banner */}
              <div className={cn(
                "text-center py-4 px-6 rounded-xl border",
                answerWoman === false && answerMan === false
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-amber-500/10 border-amber-500/30"
              )}>
                <span className="text-3xl block mb-2">
                  {answerWoman === false && answerMan === false ? '✅' : '💡'}
                </span>
                <p className="font-semibold text-lg text-foreground">
                  {answerWoman === false && answerMan === false 
                    ? "Correct! This is indeed a false belief." 
                    : "This belief is actually FALSE for both groups."}
                </p>
              </div>

              {/* Your Answers Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  "rounded-xl p-4 text-center border",
                  answerWoman === false 
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-red-500/10 border-red-500/30"
                )}>
                  <span className="text-2xl block mb-1">👩</span>
                  <p className="text-xs text-muted-foreground mb-1">Your answer</p>
                  <p className="font-semibold flex items-center justify-center gap-1">
                    {answerWoman ? 'True' : 'False'}
                    {answerWoman === false ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </p>
                </div>
                <div className={cn(
                  "rounded-xl p-4 text-center border",
                  answerMan === false 
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-red-500/10 border-red-500/30"
                )}>
                  <span className="text-2xl block mb-1">👨</span>
                  <p className="text-xs text-muted-foreground mb-1">Your answer</p>
                  <p className="font-semibold flex items-center justify-center gap-1">
                    {answerMan ? 'True' : 'False'}
                    {answerMan === false ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </p>
                </div>
              </div>

              {/* The Truth */}
              <div className="bg-muted/40 rounded-xl p-5 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-foreground">The Reality</span>
                </div>
                <p className="text-foreground/90 leading-relaxed">{truthExplanation}</p>
              </div>

              {/* Interview Question */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-foreground">Interview Question to Ask</span>
                </div>
                <p className="text-foreground/90 italic">"{interviewQuestion}"</p>
              </div>

              <Button
                onClick={handleNext}
                size="lg"
                className="w-full h-14 text-lg font-semibold"
              >
                {progress.current < progress.total ? (
                  <>
                    Next Question
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                ) : (
                  'Complete Quiz'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
