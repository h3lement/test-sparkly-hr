import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UiTranslation {
  translation_key: string;
  translations: Record<string, string>;
}

interface UseUiTranslationsOptions {
  quizId?: string | null;
  language: string;
}

interface UseUiTranslationsResult {
  translations: Record<string, string>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getTranslation: (key: string, fallback?: string) => string;
}

/**
 * Hook to fetch UI translations from the database for a specific quiz.
 * Falls back to the provided language's default if no DB translation exists.
 */
export function useUiTranslations({ 
  quizId, 
  language 
}: UseUiTranslationsOptions): UseUiTranslationsResult {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTranslations = useCallback(async () => {
    if (!quizId) {
      setTranslations({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('ui_translations')
        .select('translation_key, translations')
        .eq('quiz_id', quizId);

      if (fetchError) throw fetchError;

      // Build a flat map of key -> translated value for current language
      const translationMap: Record<string, string> = {};
      
      (data as UiTranslation[] || []).forEach((item) => {
        const translatedValue = item.translations?.[language] || item.translations?.['en'];
        if (translatedValue) {
          translationMap[item.translation_key] = translatedValue;
        }
      });

      setTranslations(translationMap);
    } catch (err) {
      console.error('Error fetching UI translations:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch translations'));
    } finally {
      setLoading(false);
    }
  }, [quizId, language]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const getTranslation = useCallback((key: string, fallback?: string): string => {
    return translations[key] || fallback || key;
  }, [translations]);

  return {
    translations,
    loading,
    error,
    refetch: fetchTranslations,
    getTranslation,
  };
}
