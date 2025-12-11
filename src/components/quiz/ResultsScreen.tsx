import { Button } from '@/components/ui/button';
import { useQuiz } from './QuizContext';
import { useLanguage, TranslationKey } from './LanguageContext';
import { Footer } from './Footer';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

interface ResultLevel {
  min: number;
  max: number;
  titleKey: TranslationKey;
  emoji: string;
  descKey: TranslationKey;
  insightKeys: TranslationKey[];
  color: string;
}

const resultLevels: ResultLevel[] = [
  {
    min: 6,
    max: 10,
    titleKey: 'highPerformingTeam',
    emoji: '🌟',
    descKey: 'highPerformingDesc',
    insightKeys: ['highPerformingInsight1', 'highPerformingInsight2', 'highPerformingInsight3'],
    color: 'from-emerald-500 to-green-600',
  },
  {
    min: 11,
    max: 16,
    titleKey: 'roomForImprovement',
    emoji: '⚡',
    descKey: 'roomForImprovementDesc',
    insightKeys: ['roomForImprovementInsight1', 'roomForImprovementInsight2', 'roomForImprovementInsight3'],
    color: 'from-amber-500 to-orange-600',
  },
  {
    min: 17,
    max: 20,
    titleKey: 'performanceChallenges',
    emoji: '🔥',
    descKey: 'performanceChallengesDesc',
    insightKeys: ['performanceChallengesInsight1', 'performanceChallengesInsight2', 'performanceChallengesInsight3'],
    color: 'from-rose-500 to-red-600',
  },
  {
    min: 21,
    max: 24,
    titleKey: 'criticalPerformanceGap',
    emoji: '🚨',
    descKey: 'criticalPerformanceGapDesc',
    insightKeys: ['criticalPerformanceGapInsight1', 'criticalPerformanceGapInsight2', 'criticalPerformanceGapInsight3'],
    color: 'from-red-600 to-rose-700',
  },
];

export function ResultsScreen() {
  const { totalScore, email, resetQuiz, openMindednessScore } = useQuiz();
  const { t } = useLanguage();
  
  const result = resultLevels.find(
    (level) => totalScore >= level.min && totalScore <= level.max
  ) || resultLevels[resultLevels.length - 1];

  const maxScore = 24; // 6 questions * 4 max points
  const percentage = Math.round((totalScore / maxScore) * 100);

  // Get open-mindedness interpretation
  const getOpenMindednessResult = () => {
    if (openMindednessScore === 4) return { key: 'openMindednessHigh' as TranslationKey, color: 'from-emerald-500 to-green-600', emoji: '🌟' };
    if (openMindednessScore >= 2) return { key: 'openMindednessMedium' as TranslationKey, color: 'from-amber-500 to-orange-600', emoji: '⚡' };
    if (openMindednessScore === 1) return { key: 'openMindednessLow' as TranslationKey, color: 'from-rose-500 to-red-600', emoji: '🔥' };
    return { key: 'openMindednessNone' as TranslationKey, color: 'from-red-600 to-rose-700', emoji: '🚨' };
  };

  const openMindednessResult = getOpenMindednessResult();

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="mb-6">
          <Logo />
        </div>
        
        <p className="text-muted-foreground mb-2">{t('resultsFor')} {email}</p>
        
        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-2">
          {result.emoji} {t(result.titleKey)}
        </h2>
      </div>

      {/* Score visualization */}
      <div className="glass rounded-2xl p-8 mb-8">
        <div className="text-center mb-6">
          <div className="text-6xl font-bold gradient-text mb-2">
            {totalScore}
          </div>
          <p className="text-muted-foreground">{t('outOf')} {maxScore} {t('points')}</p>
        </div>
        
        <div className="h-4 bg-secondary rounded-full overflow-hidden mb-4">
          <div 
            className={cn('h-full bg-gradient-to-r transition-all duration-1000', result.color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t('best')}</span>
          <span>{t('needsWork')}</span>
        </div>
      </div>

      {/* Leadership Open-Mindedness */}
      <div className="glass rounded-2xl p-8 mb-8">
        <h3 className="font-heading text-xl font-semibold mb-4">
          {openMindednessResult.emoji} {t('leadershipOpenMindedness')}
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl font-bold gradient-text">
            {openMindednessScore}/4
          </div>
          <div className="flex-1">
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn('h-full bg-gradient-to-r transition-all duration-1000', openMindednessResult.color)}
                style={{ width: `${(openMindednessScore / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">
          {t(openMindednessResult.key)}
        </p>
      </div>

      {/* Result description */}
      <div className="glass rounded-2xl p-8 mb-8">
        <h3 className="font-heading text-xl font-semibold mb-4">{t('whatThisMeans')}</h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {t(result.descKey)}
        </p>
        
        <h4 className="font-semibold mb-3">{t('keyInsights')}</h4>
        <ul className="space-y-3">
          {result.insightKeys.map((insightKey, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{t(insightKey)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="glass rounded-2xl p-8 text-center">
        <h3 className="font-heading text-xl font-semibold mb-3">
          {t('wantToImprove')}
        </h3>
        <p className="text-muted-foreground mb-6">
          {t('wantToImproveDesc')}
        </p>
        
        <Button
          onClick={resetQuiz}
          variant="outline"
          className="mr-4"
        >
          {t('takeQuizAgain')}
        </Button>
      </div>
      
      <Footer />
    </div>
  );
}
