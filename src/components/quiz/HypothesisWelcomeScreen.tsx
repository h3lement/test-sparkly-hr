import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage, languages } from './LanguageContext';
import { useUiTranslations } from '@/hooks/useUiTranslations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Users, Target, CheckCircle, Award } from 'lucide-react';

export function HypothesisWelcomeScreen() {
  const { setCurrentStep, quizData, questions } = useHypothesisQuiz();
  const { language, setLanguage } = useLanguage();

  const { getTranslation } = useUiTranslations({ quizId: quizData?.id || null, language });
  const t = (key: string, fallback: string, fiFallback?: string) =>
    getTranslation(key, language === 'fi' ? (fiFallback ?? fallback) : fallback);

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const getDiscoverItems = () => {
    if (!quizData?.discover_items) return [];
    return quizData.discover_items.map(item => getText(item));
  };

  const defaultDiscoverItems =
    language === 'fi'
      ? [
          'Paljasta piileviä oletuksia 50+ työntekijöistä',
          'Testaa ennakkoluulojasi käytännön tilanteilla',
          'Saa tutkimusperusteisia oivalluksia parempaan rekrytointiin',
        ]
      : [
          'Uncover hidden assumptions about 50+ employees',
          'Test your bias awareness with real scenarios',
          'Get evidence-based insights for better hiring',
        ];

  const discoverItems = getDiscoverItems().length > 0 ? getDiscoverItems() : defaultDiscoverItems;

  return (
    <main className="animate-fade-in text-center max-w-2xl mx-auto" role="main" aria-labelledby="welcome-heading">
      <a 
        href="#start-quiz" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        {language === 'fi' ? 'Siirry aloitukseen' : 'Skip to start quiz'}
      </a>

      {/* Language Selector */}
      <div className="flex justify-end mb-6">
        <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
          <SelectTrigger className="w-auto min-w-[140px] gap-2 bg-card border-border/50 shadow-sm" aria-label={`Select language. Current: ${languages.find(l => l.code === language)?.nativeName}`}>
            <Globe className="w-4 h-4 text-primary" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.nativeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Badge - Sparkly style with icon */}
      <div className="inline-flex items-center gap-2 bg-sparkly-blush border border-primary/20 rounded-full px-5 py-2.5 mb-8 shadow-sm" role="status">
        <Award className="w-4 h-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">{getText(quizData?.badge_text, 'Backed by decades of HR Experience and Deep Research')}</span>
      </div>
      
      {/* Main Heading - Sparkly Typography */}
      <h1 id="welcome-heading" className="font-heading text-4xl md:text-5xl lg:text-6xl font-medium mb-6 leading-tight tracking-tight text-foreground">
        {getText(quizData?.headline, 'Do You Know')}{' '}
        <span className="font-heading italic text-primary">{getText(quizData?.headline_highlight, 'The Truth?')}</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto">
        {getText(quizData?.description, 'Test your assumptions about 50+ employees. For each hypothesis, guess what you think is true for women and men - then discover the evidence-based reality.')}
      </p>

      {/* Stats Cards - Sparkly glass style */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl font-bold text-primary mb-1">{questions.length}</div>
          <div className="text-sm text-muted-foreground">{language === 'fi' ? 'Hypoteesia testattavana' : 'Hypotheses to test'}</div>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl font-bold text-primary mb-1">~5</div>
          <div className="text-sm text-muted-foreground">{language === 'fi' ? 'Minuuttia' : 'Minutes to complete'}</div>
        </div>
      </div>
      
      {/* Discover Section - Clean card design */}
      <section className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 mb-10 text-left shadow-sm" aria-labelledby="discover-heading">
        <h2 id="discover-heading" className="font-heading text-xl font-semibold mb-5 text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t('discoverTitle', "What you'll discover:", 'Mitä saat selville:')}
        </h2>
        <ul className="space-y-4" role="list">
          {discoverItems.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <span className="text-foreground leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </section>
      
      {/* CTA Buttons - Sparkly style */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center" role="group" aria-label="Quiz actions">
        <Button 
          id="start-quiz"
          onClick={() => {
            const url = quizData?.start_cta_url;
            if (url) {
              window.location.href = url;
            } else {
              setCurrentStep('quiz');
            }
          }}
          size="lg"
          className="bg-primary text-primary-foreground px-10 py-6 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:bg-primary/90 transition-all duration-300"
          aria-describedby="quiz-duration"
        >
          {getText(quizData?.start_cta_text, t('startButton', 'Start Free Assessment', 'Aloita ilmainen arviointi'))}
        </Button>
        {getText(quizData?.start_cta_secondary_text) && (
          <Button 
            onClick={() => {
              const url = quizData?.start_cta_secondary_url;
              if (url) {
                window.location.href = url;
              } else {
                setCurrentStep('quiz');
              }
            }}
            variant="outline"
            size="lg"
            className="px-10 py-6 text-base font-semibold rounded-xl border-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
          >
            {getText(quizData?.start_cta_secondary_text)}
          </Button>
        )}
      </div>
      
      <p id="quiz-duration" className="text-sm text-muted-foreground mt-8">
        {getText(quizData?.duration_text, '🎯 Test your bias awareness • 100% anonymous')}
      </p>
    </main>
  );
}
