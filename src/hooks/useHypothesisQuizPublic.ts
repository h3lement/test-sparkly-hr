import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HypothesisPage {
  id: string;
  quiz_id: string;
  page_number: number;
  title: Record<string, string>;
  description: Record<string, string>;
}

export interface HypothesisQuestion {
  id: string;
  page_id: string;
  question_order: number;
  hypothesis_text: Record<string, string>;
  interview_question: Record<string, string>;
  truth_explanation: Record<string, string>;
}

export interface QuizData {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  headline: Record<string, string>;
  headline_highlight: Record<string, string>;
  badge_text: Record<string, string>;
  duration_text: Record<string, string>;
  discover_items: Record<string, string>[];
  cta_text: Record<string, string>;
  cta_url: string | null;
  quiz_type: string;
}

export function useHypothesisQuizPublic(slug: string) {
  const quizQuery = useQuery({
    queryKey: ['hypothesis-quiz', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .eq('quiz_type', 'hypothesis')
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        slug: data.slug,
        title: data.title as Record<string, string>,
        description: data.description as Record<string, string>,
        headline: data.headline as Record<string, string>,
        headline_highlight: data.headline_highlight as Record<string, string>,
        badge_text: data.badge_text as Record<string, string>,
        duration_text: data.duration_text as Record<string, string>,
        discover_items: (data.discover_items || []) as Record<string, string>[],
        cta_text: data.cta_text as Record<string, string>,
        cta_url: data.cta_url,
        quiz_type: data.quiz_type,
      } as QuizData;
    },
    enabled: !!slug,
  });

  const pagesQuery = useQuery({
    queryKey: ['hypothesis-pages', quizQuery.data?.id],
    queryFn: async () => {
      if (!quizQuery.data?.id) return [];

      const { data, error } = await supabase
        .from('hypothesis_pages')
        .select('*')
        .eq('quiz_id', quizQuery.data.id)
        .order('page_number');

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        quiz_id: p.quiz_id,
        page_number: p.page_number,
        title: p.title as Record<string, string>,
        description: p.description as Record<string, string>,
      })) as HypothesisPage[];
    },
    enabled: !!quizQuery.data?.id,
  });

  const questionsQuery = useQuery({
    queryKey: ['hypothesis-questions', pagesQuery.data?.map(p => p.id)],
    queryFn: async () => {
      if (!pagesQuery.data?.length) return [];

      const pageIds = pagesQuery.data.map(p => p.id);
      const { data, error } = await supabase
        .from('hypothesis_questions')
        .select('*')
        .in('page_id', pageIds)
        .order('question_order');

      if (error) throw error;

      return (data || []).map(q => ({
        id: q.id,
        page_id: q.page_id,
        question_order: q.question_order,
        hypothesis_text: q.hypothesis_text as Record<string, string>,
        interview_question: q.interview_question as Record<string, string>,
        truth_explanation: q.truth_explanation as Record<string, string>,
      })) as HypothesisQuestion[];
    },
    enabled: !!pagesQuery.data?.length,
  });

  return {
    quiz: quizQuery.data,
    pages: pagesQuery.data || [],
    questions: questionsQuery.data || [],
    loading: quizQuery.isLoading || pagesQuery.isLoading || questionsQuery.isLoading,
    error: quizQuery.error || pagesQuery.error || questionsQuery.error,
  };
}
