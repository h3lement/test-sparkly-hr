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
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{t('questionOf').replace('{current}', '7').replace('{total}', String(totalQuestions))}</span>
          <span>{t('complete').replace('{percent}', String(Math.round(progress)))}</span>
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
        {t('openMindedness_question')}
      </h2>

      {/* Checkbox options */}
      <div className="space-y-3 mb-8">
        {checkboxOptions.map((option) => (
          <label
            key={option.key}
            className={cn(
              'flex items-center gap-4 w-full text-left p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer',
              openMindednessAnswers[option.key]
                ? 'border-primary bg-primary/5 shadow-lg'
                : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50'
            )}
          >
            <Checkbox
              checked={openMindednessAnswers[option.key]}
              onCheckedChange={(checked) => handleCheckboxChange(option.key, checked === true)}
              className="h-6 w-6 rounded border-2"
            />
            <span className="text-base md:text-lg">{t(option.labelKey)}</span>
          </label>
        ))}
      </div>

      {/* Hint text */}
      <p className="text-sm text-muted-foreground mb-6 text-center">
        {t('openMindedness_hint')}
      </p>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          className="px-6"
        >
          {t('back')}
        </Button>
        <Button
          onClick={handleNext}
          className="gradient-primary text-primary-foreground px-8 hover:scale-105 transition-transform"
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
