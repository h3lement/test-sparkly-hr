import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DynamicQuizProvider, useDynamicQuiz } from './DynamicQuizContext';
import { DynamicWelcomeScreen } from './DynamicWelcomeScreen';
import { DynamicQuizQuestion } from './DynamicQuizQuestion';
import { DynamicOpenMindedness } from './DynamicOpenMindedness';
import { DynamicEmailCapture } from './DynamicEmailCapture';
import { DynamicResultsScreen } from './DynamicResultsScreen';
import { EmotionalResultsScreen } from './EmotionalResultsScreen';
import { HypothesisQuiz } from './HypothesisQuiz';
import { useQuizData } from '@/hooks/useQuizData';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { useLanguage, languages, type Language } from './LanguageContext';
import { Logo } from '@/components/Logo';
import { Footer } from './Footer';

// Supported language codes for URL prefix
const SUPPORTED_LANG_PREFIXES = [
  'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'it', 'no', 'pl', 'pt', 'ru', 'es', 'sv', 'uk',
  'ro', 'el', 'cs', 'hu', 'bg', 'sk', 'hr', 'lt', 'sl', 'lv', 'ga', 'mt'
];

// Map URL step parameter to internal step names
function parseStepFromUrl(step: string | undefined, questionCount: number): { step: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results', questionIndex?: number } {
  if (!step) return { step: 'welcome' };
  
  const stepLower = step.toLowerCase();
  
  if (stepLower === 'welcome') return { step: 'welcome' };
  if (stepLower === 'mindedness') return { step: 'mindedness' };
  if (stepLower === 'email') return { step: 'email' };
  if (stepLower === 'results') return { step: 'results' };
  
  // Handle question steps: q1, q2, q3, etc.
  const questionMatch = stepLower.match(/^q(\d+)$/);
  if (questionMatch) {
    const qIndex = parseInt(questionMatch[1], 10) - 1; // Convert to 0-based
    if (qIndex >= 0 && qIndex < questionCount) {
      return { step: 'quiz', questionIndex: qIndex };
    }
  }
  
  return { step: 'welcome' };
}

interface StandardQuizContentProps {
  slug: string;
  quizType: string;
  languageFromUrl?: string;
}

