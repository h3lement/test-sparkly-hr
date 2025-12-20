import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DynamicQuizProvider, useDynamicQuiz } from './DynamicQuizContext';
import { DynamicWelcomeScreen } from './DynamicWelcomeScreen';
import { DynamicQuizQuestion } from './DynamicQuizQuestion';
import { DynamicOpenMindedness } from './DynamicOpenMindedness';
import { DynamicEmailCapture } from './DynamicEmailCapture';
import { DynamicResultsScreen } from './DynamicResultsScreen';
import { useQuizData } from '@/hooks/useQuizData';
import { Logo } from '@/components/Logo';
import { Footer } from './Footer';

function DynamicQuizContent() {
  const { quizSlug } = useParams<{ quizSlug: string }>();
  const navigate = useNavigate();
  const slug = quizSlug || 'team-performance';
  
  const { quiz, questions, resultLevels, loading, error } = useQuizData(slug);
  const { 
    currentStep, 
    setQuizData, 
    setQuestions, 
    setResultLevels 
  } = useDynamicQuiz();

  // Load quiz data into context
  useEffect(() => {
    if (quiz) setQuizData(quiz);
    if (questions.length) setQuestions(questions);
    if (resultLevels.length) setResultLevels(resultLevels);
  }, [quiz, questions, resultLevels, setQuizData, setQuestions, setResultLevels]);

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
          {currentStep === 'welcome' && <DynamicWelcomeScreen />}
          {currentStep === 'quiz' && <DynamicQuizQuestion />}
          {currentStep === 'mindedness' && <DynamicOpenMindedness />}
          {currentStep === 'email' && <DynamicEmailCapture />}
          {currentStep === 'results' && <DynamicResultsScreen />}
        </div>
      </main>
      <div className="px-4 pb-6">
        <Footer />
      </div>
    </div>
  );
}

export function DynamicQuiz() {
  return (
    <DynamicQuizProvider>
      <DynamicQuizContent />
    </DynamicQuizProvider>
  );
}
