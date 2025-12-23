import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDynamicQuiz } from './DynamicQuizContext';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" }).max(255);

export function DynamicEmailCapture() {
  const { 
    email, 
    setEmail, 
    setCurrentStep, 
    totalScore, 
    openMindednessScore,
    resultLevels,
    openMindednessResultLevels,
    quizData
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
      const { error } = await supabase.functions.invoke('send-quiz-results', {
        body: {
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
          quizId: quizData?.id,
          quizSlug: quizData?.slug,
        },
      });

      if (error) {
        console.error('Error sending results:', error);
        toast({
          title: t('emailError'),
          description: t('somethingWrong'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

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
