import { useEffect } from 'react';
import { useLanguage } from '@/components/quiz/LanguageContext';

export function useDocumentTitle() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = t('pageTitle');
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('metaDescription'));
    }
    
    // Update Open Graph description
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', t('metaDescription'));
    }
  }, [t]);
}
