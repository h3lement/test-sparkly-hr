import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export interface GlobalOMAnswer {
  id: string;
  answer_text: Record<string, string>;
  answer_order: number;
  score_value: number;
}

export interface GlobalOMModule {
  id: string;
  question_text: Record<string, string>;
  updated_at: string;
  answers: GlobalOMAnswer[];
}

interface UseGlobalOpenMindednessReturn {
  module: GlobalOMModule | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateQuestionText: (questionText: Record<string, string>) => Promise<void>;
  updateAnswer: (answerId: string, updates: Partial<GlobalOMAnswer>) => Promise<void>;
  addAnswer: (answerText: Record<string, string>, scoreValue?: number) => Promise<void>;
  deleteAnswer: (answerId: string) => Promise<void>;
  reorderAnswers: (answers: GlobalOMAnswer[]) => Promise<void>;
  saving: boolean;
}

function jsonToRecord(json: Json | undefined): Record<string, string> {
  if (!json) return {};
  if (typeof json === 'string') return { en: json };
  if (typeof json === 'object' && !Array.isArray(json)) {
    return json as Record<string, string>;
  }
  return {};
}

export function useGlobalOpenMindedness(): UseGlobalOpenMindednessReturn {
  const [module, setModule] = useState<GlobalOMModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the global module (should be exactly 1 row)
      const { data: moduleData, error: moduleError } = await supabase
        .from('global_open_mindedness_module')
        .select('*')
        .limit(1)
        .single();

      if (moduleError) {
        // If no row exists, create it
        if (moduleError.code === 'PGRST116') {
          const { data: newModule, error: createError } = await supabase
            .from('global_open_mindedness_module')
            .insert({
              question_text: {
                en: 'Which assessment methods, when used together, do you believe can provide valuable insights?',
                et: 'Millised hindamismeetodid annavad Sinu arvates koostoimes väärtuslikku teavet?'
              }
            })
            .select()
            .single();

          if (createError) throw createError;
          
          // Create default answers
          const defaultAnswers = [
            { answer_text: { en: '1:1 Coaching', et: '1:1 Coaching' }, answer_order: 1, score_value: 1 },
            { answer_text: { en: 'Group workshops', et: 'Rühmatöötoad' }, answer_order: 2, score_value: 1 },
            { answer_text: { en: 'Online courses', et: 'Veebikursused' }, answer_order: 3, score_value: 1 },
            { answer_text: { en: 'Mentoring programs', et: 'Mentorlusprogrammid' }, answer_order: 4, score_value: 1 },
          ];

          await supabase.from('global_open_mindedness_answers').insert(defaultAnswers);

          setModule({
            id: newModule.id,
            question_text: jsonToRecord(newModule.question_text),
            updated_at: newModule.updated_at,
            answers: defaultAnswers.map((a, i) => ({ ...a, id: `temp-${i}` })),
          });
          return;
        }
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
        updated_at: moduleData.updated_at,
        answers: (answersData || []).map(a => ({
          id: a.id,
          answer_text: jsonToRecord(a.answer_text),
          answer_order: a.answer_order,
          score_value: a.score_value,
        })),
      });
    } catch (err) {
      console.error('Error fetching global OM module:', err);
      setError(err instanceof Error ? err.message : 'Failed to load global open-mindedness module');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  const updateQuestionText = useCallback(async (questionText: Record<string, string>) => {
    if (!module) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('global_open_mindedness_module')
        .update({ question_text: questionText })
        .eq('id', module.id);

      if (error) throw error;

      setModule(prev => prev ? { ...prev, question_text: questionText } : null);
      toast.success('Question text updated');
    } catch (err) {
      console.error('Error updating question text:', err);
      toast.error('Failed to update question text');
    } finally {
      setSaving(false);
    }
  }, [module]);

  const updateAnswer = useCallback(async (answerId: string, updates: Partial<GlobalOMAnswer>) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('global_open_mindedness_answers')
        .update({
          ...(updates.answer_text && { answer_text: updates.answer_text }),
          ...(updates.score_value !== undefined && { score_value: updates.score_value }),
          ...(updates.answer_order !== undefined && { answer_order: updates.answer_order }),
        })
        .eq('id', answerId);

      if (error) throw error;

      setModule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          answers: prev.answers.map(a => 
            a.id === answerId ? { ...a, ...updates } : a
          ),
        };
      });
    } catch (err) {
      console.error('Error updating answer:', err);
      toast.error('Failed to update answer');
    } finally {
      setSaving(false);
    }
  }, []);

  const addAnswer = useCallback(async (answerText: Record<string, string>, scoreValue = 1) => {
    if (!module) return;
    try {
      setSaving(true);
      const maxOrder = module.answers.length > 0 
        ? Math.max(...module.answers.map(a => a.answer_order)) + 1 
        : 1;

      const { data, error } = await supabase
        .from('global_open_mindedness_answers')
        .insert({
          answer_text: answerText,
          answer_order: maxOrder,
          score_value: scoreValue,
        })
        .select()
        .single();

      if (error) throw error;

      setModule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          answers: [...prev.answers, {
            id: data.id,
            answer_text: jsonToRecord(data.answer_text),
            answer_order: data.answer_order,
            score_value: data.score_value,
          }],
        };
      });
      toast.success('Answer added');
    } catch (err) {
      console.error('Error adding answer:', err);
      toast.error('Failed to add answer');
    } finally {
      setSaving(false);
    }
  }, [module]);

  const deleteAnswer = useCallback(async (answerId: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('global_open_mindedness_answers')
        .delete()
        .eq('id', answerId);

      if (error) throw error;

      setModule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          answers: prev.answers.filter(a => a.id !== answerId),
        };
      });
      toast.success('Answer removed');
    } catch (err) {
      console.error('Error deleting answer:', err);
      toast.error('Failed to remove answer');
    } finally {
      setSaving(false);
    }
  }, []);

  const reorderAnswers = useCallback(async (answers: GlobalOMAnswer[]) => {
    try {
      setSaving(true);
      // Update all answers with new order
      const updates = answers.map((a, index) => 
        supabase
          .from('global_open_mindedness_answers')
          .update({ answer_order: index + 1 })
          .eq('id', a.id)
      );

      await Promise.all(updates);

      setModule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          answers: answers.map((a, index) => ({ ...a, answer_order: index + 1 })),
        };
      });
    } catch (err) {
      console.error('Error reordering answers:', err);
      toast.error('Failed to reorder answers');
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    module,
    loading,
    error,
    refetch: fetchModule,
    updateQuestionText,
    updateAnswer,
    addAnswer,
    deleteAnswer,
    reorderAnswers,
    saving,
  };
}
