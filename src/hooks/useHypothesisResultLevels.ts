import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface HypothesisResultLevel {
  id: string;
  quiz_id: string;
  min_score: number;
  max_score: number;
  title: Record<string, string>;
  description: Record<string, string>;
  emoji: string;
  color_class: string;
}

interface UseHypothesisResultLevelsReturn {
  resultLevels: HypothesisResultLevel[];
  loading: boolean;
  error: string | null;
  getResultLevel: (percentage: number) => HypothesisResultLevel | null;
}

const jsonToRecord = (json: Json | undefined): Record<string, string> => {
  if (!json) return {};
  if (typeof json === "object" && !Array.isArray(json)) {
    return json as Record<string, string>;
  }
  return {};
};

export function useHypothesisResultLevels(quizId: string | undefined): UseHypothesisResultLevelsReturn {
  const [resultLevels, setResultLevels] = useState<HypothesisResultLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLevels = async () => {
      if (!quizId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("hypothesis_result_levels")
          .select("*")
          .eq("quiz_id", quizId)
          .order("min_score", { ascending: false });

        if (fetchError) throw fetchError;

        const levels: HypothesisResultLevel[] = (data || []).map((row) => ({
          id: row.id,
          quiz_id: row.quiz_id,
          min_score: row.min_score,
          max_score: row.max_score,
          title: jsonToRecord(row.title),
          description: jsonToRecord(row.description),
          emoji: row.emoji || "🏆",
          color_class: row.color_class || "text-green-500 bg-green-500/10",
        }));

        setResultLevels(levels);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching hypothesis result levels:", err);
        setError(err.message || "Failed to load result levels");
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, [quizId]);

  const getResultLevel = (percentage: number): HypothesisResultLevel | null => {
    // Find the level where percentage falls within min_score and max_score
    const level = resultLevels.find(
      (l) => percentage >= l.min_score && percentage <= l.max_score
    );
    return level || null;
  };

  return {
    resultLevels,
    loading,
    error,
    getResultLevel,
  };
}
