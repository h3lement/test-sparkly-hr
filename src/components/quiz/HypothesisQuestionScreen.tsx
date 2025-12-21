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
      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span className="font-medium">{getText(currentPage.title)}</span>
          <span className="tabular-nums">{progress.current} of {progress.total}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 px-6 py-4 border-b border-border">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Belief #{progress.current}
          </span>
        </div>

        {/* Hypothesis Statement */}
        <div className="p-6 md:p-8">
          <blockquote className="text-xl md:text-2xl font-medium leading-relaxed text-foreground mb-6 border-l-4 border-primary pl-4">
            {hypothesisText}
          </blockquote>

          {/* Interview Context */}
          <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-4 mb-8">
            <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                What to ask in interviews
              </p>
              <p className="text-sm text-foreground/80">{interviewQuestion}</p>
            </div>
          </div>

          {/* Answer Section */}
          {!showTruth ? (
            <div className="space-y-8">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Is this statement true or false?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Answer for each demographic group
                </p>
              </div>

              <div className="grid gap-6">
                {/* Woman Answer */}
                <div className="bg-muted/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-lg">👩</span>
                      Women 50+
                    </span>
                    {answerWoman !== null && (
                      <span className={cn(
                        "text-sm font-medium px-3 py-1 rounded-full",
                        answerWoman ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"
                      )}>
                        {answerWoman ? 'TRUE' : 'FALSE'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant={answerWoman === true ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-12 text-base font-medium transition-all",
                        answerWoman === true 
                          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" 
                          : "hover:border-blue-400 hover:text-blue-600"
                      )}
                      onClick={() => setAnswerWoman(true)}
                    >
                      True
                    </Button>
                    <Button
                      variant={answerWoman === false ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-12 text-base font-medium transition-all",
                        answerWoman === false 
                          ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600" 
                          : "hover:border-orange-400 hover:text-orange-600"
                      )}
                      onClick={() => setAnswerWoman(false)}
                    >
                      False
                    </Button>
                  </div>
                </div>

                {/* Man Answer */}
                <div className="bg-muted/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-lg">👨</span>
                      Men 50+
                    </span>
                    {answerMan !== null && (
                      <span className={cn(
                        "text-sm font-medium px-3 py-1 rounded-full",
                        answerMan ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"
                      )}>
                        {answerMan ? 'TRUE' : 'FALSE'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant={answerMan === true ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-12 text-base font-medium transition-all",
                        answerMan === true 
                          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" 
                          : "hover:border-blue-400 hover:text-blue-600"
                      )}
                      onClick={() => setAnswerMan(true)}
                    >
                      True
                    </Button>
                    <Button
                      variant={answerMan === false ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-12 text-base font-medium transition-all",
                        answerMan === false 
                          ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600" 
                          : "hover:border-orange-400 hover:text-orange-600"
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
                {isSubmitting ? 'Checking...' : 'Check My Answer'}
              </Button>
            </div>
          ) : (
            /* Truth Reveal */
            <div className="space-y-6 animate-fade-in">
              {/* Result Header */}
              <div className={cn(
                "text-center py-4 px-6 rounded-xl",
                answerWoman === false && answerMan === false
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-amber-500/10 border border-amber-500/30"
              )}>
                <span className="text-2xl mb-2 block">
                  {answerWoman === false && answerMan === false ? '🎯' : '💡'}
                </span>
                <p className="font-semibold text-lg">
                  {answerWoman === false && answerMan === false 
                    ? "You got it right!" 
                    : "This is a common misconception"}
                </p>
              </div>

              {/* Your Answers */}
              <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                  "rounded-xl p-4 text-center border",
                  answerWoman === false 
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-red-500/10 border-red-500/30"
                )}>
                  <span className="text-2xl block mb-2">👩</span>
                  <p className="text-xs text-muted-foreground mb-1">Women 50+</p>
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
                  <span className="text-2xl block mb-2">👨</span>
                  <p className="text-xs text-muted-foreground mb-1">Men 50+</p>
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

              {/* Correct Answer Callout */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Correct answer for both</p>
                <p className="font-bold text-primary text-lg">FALSE</p>
              </div>

              {/* Truth Explanation */}
              <div className="bg-muted/30 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold">The Truth</span>
                </div>
                <p className="text-foreground/90 leading-relaxed">{truthExplanation}</p>
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
                  'See My Results'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
