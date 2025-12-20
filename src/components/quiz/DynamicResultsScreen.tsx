import { Button } from '@/components/ui/button';
import { useDynamicQuiz } from './DynamicQuizContext';
import { useLanguage } from './LanguageContext';
import { cn } from '@/lib/utils';

export function DynamicResultsScreen() {
  const { 
    totalScore, 
    email, 
    resetQuiz, 
    openMindednessScore,
    resultLevels,
    quizData
  } = useDynamicQuiz();
  const { language } = useLanguage();

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };
  
  const result = resultLevels.find(
    (level) => totalScore >= level.min_score && totalScore <= level.max_score
  ) || resultLevels[resultLevels.length - 1];

  const maxScore = resultLevels.length > 0 
    ? Math.max(...resultLevels.map(r => r.max_score))
    : 24;
  const percentage = Math.round((totalScore / maxScore) * 100);

  const getOpenMindednessResult = () => {
    if (openMindednessScore === 4) return { label: 'Highly open-minded - You embrace diverse approaches', color: 'from-emerald-500 to-green-600', emoji: '🌟' };
    if (openMindednessScore >= 2) return { label: 'Moderately open-minded - You consider alternative methods', color: 'from-amber-500 to-orange-600', emoji: '⚡' };
    if (openMindednessScore === 1) return { label: 'Somewhat rigid - You prefer traditional approaches', color: 'from-rose-500 to-red-600', emoji: '🔥' };
    return { label: 'Very rigid - You rely solely on conventional methods', color: 'from-red-600 to-rose-700', emoji: '🚨' };
  };

  const openMindednessResult = getOpenMindednessResult();

  return (
    <main className="animate-fade-in max-w-2xl mx-auto" role="main" aria-labelledby="results-heading">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Your results are ready. Score: {totalScore} out of {maxScore} points.
      </div>

      <header className="text-center mb-8">
        <p className="text-muted-foreground mb-2">Results for {email}</p>
        
        <h1 id="results-heading" className="font-heading text-3xl md:text-4xl font-bold mb-2">
          <span aria-hidden="true">{result?.emoji}</span> {getText(result?.title, 'Your Results')}
        </h1>
      </header>

      {/* Score visualization */}
      <section className="glass rounded-2xl p-8 mb-8">
        <div className="text-center mb-6">
          <div className="text-6xl font-bold gradient-text mb-2">
            {totalScore}
          </div>
          <p className="text-muted-foreground">out of {maxScore} points</p>
        </div>
        
        <div 
          className="h-4 bg-secondary rounded-full overflow-hidden mb-4"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div 
            className={cn('h-full bg-gradient-to-r transition-all duration-1000', result?.color_class)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Best</span>
          <span>Needs Work</span>
        </div>
      </section>

      {/* Leadership Open-Mindedness */}
      <section className="glass rounded-2xl p-8 mb-8">
        <h2 className="font-heading text-xl font-semibold mb-4">
          <span aria-hidden="true">{openMindednessResult.emoji}</span> Open-Minded Leadership
        </h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl font-bold gradient-text">
            {openMindednessScore}/4
          </div>
          <div className="flex-1">
            <div 
              className="h-3 bg-secondary rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={(openMindednessScore / 4) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div 
                className={cn('h-full bg-gradient-to-r transition-all duration-1000', openMindednessResult.color)}
                style={{ width: `${(openMindednessScore / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">
          {openMindednessResult.label}
        </p>
      </section>

      {/* Result description */}
      <section className="glass rounded-2xl p-8 mb-8">
        <h2 className="font-heading text-xl font-semibold mb-4">What This Means</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {getText(result?.description)}
        </p>
        
        {result?.insights && result.insights.length > 0 && (
          <>
            <h3 className="font-semibold mb-3">Key Insights:</h3>
            <ol className="space-y-3" role="list">
              {result.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{getText(insight)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* CTA */}
      <section className="glass rounded-2xl p-8 text-center">
        <h2 className="font-heading text-xl font-semibold mb-3">
          Ready for Precise Employee Assessment?
        </h2>
        <p className="text-muted-foreground mb-4">
          This quiz provides a general overview. For accurate, in-depth analysis of your team's performance and actionable improvement strategies, continue with professional testing.
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
              {getText(quizData?.cta_text, 'Continue to Sparkly.hr')}
            </a>
          </Button>
          <Button
            onClick={resetQuiz}
            variant="outline"
          >
            Take Quiz Again
          </Button>
        </div>
      </section>
    </main>
  );
}
