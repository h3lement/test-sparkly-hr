import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { useUiTranslations } from '@/hooks/useUiTranslations';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, Loader2, ThumbsUp, ThumbsDown, ArrowUp, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnswerValue = boolean | null;

interface PageAnswers {
  [questionId: string]: AnswerValue;
}

export function HypothesisQuestionScreen() {
  const {
    quizData,
    pages,
    getCurrentPage,
    getQuestionsForPage,
    currentPageIndex,
    setCurrentPageIndex,
    addResponse,
    responses,
    sessionId,
    setCurrentStep,
    getProgress,
    openMindednessQuestion,
  } = useHypothesisQuiz();
  const { language } = useLanguage();

  const [pageAnswers, setPageAnswers] = useState<PageAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollHelper, setShowScrollHelper] = useState(false);
  const [firstUnansweredIndex, setFirstUnansweredIndex] = useState<number | null>(null);
  
  const questionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPage = getCurrentPage();
  const progress = getProgress();
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  const { getTranslation } = useUiTranslations({ quizId: quizData?.id || null, language });

  const t = (key: string, fallback: string, fiFallback?: string) =>
    getTranslation(key, language === 'fi' ? (fiFallback ?? fallback) : fallback);

  const tFmt = (
    key: string,
    vars: Record<string, string | number>,
    fallback: string,
    fiFallback?: string
  ) =>
    t(key, fallback, fiFallback).replace(/\{(\w+)\}/g, (_, k: string) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
    );

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const pageQuestions = currentPage ? getQuestionsForPage(currentPage.id) : [];

  // Initialize or reset answers when page changes
  useEffect(() => {
    if (!currentPage) return;
    
    const initialAnswers: PageAnswers = {};
    
    pageQuestions.forEach((q) => {
      const existingResponse = responses.find(r => r.questionId === q.id);
      if (existingResponse) {
        initialAnswers[q.id] = existingResponse.answerWoman;
      } else {
        initialAnswers[q.id] = null;
      }
    });
    
    setPageAnswers(initialAnswers);
  }, [currentPage?.id, pageQuestions.length]);

  // Track first unanswered question and scroll visibility
  useEffect(() => {
    const unansweredIdx = pageQuestions.findIndex(q => pageAnswers[q.id] === null || pageAnswers[q.id] === undefined);
    setFirstUnansweredIndex(unansweredIdx >= 0 ? unansweredIdx : null);
  }, [pageAnswers, pageQuestions]);

  // Scroll observer for mobile floating button
  useEffect(() => {
    if (firstUnansweredIndex === null) {
      setShowScrollHelper(false);
      return;
    }

    const question = pageQuestions[firstUnansweredIndex];
    if (!question) return;

    const element = questionRefs.current.get(question.id);
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show helper when the unanswered question is NOT visible
        setShowScrollHelper(!entry.isIntersecting);
      },
      { threshold: 0.3 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [firstUnansweredIndex, pageQuestions]);

  const scrollToUnanswered = useCallback(() => {
    if (firstUnansweredIndex === null) return;
    const question = pageQuestions[firstUnansweredIndex];
    if (!question) return;
    
    const element = questionRefs.current.get(question.id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [firstUnansweredIndex, pageQuestions]);

  const handleAnswer = (questionId: string, value: boolean) => {
    setPageAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const allQuestionsAnswered = pageQuestions.every(q => pageAnswers[q.id] !== null && pageAnswers[q.id] !== undefined);


  const handleSubmitAndContinue = async () => {
    if (!allQuestionsAnswered || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const inserts = pageQuestions.map(q => ({
        quiz_id: quizData?.id,
        session_id: sessionId,
        question_id: q.id,
        answer_woman: pageAnswers[q.id],
        answer_man: pageAnswers[q.id],
      }));

      await supabase.from('hypothesis_responses').insert(inserts);

      pageQuestions.forEach(q => {
        const answer = pageAnswers[q.id]!;
        const isCorrect = answer === q.correct_answer_woman && answer === q.correct_answer_man;
        
        addResponse({
          questionId: q.id,
          answerWoman: answer,
          answerMan: answer,
          isCorrect,
        });
      });

      // Immediately proceed to next page or complete
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
       if (currentPageIndex < sortedPages.length - 1) {
         setCurrentPageIndex(currentPageIndex + 1);
       } else if (quizData?.include_open_mindedness || !!openMindednessQuestion) {
         setCurrentStep('mindedness');
       } else {
         setCurrentStep('email');
       }
    } catch (error) {
      console.error('Error saving responses:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  const answeredCount = Object.values(pageAnswers).filter(v => v !== null).length;

  if (!currentPage) {
    return <div className="text-center p-8">{t('loading', 'Loading...', 'Ladataan...')}</div>;
  }

  return (
    <main className="animate-fade-in max-w-4xl mx-auto px-4" role="main">
      {/* Progress bar - Sparkly style with rounded ends */}
      <div className="mb-8">
        <div className="h-2 bg-sparkly-cream rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-primary to-sparkly-indigo-light transition-all duration-500 rounded-full"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-right font-medium">
          {tFmt(
            'progressCompleted',
            { current: progress.current, total: progress.total },
            '{current} of {total} hypotheses completed',
            '{current}/{total} hypoteesia tehty'
          )}
        </p>
      </div>

      {/* Page Header - Sparkly Typography */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">{getText(currentPage.title)}</h1>
          <span className="text-sm text-muted-foreground bg-sparkly-blush px-3 py-1.5 rounded-full font-medium">
            {tFmt(
              'pageOf',
              { current: currentPageIndex + 1, total: sortedPages.length },
              'Page {current} of {total}',
              'Sivu {current}/{total}'
            )}
          </span>
        </div>
        <p className="text-muted-foreground">{getText(currentPage.description)}</p>
      </div>

      {/* Questions Card - Sparkly card style */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
        {/* Desktop Table Header - hidden on mobile */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_180px] gap-2 px-5 py-4 bg-sparkly-blush border-b border-border/50 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">👩</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{t('women', 'Women', 'Naiset')} 50+</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">👨</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{t('men', 'Men', 'Miehet')} 50+</span>
          </div>
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
              {t('answerLabel', 'Answer', 'Vastaus')}
            </span>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden px-4 py-3 bg-sparkly-blush border-b border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{t('hypothesesLabel', 'Hypotheses', 'Hypoteesit')}</span>
            <span className="text-xs text-muted-foreground">
              {tFmt(
                'answeredCount',
                { answered: answeredCount, total: pageQuestions.length },
                '{answered}/{total} answered',
                '{answered}/{total} vastattu'
              )}
            </span>
          </div>
        </div>

        {/* Status Bar with Bulk Actions - Desktop only */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_180px] gap-2 px-5 py-3 bg-muted/30 border-b border-border/50 items-center">
          <div className="col-span-2 flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {tFmt(
                'thisPageAnswered',
                { answered: answeredCount, total: pageQuestions.length },
                'This page: {answered} of {total} answered',
                'Tällä sivulla: {answered} / {total} vastattu'
              )}
            </span>
            {allQuestionsAnswered && (
              <span className="text-sm text-green-600 font-semibold bg-green-500/10 px-3 py-1 rounded-full">✓ {t('readyToSubmit', 'Ready to submit!', 'Valmis lähetettäväksi!')}</span>
            )}
          </div>
          
          {/* Bulk True/False Buttons */}
          <div className="flex justify-center items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 rounded-lg"
              onClick={() => {
                const newAnswers: PageAnswers = {};
                pageQuestions.forEach(q => { newAnswers[q.id] = true; });
                setPageAnswers(newAnswers);
              }}
            >
              {t('allTrue', 'All True', 'Kaikki tosi')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-semibold border-orange-400/50 text-orange-600 hover:bg-orange-500/10 rounded-lg"
              onClick={() => {
                const newAnswers: PageAnswers = {};
                pageQuestions.forEach(q => { newAnswers[q.id] = false; });
                setPageAnswers(newAnswers);
              }}
            >
              {t('allFalse', 'All False', 'Kaikki epätosi')}
            </Button>
          </div>
        </div>

        {/* Question Rows */}
        <div className="divide-y divide-border/50">
          {pageQuestions.map((question, idx) => {
            const answer = pageAnswers[question.id];

            const isCorrect = answer === question.correct_answer_woman && 
                             answer === question.correct_answer_man;

            const womanHypothesis = getText(question.hypothesis_text_woman) || getText(question.hypothesis_text);
            const manHypothesis = getText(question.hypothesis_text_man) || getText(question.hypothesis_text);

            const previousPagesQuestions = sortedPages
              .slice(0, currentPageIndex)
              .reduce((sum, page) => sum + getQuestionsForPage(page.id).length, 0);
            const overallNumber = previousPagesQuestions + idx + 1;

            return (
              <div 
                key={question.id}
                ref={(el) => {
                  if (el) questionRefs.current.set(question.id, el);
                }}
                className="relative transition-all hover:bg-muted/20 animate-slide-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Desktop Layout: 3-column grid */}
                <div className="hidden md:grid grid-cols-[1fr_1fr_180px] gap-3 px-5 py-4 items-start">
                  {/* Women Hypothesis */}
                  <div className="p-3 bg-pink-50/80 dark:bg-pink-950/20 rounded-xl border border-pink-200/50 dark:border-pink-800/30">
                    <p className="text-sm leading-relaxed font-medium text-foreground">
                      <span className="text-primary font-bold mr-1.5">{overallNumber}.</span>
                      {womanHypothesis}
                    </p>
                  </div>

                  {/* Men Hypothesis */}
                  <div className="p-3 bg-blue-50/80 dark:bg-blue-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                    <p className="text-sm leading-relaxed font-medium text-foreground">
                      <span className="text-primary font-bold mr-1.5">{overallNumber}.</span>
                      {manHypothesis}
                    </p>
                  </div>

                  {/* Answer Buttons */}
                  <div className="flex justify-center items-start pt-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={answer === true ? "default" : "outline"}
                        className={cn(
                          "h-10 px-4 text-sm font-semibold rounded-xl transition-all",
                          answer === true && "bg-primary hover:bg-primary/90 shadow-md"
                        )}
                        onClick={() => handleAnswer(question.id, true)}
                      >
                        {t('trueLabel', 'True', 'Tosi')}
                      </Button>
                      <Button
                        size="sm"
                        variant={answer === false ? "default" : "outline"}
                        className={cn(
                          "h-10 px-4 text-sm font-semibold rounded-xl transition-all",
                          answer === false && "bg-orange-500 hover:bg-orange-600 shadow-md"
                        )}
                        onClick={() => handleAnswer(question.id, false)}
                      >
                        {t('falseLabel', 'False', 'Epätosi')}
                      </Button>
                      {answer !== null && (
                        isCorrect ? (
                          <ThumbsUp className="w-5 h-5 text-green-500 animate-fade-in ml-1" />
                        ) : (
                          <ThumbsDown className="w-5 h-5 text-red-500 animate-fade-in ml-1" />
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Layout: Stacked vertically */}
                <div className="md:hidden p-4 space-y-3">
                  {/* Question Number & Answer Feedback */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{t('question', 'Question', 'Kysymys')} {overallNumber}</span>
                    {answer !== null && (
                      <div className="flex items-center gap-1">
                        {isCorrect ? (
                          <>
                            <ThumbsUp className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">{t('correctLabel', 'Correct!', 'Oikein!')}</span>
                          </>
                        ) : (
                          <>
                            <ThumbsDown className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-red-500 font-medium">{t('incorrectLabel', 'Incorrect', 'Väärin')}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Women Hypothesis */}
                  <div className="p-3 bg-pink-50/80 dark:bg-pink-950/20 rounded-xl border border-pink-200/50 dark:border-pink-800/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">👩</span>
                      <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase">{t('women', 'Women', 'Naiset')} 50+</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">
                      {womanHypothesis}
                    </p>
                  </div>

                  {/* Men Hypothesis */}
                  <div className="p-3 bg-blue-50/80 dark:bg-blue-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">👨</span>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">{t('men', 'Men', 'Miehet')} 50+</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">
                      {manHypothesis}
                    </p>
                  </div>

                  {/* Answer Buttons - Full width on mobile */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant={answer === true ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-11 text-sm font-semibold rounded-xl transition-all",
                        answer === true && "bg-primary hover:bg-primary/90 shadow-md"
                      )}
                      onClick={() => handleAnswer(question.id, true)}
                    >
                      {t('trueLabel', 'True', 'Tosi')}
                    </Button>
                    <Button
                      variant={answer === false ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-11 text-sm font-semibold rounded-xl transition-all",
                        answer === false && "bg-orange-500 hover:bg-orange-600 shadow-md text-white"
                      )}
                      onClick={() => handleAnswer(question.id, false)}
                    >
                      {t('falseLabel', 'False', 'Epätosi')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bulk Actions - at bottom of card (both mobile and desktop) */}
        <div className="px-4 md:px-5 py-3 bg-muted/30 border-t border-border/50 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 rounded-lg"
              onClick={() => {
                const newAnswers: PageAnswers = {};
                pageQuestions.forEach(q => { newAnswers[q.id] = true; });
                setPageAnswers(newAnswers);
              }}
            >
              {t('allTrue', 'All True', 'Kaikki tosi')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-semibold border-orange-400/50 text-orange-600 hover:bg-orange-500/10 rounded-lg"
              onClick={() => {
                const newAnswers: PageAnswers = {};
                pageQuestions.forEach(q => { newAnswers[q.id] = false; });
                setPageAnswers(newAnswers);
              }}
            >
              {t('allFalse', 'All False', 'Kaikki epätosi')}
            </Button>
          </div>
          {allQuestionsAnswered && (
            <span className="text-xs text-green-600 font-semibold">✓ {t('ready', 'Ready!', 'Valmis!')}</span>
          )}
        </div>
      </div>

      {/* Action Buttons - Sparkly style */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
        {currentPageIndex > 0 && (
          <Button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setCurrentPageIndex(currentPageIndex - 1);
            }}
            variant="outline"
            size="lg"
            className="h-14 px-8 text-lg font-semibold rounded-xl border-2 order-2 sm:order-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('previous', 'Previous', 'Edellinen')}
          </Button>
        )}
        <Button
          onClick={handleSubmitAndContinue}
          disabled={!allQuestionsAnswered || isSubmitting}
          size="lg"
          className="flex-1 h-14 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all order-1 sm:order-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t('submitting', 'Submitting...', 'Lähetetään...')}
            </>
          ) : (
            <>
              {currentPageIndex < sortedPages.length - 1 ? (
                <>
                  {t('submitNextPage', 'Submit & Next Page', 'Lähetä & Seuraava sivu')} ({answeredCount}/{pageQuestions.length})
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                <>
                  {t('submitSeeResults', 'Submit & See Results', 'Lähetä & Katso tulokset')} ({answeredCount}/{pageQuestions.length})
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </>
          )}
        </Button>
      </div>

      {/* Mobile Floating Progress Indicator */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          {/* Progress bar */}
          <div className="flex-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-sparkly-indigo-light transition-all duration-300 rounded-full"
                style={{ width: `${(answeredCount / pageQuestions.length) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Counter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn(
              "text-sm font-bold transition-colors",
              allQuestionsAnswered ? "text-green-600" : "text-primary"
            )}>
              {answeredCount}
            </span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{pageQuestions.length}</span>
            {allQuestionsAnswered && (
              <span className="text-green-600 text-sm ml-1">✓</span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Floating Scroll Helper Button */}
      {showScrollHelper && firstUnansweredIndex !== null && (
        <div className="md:hidden fixed bottom-24 right-4 z-50 animate-bounce-subtle">
          <Button
            onClick={scrollToUnanswered}
            size="sm"
            className="h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center gap-2"
          >
            <CircleDot className="w-4 h-4" />
            <span className="text-sm font-medium">
              Q{firstUnansweredIndex + 1}
            </span>
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>
      )}
    </main>
  );
}
