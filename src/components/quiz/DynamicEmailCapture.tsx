import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDynamicQuiz } from './DynamicQuizContext';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" }).max(255);

// Determine which edge function to call based on quiz type
function getEmailFunctionName(quizType: string | undefined): string {
  switch (quizType) {
    case 'emotional':
      return 'send-emotional-user-email';
    case 'hypothesis':
      return 'send-hypothesis-user-email';
    default:
      return 'send-quiz-results';
  }
}

export function DynamicEmailCapture() {
  const { 
    email, 
    setEmail, 
    setCurrentStep, 
    totalScore, 
    openMindednessScore,
    resultLevels,
    openMindednessResultLevels,
    quizData,
    answers
  } = useDynamicQuiz();
  const { language, t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: t('invalidEmail'),
        description: validation.error.errors[0]?.message || 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // Find the matching result level
    const result = resultLevels.find(
      (level) => totalScore >= level.min_score && totalScore <= level.max_score
    ) || resultLevels[resultLevels.length - 1];

    const maxScore = resultLevels.length > 0 
      ? Math.max(...resultLevels.map(r => r.max_score))
      : 24;

    // Find the matching open-mindedness result level
    const omResult = openMindednessResultLevels.find(
      (level) => openMindednessScore >= level.min_score && openMindednessScore <= level.max_score
    );
    
    const omMaxScore = openMindednessResultLevels.length > 0
      ? Math.max(...openMindednessResultLevels.map(l => l.max_score))
      : 4;

    try {
      // Resolve quiz_id (required by DB policy) - recover by slug if context isn't hydrated
      let effectiveQuizId: string | undefined = quizData?.id;

      if (!effectiveQuizId && quizData?.slug) {
        const { data: quizRow, error: quizLookupError } = await supabase
          .from('quizzes')
          .select('id')
          .eq('slug', quizData.slug)
          .eq('is_active', true)
          .maybeSingle();

        if (quizLookupError) {
          console.error('Quiz lookup error:', quizLookupError);
        }

        effectiveQuizId = quizRow?.id;
      }

      if (!effectiveQuizId) {
        console.error('Quiz ID is missing - cannot save lead');
        toast({
          title: t('emailError'),
          description: 'Quiz data not loaded. Please refresh and try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // PRIORITY 1: Insert lead and get the ID (wait for result to prevent duplicates)
      console.log('Saving lead to database...');
      const { data: insertedLead, error: insertError } = await supabase
        .from('quiz_leads')
        .insert({
          email: validation.data,
          score: totalScore,
          total_questions: maxScore,
          result_category: result ? getText(result.title) : 'Your Results',
          openness_score: openMindednessScore ?? null,
          language: language,
          quiz_id: effectiveQuizId,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Lead insert error:', insertError);
        // Continue anyway - edge function can create the lead as backup
      } else {
        console.log('Lead saved successfully with ID:', insertedLead?.id);
      }

      // PRIORITY 2: Queue emails via edge function (fire and forget)
      // Route to appropriate edge function based on quiz type
      const emailFunctionName = getEmailFunctionName(quizData?.quiz_type);
      console.log('Using email function:', emailFunctionName, 'for quiz type:', quizData?.quiz_type);
      
      // Build request body based on quiz type
      const emailRequestBody = quizData?.quiz_type === 'emotional' 
        ? {
            email: validation.data,
            averageScore: totalScore / (answers.length || 12), // Calculate average for emotional quiz
            emotionalLevel: Math.round(totalScore / (answers.length || 12)),
            quizId: effectiveQuizId,
            language,
            existingLeadId: insertedLead?.id,
          }
        : {
            email: validation.data,
            totalScore,
            maxScore,
            resultTitle: result ? getText(result.title) : 'Your Results',
            resultDescription: result ? getText(result.description) : '',
            insights: result?.insights?.map(i => getText(i)) || [],
            language,
            opennessScore: openMindednessScore,
            opennessMaxScore: omMaxScore,
            opennessTitle: omResult ? getText(omResult.title) : '',
            opennessDescription: omResult ? getText(omResult.description) : '',
            quizId: effectiveQuizId,
            quizSlug: quizData?.slug,
            existingLeadId: insertedLead?.id,
          };
      
      supabase.functions.invoke(emailFunctionName, {
        body: emailRequestBody,
      }).catch(err => console.error('Email sending error:', err));

      // Fire confetti celebration immediately
      const end = Date.now() + 800;
      const colors = ['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: colors
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      toast({
        title: t('emailSuccess'),
        description: t('emailSuccessDesc'),
      });

      setCurrentStep('results');
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: t('emailError'),
        description: t('somethingWrong'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="animate-fade-in text-center max-w-xl mx-auto" role="main" aria-labelledby="email-heading">
      
      <h1 id="email-heading" className="font-heading text-3xl md:text-4xl font-bold mb-4">
        {t('resultsReady')}{' '}
        <span className="gradient-text">{t('resultsReadyHighlight')}</span>
      </h1>
      
      <p className="text-lg text-muted-foreground mb-8" id="email-description">
        {t('emailDescription')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="glass rounded-2xl p-6">
          <label htmlFor="email-input" className="sr-only">Email address</label>
          <Input
            id="email-input"
            type="email"
            placeholder={t('emailPlaceholder')}
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
          className="w-full gradient-primary text-primary-foreground py-6 text-lg font-semibold rounded-full glow-primary hover:scale-105 transition-transform"
        >
          {isSubmitting ? t('sending') : t('getResults')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground mt-6">
        {t('privacyNotice')}
      </p>
    </main>
  );
}
