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
import { cn } from '@/lib/utils';

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

  // Get assessment category based on percentage
  const getAssessment = () => {
    if (percentage >= 90) {
      return { label: "Bias Champion", emoji: "🏆", bgColor: "bg-emerald-500", description: "Excellent awareness! You see through most common biases about 50+ employees." };
    } else if (percentage >= 70) {
      return { label: "Bias Aware", emoji: "⭐", bgColor: "bg-blue-500", description: "Strong understanding with room for refinement on 50+ workforce dynamics." };
    } else if (percentage >= 50) {
      return { label: "Bias Curious", emoji: "📚", bgColor: "bg-amber-500", description: "Solid foundation — the full material will deepen your insights about 50+ employees." };
    } else if (percentage >= 30) {
      return { label: "Bias Discoverer", emoji: "🌱", bgColor: "bg-orange-500", description: "Common misconceptions detected — valuable learning ahead about 50+ workforce." };
    } else {
      return { label: "Bias Explorer", emoji: "🔍", bgColor: "bg-red-500", description: "Many beliefs to reconsider — this material will be eye-opening about 50+ employees." };
    }
  };

  const assessment = getAssessment();

  return (
    <main className="animate-fade-in max-w-xl mx-auto px-4" role="main" aria-labelledby="email-heading">
      
      {/* Score Result Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6 shadow-lg">
        {/* Header with gradient */}
        <div className={cn("p-6 text-center text-white", assessment.bgColor)}>
          <span className="text-4xl mb-2 block">{assessment.emoji}</span>
          <h2 className="text-2xl md:text-3xl font-bold mb-1">{assessment.label}</h2>
          <p className="text-white/90 text-sm font-medium">
            {percentage}% · {correct} of {total} correct
          </p>
        </div>
        
        {/* Description */}
        <div className="p-4 text-center bg-muted/30">
          <p className="text-sm text-foreground/80">
            {assessment.description}
          </p>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-foreground mb-3">Submit your email to receive:</p>
        <ul className="space-y-2 text-sm text-foreground/90">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Correct answers with detailed explanations for each hypothesis</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Common misconceptions debunked with research-backed insights</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Interview questions designed to reveal what truly drives 50+ candidates</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Practical guidance on navigating generational dynamics with confidence</span>
          </li>
        </ul>
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
              What will you do differently since today?
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
