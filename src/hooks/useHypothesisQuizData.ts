import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface HypothesisPage {
  id: string;
  quiz_id: string;
  page_number: number;
  title: Record<string, string>;
  description: Record<string, string>;
  questions: HypothesisQuestion[];
}

export interface HypothesisQuestion {
  id: string;
  page_id: string;
  question_order: number;
  hypothesis_text: Record<string, string>;
  interview_question: Record<string, string>;
  truth_explanation: Record<string, string>;
}

export interface UseHypothesisQuizDataReturn {
  pages: HypothesisPage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  savePage: (page: Partial<HypothesisPage> & { id?: string }) => Promise<string>;
  saveQuestion: (question: Partial<HypothesisQuestion> & { id?: string; page_id: string }) => Promise<string>;
  deletePage: (pageId: string) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  reorderQuestions: (pageId: string, questionIds: string[]) => Promise<void>;
}

function jsonToRecord(json: Json | undefined): Record<string, string> {
  if (!json) return {};
  if (typeof json === "string") return { en: json };
  if (typeof json === "object" && !Array.isArray(json)) {
    return json as Record<string, string>;
  }
  return {};
}

export function useHypothesisQuizData(quizId: string | undefined): UseHypothesisQuizDataReturn {
  const [pages, setPages] = useState<HypothesisPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!quizId || quizId === "new") {
      setPages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch pages
      const { data: pagesData, error: pagesError } = await supabase
        .from("hypothesis_pages")
        .select("*")
        .eq("quiz_id", quizId)
        .order("page_number");

      if (pagesError) throw pagesError;

      // Fetch all questions for these pages
      const pageIds = (pagesData || []).map(p => p.id);
      
      let questionsData: any[] = [];
      if (pageIds.length > 0) {
        const { data, error: questionsError } = await supabase
          .from("hypothesis_questions")
          .select("*")
          .in("page_id", pageIds)
          .order("question_order");

        if (questionsError) throw questionsError;
        questionsData = data || [];
      }

      // Map questions to their pages
      const pagesWithQuestions: HypothesisPage[] = (pagesData || []).map(page => ({
        id: page.id,
        quiz_id: page.quiz_id,
        page_number: page.page_number,
        title: jsonToRecord(page.title),
        description: jsonToRecord(page.description),
        questions: questionsData
          .filter(q => q.page_id === page.id)
          .map(q => ({
            id: q.id,
            page_id: q.page_id,
            question_order: q.question_order,
            hypothesis_text: jsonToRecord(q.hypothesis_text),
            interview_question: jsonToRecord(q.interview_question),
            truth_explanation: jsonToRecord(q.truth_explanation),
          })),
      }));

      setPages(pagesWithQuestions);
    } catch (err: any) {
      console.error("Error fetching hypothesis quiz data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const savePage = async (page: Partial<HypothesisPage> & { id?: string }): Promise<string> => {
    if (!quizId) throw new Error("Quiz ID is required");

    const pageData = {
      quiz_id: quizId,
      page_number: page.page_number || 1,
      title: page.title || {},
      description: page.description || {},
    };

    if (page.id && !page.id.startsWith("new-")) {
      // Update existing
      const { error } = await supabase
        .from("hypothesis_pages")
        .update(pageData)
        .eq("id", page.id);
      
      if (error) throw error;
      return page.id;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from("hypothesis_pages")
        .insert(pageData)
        .select()
        .single();
      
      if (error) throw error;
      return data.id;
    }
  };

  const saveQuestion = async (
    question: Partial<HypothesisQuestion> & { id?: string; page_id: string }
  ): Promise<string> => {
    const questionData = {
      page_id: question.page_id,
      question_order: question.question_order || 1,
      hypothesis_text: question.hypothesis_text || {},
      interview_question: question.interview_question || {},
      truth_explanation: question.truth_explanation || {},
    };

    if (question.id && !question.id.startsWith("new-")) {
      // Update existing
      const { error } = await supabase
        .from("hypothesis_questions")
        .update(questionData)
        .eq("id", question.id);
      
      if (error) throw error;
      return question.id;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from("hypothesis_questions")
        .insert(questionData)
        .select()
        .single();
      
      if (error) throw error;
      return data.id;
    }
  };

  const deletePage = async (pageId: string): Promise<void> => {
    if (pageId.startsWith("new-")) {
      setPages(prev => prev.filter(p => p.id !== pageId));
      return;
    }

    const { error } = await supabase
      .from("hypothesis_pages")
      .delete()
      .eq("id", pageId);
    
    if (error) throw error;
  };

  const deleteQuestion = async (questionId: string): Promise<void> => {
    if (questionId.startsWith("new-")) {
      setPages(prev => prev.map(page => ({
        ...page,
        questions: page.questions.filter(q => q.id !== questionId),
      })));
      return;
    }

    const { error } = await supabase
      .from("hypothesis_questions")
      .delete()
      .eq("id", questionId);
    
    if (error) throw error;
  };

  const reorderQuestions = async (pageId: string, questionIds: string[]): Promise<void> => {
    const updates = questionIds.map((id, index) => 
      supabase
        .from("hypothesis_questions")
        .update({ question_order: index + 1 })
        .eq("id", id)
    );

    await Promise.all(updates);
  };

  return {
    pages,
    loading,
    error,
    refetch: fetchData,
    savePage,
    saveQuestion,
    deletePage,
    deleteQuestion,
    reorderQuestions,
  };
}
