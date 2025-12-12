import { Button } from '@/components/ui/button';
import { useQuiz } from './QuizContext';
import { useLanguage, languages } from './LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function WelcomeScreen() {
  const { setCurrentStep } = useQuiz();
  const { language, setLanguage, t } = useLanguage();

  return (
    <main className="animate-fade-in text-center max-w-2xl mx-auto" role="main" aria-labelledby="welcome-heading">
      {/* Skip to main content link for keyboard users */}
      <a 
        href="#start-quiz" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Skip to start quiz
      </a>

      {/* Logo */}
      <div className="mb-6">
        <Logo />
      </div>

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
      
      <div className="badge-pill inline-flex items-center gap-2 mb-8" role="status" aria-label={t('badge')}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>{t('badge')}</span>
      </div>
      
      <h1 id="welcome-heading" className="font-heading text-4xl md:text-5xl font-medium mb-6 leading-tight tracking-tight">
        {t('headline')}{' '}
        <span className="font-heading italic gradient-text">{t('headlineHighlight')}</span>
      </h1>
      
      <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto">
        {t('description')}
      </p>
      
      <section className="glass rounded-xl p-6 mb-10 text-left" aria-labelledby="discover-heading">
        <h2 id="discover-heading" className="font-heading text-lg font-semibold mb-4 text-foreground">{t('discoverTitle')}</h2>
        <ul className="space-y-3" role="list">
          {[t('discover1'), t('discover2'), t('discover3')].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="bg-primary w-5 h-5 rounded-full flex items-center justify-center text-primary-foreground text-xs shrink-0 mt-0.5" aria-hidden="true">
                ✓
              </span>
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
          {t('startButton')}
        </Button>
        <Button 
          variant="outline"
          size="lg"
          onClick={() => setCurrentStep('quiz')}
          className="px-8 py-6 text-base font-medium rounded-lg border-primary text-primary hover:bg-primary/5 transition-all"
        >
          {t('learnMore')}
        </Button>
      </div>
      
      <p id="quiz-duration" className="text-sm text-muted-foreground mt-8">
        {t('duration')}
      </p>
    </main>
  );
}
