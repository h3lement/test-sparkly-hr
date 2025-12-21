import { Button } from '@/components/ui/button';
import { useHypothesisQuiz } from './HypothesisQuizContext';
import { useLanguage, languages } from './LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Users, Target, CheckCircle } from 'lucide-react';

export function HypothesisWelcomeScreen() {
  const { setCurrentStep, quizData, questions } = useHypothesisQuiz();
  const { language, setLanguage } = useLanguage();

  const getText = (textObj: Record<string, string> | undefined, fallback: string = '') => {
    if (!textObj) return fallback;
    return textObj[language] || textObj['en'] || fallback;
  };

  const getDiscoverItems = () => {
    if (!quizData?.discover_items) return [];
    return quizData.discover_items.map(item => getText(item));
  };

  const defaultDiscoverItems = [
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
        Skip to start quiz
      </a>

      {/* Language Selector */}
      <div className="flex justify-end mb-4">
        <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
          <SelectTrigger className="w-auto min-w-[140px] gap-2" aria-label={`Select language. Current: ${languages.find(l => l.code === language)?.nativeName}`}>
            <Globe className="w-4 h-4" aria-hidden="true" />
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
      
      <div className="badge-pill inline-flex items-center gap-2 mb-8" role="status">
        <Target className="w-4 h-4" aria-hidden="true" />
        <span>{getText(quizData?.badge_text, 'Bias Awareness Test')}</span>
      </div>
      
      <h1 id="welcome-heading" className="font-heading text-4xl md:text-5xl font-medium mb-6 leading-tight tracking-tight">
        {getText(quizData?.headline, 'Do You Know')}{' '}
        <span className="font-heading italic gradient-text">{getText(quizData?.headline_highlight, 'The Truth?')}</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto">
        {getText(quizData?.description, 'Test your assumptions about 50+ employees. For each hypothesis, guess what you think is true for women and men - then discover the evidence-based reality.')}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass rounded-xl p-4">
          <div className="text-3xl font-bold text-primary">{questions.length}</div>
          <div className="text-sm text-muted-foreground">Hypotheses to test</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-3xl font-bold text-primary">~5</div>
          <div className="text-sm text-muted-foreground">Minutes to complete</div>
        </div>
      </div>
      
      <section className="glass rounded-xl p-6 mb-10 text-left" aria-labelledby="discover-heading">
        <h2 id="discover-heading" className="font-heading text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          What you'll discover:
        </h2>
        <ul className="space-y-3" role="list">
          {discoverItems.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center" role="group" aria-label="Quiz actions">
        <Button 
          id="start-quiz"
          onClick={() => setCurrentStep('quiz')}
          size="lg"
          className="bg-primary text-primary-foreground px-8 py-6 text-base font-semibold rounded-lg glow-primary hover:bg-primary/90 transition-all"
          aria-describedby="quiz-duration"
        >
          {getText(quizData?.cta_text, 'Start the Test')}
        </Button>
      </div>
      
      <p id="quiz-duration" className="text-sm text-muted-foreground mt-8">
        {getText(quizData?.duration_text, '🎯 Test your bias awareness • 100% anonymous')}
      </p>
    </main>
  );
}
