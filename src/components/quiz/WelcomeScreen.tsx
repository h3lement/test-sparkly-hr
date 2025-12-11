import { Button } from '@/components/ui/button';
import { useQuiz } from './QuizContext';
import { Footer } from './Footer';
import { Logo } from '@/components/Logo';

export function WelcomeScreen() {
  const { setCurrentStep } = useQuiz();

  return (
    <div className="animate-fade-in text-center max-w-2xl mx-auto">
      <div className="mb-10">
        <Logo />
      </div>
      
      <div className="badge-pill inline-flex items-center gap-2 mb-8">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>Backed by decades of HR Experience and Deep Research</span>
      </div>
      
      <h1 className="font-heading text-4xl md:text-5xl font-medium mb-6 leading-tight tracking-tight">
        Is Your Team Holding You{' '}
        <span className="font-heading italic gradient-text">Back?</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto">
        Take this 2-minute assessment to discover if employee performance issues 
        are secretly draining your time, energy, and business growth.
      </p>
      
      <div className="glass rounded-xl p-6 mb-10 text-left">
        <h3 className="font-heading text-lg font-semibold mb-4 text-foreground">What you'll discover:</h3>
        <ul className="space-y-3">
          {[
            'Your team performance score (and what it means)',
            'Hidden signs of performance problems',
            'Actionable next steps tailored to your situation',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="bg-primary w-5 h-5 rounded-full flex items-center justify-center text-primary-foreground text-xs shrink-0 mt-0.5">
                ✓
              </span>
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          onClick={() => setCurrentStep('quiz')}
          size="lg"
          className="bg-primary text-primary-foreground px-8 py-6 text-base font-semibold rounded-lg glow-primary hover:bg-primary/90 transition-all"
        >
          Start Free Assessment
        </Button>
        <Button 
          variant="outline"
          size="lg"
          onClick={() => setCurrentStep('quiz')}
          className="px-8 py-6 text-base font-medium rounded-lg border-primary text-primary hover:bg-primary/5 transition-all"
        >
          Learn More
        </Button>
      </div>
      
      <p className="text-sm text-muted-foreground mt-8">
        Takes only 2 minutes • 100% confidential
      </p>
      
      <Footer />
    </div>
  );
}
