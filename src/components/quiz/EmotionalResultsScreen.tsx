import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useDynamicQuiz } from './DynamicQuizContext';
import { useLanguage } from './LanguageContext';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

export function EmotionalResultsScreen() {
  const { 
    totalScore, 
    email, 
    resetQuiz, 
    resultLevels,
    quizData,
    answers
  } = useDynamicQuiz();
  const { language, t } = useLanguage();

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  // Calculate average score (1-9 scale) for display
  const questionCount = answers.length || 12;
  const averageScore = totalScore / questionCount;
  const emotionalLevel = Math.round(averageScore);
  
  // Find the matching result level
  const result = resultLevels.find(
    (level) => totalScore >= level.min_score && totalScore <= level.max_score
  ) || resultLevels[resultLevels.length - 1];

  // Calculate percentage for visual display (based on 1-9 scale)
  const percentage = Math.round((averageScore / 9) * 100);

  // Split insights into Common Experiences (first 2) and Path Forward (last 2)
  const insights = result?.insights || [];
  const commonExperiences = insights.slice(0, 2);
  const pathForward = insights.slice(2, 4);

  // Emotional level names - using translations
  const emotionalLevelNames: Record<number, { nameKey: string; descKey: string }> = {
    1: { nameKey: 'sedonaApathy', descKey: 'sedonaApathyDesc' },
    2: { nameKey: 'sedonaGrief', descKey: 'sedonaGriefDesc' },
    3: { nameKey: 'sedonaFear', descKey: 'sedonaFearDesc' },
    4: { nameKey: 'sedonaLust', descKey: 'sedonaLustDesc' },
    5: { nameKey: 'sedonaAnger', descKey: 'sedonaAngerDesc' },
    6: { nameKey: 'sedonaPride', descKey: 'sedonaPrideDesc' },
    7: { nameKey: 'sedonaCourage', descKey: 'sedonaCourageDesc' },
    8: { nameKey: 'sedonaAcceptance', descKey: 'sedonaAcceptanceDesc' },
    9: { nameKey: 'sedonaPeace', descKey: 'sedonaPeaceDesc' },
  };

  const currentLevelKeys = emotionalLevelNames[emotionalLevel] || emotionalLevelNames[5];
  const currentLevel = {
    name: t(currentLevelKeys.nameKey as any),
    description: t(currentLevelKeys.descKey as any),
  };

  // Check if confetti is enabled for this quiz (default: true)
  const showConfetti = quizData?.show_confetti !== false;

  // Trigger confetti on mount (if enabled)
  useEffect(() => {
    if (!showConfetti) return;
    
    const duration = 3000;
    const end = Date.now() + duration;
    
    const colors = ['#a855f7', '#ec4899', '#8b5cf6', '#f472b6'];
    
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors
      });
      
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    
    frame();
  }, [showConfetti]);

  return (
    <main className="animate-fade-in max-w-2xl mx-auto" role="main" aria-labelledby="results-heading">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Your results are ready. Emotional level: {emotionalLevel} - {currentLevel.name}.
      </div>

      <header className="text-center mb-8">
        <p className="text-muted-foreground mb-2">{t('resultsFor')} {email}</p>
        
        <h1 id="results-heading" className="font-heading text-3xl md:text-4xl font-bold mb-2">
          <span aria-hidden="true">{result?.emoji}</span> {getText(result?.title, t('yourEmotionalProfile'))}
        </h1>
        <p className="text-lg text-muted-foreground">{currentLevel.description}</p>
      </header>

      {/* Score visualization - Sedona Scale */}
      <section className="glass rounded-2xl p-8 mb-6">
        <div className="text-center mb-6">
          <div className="text-6xl font-bold gradient-text mb-1">
            {averageScore.toFixed(1)}
          </div>
          <p className="text-muted-foreground text-sm">{t('averageScore')}</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {t('levelLabel')} {emotionalLevel}: {currentLevel.name}
          </div>
        </div>
        
        {/* Emotional scale visualization */}
        <div className="relative mb-4">
          <div 
            className="h-3 bg-gradient-to-r from-slate-400 via-amber-400 to-emerald-400 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
          <div 
            className="absolute top-0 h-3 w-1 bg-foreground rounded-full transform -translate-x-1/2 shadow-lg"
            style={{ left: `${percentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>{t('sedonaApathy')} (1)</span>
          <span>{t('sedonaAnger')} (5)</span>
          <span>{t('sedonaPeace')} (9)</span>
        </div>
      </section>

      {/* Core State Description */}
      <section className="glass rounded-2xl p-8 mb-6">
        <h2 className="font-heading text-xl font-semibold mb-4">{t('whatThisMeans')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {getText(result?.description)}
        </p>
      </section>

      {/* Common Experiences */}
      {commonExperiences.length > 0 && (
        <section className="glass rounded-2xl p-8 mb-6">
          <h2 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">💭</span> {t('commonExperiences')}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t('commonExperiencesDesc')}
          </p>
          <ul className="space-y-3" role="list">
            {commonExperiences.map((experience, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-white text-sm shrink-0 mt-0.5 bg-gradient-to-r",
                  result?.color_class || "from-primary to-primary"
                )}>
                  •
                </span>
                <span className="text-foreground">{getText(experience)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Path Forward */}
      {pathForward.length > 0 && (
        <section className="glass rounded-2xl p-8 mb-6">
          <h2 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">🌱</span> {t('pathForward')}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t('pathForwardDesc')}
          </p>
          <ol className="space-y-3" role="list">
            {pathForward.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-foreground">{getText(step)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Sedona Scale Reference */}
      <section className="glass rounded-2xl p-6 mb-6">
        <h3 className="font-heading text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          {t('sedonaScaleTitle')}
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-9 gap-2 text-center text-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
            const levelKeys = emotionalLevelNames[level];
            return (
              <div 
                key={level}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  level === emotionalLevel 
                    ? "bg-primary text-primary-foreground font-bold scale-105 shadow-lg" 
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                <div className="font-semibold">{level}</div>
                <div className="hidden md:block text-[10px] truncate">
                  {t(levelKeys?.nameKey as any)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="glass rounded-2xl p-8 text-center">
        <h2 className="font-heading text-xl font-semibold mb-3">
          {getText(quizData?.cta_title, t('emotionalCtaTitle'))}
        </h2>
        <p className="text-muted-foreground mb-4">
          {getText(quizData?.cta_description, t('emotionalCtaDesc'))}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="gradient-primary text-primary-foreground"
          >
            <a 
              href={quizData?.cta_url || 'https://sparkly.hr'} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {getText(quizData?.cta_text, t('learnMore'))}
            </a>
          </Button>
          <Button
            onClick={resetQuiz}
            variant="outline"
          >
            {t('takeAssessmentAgain')}
          </Button>
        </div>
      </section>
    </main>
  );
}