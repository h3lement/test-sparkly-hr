import { useState, useRef, useEffect } from 'react';
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
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

      {/* Question content with slide animation */}
      <div 
        key={currentQuestion}
        className={cn(
          slideDirection === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'
        )}
      >
        {/* Question */}
        <h2 className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
          {t(currentQuestionData.question)}
        </h2>

      {/* Answers */}
      <div className="space-y-3 mb-8">
        {currentQuestionData.answers.map((answerKey, index) => {
          const answerId = index + 1;
          return (
            <button
              key={answerId}
              onClick={() => {
                setSelectedAnswer(answerId);
                // Auto-advance after selection with small delay for visual feedback
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
              }}
              className={cn(
                'w-full text-left p-5 rounded-xl border-2 transition-all duration-200',
                selectedAnswer === answerId
                  ? 'border-primary bg-primary/5 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
              )}
            >
              <div className="flex items-center gap-4">
                <div 
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    selectedAnswer === answerId
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  )}
                >
                  {selectedAnswer === answerId && (
                    <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                  )}
                </div>
                <span className="text-base md:text-lg">{t(answerKey)}</span>
              </div>
            </button>
          );
        })}
      </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
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
          {isLastQuestion ? t('seeResults') : t('next')}
        </Button>
      </div>
    </div>
  );
}
