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
    <main className="animate-fade-in max-w-2xl mx-auto" role="main">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{getText(currentPage.title)}</span>
          <span>{progress.current} / {progress.total}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Category Description */}
      {currentQuestionIndex === 0 && (
        <div className="glass rounded-xl p-4 mb-6 text-center">
          <p className="text-muted-foreground">{getText(currentPage.description)}</p>
        </div>
      )}

      {/* Hypothesis Card */}
      <div className="glass rounded-2xl p-6 md:p-8 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Lightbulb className="w-4 h-4" />
          <span>Hypothesis #{progress.current}</span>
        </div>

        <h2 className="text-xl md:text-2xl font-medium mb-6 leading-relaxed">
          "{hypothesisText}"
        </h2>

        {/* Interview Question Hint */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-primary mt-1 shrink-0" />
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Interview check:</span>
              <p className="text-sm mt-1">{interviewQuestion}</p>
            </div>
          </div>
        </div>

        {/* Answer Section */}
        {!showTruth ? (
          <div className="space-y-6">
            <p className="text-center text-muted-foreground">
              Do you believe this is true?
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Woman Answer */}
              <div className="space-y-3">
                <label className="text-center block font-medium">For Women 50+</label>
                <div className="flex gap-2">
                  <Button
                    variant={answerWoman === true ? "default" : "outline"}
                    className={cn(
                      "flex-1 h-12",
                      answerWoman === true && "bg-primary"
                    )}
                    onClick={() => setAnswerWoman(true)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    True
                  </Button>
                  <Button
                    variant={answerWoman === false ? "default" : "outline"}
                    className={cn(
                      "flex-1 h-12",
                      answerWoman === false && "bg-primary"
                    )}
                    onClick={() => setAnswerWoman(false)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    False
                  </Button>
                </div>
              </div>

              {/* Man Answer */}
              <div className="space-y-3">
                <label className="text-center block font-medium">For Men 50+</label>
                <div className="flex gap-2">
                  <Button
                    variant={answerMan === true ? "default" : "outline"}
                    className={cn(
                      "flex-1 h-12",
                      answerMan === true && "bg-primary"
                    )}
                    onClick={() => setAnswerMan(true)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    True
                  </Button>
                  <Button
                    variant={answerMan === false ? "default" : "outline"}
                    className={cn(
                      "flex-1 h-12",
                      answerMan === false && "bg-primary"
                    )}
                    onClick={() => setAnswerMan(false)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    False
                  </Button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmitAnswer}
              disabled={answerWoman === null || answerMan === null || isSubmitting}
              className="w-full h-14 text-lg font-semibold bg-primary text-primary-foreground"
            >
              {isSubmitting ? 'Saving...' : 'Reveal the Truth'}
            </Button>
          </div>
        ) : (
          /* Truth Reveal */
          <div className="space-y-6 animate-fade-in">
            {/* Answer Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className={cn(
                "rounded-lg p-4 text-center",
                answerWoman === false ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30"
              )}>
                <div className="text-sm text-muted-foreground mb-1">Women 50+</div>
                <div className="font-medium">
                  You said: {answerWoman ? 'True' : 'False'}
                  {answerWoman === false ? (
                    <CheckCircle className="inline w-4 h-4 ml-2 text-green-500" />
                  ) : (
                    <XCircle className="inline w-4 h-4 ml-2 text-destructive" />
                  )}
                </div>
              </div>
              <div className={cn(
                "rounded-lg p-4 text-center",
                answerMan === false ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30"
              )}>
                <div className="text-sm text-muted-foreground mb-1">Men 50+</div>
                <div className="font-medium">
                  You said: {answerMan ? 'True' : 'False'}
                  {answerMan === false ? (
                    <CheckCircle className="inline w-4 h-4 ml-2 text-green-500" />
                  ) : (
                    <XCircle className="inline w-4 h-4 ml-2 text-destructive" />
                  )}
                </div>
              </div>
            </div>

            {/* Truth Explanation */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-primary" />
                <span className="font-semibold text-primary">The Reality</span>
              </div>
              <p className="text-foreground leading-relaxed">{truthExplanation}</p>
            </div>

            <Button
              onClick={handleNext}
              className="w-full h-14 text-lg font-semibold bg-primary text-primary-foreground"
            >
              {progress.current < progress.total ? (
                <>
                  Next Hypothesis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                'Complete & Get Results'
              )}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
