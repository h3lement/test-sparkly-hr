import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QuizData {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  badge_text: Record<string, string>;
  headline: Record<string, string>;
  headline_highlight: Record<string, string>;
  discover_items: Array<Record<string, string>>;
  duration_text: Record<string, string>;
  cta_url: string;
  cta_text: Record<string, string>;
  shuffle_questions: boolean;
  enable_scoring: boolean;
  include_open_mindedness: boolean;
}

export interface QuestionData {
  id: string;
  question_order: number;
  question_text: Record<string, string>;
  question_type: string;
  answers: AnswerData[];
}

export interface AnswerData {
  id: string;
  answer_order: number;
  answer_text: Record<string, string>;
  score_value: number;
}

export interface ResultLevelData {
  id: string;
  min_score: number;
  max_score: number;
  title: Record<string, string>;
  description: Record<string, string>;
  insights: Array<Record<string, string>>;
  emoji: string;
  color_class: string;
}

export interface OpenMindednessResultLevelData {
  id: string;
  min_score: number;
  max_score: number;
  title: Record<string, string>;
  description: Record<string, string>;
  emoji: string;
  color_class: string;
}

interface UseQuizDataReturn {
  quiz: QuizData | null;
  questions: QuestionData[];
  resultLevels: ResultLevelData[];
  openMindednessResultLevels: OpenMindednessResultLevelData[];
  loading: boolean;
  error: string | null;
}

export function useQuizData(slug: string): UseQuizDataReturn {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [resultLevels, setResultLevels] = useState<ResultLevelData[]>([]);
  const [openMindednessResultLevels, setOpenMindednessResultLevels] = useState<OpenMindednessResultLevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchQuizData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch quiz
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (quizError) throw quizError;
        if (!quizData) {
          setError('Quiz not found');
          setLoading(false);
          return;
        }

        setQuiz({
          id: quizData.id,
          slug: quizData.slug,
          title: quizData.title as Record<string, string>,
          description: quizData.description as Record<string, string>,
          badge_text: quizData.badge_text as Record<string, string>,
          headline: quizData.headline as Record<string, string>,
          headline_highlight: quizData.headline_highlight as Record<string, string>,
          discover_items: quizData.discover_items as Array<Record<string, string>>,
          duration_text: quizData.duration_text as Record<string, string>,
          cta_url: quizData.cta_url || 'https://sparkly.hr',
          cta_text: quizData.cta_text as Record<string, string>,
          shuffle_questions: quizData.shuffle_questions ?? false,
          enable_scoring: quizData.enable_scoring ?? true,
          include_open_mindedness: quizData.include_open_mindedness ?? false,
        });

        // Fetch questions with answers
        const { data: questionsData, error: questionsError } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', quizData.id)
          .order('question_order', { ascending: true });

        if (questionsError) throw questionsError;

        // Fetch all answers for these questions
        const questionIds = questionsData?.map(q => q.id) || [];
        const { data: answersData, error: answersError } = await supabase
          .from('quiz_answers')
          .select('*')
          .in('question_id', questionIds)
          .order('answer_order', { ascending: true });

        if (answersError) throw answersError;

        // Map answers to questions
        const questionsWithAnswers: QuestionData[] = (questionsData || []).map(q => ({
          id: q.id,
          question_order: q.question_order,
          question_text: q.question_text as Record<string, string>,
          question_type: q.question_type,
          answers: (answersData || [])
            .filter(a => a.question_id === q.id)
            .map(a => ({
              id: a.id,
              answer_order: a.answer_order,
              answer_text: a.answer_text as Record<string, string>,
              score_value: a.score_value,
            })),
        }));

        setQuestions(questionsWithAnswers);

        // Fetch result levels
        const { data: levelsData, error: levelsError } = await supabase
          .from('quiz_result_levels')
          .select('*')
          .eq('quiz_id', quizData.id)
          .order('min_score', { ascending: true });

        if (levelsError) throw levelsError;

        setResultLevels((levelsData || []).map(l => ({
          id: l.id,
          min_score: l.min_score,
          max_score: l.max_score,
          title: l.title as Record<string, string>,
          description: l.description as Record<string, string>,
          insights: l.insights as Array<Record<string, string>>,
          emoji: l.emoji || '🌟',
          color_class: l.color_class || 'from-emerald-500 to-green-600',
        })));

        // Fetch open-mindedness result levels
        const { data: omLevelsData, error: omLevelsError } = await supabase
          .from('open_mindedness_result_levels')
          .select('*')
          .eq('quiz_id', quizData.id)
          .order('min_score', { ascending: true });

        if (omLevelsError) throw omLevelsError;

        setOpenMindednessResultLevels((omLevelsData || []).map(l => ({
          id: l.id,
          min_score: l.min_score,
          max_score: l.max_score,
          title: l.title as Record<string, string>,
          description: l.description as Record<string, string>,
          emoji: l.emoji || '🧠',
          color_class: l.color_class || 'from-blue-500 to-indigo-600',
        })));

      } catch (err: any) {
        console.error('Error fetching quiz data:', err);
        setError(err.message || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [slug]);

  return { quiz, questions, resultLevels, openMindednessResultLevels, loading, error };
}
