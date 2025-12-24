import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface GlobalOMAnswerPublic {
  id: string;
  answer_text: Record<string, string>;
  answer_order: number;
  score_value: number;
}

export interface GlobalOMModulePublic {
  id: string;
  question_text: Record<string, string>;
  answers: GlobalOMAnswerPublic[];
}

interface UseGlobalOMPublicReturn {
  module: GlobalOMModulePublic | null;
  loading: boolean;
  error: string | null;
}

function jsonToRecord(json: Json | undefined): Record<string, string> {
  if (!json) return {};
  if (typeof json === 'string') return { en: json };
  if (typeof json === 'object' && !Array.isArray(json)) {
    return json as Record<string, string>;
  }
  return {};
}

/**
 * Public hook for quiz-takers to fetch the global Open-Mindedness module
 * Read-only, no authentication required
 */
export function useGlobalOMPublic(): UseGlobalOMPublicReturn {
  const [module, setModule] = useState<GlobalOMModulePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the global module
      const { data: moduleData, error: moduleError } = await supabase
        .from('global_open_mindedness_module')
        .select('*')
        .limit(1)
        .single();

      if (moduleError) {
        throw moduleError;
      }

      // Fetch answers
      const { data: answersData, error: answersError } = await supabase
        .from('global_open_mindedness_answers')
        .select('*')
        .order('answer_order');

      if (answersError) throw answersError;

      setModule({
        id: moduleData.id,
        question_text: jsonToRecord(moduleData.question_text),
        answers: (answersData || []).map(a => ({
          id: a.id,
          answer_text: jsonToRecord(a.answer_text),
          answer_order: a.answer_order,
          score_value: a.score_value,
        })),
      });
    } catch (err) {
      console.error('Error fetching global OM module:', err);
      setError(err instanceof Error ? err.message : 'Failed to load open-mindedness module');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  return {
    module,
    loading,
    error,
  };
}
