import { useEffect } from 'react';
import { useLanguage } from '@/components/quiz/LanguageContext';

export function useDocumentTitle() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = t('pageTitle');
  }, [t]);
}
