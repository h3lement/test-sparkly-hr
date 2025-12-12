import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuiz } from './QuizContext';
import { useLanguage, TranslationKey } from './LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Footer } from './Footer';
import { Logo } from '@/components/Logo';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { usePageTracking, QUIZ_STEPS } from '@/hooks/usePageTracking';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" }).max(255, { message: "Email must be less than 255 characters" });

interface ResultLevel {
  min: number;
  max: number;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  insightKeys: TranslationKey[];
}

const resultLevels: ResultLevel[] = [
  {
    min: 6,
    max: 10,
    titleKey: 'highPerformingTeam',
    descKey: 'highPerformingDesc',
    insightKeys: ['highPerformingInsight1', 'highPerformingInsight2', 'highPerformingInsight3'],
  },
  {
    min: 11,
    max: 16,
    titleKey: 'roomForImprovement',
    descKey: 'roomForImprovementDesc',
    insightKeys: ['roomForImprovementInsight1', 'roomForImprovementInsight2', 'roomForImprovementInsight3'],
  },
  {
    min: 17,
    max: 20,
    titleKey: 'performanceChallenges',
    descKey: 'performanceChallengesDesc',
    insightKeys: ['performanceChallengesInsight1', 'performanceChallengesInsight2', 'performanceChallengesInsight3'],
  },
  {
    min: 21,
    max: 24,
    titleKey: 'criticalPerformanceGap',
    descKey: 'criticalPerformanceGapDesc',
    insightKeys: ['criticalPerformanceGapInsight1', 'criticalPerformanceGapInsight2', 'criticalPerformanceGapInsight3'],
  },
];

export function EmailCapture() {
  const { email, setEmail, setCurrentStep, totalScore, openMindednessScore } = useQuiz();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Track page view
  usePageTracking(QUIZ_STEPS.EMAIL);

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

    const maxScore = 24; // 6 questions * 4 max points
    const result = resultLevels.find(
      (level) => totalScore >= level.min && totalScore <= level.max
    ) || resultLevels[resultLevels.length - 1];

    try {
      const { error } = await supabase.functions.invoke('send-quiz-results', {
        body: {
          email: validation.data,
          totalScore,
          maxScore,
          resultTitle: t(result.titleKey),
          resultDescription: t(result.descKey),
          insights: result.insightKeys.map(key => t(key)),
          language,
          opennessScore: openMindednessScore,
        },
      });

      if (error) {
        console.error('Error sending results:', error);
        toast({
          title: t('emailError'),
          description: 'Failed to send results. Please try again.',
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
      <div className="mb-6">
        <Logo />
      </div>
      
      <h1 id="email-heading" className="font-heading text-3xl md:text-4xl font-bold mb-4">
        {t('resultsReady')}{' '}
        <span className="gradient-text">{t('resultsReadyHighlight')}</span>
      </h1>
      
      <p className="text-lg text-muted-foreground mb-8" id="email-description">
        {t('emailDescription')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" aria-describedby="email-description privacy-notice">
        <div className="glass rounded-2xl p-6">
          <label htmlFor="email-input" className="sr-only">{t('emailPlaceholder')}</label>
          <Input
            id="email-input"
            type="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-center text-lg h-14 rounded-xl border-2 focus:border-primary"
            required
            aria-required="true"
            aria-invalid={email.length > 0 && !emailSchema.safeParse(email).success}
            autoComplete="email"
          />
        </div>
        
        <Button 
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full gradient-primary text-primary-foreground py-6 text-lg font-semibold rounded-full glow-primary hover:scale-105 transition-transform"
          aria-busy={isSubmitting}
          aria-live="polite"
        >
          {isSubmitting ? t('sending') : t('getResults')}
        </Button>
      </form>

      <p id="privacy-notice" className="text-sm text-muted-foreground mt-6">
        {t('privacyNotice')}
      </p>
      
      <Footer />
    </main>
  );
}
