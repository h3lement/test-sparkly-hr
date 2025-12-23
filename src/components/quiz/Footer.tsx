import { useLanguage } from './LanguageContext';

export function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="mt-12 pt-6 border-t border-border/50 text-center" role="contentinfo">
      <p className="text-sm text-muted-foreground">
        <span aria-label="Copyright">©</span> 2025{' '}
        <a 
          href="https://sparkly.hr" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
          aria-label="Sparkly.hr (opens in new tab)"
        >
          Sparkly.hr
        </a>
        . {t('allRightsReserved')}
      </p>
    </footer>
  );
}
