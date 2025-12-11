import { QuizProvider, useQuiz } from './QuizContext';
import { WelcomeScreen } from './WelcomeScreen';
import { QuizQuestion } from './QuizQuestion';
import { OpenMindednessQuestion } from './OpenMindednessQuestion';
import { EmailCapture } from './EmailCapture';
import { ResultsScreen } from './ResultsScreen';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

function QuizContent() {
  const { currentStep } = useQuiz();
  useDocumentTitle();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        {currentStep === 'welcome' && <WelcomeScreen />}
        {currentStep === 'quiz' && <QuizQuestion />}
        {currentStep === 'mindedness' && <OpenMindednessQuestion />}
        {currentStep === 'email' && <EmailCapture />}
        {currentStep === 'results' && <ResultsScreen />}
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
