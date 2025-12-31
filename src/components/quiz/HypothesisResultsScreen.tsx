import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp, Award, Lightbulb, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useUiTranslations } from '@/hooks/useUiTranslations';
import { useHypothesisResultLevels } from '@/hooks/useHypothesisResultLevels';

// UI text keys are stored in the backend UI translations table.
// This component intentionally avoids hardcoded per-language dictionaries so all languages work consistently.

// Default fallback levels in case database has none
const DEFAULT_RESULT_LEVELS = [
  { min: 80, max: 100, emoji: '🏆', titleKey: 'biasChampion', titleFallback: 'Bias Champion', descKey: 'biasChampionDesc', descFallback: 'Excellent awareness! You see through most common biases about 50+ employees.', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { min: 60, max: 79, emoji: '👁️', titleKey: 'awareRecruiter', titleFallback: 'Aware Recruiter', descKey: 'awareRecruiterDesc', descFallback: 'Good progress! You recognize many biases but have room to grow.', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { min: 40, max: 59, emoji: '📚', titleKey: 'learningMindset', titleFallback: 'Learning Mindset', descKey: 'learningMindsetDesc', descFallback: "You're on your way. This test revealed some blind spots to work on.", color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { min: 0, max: 39, emoji: '🌱', titleKey: 'freshStart', titleFallback: 'Fresh Start', descKey: 'freshStartDesc', descFallback: 'Great that you took this test! Now you know where to focus your learning.', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
];

export function HypothesisResultsScreen() {
  const { 
    calculateScore, 
    responses, 
    questions, 
    pages,
    resetQuiz,
    quizData,
    feedbackNewLearnings,
    feedbackActionPlan,
    hasOpenMindedness,
    calculateOpenMindednessScore,
    openMindednessResultLevels,
  } = useHypothesisQuiz();
  const { language } = useLanguage();
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  
  // Fetch database result levels
  const { resultLevels: dbResultLevels, getResultLevel: getDbResultLevel } = useHypothesisResultLevels(quizData?.id);
  
  // Use UI translations from database
  const { getTranslation } = useUiTranslations({
    quizId: quizData?.id || null,
    language,
  });

  const t = (key: string, fallback: string) => getTranslation(key, fallback);

  const labelCorrect = t('correct', language === 'fi' ? 'Oikein' : (language === 'et' ? 'Õige' : 'Correct'));
  const labelIncorrect = t('incorrect', language === 'fi' ? 'Väärin' : (language === 'et' ? 'Vale' : 'Incorrect'));


  const { correct, total } = calculateScore();
  const percentage = Math.round((correct / total) * 100);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  // Get result level based on score - use database if available, fallback to defaults
  const getResultLevel = () => {
    // Try to get from database first
    const dbLevel = getDbResultLevel(percentage);
    if (dbLevel) {
      return {
        title: dbLevel.title[language] || dbLevel.title['en'] || 'Result',
        emoji: dbLevel.emoji,
        color: dbLevel.color_class.split(' ')[0] || 'text-green-500',
        bgColor: dbLevel.color_class.split(' ')[1] || 'bg-green-500/10',
        description: dbLevel.description[language] || dbLevel.description['en'] || '',
      };
    }

    // Fallback to defaults with translations
    const fallback = DEFAULT_RESULT_LEVELS.find(l => percentage >= l.min && percentage <= l.max) || DEFAULT_RESULT_LEVELS[3];
    return {
      title: t(fallback.titleKey, fallback.titleFallback),
      emoji: fallback.emoji,
      color: fallback.color,
      bgColor: fallback.bgColor,
      description: t(fallback.descKey, fallback.descFallback),
    };
  };

  const resultLevel = getResultLevel();
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  // Calculate and get Open-Mindedness result
  const omScore = hasOpenMindedness ? calculateOpenMindednessScore() : 0;
  const omMaxScore = 4; // Standard OM max score
  const getOmResultLevel = () => {
    if (!hasOpenMindedness) return null;
    const dbLevel = openMindednessResultLevels.find(
      level => omScore >= level.min_score && omScore <= level.max_score
    );
    if (dbLevel) {
      return {
        title: dbLevel.title[language] || dbLevel.title['en'] || 'Your Open-Mindedness',
        description: dbLevel.description[language] || dbLevel.description['en'] || '',
        emoji: dbLevel.emoji,
        colorClass: dbLevel.color_class,
      };
    }
    // Fallback
    if (omScore === 4) return { title: t('highlyOpenMinded', 'Highly Open-Minded'), description: t('omHighDesc', 'You embrace diverse approaches to understanding people.'), emoji: '🌟', colorClass: 'from-emerald-500 to-green-600' };
    if (omScore >= 2) return { title: t('moderatelyOpenMinded', 'Moderately Open-Minded'), description: t('omModerateDesc', 'You consider alternative assessment methods.'), emoji: '⚡', colorClass: 'from-amber-500 to-orange-600' };
    if (omScore === 1) return { title: t('somewhatRigid', 'Somewhat Rigid'), description: t('omLowDesc', 'You prefer traditional approaches to assessment.'), emoji: '🔥', colorClass: 'from-rose-500 to-red-600' };
    return { title: t('veryRigid', 'Very Rigid'), description: t('omVeryLowDesc', 'You rely solely on conventional methods.'), emoji: '🚨', colorClass: 'from-red-600 to-rose-700' };
  };
  const omResultLevel = getOmResultLevel();

  // Group responses by page
  const getPageStats = (pageId: string) => {
    const pageQuestions = questions.filter(q => q.page_id === pageId);
    const pageResponses = responses.filter(r => pageQuestions.some(q => q.id === r.questionId));
    const correctCount = pageResponses.filter(r => r.isCorrect).length;
    return { correct: correctCount, total: pageQuestions.length };
  };

  const togglePage = (pageId: string) => {
    setExpandedPages(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  return (
    <main className="animate-fade-in max-w-4xl mx-auto px-4" role="main" aria-labelledby="results-heading">
      {/* Hero Score Card - Sparkly style */}
      <div className={cn("rounded-2xl p-8 mb-8 text-center border shadow-lg", resultLevel.bgColor)}>
        <span className="text-6xl block mb-4">{resultLevel.emoji}</span>
        <h1 id="results-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
          {resultLevel.title}
        </h1>
        <div className="inline-flex items-center gap-3 bg-card/90 backdrop-blur rounded-full px-6 py-3 mb-4 shadow-sm">
          <span className="text-3xl font-bold text-primary">{percentage}%</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-medium">
            {correct} {t('of', 'of')} {total} {t('correct', 'correct')}
          </span>
        </div>
        <p className="text-foreground/80 max-w-lg mx-auto leading-relaxed">
          {resultLevel.description}
        </p>
      </div>

      {/* Open-Mindedness Results Section */}
      {hasOpenMindedness && omResultLevel && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 mb-8 shadow-md">
          <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-indigo-500" />
            {t('openMindednessResults', 'Open-Mindedness Assessment')}
          </h2>
          <div className={cn("rounded-xl p-5 text-center bg-gradient-to-r", omResultLevel.colorClass)}>
            <span className="text-4xl block mb-2">{omResultLevel.emoji}</span>
            <h3 className="text-xl font-bold text-white mb-2">{omResultLevel.title}</h3>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-2 mb-3">
              <span className="text-lg font-bold text-white">{omScore}/{omMaxScore}</span>
            </div>
            <p className="text-white/90 text-sm leading-relaxed max-w-md mx-auto">
              {omResultLevel.description}
            </p>
          </div>
        </div>
      )}

      {/* User Reflections - Sparkly card style */}
      {(feedbackNewLearnings || feedbackActionPlan) && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 mb-8 shadow-md">
          <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary" />
            {t('yourReflections', 'Your Reflections')}
          </h2>
          <div className="space-y-4">
            {feedbackNewLearnings && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t('keyInsight', 'Key Insight')}
                </p>
                <p className="text-foreground italic leading-relaxed">"{feedbackNewLearnings}"</p>
              </div>
            )}
            {feedbackActionPlan && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t('actionPlan', 'Action Plan')}
                </p>
                <p className="text-foreground italic leading-relaxed">"{feedbackActionPlan}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Truth Reveals by Category - Sparkly styling */}
      <div className="space-y-5 mb-8">
        <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          {t('truthBehind', 'The Truth Behind Each Belief')}
        </h2>

        {sortedPages.map((page) => {
          const stats = getPageStats(page.id);
          const pagePercentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
          const isExpanded = expandedPages[page.id] ?? true;
          const pageQuestions = questions.filter(q => q.page_id === page.id);

          return (
            <div key={page.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-md">
              {/* Page Header */}
              <button
                onClick={() => togglePage(page.id)}
                className="w-full flex items-center justify-between px-5 py-4 bg-sparkly-blush hover:bg-sparkly-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="font-heading font-semibold text-foreground">{getText(page.title)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-sm font-bold px-3 py-1 rounded-full",
                    pagePercentage >= 80 ? "bg-green-500/20 text-green-600" :
                    pagePercentage >= 50 ? "bg-amber-500/20 text-amber-600" : "bg-red-500/20 text-red-600"
                  )}>
                    {stats.correct}/{stats.total}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Questions - Responsive layout */}
              {isExpanded && (
                <div className="divide-y divide-border/50">
                  {/* Desktop Table Header - hidden on mobile */}
                  <div className="hidden md:grid grid-cols-[1fr_1fr_1fr] gap-3 px-5 py-3 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <div>{t('columnHypothesis', 'Assumption')}</div>
                    <div>{t('columnReality', 'Reality for 50+')}</div>
                    <div>{t('columnInterview', 'Interview Question')}</div>
                  </div>

                  {pageQuestions.map((question, idx) => {
                    const response = responses.find(r => r.questionId === question.id);
                    const isCorrect = response?.isCorrect ?? false;
                    const womanHypothesis = getText(question.hypothesis_text_woman) || getText(question.hypothesis_text);
                    const manHypothesis = getText(question.hypothesis_text_man) || getText(question.hypothesis_text);
                    const truthExplanation = getText(question.truth_explanation);
                    const interviewQuestion = getText(question.interview_question);

                    return (
                      <div key={question.id} className={cn(
                        isCorrect ? "bg-green-500/5" : "bg-red-500/5"
                      )}>
                        {/* Desktop Layout: 3-column grid */}
                        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr] gap-3 px-5 py-4 items-start">
                          {/* Hypothesis */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              {isCorrect ? (
                                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                              )}
                              <span className="text-xs text-muted-foreground font-semibold">#{idx + 1}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="p-2.5 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                                <p className="text-xs text-pink-700 dark:text-pink-400 leading-relaxed">
                                  <span className="font-semibold">👩</span> {womanHypothesis}
                                </p>
                              </div>
                              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                                  <span className="font-semibold">👨</span> {manHypothesis}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Reality for 50+ */}
                          <div className="text-xs leading-relaxed">
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl h-full">
                              <p className="text-emerald-700 dark:text-emerald-400">
                                {truthExplanation}
                              </p>
                            </div>
                          </div>

                          {/* Interview Question */}
                          <div className="text-xs leading-relaxed">
                            <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl h-full">
                              <p className="text-violet-700 dark:text-violet-400 italic">
                                {interviewQuestion}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Layout: Stacked vertically */}
                        <div className="md:hidden p-4 space-y-3">
                          {/* Question header with status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCorrect ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm font-semibold text-foreground">
                                {language === 'fi' ? 'Kysymys' : 'Question'} #{idx + 1}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                isCorrect ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                              )}
                            >
                              {isCorrect ? labelCorrect : labelIncorrect}
                            </span>
                          </div>

                          {/* Hypotheses */}
                          <div className="space-y-2">
                              <div className="p-2.5 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                                <div className="flex items-center gap-1 mb-1">
                                  <span>👩</span>
                                  <span className="text-[10px] font-semibold text-pink-600 uppercase">{t('women', 'Women')}</span>
                                </div>
                                <p className="text-xs text-pink-700 dark:text-pink-400 leading-relaxed">
                                  {womanHypothesis}
                                </p>
                              </div>
                              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <div className="flex items-center gap-1 mb-1">
                                  <span>👨</span>
                                  <span className="text-[10px] font-semibold text-blue-600 uppercase">{t('men', 'Men')}</span>
                                </div>
                                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                                  {manHypothesis}
                                </p>
                              </div>
                          </div>

                          {/* Reality */}
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <div className="text-[10px] font-semibold text-emerald-600 uppercase mb-1">
                              {t('columnReality', 'Reality for 50+')}
                            </div>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                              {truthExplanation}
                            </p>
                          </div>

                          {/* Interview Question */}
                          <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                            <div className="text-[10px] font-semibold text-violet-600 uppercase mb-1">
                              {t('columnInterview', 'Interview Question')}
                            </div>
                            <p className="text-xs text-violet-700 dark:text-violet-400 italic leading-relaxed">
                              {interviewQuestion}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA Section - Sparkly style */}
      <section className="bg-card border border-border/50 rounded-2xl p-8 mb-8 text-center shadow-lg">
        <h2 className="font-heading text-2xl font-bold text-foreground mb-4">
          {getText(quizData?.cta_title, 'Ready for Precise Employee Assessment?')}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-lg mx-auto leading-relaxed">
          {getText(quizData?.cta_description, 'This quiz provides a general overview. For accurate, in-depth analysis of your team\'s performance and actionable improvement strategies, continue with professional testing.')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="h-14 px-8 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
          >
            <a 
              href={quizData?.cta_url || 'https://sparkly.hr'} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {getText(quizData?.cta_text, 'Continue to Sparkly.hr')}
              <ExternalLink className="w-5 h-5 ml-2" />
            </a>
          </Button>
          {quizData?.cta_retry_url ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-14 px-8 text-lg font-semibold rounded-xl border-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all"
            >
              <a 
                href={quizData.cta_retry_url} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                {getText(quizData?.cta_retry_text, t('hypothesisTakeAgain', 'Take Again'))}
              </a>
            </Button>
          ) : (
            <Button
              onClick={resetQuiz}
              variant="outline"
              size="lg"
              className="h-14 px-8 text-lg font-semibold rounded-xl border-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              {getText(quizData?.cta_retry_text, t('hypothesisTakeAgain', 'Take Again'))}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}