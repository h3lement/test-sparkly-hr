import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useQuiz } from './QuizContext';
import { useLanguage, TranslationKey } from './LanguageContext';
import { cn } from '@/lib/utils';

const questionKeys: { question: TranslationKey; answers: TranslationKey[] }[] = [
  { question: 'q1_question', answers: ['q1_a1', 'q1_a2', 'q1_a3', 'q1_a4'] },
  { question: 'q2_question', answers: ['q2_a1', 'q2_a2', 'q2_a3', 'q2_a4'] },
  { question: 'q3_question', answers: ['q3_a1', 'q3_a2', 'q3_a3', 'q3_a4'] },
  { question: 'q4_question', answers: ['q4_a1', 'q4_a2', 'q4_a3', 'q4_a4'] },
  { question: 'q5_question', answers: ['q5_a1', 'q5_a2', 'q5_a3', 'q5_a4'] },
  { question: 'q6_question', answers: ['q6_a1', 'q6_a2', 'q6_a3', 'q6_a4'] },
];

// Keyboard shortcuts for answer selection
const ANSWER_KEYS = ['1', '2', '3', '4'];

export function QuizQuestion() {
  const { currentQuestion, setCurrentQuestion, addAnswer, setCurrentStep, answers } = useQuiz();
  const { t } = useLanguage();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(
    answers.find((a) => a.questionId === currentQuestion + 1)?.answerId ?? null
  );
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const prevQuestion = useRef(currentQuestion);

  useEffect(() => {
    if (currentQuestion > prevQuestion.current) {
      setSlideDirection('left');
    } else if (currentQuestion < prevQuestion.current) {
      setSlideDirection('right');
    }
    prevQuestion.current = currentQuestion;
    setSelectedAnswer(
      answers.find((a) => a.questionId === currentQuestion + 1)?.answerId ?? null
    );
  }, [currentQuestion, answers]);

  const totalQuestions = 7; // 6 quiz questions + 1 mindedness question
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;
  const isLastQuestion = currentQuestion === questionKeys.length - 1;

  const handleNext = () => {
    if (selectedAnswer === null) return;

    addAnswer({
      questionId: currentQuestion + 1,
      answerId: selectedAnswer,
      score: selectedAnswer,
    });

    if (isLastQuestion) {
      setCurrentStep('mindedness');
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers.find((a) => a.questionId === currentQuestion);
      setSelectedAnswer(prevAnswer?.answerId ?? null);
    }
  };

  const currentQuestionData = questionKeys[currentQuestion];

  // Handle keyboard shortcuts for answer selection
  const handleAnswerSelect = useCallback((answerId: number) => {
    setSelectedAnswer(answerId);
    setTimeout(() => {
      addAnswer({
        questionId: currentQuestion + 1,
        answerId: answerId,
        score: answerId,
      });
      if (isLastQuestion) {
        setCurrentStep('mindedness');
      } else {
        setCurrentQuestion(currentQuestion + 1);
      }
    }, 300);
  }, [addAnswer, currentQuestion, isLastQuestion, setCurrentQuestion, setCurrentStep]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-4 for answer selection
      if (ANSWER_KEYS.includes(e.key)) {
        e.preventDefault();
        const answerId = parseInt(e.key);
        handleAnswerSelect(answerId);
      }
      // Arrow keys for navigation between answers
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = selectedAnswer ? selectedAnswer - 1 : -1;
        let newIndex;
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < 3 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : 3;
        }
        setSelectedAnswer(newIndex + 1);
      }
      // Enter to confirm and proceed
      if (e.key === 'Enter' && selectedAnswer !== null) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswerSelect, selectedAnswer, handleNext]);

  return (
    <main className="max-w-2xl mx-auto" role="main" aria-labelledby="question-heading">
      {/* Progress bar */}
      <div className="mb-8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={`Quiz progress: ${Math.round(progress)}% complete`}>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span aria-hidden="true">{t('questionOf').replace('{current}', String(currentQuestion + 1)).replace('{total}', String(totalQuestions))}</span>
          <span aria-hidden="true">{t('complete').replace('{percent}', String(Math.round(progress)))}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Screen reader announcement for question change */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Question {currentQuestion + 1} of {totalQuestions}
      </div>

      {/* Question content with slide animation */}
      <div 
        key={currentQuestion}
        className={cn(
          slideDirection === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'
        )}
      >
        {/* Question */}
        <h1 id="question-heading" className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
          {t(currentQuestionData.question)}
        </h1>

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground mb-4 hidden sm:block" aria-hidden="true">
        {t('keyboardHintArrows')}
      </p>

      {/* Answers */}
      <fieldset className="space-y-3 mb-8" role="radiogroup" aria-labelledby="question-heading" aria-describedby="keyboard-hint">
        <legend className="sr-only">{t(currentQuestionData.question)}</legend>
        <p id="keyboard-hint" className="sr-only">Use number keys 1 through 4 to select an answer, arrow keys to navigate, Enter to confirm</p>
        {currentQuestionData.answers.map((answerKey, index) => {
          const answerId = index + 1;
          const isSelected = selectedAnswer === answerId;
          return (
            <button
              key={answerId}
              onClick={() => handleAnswerSelect(answerId)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`Option ${answerId}: ${t(answerKey)}${isSelected ? ', selected' : ''}`}
              className={cn(
                'w-full text-left p-5 rounded-xl border-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
              )}
            >
              <div className="flex items-center gap-4">
                {/* Keyboard shortcut indicator */}
                <kbd 
                  className={cn(
                    'hidden sm:flex w-6 h-6 rounded border text-xs font-mono items-center justify-center shrink-0 transition-all',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/50 bg-muted/50 text-muted-foreground'
                  )}
                  aria-hidden="true"
                >
                  {answerId}
                </kbd>
                {/* Radio indicator for mobile */}
                <div 
                  className={cn(
                    'sm:hidden w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  )}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                  )}
                </div>
                <span className="text-base md:text-lg">{t(answerKey)}</span>
              </div>
            </button>
          );
        })}
      </fieldset>
      </div>

      {/* Navigation */}
      <nav className="flex justify-between gap-4" aria-label="Quiz navigation">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className="px-6"
          aria-label={t('back')}
        >
          {t('back')}
        </Button>
        <Button
          onClick={handleNext}
          disabled={selectedAnswer === null}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
          aria-label={isLastQuestion ? t('seeResults') : t('next')}
        >
          {isLastQuestion ? t('seeResults') : t('next')}
        </Button>
      </nav>
    </main>
  );
}
