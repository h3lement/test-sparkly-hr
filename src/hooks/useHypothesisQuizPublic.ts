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
  hypothesis_text_woman: Record<string, string>;
  hypothesis_text_man: Record<string, string>;
  interview_question: Record<string, string>;
  interview_question_woman: Record<string, string>;
  interview_question_man: Record<string, string>;
  truth_explanation: Record<string, string>;
  correct_answer_woman: boolean;
  correct_answer_man: boolean;
}

export interface OpenMindednessAnswer {
  id: string;
  answer_text: Record<string, string>;
  answer_order: number;
  score_value: number;
}

export interface OpenMindednessQuestionData {
  id: string;
  question_text: Record<string, string>;
  answers: OpenMindednessAnswer[];
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
  cta_title: Record<string, string>;
  cta_description: Record<string, string>;
  cta_retry_text: Record<string, string>;
  cta_url: string | null;
  cta_retry_url: string | null;
  quiz_type: string;
  include_open_mindedness: boolean;
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

      // Fetch live CTA template for this quiz
      const { data: ctaTemplate } = await supabase
        .from('cta_templates')
        .select('cta_title, cta_description, cta_text, cta_retry_text, cta_url, cta_retry_url')
        .eq('quiz_id', data.id)
        .eq('is_live', true)
        .maybeSingle();

      // Merge CTA data: quiz table as base, template overrides per-language
      const quizCtaTitle = ((data as any).cta_title || {}) as Record<string, string>;
      const quizCtaDescription = ((data as any).cta_description || {}) as Record<string, string>;
      const quizCtaText = (data.cta_text || {}) as Record<string, string>;
      const quizCtaRetryText = ((data as any).cta_retry_text || {}) as Record<string, string>;

      const templateCtaTitle = (ctaTemplate?.cta_title || {}) as Record<string, string>;
      const templateCtaDescription = (ctaTemplate?.cta_description || {}) as Record<string, string>;
      const templateCtaText = (ctaTemplate?.cta_text || {}) as Record<string, string>;
      const templateCtaRetryText = (ctaTemplate?.cta_retry_text || {}) as Record<string, string>;

      // Merge: template overrides quiz, but only for languages that exist in template
      const ctaTitle = { ...quizCtaTitle, ...templateCtaTitle };
      const ctaDescription = { ...quizCtaDescription, ...templateCtaDescription };
      const ctaText = { ...quizCtaText, ...templateCtaText };
      const ctaRetryText = { ...quizCtaRetryText, ...templateCtaRetryText };
      const ctaUrl = ctaTemplate?.cta_url || data.cta_url;
      const ctaRetryUrl = ctaTemplate?.cta_retry_url || (data as any).cta_retry_url || null;

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
        cta_text: ctaText,
        cta_title: ctaTitle,
        cta_description: ctaDescription,
        cta_retry_text: ctaRetryText,
        cta_url: ctaUrl,
        cta_retry_url: ctaRetryUrl,
        quiz_type: data.quiz_type,
        include_open_mindedness: data.include_open_mindedness ?? false,
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
        hypothesis_text_woman: q.hypothesis_text_woman as Record<string, string>,
        hypothesis_text_man: q.hypothesis_text_man as Record<string, string>,
        interview_question: q.interview_question as Record<string, string>,
        interview_question_woman: q.interview_question_woman as Record<string, string>,
        interview_question_man: q.interview_question_man as Record<string, string>,
        truth_explanation: q.truth_explanation as Record<string, string>,
        correct_answer_woman: q.correct_answer_woman ?? false,
        correct_answer_man: q.correct_answer_man ?? false,
      })) as HypothesisQuestion[];
    },
    enabled: !!pagesQuery.data?.length,
  });

  // Fetch open mindedness question if enabled
  const openMindednessQuery = useQuery({
    queryKey: ['hypothesis-open-mindedness', quizQuery.data?.id],
    queryFn: async () => {
      if (!quizQuery.data?.id || !quizQuery.data.include_open_mindedness) return null;

      // Fetch the open_mindedness question
      const { data: questionData, error: questionError } = await supabase
        .from('quiz_questions')
        .select('id, question_text')
        .eq('quiz_id', quizQuery.data.id)
        .eq('question_type', 'open_mindedness')
        .maybeSingle();

      if (questionError) throw questionError;
      if (!questionData) return null;

      // Fetch answers for this question
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select('id, answer_text, answer_order, score_value')
        .eq('question_id', questionData.id)
        .order('answer_order');

      if (answersError) throw answersError;

      return {
        id: questionData.id,
        question_text: questionData.question_text as Record<string, string>,
        answers: (answersData || []).map(a => ({
          id: a.id,
          answer_text: a.answer_text as Record<string, string>,
          answer_order: a.answer_order,
          score_value: a.score_value,
        })),
      } as OpenMindednessQuestionData;
    },
    enabled: !!quizQuery.data?.id && quizQuery.data.include_open_mindedness,
  });

  return {
    quiz: quizQuery.data,
    pages: pagesQuery.data || [],
    questions: questionsQuery.data || [],
    openMindednessQuestion: openMindednessQuery.data || null,
    loading: quizQuery.isLoading || pagesQuery.isLoading || questionsQuery.isLoading || openMindednessQuery.isLoading,
    error: quizQuery.error || pagesQuery.error || questionsQuery.error || openMindednessQuery.error,
  };
}
