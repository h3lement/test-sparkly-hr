import { QuizProvider, useQuiz } from './QuizContext';
import { WelcomeScreen } from './WelcomeScreen';
import { QuizQuestion } from './QuizQuestion';
import { EmailCapture } from './EmailCapture';
import { ResultsScreen } from './ResultsScreen';

function QuizContent() {
  const { currentStep } = useQuiz();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        {currentStep === 'welcome' && <WelcomeScreen />}
        {currentStep === 'quiz' && <QuizQuestion />}
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
