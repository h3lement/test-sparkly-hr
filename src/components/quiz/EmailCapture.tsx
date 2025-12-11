import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuiz, quizQuestions } from './QuizContext';
import { useToast } from '@/hooks/use-toast';
import { Footer } from './Footer';
import { Logo } from '@/components/Logo';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" }).max(255, { message: "Email must be less than 255 characters" });

interface ResultLevel {
  min: number;
  max: number;
  title: string;
  description: string;
  insights: string[];
}

const resultLevels: ResultLevel[] = [
  {
    min: 6,
    max: 10,
    title: 'High-Performing Team',
    description: 'Congratulations! Your team is operating at a high level. You\'ve built a solid foundation that allows you to focus on growth.',
    insights: [
      'Your delegation skills are strong',
      'Team members show initiative and ownership',
      'You have time to focus on strategic priorities',
    ],
  },
  {
    min: 11,
    max: 16,
    title: 'Room for Improvement',
    description: 'Your team has potential, but there are clear areas where performance improvements could significantly impact your business.',
    insights: [
      'Some tasks take longer than they should',
      'Communication gaps may be causing delays',
      'Clearer expectations could boost results',
    ],
  },
  {
    min: 17,
    max: 20,
    title: 'Performance Challenges',
    description: 'You\'re likely spending significant time managing issues rather than growing your business. This is holding you back.',
    insights: [
      'You\'re frequently re-doing delegated work',
      'Employee issues consume your daily focus',
      'Scaling feels impossible right now',
    ],
  },
  {
    min: 21,
    max: 24,
    title: 'Critical Performance Gap',
    description: 'Your team performance is significantly impacting your ability to run and grow your business. Immediate action is needed.',
    insights: [
      'You\'re essentially doing everything yourself',
      'Taking time off feels impossible',
      'Employee issues are your biggest bottleneck',
    ],
  },
];

export function EmailCapture() {
  const { email, setEmail, setCurrentStep, totalScore } = useQuiz();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: 'Invalid email',
        description: validation.error.errors[0]?.message || 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const maxScore = quizQuestions.length * 4;
    const result = resultLevels.find(
      (level) => totalScore >= level.min && totalScore <= level.max
    ) || resultLevels[resultLevels.length - 1];

    try {
      const { error } = await supabase.functions.invoke('send-quiz-results', {
        body: {
          email: validation.data,
          totalScore,
          maxScore,
          resultTitle: result.title,
          resultDescription: result.description,
          insights: result.insights,
        },
      });

      if (error) {
        console.error('Error sending results:', error);
        toast({
          title: 'Error',
          description: 'Failed to send results. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      toast({
        title: 'Success!',
        description: 'Your results have been sent to your email.',
      });

      setCurrentStep('results');
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in text-center max-w-xl mx-auto">
      <div className="mb-6">
        <Logo />
      </div>
      
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
          {isSubmitting ? 'Sending...' : 'Get My Results'}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground mt-6">
        🔒 We respect your privacy. No spam, ever.
      </p>
      
      <Footer />
    </div>
  );
}
