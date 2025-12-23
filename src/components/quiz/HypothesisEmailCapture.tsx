import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useUiTranslations } from '@/hooks/useUiTranslations';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" }).max(255);

export function HypothesisEmailCapture() {
  const { 
    email, 
    setEmail, 
    setCurrentStep, 
    calculateScore,
    calculateOpenMindednessScore,
    openMindednessQuestion,
    quizData,
    sessionId,
  } = useHypothesisQuiz();
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { getTranslation } = useUiTranslations({ quizId: quizData?.id || null, language });
  const t = (key: string, fallback: string, fiFallback?: string) =>
    getTranslation(key, language === 'fi' ? (fiFallback ?? fallback) : fallback);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: t('invalidEmail', 'Invalid email', 'Virheellinen sähköposti'),
        description:
          validation.error.errors[0]?.message || t('somethingWrong', 'Please enter a valid email address.', 'Syötä kelvollinen sähköpostiosoite.'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const { correct, total } = calculateScore();
    // Use OM question presence as a fallback in case quizData isn't hydrated yet
    const shouldIncludeOm = !!(quizData?.include_open_mindedness || openMindednessQuestion);
    const opennessScore = shouldIncludeOm ? calculateOpenMindednessScore() : null;

    try {
      // Save lead to database
      const { data: insertedLead, error } = await supabase.from('hypothesis_leads').insert({
        quiz_id: quizData?.id,
        session_id: sessionId,
        email: validation.data,
        score: correct,
        total_questions: total,
        language,
        openness_score: opennessScore,
      }).select('id').single();

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

      // Trigger background email preview pre-generation (fire and forget)
      if (insertedLead?.id) {
        supabase.functions.invoke('pregenerate-email-preview', {
          body: { leadId: insertedLead.id, leadType: 'hypothesis' }
        }).catch(err => console.warn('Email preview pregeneration error:', err));
      }
      const quizTitle = typeof quizData?.title === 'object' && quizData.title !== null 
        ? (quizData.title as Record<string, string>)[language] || (quizData.title as Record<string, string>)['en'] || 'Quiz'
        : String(quizData?.title || 'Quiz');
      
      // Send admin notification email
      supabase.functions.invoke('send-hypothesis-admin-email', {
        body: {
          email: validation.data,
          score: correct,
          totalQuestions: total,
          quizId: quizData?.id,
          quizTitle,
          language,
          leadId: insertedLead?.id,
        }
      }).catch(err => console.error('Admin email notification error:', err));

      // Send user results email with correct answers
      supabase.functions.invoke('send-hypothesis-user-email', {
        body: {
          email: validation.data,
          score: correct,
          totalQuestions: total,
          quizId: quizData?.id,
          quizTitle,
          language,
          sessionId,
          leadId: insertedLead?.id,
          opennessScore,
        }
      }).catch(err => console.error('User email notification error:', err));

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
      return { label: t('biasChampion', 'Bias Champion', 'Ennakkoluulojen mestari'), emoji: '🏆', bgColor: 'bg-emerald-500', description: t('biasChampionDesc', 'Excellent awareness! You see through most common biases about 50+ employees.', 'Erinomainen tietoisuus! Näet läpi yleisimmät ennakkoluulot 50+-työntekijöistä.') };
    } else if (percentage >= 70) {
      return { label: t('biasAware', 'Bias Aware', 'Ennakkoluulotietoinen'), emoji: '⭐', bgColor: 'bg-blue-500', description: t('biasAwareDesc', 'Strong understanding with room for refinement on 50+ workforce dynamics.', 'Vahva ymmärrys, mutta tilaa hiontaan 50+-työvoiman dynamiikassa.') };
    } else if (percentage >= 50) {
      return { label: t('biasCurious', 'Bias Curious', 'Ennakkoluuloja tutkiva'), emoji: '📚', bgColor: 'bg-amber-500', description: t('biasCuriousDesc', 'Solid foundation — the full material will deepen your insights about 50+ employees.', 'Vankka pohja — materiaali syventää oivalluksiasi 50+-työntekijöistä.') };
    } else if (percentage >= 30) {
      return { label: t('biasDiscoverer', 'Bias Discoverer', 'Ennakkoluulojen löytäjä'), emoji: '🌱', bgColor: 'bg-orange-500', description: t('biasDiscovererDesc', 'Common misconceptions detected — valuable learning ahead about 50+ workforce.', 'Yleisiä väärinkäsityksiä havaittu — arvokasta oppimista edessä.') };
    } else {
      return { label: t('biasExplorer', 'Bias Explorer', 'Ennakkoluulojen tutkija'), emoji: '🔍', bgColor: 'bg-red-500', description: t('biasExplorerDesc', 'Many beliefs to reconsider — this material will be eye-opening about 50+ employees.', 'Monta uskomusta harkittavaksi uudelleen — materiaali avaa silmät.') };
    }
  };

  const assessment = getAssessment();

  return (
    <main className="animate-fade-in max-w-xl mx-auto px-4" role="main" aria-labelledby="email-heading">
      
      {/* Score Result Card - Mobile optimized */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden mb-6 shadow-lg animate-slide-up">
        {/* Header with gradient */}
        <div className={cn("p-5 md:p-6 text-center text-white", assessment.bgColor)}>
          <span className="text-4xl md:text-5xl mb-2 block">{assessment.emoji}</span>
          <h2 className="text-xl md:text-3xl font-bold mb-1 font-heading">{assessment.label}</h2>
          <p className="text-white/90 text-sm md:text-base font-medium">
            {percentage}% · {correct} {t('of', 'of', '/')} {total} {t('correct', 'correct', 'oikein')}
          </p>
        </div>
        
        {/* Description */}
        <div className="p-4 text-center bg-sparkly-blush">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {assessment.description}
          </p>
        </div>
      </div>

      {/* Value Proposition - Mobile optimized */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 md:p-5 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <p className="text-sm font-semibold text-foreground mb-3">
          {t('submitEmailToReceive', 'Submit your email to receive:', 'Lähetä sähköpostiosoitteesi saadaksesi:')}
        </p>
        <ul className="space-y-2.5 text-sm text-foreground/90">
          <li className="flex items-start gap-2.5">
            <span className="text-primary mt-0.5 text-base">✓</span>
            <span>{t('emailBenefit1', 'Correct answers with detailed explanations', 'Oikeat vastaukset selityksineen')}</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-primary mt-0.5 text-base">✓</span>
            <span>{t('emailBenefit2', 'Research-backed insights on 50+ workforce', 'Tutkimukseen perustuvat näkemykset 50+-työvoimasta')}</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-primary mt-0.5 text-base">✓</span>
            <span>{t('emailBenefit3', 'Interview questions for 50+ candidates', 'Haastattelukysymyksiä 50+-ehdokkaille')}</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-primary mt-0.5 text-base">✓</span>
            <span>{t('emailBenefit4', 'Practical guidance on generational dynamics', 'Käytännön ohjeistusta sukupolvien väliseen dynamiikkaan')}</span>
          </li>
        </ul>
      </div>

      <h1 id="email-heading" className="font-heading text-xl md:text-3xl font-bold mb-2 text-center animate-slide-up" style={{ animationDelay: '0.15s' }}>
        {t('beforeReveal', 'Before we reveal the answers...', 'Ennen kuin paljastamme vastaukset...')}
      </h1>
      
      <p className="text-muted-foreground mb-5 text-center text-sm md:text-base animate-slide-up" id="email-description" style={{ animationDelay: '0.2s' }}>
        {t('reflectPrompt', "Take a moment to reflect on what you've learned.", 'Käytä hetki pohtiaksesi oppimaasi.')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input - Prominent on mobile */}
        <div className="bg-card border border-border/50 rounded-xl p-4 md:p-5 shadow-md animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <label htmlFor="email-input" className="flex items-center gap-2 text-sm font-medium mb-3">
            <Mail className="w-4 h-4 text-primary" />
            {t('emailToSeeResults', 'Enter your email to see results', 'Syötä sähköpostiosoitteesi nähdäksesi tulokset')}
          </label>
          <Input
            id="email-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-center text-base md:text-lg h-12 border-2 focus:border-primary rounded-xl"
            required
            autoComplete="email"
          />
        </div>
        
        {/* Submit Button - Sticky on mobile */}
        <div className="animate-slide-up" style={{ animationDelay: '0.35s' }}>
          <Button 
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full h-14 text-base md:text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
          >
            {isSubmitting
              ? t('saving', 'Saving...', 'Tallennetaan...')
              : t('revealTruth', 'Reveal the Truth', 'Paljasta totuus')}
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground mt-4 text-center pb-4">
        🔒 {t('dataSecure', 'Your data is secure. We never share your information.', 'Tietosi ovat turvassa. Emme koskaan jaa tietojasi.')}
      </p>
    </main>
  );
}
