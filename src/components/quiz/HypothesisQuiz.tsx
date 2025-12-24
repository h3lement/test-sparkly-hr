import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { HypothesisQuizProvider, useHypothesisQuiz } from './HypothesisQuizContext';
import { HypothesisWelcomeScreen } from './HypothesisWelcomeScreen';
import { HypothesisQuestionScreen } from './HypothesisQuestionScreen';
import { HypothesisEmailCapture } from './HypothesisEmailCapture';
import { HypothesisResultsScreen } from './HypothesisResultsScreen';
import { HypothesisOpenMindedness } from './HypothesisOpenMindedness';
import { useHypothesisQuizPublic } from '@/hooks/useHypothesisQuizPublic';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { useLanguage, type Language } from './LanguageContext';
import { Logo } from '@/components/Logo';
import { Footer } from './Footer';

// Supported language codes for URL prefix
const SUPPORTED_LANG_PREFIXES = [
  'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'it', 'no', 'pl', 'pt', 'ru', 'es', 'sv', 'uk',
  'ro', 'el', 'cs', 'hu', 'bg', 'sk', 'hr', 'lt', 'sl', 'lv', 'ga', 'mt'
];

// Map URL step parameter to internal step names (preview mode)
function parseStepFromUrl(
  step: string | undefined,
  pageCount: number
): { step: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results'; pageIndex?: number } {
  if (!step) return { step: 'welcome' };

  const stepLower = step.toLowerCase();

  if (stepLower === 'welcome') return { step: 'welcome' };
  if (stepLower === 'mindedness') return { step: 'mindedness' };
  if (stepLower === 'email') return { step: 'email' };
  if (stepLower === 'results') return { step: 'results' };

  // Handle page shortcuts: q1, q2, ... (maps to hypothesis pages)
  const pageMatch = stepLower.match(/^q(\d+)$/);
  if (pageMatch) {
    const idx = parseInt(pageMatch[1], 10) - 1; // 0-based
    if (idx >= 0 && idx < pageCount) {
      return { step: 'quiz', pageIndex: idx };
    }
  }

  return { step: 'welcome' };
}

interface HypothesisQuizContentProps {
  languageFromUrl?: string;
}

function HypothesisQuizContent({ languageFromUrl }: HypothesisQuizContentProps) {
  // Force light mode for public quiz pages
  useForceLightMode();

  const { quizSlug, step: urlStep } = useParams<{ quizSlug: string; step?: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';
  const navigate = useNavigate();
  const slug = quizSlug || '';

  const { quiz, pages, questions, openMindednessQuestion, loading, error } = useHypothesisQuizPublic(slug);
  const {
    currentStep,
    setQuizData,
    setPages,
    setQuestions,
    setOpenMindednessQuestion,
    setCurrentStep,
    setCurrentPageIndex,
    setCurrentQuestionIndex,
  } = useHypothesisQuiz();

  const { setQuizId, setLanguage, dbTranslationsLoaded } = useLanguage();
  const [initialStepApplied, setInitialStepApplied] = useState(false);

  // Apply language from URL path (e.g., /et/quiz-slug)
  useEffect(() => {
    if (languageFromUrl && SUPPORTED_LANG_PREFIXES.includes(languageFromUrl)) {
      setLanguage(languageFromUrl as Language);
    }
  }, [languageFromUrl, setLanguage]);

  // Read language from URL query parameter and apply it (legacy support for admin preview)
  useEffect(() => {
    const langParam = searchParams.get('lang');
    if (langParam && SUPPORTED_LANG_PREFIXES.includes(langParam)) {
      setLanguage(langParam as Language);
    }
  }, [searchParams, setLanguage]);

  // Load quiz data into context and set quizId for translations
  useEffect(() => {
    if (quiz) {
      setQuizData(quiz);
      setQuizId(quiz.id);
    }
    if (pages.length) setPages(pages);
    if (questions.length) setQuestions(questions);
    if (openMindednessQuestion) setOpenMindednessQuestion(openMindednessQuestion);
  }, [quiz, pages, questions, openMindednessQuestion, setQuizData, setPages, setQuestions, setOpenMindednessQuestion, setQuizId]);

  // In preview mode, apply the URL step directly (supports q1..qN page shortcuts)
  useEffect(() => {
    if (!isPreviewMode || initialStepApplied) return;

    const pageCount = pages.length;
    // Apply once we know how many pages we have
    if (pageCount <= 0) return;

    const parsed = parseStepFromUrl(urlStep, pageCount);
    setCurrentStep(parsed.step);

    if (parsed.pageIndex !== undefined) {
      setCurrentPageIndex(parsed.pageIndex);
      setCurrentQuestionIndex(0);
    }

    setInitialStepApplied(true);
  }, [isPreviewMode, urlStep, pages.length, initialStepApplied, setCurrentStep, setCurrentPageIndex, setCurrentQuestionIndex]);

  // Show loading while data or translations are loading
  if (loading || !dbTranslationsLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground">{loading ? 'Loading quiz...' : 'Loading translations...'}</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Quiz Not Found</h1>
        <p className="text-muted-foreground mb-6">The quiz "{slug}" doesn't exist or is not active.</p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Go to homepage
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="pt-6 pb-4 px-4">
        <Logo quizSlug={slug} />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl">
          {currentStep === 'welcome' && <HypothesisWelcomeScreen />}
          {currentStep === 'quiz' && <HypothesisQuestionScreen />}
          {currentStep === 'mindedness' && <HypothesisOpenMindedness />}
          {currentStep === 'email' && <HypothesisEmailCapture />}
          {currentStep === 'results' && <HypothesisResultsScreen />}
        </div>
      </main>
      <div className="px-4 pb-6">
        <Footer />
      </div>
    </div>
  );
}

interface HypothesisQuizProps {
  languageFromUrl?: string;
}

export function HypothesisQuiz({ languageFromUrl }: HypothesisQuizProps) {
  return (
    <HypothesisQuizProvider>
      <HypothesisQuizContent languageFromUrl={languageFromUrl} />
    </HypothesisQuizProvider>
  );
}
