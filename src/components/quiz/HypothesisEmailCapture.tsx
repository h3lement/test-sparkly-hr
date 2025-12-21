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
    <main className="animate-fade-in max-w-xl mx-auto" role="main" aria-labelledby="email-heading">
      
      {/* Score Preview */}
      <div className="glass rounded-2xl p-6 mb-8 text-center">
        <div className="text-5xl font-bold gradient-text mb-2">
          {correct}/{total}
        </div>
        <p className="text-muted-foreground">
          You correctly identified {percentage}% of the biases
        </p>
      </div>

      <h1 id="email-heading" className="font-heading text-3xl md:text-4xl font-bold mb-4 text-center">
        Almost Done!{' '}
        <span className="gradient-text">Reflect & Save</span>
      </h1>
      
      <p className="text-lg text-muted-foreground mb-8 text-center" id="email-description">
        Take a moment to reflect on what you learned. We'll email you a summary of your insights.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reflection Questions */}
        <div className="glass rounded-2xl p-6 space-y-5">
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
              className="min-h-[100px] resize-none"
            />
          </div>

          <div>
            <label htmlFor="action-plan" className="flex items-center gap-2 text-sm font-medium mb-2">
              <Target className="w-4 h-4 text-primary" />
              How will you apply this in your hiring process?
            </label>
            <Textarea
              id="action-plan"
              placeholder="Your action plan..."
              value={feedbackActionPlan}
              onChange={(e) => setFeedbackActionPlan(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>

        {/* Email Input */}
        <div className="glass rounded-2xl p-6">
          <label htmlFor="email-input" className="flex items-center gap-2 text-sm font-medium mb-3">
            <Mail className="w-4 h-4 text-primary" />
            Get your personalized report
          </label>
          <Input
            id="email-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-center text-lg h-14 rounded-xl border-2 focus:border-primary"
            required
            autoComplete="email"
          />
        </div>
        
        <Button 
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-primary text-primary-foreground py-6 text-lg font-semibold rounded-full glow-primary hover:scale-105 transition-transform"
        >
          {isSubmitting ? 'Saving...' : 'Get My Results'}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground mt-6 text-center">
        🔒 Your data is secure. We never share your information.
      </p>
    </main>
  );
}
