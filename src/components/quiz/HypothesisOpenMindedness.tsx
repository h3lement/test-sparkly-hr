import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { useUiTranslations } from '@/hooks/useUiTranslations';
import { useGlobalOMPublic } from '@/hooks/useGlobalOMPublic';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function HypothesisOpenMindedness() {
  const { 
    openMindednessAnswers, 
    setOpenMindednessAnswers, 
    setCurrentStep,
    questions,
    quizData
  } = useHypothesisQuiz();
  const { language } = useLanguage();
  const { getTranslation } = useUiTranslations({ quizId: quizData?.id, language });
  const { module: globalOM, loading: loadingGlobalOM } = useGlobalOMPublic();

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
  };

  // Calculate progress - OM is the last question
  const totalQuestions = questions.length + 1;
  const currentQuestionNumber = questions.length + 1;
  const progress = (currentQuestionNumber / totalQuestions) * 100;

  // Show loading state while fetching global module
  if (loadingGlobalOM) {
    return (
      <main className="max-w-2xl mx-auto animate-fade-in text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading question...</p>
      </main>
    );
  }

  // Use global OM module
  if (!globalOM) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <p className="text-muted-foreground">Open-mindedness module not available</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto animate-fade-in" role="main" aria-labelledby="mindedness-heading">
      {/* Progress bar */}
      <div className="mb-8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{getTranslation('questionOf', `Question ${currentQuestionNumber} of ${totalQuestions}`).replace('{current}', String(currentQuestionNumber)).replace('{total}', String(totalQuestions))}</span>
          <span>{getTranslation('complete', `${Math.round(progress)}% complete`).replace('{percent}', String(Math.round(progress)))}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {getTranslation('finalQuestion', `Question ${currentQuestionNumber} of ${totalQuestions}, final question`).replace('{current}', String(currentQuestionNumber)).replace('{total}', String(totalQuestions))}
      </div>

      <h1 id="mindedness-heading" className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
        {getText(globalOM.question_text)}
      </h1>

      <p className="text-xs text-muted-foreground mb-4 hidden sm:block" aria-hidden="true">
        {getTranslation('keyboardHintCheckbox', 'Use Tab to navigate, Space to toggle')}
      </p>

      <fieldset className="space-y-3 mb-8">
        <legend className="sr-only">{getText(globalOM.question_text)}</legend>
        {globalOM.answers.map((answer, index) => {
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
        {getTranslation('selectAllMethods', 'Select all methods you are open to exploring.')}
      </p>

      <nav className="flex justify-between gap-4" aria-label="Quiz navigation">
        <Button
          variant="outline"
          onClick={handlePrevious}
          className="px-6"
        >
          {getTranslation('back', 'Back')}
        </Button>
        <Button
          onClick={handleNext}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
        >
          {getTranslation('next', 'Next')}
        </Button>
      </nav>
    </main>
  );
}
