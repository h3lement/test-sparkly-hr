import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuiz } from './QuizContext';
import { useToast } from '@/hooks/use-toast';
import sparklyLogo from '@/assets/sparkly-logo.png';

export function EmailCapture() {
  const { email, setEmail, setCurrentStep, totalScore } = useQuiz();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // For now, just log the submission (email sending will be added later)
    console.log('Quiz submission:', { email, totalScore });
    
    // Simulate a brief delay
    await new Promise(resolve => setTimeout(resolve, 500));

    toast({
      title: 'Success!',
      description: 'Your results are ready.',
    });

    setIsSubmitting(false);
    setCurrentStep('results');
  };

  return (
    <div className="animate-fade-in text-center max-w-xl mx-auto">
      <img 
        src={sparklyLogo} 
        alt="Sparkly Logo" 
        className="w-16 h-16 mx-auto mb-6 object-contain"
      />
      
      <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
        Your Results Are{' '}
        <span className="gradient-text">Ready!</span>
      </h2>
      
      <p className="text-lg text-muted-foreground mb-8">
        Enter your email to unlock your personalized performance assessment 
        and get actionable insights delivered to your inbox.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="glass rounded-2xl p-6">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-center text-lg h-14 rounded-xl border-2 focus:border-primary"
            required
          />
        </div>
        
        <Button 
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full gradient-primary text-primary-foreground py-6 text-lg font-semibold rounded-full glow-primary hover:scale-105 transition-transform"
        >
          {isSubmitting ? 'Processing...' : 'Get My Results'}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground mt-6">
        🔒 We respect your privacy. No spam, ever.
      </p>
    </div>
  );
}
