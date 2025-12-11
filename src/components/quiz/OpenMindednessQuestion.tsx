import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuiz } from './QuizContext';
import { useLanguage, TranslationKey } from './LanguageContext';
import { cn } from '@/lib/utils';

const checkboxOptions: { key: keyof ReturnType<typeof useQuiz>['openMindednessAnswers']; labelKey: TranslationKey }[] = [
  { key: 'humans', labelKey: 'openMindedness_humans' },
  { key: 'aiCalculations', labelKey: 'openMindedness_ai' },
  { key: 'psychology', labelKey: 'openMindedness_psychology' },
  { key: 'humanDesign', labelKey: 'openMindedness_humanDesign' },
];

export function OpenMindednessQuestion() {
  const { openMindednessAnswers, setOpenMindednessAnswers, setCurrentStep, setCurrentQuestion, currentQuestion } = useQuiz();
  const { t } = useLanguage();

  const handleCheckboxChange = (key: keyof typeof openMindednessAnswers, checked: boolean) => {
    setOpenMindednessAnswers({
      ...openMindednessAnswers,
      [key]: checked,
    });
  };

  const handleNext = () => {
    setCurrentStep('email');
  };

  const handlePrevious = () => {
    setCurrentStep('quiz');
    setCurrentQuestion(5); // Go back to last quiz question (index 5 = question 6)
  };

  // Progress: 7th question out of 7 total (6 quiz + 1 mindedness)
  const totalQuestions = 7;
  const progress = (7 / totalQuestions) * 100;

  return (
    <main className="max-w-2xl mx-auto animate-fade-in" role="main" aria-labelledby="mindedness-heading">
      {/* Progress bar */}
      <div className="mb-8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={`Quiz progress: ${Math.round(progress)}% complete`}>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span aria-hidden="true">{t('questionOf').replace('{current}', '7').replace('{total}', String(totalQuestions))}</span>
          <span aria-hidden="true">{t('complete').replace('{percent}', String(Math.round(progress)))}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Question 7 of {totalQuestions}, final question
      </div>

      {/* Question */}
      <h1 id="mindedness-heading" className="font-heading text-2xl md:text-3xl font-semibold mb-8 leading-tight">
        {t('openMindedness_question')}
      </h1>

      {/* Checkbox options */}
      <fieldset className="space-y-3 mb-8" aria-describedby="mindedness-hint">
        <legend className="sr-only">{t('openMindedness_question')}</legend>
        {checkboxOptions.map((option) => {
          const isChecked = openMindednessAnswers[option.key];
          return (
            <label
              key={option.key}
              className={cn(
                'flex items-center gap-4 w-full text-left p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer',
                isChecked
                  ? 'border-primary bg-primary/5 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckboxChange(option.key, checked === true)}
                className="h-6 w-6 rounded border-2"
                aria-label={t(option.labelKey)}
              />
              <span className="text-base md:text-lg">{t(option.labelKey)}</span>
            </label>
          );
        })}
      </fieldset>

      {/* Hint text */}
      <p id="mindedness-hint" className="text-sm text-muted-foreground mb-6 text-center">
        {t('openMindedness_hint')}
      </p>

      {/* Navigation */}
      <nav className="flex justify-between gap-4" aria-label="Quiz navigation">
        <Button
          variant="outline"
          onClick={handlePrevious}
          className="px-6"
          aria-label={t('back')}
        >
          {t('back')}
        </Button>
        <Button
          onClick={handleNext}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
          aria-label={t('next')}
        >
          {t('next')}
        </Button>
      </nav>
    </main>
  );
}
