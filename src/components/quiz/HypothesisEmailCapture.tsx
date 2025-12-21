import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lightbulb, Target } from 'lucide-react';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" }).max(255);

export function HypothesisEmailCapture() {
  const { 
    email, 
    setEmail, 
    setCurrentStep, 
    calculateScore,
    quizData,
    sessionId,
    feedbackNewLearnings,
    setFeedbackNewLearnings,
    feedbackActionPlan,
    setFeedbackActionPlan,
    questions,
  } = useHypothesisQuiz();
  const { language } = useLanguage();
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

    const { correct, total } = calculateScore();

    try {
      // Save lead to database
      const { error } = await supabase.from('hypothesis_leads').insert({
        quiz_id: quizData?.id,
        session_id: sessionId,
        email: validation.data,
        score: correct,
        total_questions: total,
        feedback_new_learnings: feedbackNewLearnings || null,
        feedback_action_plan: feedbackActionPlan || null,
        language,
      });

      if (error) {
        console.error('Error saving lead:', error);
        toast({
          title: 'Error',
          description: 'Failed to save your results. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      toast({
        title: 'Success!',
        description: 'Your results have been saved.',
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

  const { correct, total } = calculateScore();
  const percentage = Math.round((correct / total) * 100);

  return (
    <main className="animate-fade-in max-w-xl mx-auto px-4" role="main" aria-labelledby="email-heading">
      
      {/* Score Preview */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-center shadow-lg">
        <div className="text-5xl font-bold text-primary mb-2">
          {correct}/{total}
        </div>
        <p className="text-muted-foreground">
          Hypotheses answered
        </p>
      </div>

      {/* Unlock Message */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-center">
        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
          🔓 You may find it valuable to receive the complete material — including the correct answers, common misconceptions, and suggested interview questions designed to uncover what truly matters. Discover why professionals aged 50+ are often perceived as challenging by younger generations, and how to navigate these dynamics with confidence.
        </p>
      </div>

      <h1 id="email-heading" className="font-heading text-2xl md:text-3xl font-bold mb-3 text-center">
        Before we reveal the answers...
      </h1>
      
      <p className="text-muted-foreground mb-6 text-center" id="email-description">
        Take a moment to reflect on what you've learned so far.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Reflection Questions */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow">
          <div>
            <label htmlFor="new-learnings" className="flex items-center gap-2 text-sm font-medium mb-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              What new insight surprised you the most?
            </label>
            <Textarea
              id="new-learnings"
              placeholder="Share what you learned..."
              value={feedbackNewLearnings}
              onChange={(e) => setFeedbackNewLearnings(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div>
            <label htmlFor="action-plan" className="flex items-center gap-2 text-sm font-medium mb-2">
              <Target className="w-4 h-4 text-primary" />
              How will you apply this in interviews?
            </label>
            <Textarea
              id="action-plan"
              placeholder="Your action plan..."
              value={feedbackActionPlan}
              onChange={(e) => setFeedbackActionPlan(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Email Input */}
        <div className="bg-card border border-border rounded-xl p-5 shadow">
          <label htmlFor="email-input" className="flex items-center gap-2 text-sm font-medium mb-3">
            <Mail className="w-4 h-4 text-primary" />
            Enter your email to see the results
          </label>
          <Input
            id="email-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-center text-lg h-12 border-2 focus:border-primary"
            required
            autoComplete="email"
          />
        </div>
        
        <Button 
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full h-14 text-lg font-semibold"
        >
          {isSubmitting ? 'Saving...' : 'Reveal the Truth'}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        🔒 Your data is secure. We never share your information.
      </p>
    </main>
  );
}
