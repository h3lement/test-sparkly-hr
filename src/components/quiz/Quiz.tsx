import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuizProvider, useQuiz } from './QuizContext';
import { WelcomeScreen } from './WelcomeScreen';
import { QuizQuestion } from './QuizQuestion';
import { OpenMindednessQuestion } from './OpenMindednessQuestion';
import { EmailCapture } from './EmailCapture';
import { ResultsScreen } from './ResultsScreen';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { trackPageView } from '@/hooks/usePageTracking';
import { Logo } from '@/components/Logo';
import { Footer } from './Footer';

// Map URL slugs to quiz steps
const SLUG_TO_STEP: Record<string, { step: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results'; question?: number }> = {
  'welcome': { step: 'welcome' },
  'q1': { step: 'quiz', question: 0 },
  'q2': { step: 'quiz', question: 1 },
  'q3': { step: 'quiz', question: 2 },
  'q4': { step: 'quiz', question: 3 },
  'q5': { step: 'quiz', question: 4 },
  'q6': { step: 'quiz', question: 5 },
  'mindedness': { step: 'mindedness' },
  'email': { step: 'email' },
  'results': { step: 'results' },
};

// Map quiz state to URL slug
const getSlugFromState = (step: string, questionNumber?: number): string => {
  if (step === 'quiz' && typeof questionNumber === 'number') {
    return `q${questionNumber + 1}`;
  }
  return step;
};

function QuizContent() {
  const { currentStep, currentQuestion, setCurrentStep, setCurrentQuestion } = useQuiz();
  const { step: urlStep } = useParams<{ step?: string }>();
  const navigate = useNavigate();
  useDocumentTitle();

  // Sync URL to quiz state on mount/URL change
  useEffect(() => {
    const slug = urlStep || 'welcome';
    const mapping = SLUG_TO_STEP[slug];
    
    if (mapping) {
      if (mapping.step !== currentStep || (mapping.step === 'quiz' && mapping.question !== currentQuestion)) {
        setCurrentStep(mapping.step);
        if (mapping.step === 'quiz' && typeof mapping.question === 'number') {
          setCurrentQuestion(mapping.question);
        }
      }
      // Track page view when URL changes
      trackPageView(slug);
    }
  }, [urlStep]);

  // Sync quiz state to URL when state changes
  useEffect(() => {
    const currentSlug = getSlugFromState(currentStep, currentStep === 'quiz' ? currentQuestion : undefined);
    const expectedPath = currentSlug === 'welcome' ? '/quiz/welcome' : `/quiz/${currentSlug}`;
    const currentPath = window.location.pathname;
    
    // Only navigate if the path doesn't match
    if (currentPath !== expectedPath && currentPath !== '/' || (currentPath === '/' && currentStep !== 'welcome')) {
      navigate(expectedPath, { replace: true });
    }
  }, [currentStep, currentQuestion, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      {currentStep !== 'welcome' && (
        <header className="pt-6 pb-4 px-4">
          <Logo />
        </header>
      )}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl">
          {currentStep === 'welcome' && <WelcomeScreen />}
          {currentStep === 'quiz' && <QuizQuestion />}
          {currentStep === 'mindedness' && <OpenMindednessQuestion />}
          {currentStep === 'email' && <EmailCapture />}
          {currentStep === 'results' && <ResultsScreen />}
        </div>
      </main>
      <div className="px-4 pb-6">
        <Footer />
      </div>
    </div>
  );
}

export function Quiz() {
  return (
    <QuizProvider>
      <QuizContent />
    </QuizProvider>
  );
}
