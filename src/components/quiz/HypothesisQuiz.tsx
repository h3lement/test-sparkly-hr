import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HypothesisQuizProvider, useHypothesisQuiz } from './HypothesisQuizContext';
import { HypothesisWelcomeScreen } from './HypothesisWelcomeScreen';
import { HypothesisQuestionScreen } from './HypothesisQuestionScreen';
import { HypothesisEmailCapture } from './HypothesisEmailCapture';
import { HypothesisResultsScreen } from './HypothesisResultsScreen';
import { HypothesisOpenMindedness } from './HypothesisOpenMindedness';
import { useHypothesisQuizPublic } from '@/hooks/useHypothesisQuizPublic';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { useLanguage } from './LanguageContext';
import { Logo } from '@/components/Logo';
import { Footer } from './Footer';

function HypothesisQuizContent() {
  // Force light mode for public quiz pages
  useForceLightMode();
  const { quizSlug } = useParams<{ quizSlug: string }>();
  const navigate = useNavigate();
  const slug = quizSlug || '';
  
  const { quiz, pages, questions, openMindednessQuestion, loading, error } = useHypothesisQuizPublic(slug);
  const { 
    currentStep, 
    setQuizData, 
    setPages, 
    setQuestions,
    setOpenMindednessQuestion,
  } = useHypothesisQuiz();
  const { setQuizId, dbTranslationsLoaded } = useLanguage();

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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="pt-6 pb-4 px-4">
        <Logo />
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

export function HypothesisQuiz() {
  return (
    <HypothesisQuizProvider>
      <HypothesisQuizContent />
    </HypothesisQuizProvider>
  );
}
