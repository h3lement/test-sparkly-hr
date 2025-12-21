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
    <main className="animate-fade-in max-w-2xl mx-auto" role="main" aria-labelledby="results-heading">
      {/* Hero Score */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{resultLevel.emoji}</div>
        <h1 id="results-heading" className="font-heading text-3xl md:text-4xl font-bold mb-2">
          {resultLevel.title}
        </h1>
        <p className={cn("text-xl font-semibold", resultLevel.color)}>
          {correct} out of {total} correct ({percentage}%)
        </p>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
          {resultLevel.description}
        </p>
      </div>

      {/* Score Visualization */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Your Bias Awareness Score</span>
          <span className="text-sm text-muted-foreground">{percentage}%</span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-1000 rounded-full",
              percentage >= 80 ? "bg-green-500" :
              percentage >= 60 ? "bg-blue-500" :
              percentage >= 40 ? "bg-yellow-500" : "bg-orange-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Results by Category
        </h2>
        <div className="space-y-3">
          {sortedPages.map((page) => {
            const stats = getPageStats(page.id);
            const pagePercentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            return (
              <div key={page.id} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1 mr-4">{getText(page.title)}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full",
                        pagePercentage >= 80 ? "bg-green-500" :
                        pagePercentage >= 50 ? "bg-yellow-500" : "bg-orange-500"
                      )}
                      style={{ width: `${pagePercentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {stats.correct}/{stats.total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Reflections */}
      {(feedbackNewLearnings || feedbackActionPlan) && (
        <div className="glass rounded-2xl p-6 mb-8">
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Your Reflections
          </h2>
          {feedbackNewLearnings && (
            <div className="mb-4">
              <div className="text-sm text-muted-foreground mb-1">Key insight:</div>
              <p className="text-foreground italic">"{feedbackNewLearnings}"</p>
            </div>
          )}
          {feedbackActionPlan && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Action plan:</div>
              <p className="text-foreground italic">"{feedbackActionPlan}"</p>
            </div>
          )}
        </div>
      )}

      {/* Key Takeaways */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-heading text-lg font-semibold mb-4">Key Takeaways</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <span>Age-based assumptions often don't reflect individual capabilities</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <span>Experience brings valuable self-awareness and wisdom</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <span>Interview questions should focus on evidence, not assumptions</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={resetQuiz}
          variant="outline"
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Take Again
        </Button>
        {quizData?.cta_url && (
          <Button
            asChild
            className="flex-1 bg-primary text-primary-foreground"
          >
            <a href={quizData.cta_url} target="_blank" rel="noopener noreferrer">
              {getText(quizData.cta_text, 'Learn More')}
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}
      </div>
    </main>
  );
}
