import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HypothesisQuizProvider, useHypothesisQuiz } from './HypothesisQuizContext';
import { HypothesisWelcomeScreen } from './HypothesisWelcomeScreen';
import { HypothesisQuestionScreen } from './HypothesisQuestionScreen';
import { HypothesisEmailCapture } from './HypothesisEmailCapture';
import { HypothesisResultsScreen } from './HypothesisResultsScreen';
import { useHypothesisQuizPublic } from '@/hooks/useHypothesisQuizPublic';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { Logo } from '@/components/Logo';
import { Footer } from './Footer';

function HypothesisQuizContent() {
  // Force light mode for public quiz pages
  useForceLightMode();
  const { quizSlug } = useParams<{ quizSlug: string }>();
  const navigate = useNavigate();
  const slug = quizSlug || '';
  
  const { quiz, pages, questions, loading, error } = useHypothesisQuizPublic(slug);
  const { 
    currentStep, 
    setQuizData, 
    setPages, 
    setQuestions,
  } = useHypothesisQuiz();

  // Load quiz data into context
  useEffect(() => {
    if (quiz) setQuizData(quiz);
    if (pages.length) setPages(pages);
    if (questions.length) setQuestions(questions);
  }, [quiz, pages, questions, setQuizData, setPages, setQuestions]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground">Loading quiz...</p>
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