function StandardQuizContent({ slug, quizType, languageFromUrl }: StandardQuizContentProps) {
  const { step: urlStep } = useParams<{ step?: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';
  const navigate = useNavigate();
  const { quiz, questions, resultLevels, openMindednessResultLevels, loading, error } = useQuizData(slug);
  const { 
    currentStep, 
    setCurrentStep,
    setCurrentQuestion,
    setQuizData, 
    setQuestions, 
    setResultLevels,
    setOpenMindednessResultLevels,
    quizData: existingQuizData
  } = useDynamicQuiz();
  const { setQuizId, setLanguage, language, dbTranslationsLoaded } = useLanguage();
  const [initialStepApplied, setInitialStepApplied] = useState(false);
  
  // Apply language from URL path (e.g., /et/quiz-slug)
  useEffect(() => {
    if (languageFromUrl && SUPPORTED_LANG_PREFIXES.includes(languageFromUrl)) {
      setLanguage(languageFromUrl as Language);
    }
  }, [languageFromUrl, setLanguage]);
  
  // Read language from URL query parameter and apply it (legacy support)
  useEffect(() => {
    const langParam = searchParams.get('lang');
    if (langParam && SUPPORTED_LANG_PREFIXES.includes(langParam)) {
      setLanguage(langParam as Language);
    }
  }, [searchParams, setLanguage]);

  // Load quiz data into context and set quizId for translations
  // Only set data if not already loaded (prevent reset during quiz)
  useEffect(() => {
    if (quiz && !existingQuizData) {
      setQuizData(quiz);
      setQuizId(quiz.id);
    } else if (quiz && existingQuizData && quiz.id !== existingQuizData.id) {
      // Only update if quiz ID changed (navigated to different quiz)
      setQuizData(quiz);
      setQuizId(quiz.id);
    }
    // Always set questions in preview mode, otherwise only on welcome
    if (questions.length && (currentStep === 'welcome' || isPreviewMode)) setQuestions(questions);
    if (resultLevels.length) setResultLevels(resultLevels);
    if (openMindednessResultLevels.length) setOpenMindednessResultLevels(openMindednessResultLevels);
  }, [quiz, questions, resultLevels, openMindednessResultLevels, setQuizData, setQuestions, setResultLevels, setOpenMindednessResultLevels, setQuizId, existingQuizData, currentStep, isPreviewMode]);

  // In preview mode, apply the URL step directly (bypass normal flow)
  useEffect(() => {
    if (isPreviewMode && questions.length > 0 && !initialStepApplied) {
      const regularQuestions = questions.filter(q => q.question_type !== 'open_mindedness');
      const parsed = parseStepFromUrl(urlStep, regularQuestions.length);
      setCurrentStep(parsed.step);
      if (parsed.questionIndex !== undefined) {
        setCurrentQuestion(parsed.questionIndex);
      }
      setInitialStepApplied(true);
    }
  }, [isPreviewMode, urlStep, questions, setCurrentStep, setCurrentQuestion, initialStepApplied]);

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
        <button 
          onClick={() => navigate('/')}
          className="text-primary hover:underline"
        >
          Go to homepage
        </button>
      </div>
    );
  }

  // Use custom results screen for emotional quiz type
  const ResultsComponent = quizType === 'emotional' ? EmotionalResultsScreen : DynamicResultsScreen;

  const handleLogoClick = () => {
    // Reset quiz to beginning
    setCurrentStep('welcome');
    setCurrentQuestion(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="pt-6 pb-4 px-4">
        <Logo quizSlug={slug} onLogoClick={handleLogoClick} />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl">
          {currentStep === 'welcome' && <DynamicWelcomeScreen />}
          {currentStep === 'quiz' && <DynamicQuizQuestion />}
          {currentStep === 'mindedness' && <DynamicOpenMindedness />}
          {currentStep === 'email' && <DynamicEmailCapture />}
          {currentStep === 'results' && <ResultsComponent />}
        </div>
      </main>
      <div className="px-4 pb-6">
        <Footer />
      </div>
    </div>
  );
}

interface QuizTypeRouterProps {
  languageFromUrl?: string;
}

function QuizTypeRouter({ languageFromUrl }: QuizTypeRouterProps) {
  const { quizSlug, lang } = useParams<{ quizSlug: string; lang?: string }>();
  const navigate = useNavigate();
  
  // Determine actual language and slug
  // If lang param exists and is a valid language, use it
  // Otherwise, treat it as a quiz slug (for backwards compatibility)
  const effectiveLanguage = languageFromUrl || (lang && SUPPORTED_LANG_PREFIXES.includes(lang) ? lang : undefined);
  const slug = quizSlug || (lang && !SUPPORTED_LANG_PREFIXES.includes(lang) ? lang : 'team-performance');
  
  // Force light mode for public quiz pages
  useForceLightMode();
  
  const [quizType, setQuizType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkQuizType() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('quizzes')
        .select('quiz_type')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Quiz not found');
        setLoading(false);
        return;
      }

      setQuizType(data.quiz_type);
      setLoading(false);
    }

    checkQuizType();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Quiz Not Found</h1>
        <p className="text-muted-foreground mb-6">The quiz "{slug}" doesn't exist or is not active.</p>
        <button 
          onClick={() => navigate('/')}
          className="text-primary hover:underline"
        >
          Go to homepage
        </button>
      </div>
    );
  }

  // Route to hypothesis quiz if type matches
  if (quizType === 'hypothesis') {
    return <HypothesisQuiz languageFromUrl={effectiveLanguage} />;
  }

  // Emotional and standard quizzes use the same flow
  // (emotional quiz uses average-based scoring but same components)
  return (
    <DynamicQuizProvider>
      <StandardQuizContent slug={slug} quizType={quizType || 'standard'} languageFromUrl={effectiveLanguage} />
    </DynamicQuizProvider>
  );
}

interface DynamicQuizProps {
  languageFromUrl?: string;
}

export function DynamicQuiz({ languageFromUrl }: DynamicQuizProps) {
  return <QuizTypeRouter languageFromUrl={languageFromUrl} />;
}
