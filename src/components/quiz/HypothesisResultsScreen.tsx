import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp, Award, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  const { correct, total } = calculateScore();
  const percentage = Math.round((correct / total) * 100);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  // Get result level based on score
  const getResultLevel = () => {
    if (percentage >= 80) return { title: 'Bias Champion', emoji: '🏆', color: 'text-green-500', bgColor: 'bg-green-500/10', description: 'Excellent awareness! You see through most common biases about 50+ employees.' };
    if (percentage >= 60) return { title: 'Aware Recruiter', emoji: '👁️', color: 'text-blue-500', bgColor: 'bg-blue-500/10', description: 'Good progress! You recognize many biases but have room to grow.' };
    if (percentage >= 40) return { title: 'Learning Mindset', emoji: '📚', color: 'text-amber-500', bgColor: 'bg-amber-500/10', description: 'You\'re on your way. This test revealed some blind spots to work on.' };
    return { title: 'Fresh Start', emoji: '🌱', color: 'text-orange-500', bgColor: 'bg-orange-500/10', description: 'Great that you took this test! Now you know where to focus your learning.' };
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

  const togglePage = (pageId: string) => {
    setExpandedPages(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  return (
    <main className="animate-fade-in max-w-3xl mx-auto px-4" role="main" aria-labelledby="results-heading">
      {/* Hero Score Card */}
      <div className={cn("rounded-2xl p-6 mb-6 text-center border", resultLevel.bgColor)}>
        <span className="text-5xl block mb-3">{resultLevel.emoji}</span>
        <h1 id="results-heading" className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
          {resultLevel.title}
        </h1>
        <div className="inline-flex items-center gap-2 bg-background/80 backdrop-blur rounded-full px-4 py-2 mb-3">
          <span className="text-2xl font-bold text-foreground">{percentage}%</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{correct} of {total} correct</span>
        </div>
        <p className="text-foreground/80 max-w-md mx-auto text-sm">
          {resultLevel.description}
        </p>
      </div>

      {/* User Reflections */}
      {(feedbackNewLearnings || feedbackActionPlan) && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-primary" />
            Your Reflections
          </h2>
          <div className="space-y-3 text-sm">
            {feedbackNewLearnings && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Key Insight</p>
                <p className="text-foreground italic">"{feedbackNewLearnings}"</p>
              </div>
            )}
            {feedbackActionPlan && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Action Plan</p>
                <p className="text-foreground italic">"{feedbackActionPlan}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Truth Reveals by Category */}
      <div className="space-y-4 mb-6">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          The Truth Behind Each Belief
        </h2>

        {sortedPages.map((page) => {
          const stats = getPageStats(page.id);
          const pagePercentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
          const isExpanded = expandedPages[page.id] ?? true; // Default expanded
          const pageQuestions = questions.filter(q => q.page_id === page.id);

          return (
            <div key={page.id} className="bg-card border border-border rounded-xl overflow-hidden shadow">
              {/* Page Header */}
              <button
                onClick={() => togglePage(page.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm text-foreground">{getText(page.title)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    pagePercentage >= 80 ? "bg-green-500/20 text-green-600" :
                    pagePercentage >= 50 ? "bg-amber-500/20 text-amber-600" : "bg-red-500/20 text-red-600"
                  )}>
                    {stats.correct}/{stats.total}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Questions in this page */}
              {isExpanded && (
                <div className="divide-y divide-border">
                  {pageQuestions.map((question, idx) => {
                    const response = responses.find(r => r.questionId === question.id);
                    const isCorrect = response?.isCorrect ?? false;

                    return (
                      <div key={question.id} className="p-4">
                        {/* Question header */}
                        <div className="flex items-start gap-3 mb-3">
                          <span className={cn(
                            "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                            isCorrect ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                          )}>
                            {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              {getText(question.hypothesis_text)}
                            </p>
                            {/* User's answers */}
                            <div className="flex gap-4 mt-2 text-xs">
                              <span className={cn(
                                "px-2 py-0.5 rounded",
                                response?.answerWoman === false ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                              )}>
                                👩 You: {response?.answerWoman ? 'True' : 'False'}
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded",
                                response?.answerMan === false ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                              )}>
                                👨 You: {response?.answerMan ? 'True' : 'False'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                ✓ Correct: FALSE for both
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Truth explanation */}
                        <div className="ml-9 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                            The Reality
                          </p>
                          <p className="text-sm text-foreground/90 leading-relaxed">
                            {getText(question.truth_explanation)}
                          </p>
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

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={resetQuiz}
          variant="outline"
          size="lg"
          className="flex-1 h-12"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Take Again
        </Button>
        {quizData?.cta_url && (
          <Button
            asChild
            size="lg"
            className="flex-1 h-12"
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