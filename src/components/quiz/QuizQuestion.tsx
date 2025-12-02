import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useQuiz, quizQuestions } from './QuizContext';
import { cn } from '@/lib/utils';

export function QuizQuestion() {
  const { currentQuestion, setCurrentQuestion, addAnswer, setCurrentStep, answers } = useQuiz();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(
    answers.find((a) => a.questionId === quizQuestions[currentQuestion].id)?.answerId ?? null
  );

  const question = quizQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;
  const isLastQuestion = currentQuestion === quizQuestions.length - 1;

  const handleNext = () => {
    if (selectedAnswer === null) return;

    const answer = question.answers.find((a) => a.id === selectedAnswer);
    if (answer) {
      addAnswer({
        questionId: question.id,
        answerId: answer.id,
        score: answer.score,
      });
    }

    if (isLastQuestion) {
      setCurrentStep('email');
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers.find((a) => a.questionId === quizQuestions[currentQuestion - 1].id);
      setSelectedAnswer(prevAnswer?.answerId ?? null);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentQuestion + 1} of {quizQuestions.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h2 className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
        {question.question}
      </h2>

      {/* Answers */}
      <div className="space-y-3 mb-8">
        {question.answers.map((answer) => (
          <button
            key={answer.id}
            onClick={() => setSelectedAnswer(answer.id)}
            className={cn(
              'w-full text-left p-5 rounded-xl border-2 transition-all duration-200',
              selectedAnswer === answer.id
                ? 'border-primary bg-primary/5 shadow-lg'
                : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
            )}
          >
            <div className="flex items-center gap-4">
              <div 
                className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                  selectedAnswer === answer.id
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                )}
              >
                {selectedAnswer === answer.id && (
                  <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </div>
              <span className="text-base md:text-lg">{answer.text}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className="px-6"
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={selectedAnswer === null}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
        >
          {isLastQuestion ? 'See Results' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
