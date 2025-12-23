import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useDynamicQuiz } from './DynamicQuizContext';
import { useLanguage } from './LanguageContext';
import { cn } from '@/lib/utils';

// Fisher-Yates shuffle with seed for consistent shuffling per question
function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  while (currentIndex !== 0) {
    const randomIndex = Math.floor(seededRandom() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }

  return shuffled;
}

export function DynamicQuizQuestion() {
  const { 
    currentQuestion, 
    setCurrentQuestion, 
    addAnswer, 
    setCurrentStep, 
    answers,
    quizData,
    getRegularQuestions,
    getOpenMindednessQuestion,
    getTotalQuestionCount
  } = useDynamicQuiz();
  const { language, t } = useLanguage();
  
  const regularQuestions = getRegularQuestions();
  const hasOpenMindedness = !!getOpenMindednessQuestion();
  const currentQuestionData = regularQuestions[currentQuestion];
  const shouldShuffleAnswers = quizData?.shuffle_answers ?? false;
  
  // Generate a unique seed per question for shuffling (changes each render to truly randomize)
  const shuffleSeed = useMemo(() => {
    return Date.now() + (currentQuestionData?.id?.charCodeAt(0) || 0);
  }, [currentQuestionData?.id, currentQuestion]);
  
  // Shuffle answers for display only if enabled
  const shuffledAnswers = useMemo(() => {
    if (!currentQuestionData?.answers) return [];
    if (!shouldShuffleAnswers) return currentQuestionData.answers;
    return shuffleArray(currentQuestionData.answers, shuffleSeed);
  }, [currentQuestionData?.answers, shuffleSeed, shouldShuffleAnswers]);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(
    answers.find((a) => a.questionId === currentQuestionData?.id)?.answerId ?? null
  );
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const prevQuestion = useRef(currentQuestion);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  useEffect(() => {
    if (currentQuestion > prevQuestion.current) {
      setSlideDirection('left');
    } else if (currentQuestion < prevQuestion.current) {
      setSlideDirection('right');
    }
    prevQuestion.current = currentQuestion;
    setSelectedAnswer(
      answers.find((a) => a.questionId === currentQuestionData?.id)?.answerId ?? null
    );
  }, [currentQuestion, answers, currentQuestionData?.id]);

  const totalQuestions = getTotalQuestionCount();
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;
  const isLastRegularQuestion = currentQuestion === regularQuestions.length - 1;

  const handleNext = () => {
    if (selectedAnswer === null || !currentQuestionData) return;

    const selectedAnswerData = currentQuestionData.answers.find(a => a.id === selectedAnswer);
    
    addAnswer({
      questionId: currentQuestionData.id,
      answerId: selectedAnswer,
      score: selectedAnswerData?.score_value || 0,
    });

    if (isLastRegularQuestion) {
      if (hasOpenMindedness) {
        setCurrentStep('mindedness');
      } else {
        setCurrentStep('email');
      }
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestionData = regularQuestions[currentQuestion - 1];
      const prevAnswer = answers.find((a) => a.questionId === prevQuestionData?.id);
      setSelectedAnswer(prevAnswer?.answerId ?? null);
    }
  };

  const handleAnswerSelect = useCallback((answerId: string) => {
    if (!currentQuestionData) return;
    
    setSelectedAnswer(answerId);
    const selectedAnswerData = currentQuestionData.answers.find(a => a.id === answerId);
    
    setTimeout(() => {
      addAnswer({
        questionId: currentQuestionData.id,
        answerId: answerId,
        score: selectedAnswerData?.score_value || 0,
      });
      if (isLastRegularQuestion) {
        if (hasOpenMindedness) {
          setCurrentStep('mindedness');
        } else {
          setCurrentStep('email');
        }
      } else {
        setCurrentQuestion(currentQuestion + 1);
      }
    }, 300);
  }, [addAnswer, currentQuestion, isLastRegularQuestion, setCurrentQuestion, setCurrentStep, currentQuestionData, hasOpenMindedness]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentQuestionData) return;
      
      // Arrow key navigation using shuffled answers
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = selectedAnswer 
          ? shuffledAnswers.findIndex(a => a.id === selectedAnswer)
          : -1;
        let newIndex;
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < shuffledAnswers.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : shuffledAnswers.length - 1;
        }
        setSelectedAnswer(shuffledAnswers[newIndex].id);
      }
      if (e.key === 'Enter' && selectedAnswer !== null) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswerSelect, selectedAnswer, currentQuestionData, shuffledAnswers]);

  if (!currentQuestionData) {
    return <div className="text-center py-8">Loading question...</div>;
  }

  return (
    <main className="max-w-2xl mx-auto" role="main" aria-labelledby="question-heading">
      {/* Progress bar */}
      <div className="mb-8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{t('questionOf').replace('{current}', String(currentQuestion + 1)).replace('{total}', String(totalQuestions))}</span>
          <span>{t('complete').replace('{percent}', String(Math.round(progress)))}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Question {currentQuestion + 1} of {totalQuestions}
      </div>

      <div 
        key={currentQuestion}
        className={cn(
          slideDirection === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'
        )}
      >
        <h1 id="question-heading" className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
          {getText(currentQuestionData.question_text)}
        </h1>

        <p className="text-xs text-muted-foreground mb-4 hidden sm:block" aria-hidden="true">
          Use ↑↓ to navigate, Enter to confirm
        </p>

        <fieldset className="space-y-3 mb-8" role="radiogroup" aria-labelledby="question-heading">
          <legend className="sr-only">{getText(currentQuestionData.question_text)}</legend>
          {shuffledAnswers.map((answer) => {
            const isSelected = selectedAnswer === answer.id;
            return (
              <button
                key={answer.id}
                onClick={() => handleAnswerSelect(answer.id)}
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  'w-full text-left p-5 rounded-xl border-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
                )}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/50'
                    )}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                    )}
                  </div>
                  <span className="text-base md:text-lg">{getText(answer.answer_text)}</span>
                </div>
              </button>
            );
          })}
        </fieldset>
      </div>

      <nav className="flex justify-between gap-4" aria-label="Quiz navigation">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className="px-6"
        >
          {t('back')}
        </Button>
        <Button
          onClick={handleNext}
          disabled={selectedAnswer === null}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
        >
          {isLastRegularQuestion ? (hasOpenMindedness ? t('next') : t('seeResults')) : t('next')}
        </Button>
      </nav>
    </main>
  );
}
