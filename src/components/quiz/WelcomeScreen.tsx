import { Button } from '@/components/ui/button';
import { useQuiz } from './QuizContext';
import sparklyLogo from '@/assets/sparkly-logo.png';

export function WelcomeScreen() {
  const { setCurrentStep } = useQuiz();

  return (
    <div className="animate-fade-in text-center max-w-2xl mx-auto">
      <img 
        src={sparklyLogo} 
        alt="Sparkly Logo" 
        className="w-24 h-24 mx-auto mb-8 object-contain"
      />
      
      <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6 leading-tight">
        Is Your Team Holding You{' '}
        <span className="gradient-text">Back?</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
        Take this 2-minute assessment to discover if employee performance issues 
        are secretly draining your time, energy, and business growth.
      </p>
      
      <div className="glass rounded-2xl p-6 mb-8">
        <h3 className="font-heading text-xl font-semibold mb-4">What you'll discover:</h3>
        <ul className="text-left space-y-3">
          {[
            'Your team performance score (and what it means)',
            'Hidden signs of performance problems',
            'Actionable next steps tailored to your situation',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm shrink-0 mt-0.5">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <Button 
        onClick={() => setCurrentStep('quiz')}
        size="lg"
        className="gradient-primary text-primary-foreground px-10 py-6 text-lg font-semibold rounded-full glow-primary hover:scale-105 transition-transform animate-pulse-glow"
      >
        Start Free Assessment
      </Button>
      
      <p className="text-sm text-muted-foreground mt-6">
        Takes only 2 minutes • 100% confidential
      </p>
    </div>
  );
}
