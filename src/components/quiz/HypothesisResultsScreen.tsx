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
          const isExpanded = expandedPages[page.id] ?? true;
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

              {/* Questions Table */}
              {isExpanded && (
                <div className="divide-y divide-border">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-muted/20 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <div>Hypothesis</div>
                    <div>The Actual Fear</div>
                    <div>Reality for 50+</div>
                    <div>Interview Question</div>
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
                        "grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-3 py-3 items-start",
                        isCorrect ? "bg-green-500/5" : "bg-red-500/5"
                      )}>
                        {/* Hypothesis */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 mb-1">
                            {isCorrect ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground font-medium">#{idx + 1}</span>
                          </div>
                          <div className="text-xs space-y-1">
                            <p className="text-pink-700 dark:text-pink-400">
                              <span className="font-medium">👩</span> {womanHypothesis}
                            </p>
                            <p className="text-blue-700 dark:text-blue-400">
                              <span className="font-medium">👨</span> {manHypothesis}
                            </p>
                          </div>
                        </div>

                        {/* The Actual Fear */}
                        <div className="text-xs text-foreground/80 leading-relaxed">
                          <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                            <p className="text-orange-700 dark:text-orange-400">
                              Younger generations often fear that 50+ employees may be resistant to change, less adaptable, or harder to manage.
                            </p>
                          </div>
                        </div>

                        {/* Reality for 50+ */}
                        <div className="text-xs leading-relaxed">
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <p className="text-emerald-700 dark:text-emerald-400">
                              {truthExplanation || "50+ professionals bring stability, mentorship, and proven problem-solving skills developed over decades."}
                            </p>
                          </div>
                        </div>

                        {/* Interview Question */}
                        <div className="text-xs leading-relaxed">
                          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-blue-700 dark:text-blue-400 italic">
                              {interviewQuestion || "What recent change in your field excited you most, and how did you adapt to it?"}
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

      {/* CTA Section */}
      <section className="bg-card border border-border rounded-xl p-6 mb-6 text-center shadow">
        <h2 className="font-heading text-xl font-semibold mb-3">
          Ready for Precise Employee Assessment?
        </h2>
        <p className="text-muted-foreground text-sm mb-5 max-w-lg mx-auto">
          This quiz provides a general overview. For accurate, in-depth analysis of your team's performance and actionable improvement strategies, continue with professional testing.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            size="lg"
            className="h-12"
          >
            <a 
              href={quizData?.cta_url || 'https://sparkly.hr'} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {getText(quizData?.cta_text, 'Continue to Sparkly.hr')}
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
          <Button
            onClick={resetQuiz}
            variant="outline"
            size="lg"
            className="h-12"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Take Again
          </Button>
        </div>
      </section>
    </main>
  );
}