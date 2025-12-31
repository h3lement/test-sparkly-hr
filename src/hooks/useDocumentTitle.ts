import { useEffect } from 'react';
import { useLanguage } from '@/components/quiz/LanguageContext';

const SITE_SUFFIX = ' - Test.Sparkly.hr';

export function useDocumentTitle(quizTitle?: string) {
  const { t } = useLanguage();

  useEffect(() => {
    // Use quiz title if provided, otherwise fall back to translation
    const baseTitle = quizTitle || t('pageTitle');
    document.title = baseTitle ? `${baseTitle}${SITE_SUFFIX}` : 'Test.Sparkly.hr';
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('metaDescription'));
    }
    
    // Update Open Graph title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', document.title);
    }
    
    // Update Open Graph description
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', t('metaDescription'));
    }
  }, [t, quizTitle]);
}

export function useQuizDocumentTitle(quizTitle?: string) {
  useEffect(() => {
    if (quizTitle) {
      document.title = `${quizTitle}${SITE_SUFFIX}`;
      
      // Update Open Graph title
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', document.title);
      }
    }
  }, [quizTitle]);
}
