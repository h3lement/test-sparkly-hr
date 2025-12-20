import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDynamicQuiz } from './DynamicQuizContext';
import { useLanguage } from './LanguageContext';
import { cn } from '@/lib/utils';

export function DynamicOpenMindedness() {
  const { 
    openMindednessAnswers, 
    setOpenMindednessAnswers, 
    setCurrentStep, 
    setCurrentQuestion,
    getOpenMindednessQuestion,
    getRegularQuestions,
    getTotalQuestionCount
  } = useDynamicQuiz();
  const { language } = useLanguage();

  const openMindednessQuestion = getOpenMindednessQuestion();
  const regularQuestions = getRegularQuestions();

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const handleCheckboxChange = (answerId: string, checked: boolean) => {
    setOpenMindednessAnswers({
      ...openMindednessAnswers,
      [answerId]: checked,
    });
  };

  const handleNext = () => {
    setCurrentStep('email');
  };

  const handlePrevious = () => {
    setCurrentStep('quiz');
    setCurrentQuestion(regularQuestions.length - 1);
  };

  const totalQuestions = getTotalQuestionCount();
  const currentQuestionNumber = regularQuestions.length + 1;
  const progress = (currentQuestionNumber / totalQuestions) * 100;

  if (!openMindednessQuestion) {
    return null;
  }

  return (
    <main className="max-w-2xl mx-auto animate-fade-in" role="main" aria-labelledby="mindedness-heading">
      {/* Progress bar */}
      <div className="mb-8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentQuestionNumber} of {totalQuestions}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Question {currentQuestionNumber} of {totalQuestions}, final question
      </div>

      <h1 id="mindedness-heading" className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
        {getText(openMindednessQuestion.question_text)}
      </h1>

      <p className="text-xs text-muted-foreground mb-4 hidden sm:block" aria-hidden="true">
        Use Tab to navigate, Space to toggle
      </p>

      <fieldset className="space-y-3 mb-8">
        <legend className="sr-only">{getText(openMindednessQuestion.question_text)}</legend>
        {openMindednessQuestion.answers.map((answer, index) => {
          const isChecked = openMindednessAnswers[answer.id] || false;
          return (
            <label
              key={answer.id}
              className={cn(
                'flex items-center gap-4 w-full text-left p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer',
                isChecked
                  ? 'border-primary bg-primary/5 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckboxChange(answer.id, checked === true)}
                className="h-6 w-6 rounded border-2"
              />
              <span className="text-base md:text-lg flex-1">{getText(answer.answer_text)}</span>
              <kbd 
                className="hidden sm:flex w-6 h-6 rounded border text-xs font-mono items-center justify-center shrink-0 border-muted-foreground/50 bg-muted/50 text-muted-foreground"
                aria-hidden="true"
              >
                {index + 1}
              </kbd>
            </label>
          );
        })}
      </fieldset>

      <p className="text-sm text-muted-foreground mb-6 text-center">
        Select all methods you are open to exploring.
      </p>

      <nav className="flex justify-between gap-4" aria-label="Quiz navigation">
        <Button
          variant="outline"
          onClick={handlePrevious}
          className="px-6"
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
        >
          Next
        </Button>
      </nav>
    </main>
  );
}
