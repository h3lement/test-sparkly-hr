import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  } = useHypothesisQuiz();
  const { language } = useLanguage();

  const { correct, total } = calculateScore();
  const percentage = Math.round((correct / total) * 100);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  // Get result level based on score
  const getResultLevel = () => {
    if (percentage >= 80) return { title: 'Bias Champion', emoji: '🏆', color: 'text-green-500', description: 'Excellent awareness! You see through most common biases about 50+ employees.' };
    if (percentage >= 60) return { title: 'Aware Recruiter', emoji: '👁️', color: 'text-blue-500', description: 'Good progress! You recognize many biases but have room to grow.' };
    if (percentage >= 40) return { title: 'Learning Mindset', emoji: '📚', color: 'text-yellow-500', description: 'You\'re on your way. This test revealed some blind spots to work on.' };
    return { title: 'Fresh Start', emoji: '🌱', color: 'text-orange-500', description: 'Great that you took this test! Now you know where to focus your learning.' };
  };

  const resultLevel = getResultLevel();
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  // Group responses by page
  const getPageStats = (pageId: string) => {
    const pageQuestions = questions.filter(q => q.page_id === pageId);
    const pageResponses = responses.filter(r => pageQuestions.some(q => q.id === r.questionId));
    const correctCount = pageResponses.filter(r => r.isCorrect).length;
    return { correct: correctCount, total: pageQuestions.length };
  };

  return (
    <main className="animate-fade-in max-w-2xl mx-auto px-4" role="main" aria-labelledby="results-heading">
      {/* Hero Score Card */}
      <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden mb-6">
        <div className={cn(
          "py-8 px-6 text-center",
          percentage >= 80 ? "bg-green-500/10" :
          percentage >= 60 ? "bg-blue-500/10" :
          percentage >= 40 ? "bg-amber-500/10" : "bg-orange-500/10"
        )}>
          <span className="text-6xl block mb-4">{resultLevel.emoji}</span>
          <h1 id="results-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            {resultLevel.title}
          </h1>
          <div className="inline-flex items-center gap-2 bg-background/80 backdrop-blur rounded-full px-4 py-2 mb-4">
            <span className="text-2xl font-bold text-foreground">{percentage}%</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{correct} of {total} correct</span>
          </div>
          <p className="text-foreground/80 max-w-md mx-auto">
            {resultLevel.description}
          </p>
        </div>

        {/* Score Progress Bar */}
        <div className="px-6 py-5 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Bias Awareness Score</span>
            <span className={cn(
              "text-sm font-semibold",
              percentage >= 80 ? "text-green-600" :
              percentage >= 60 ? "text-blue-600" :
              percentage >= 40 ? "text-amber-600" : "text-orange-600"
            )}>{percentage}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000 ease-out rounded-full",
                percentage >= 80 ? "bg-green-500" :
                percentage >= 60 ? "bg-blue-500" :
                percentage >= 40 ? "bg-amber-500" : "bg-orange-500"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Breakdown Card */}
      <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Results by Category
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {sortedPages.map((page) => {
            const stats = getPageStats(page.id);
            const pagePercentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            return (
              <div key={page.id} className="bg-muted/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground text-sm">{getText(page.title)}</span>
                  <span className={cn(
                    "text-sm font-semibold px-2 py-0.5 rounded-full",
                    pagePercentage >= 80 ? "bg-green-500/20 text-green-600" :
                    pagePercentage >= 50 ? "bg-amber-500/20 text-amber-600" : "bg-red-500/20 text-red-600"
                  )}>
                    {stats.correct}/{stats.total}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      pagePercentage >= 80 ? "bg-green-500" :
                      pagePercentage >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${pagePercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Reflections Card */}
      {(feedbackNewLearnings || feedbackActionPlan) && (
        <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Your Reflections
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {feedbackNewLearnings && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Key Insight
                </p>
                <p className="text-foreground italic leading-relaxed">"{feedbackNewLearnings}"</p>
              </div>
            )}
            {feedbackActionPlan && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Action Plan
                </p>
                <p className="text-foreground italic leading-relaxed">"{feedbackActionPlan}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Takeaways Card */}
      <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-foreground">Key Takeaways</h2>
        </div>
        <div className="p-6">
          <ul className="space-y-3">
            <li className="flex items-start gap-3 bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-foreground/90">Age-based assumptions often don't reflect individual capabilities</span>
            </li>
            <li className="flex items-start gap-3 bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-foreground/90">Experience brings valuable self-awareness and wisdom</span>
            </li>
            <li className="flex items-start gap-3 bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-foreground/90">Interview questions should focus on evidence, not assumptions</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={resetQuiz}
          variant="outline"
          size="lg"
          className="flex-1 h-14"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Take Again
        </Button>
        {quizData?.cta_url && (
          <Button
            asChild
            size="lg"
            className="flex-1 h-14"
          >
            <a href={quizData.cta_url} target="_blank" rel="noopener noreferrer">
              {getText(quizData.cta_text, 'Learn More')}
              <ExternalLink className="w-5 h-5 ml-2" />
            </a>
          </Button>
        )}
      </div>
    </main>
  );
}
