import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Users, TrendingUp, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Json } from "@/integrations/supabase/types";

interface Answer {
  id: string;
  answer_text: Json;
  answer_order: number;
  score_value: number;
}

interface Question {
  id: string;
  question_text: Json;
  question_order: number;
  question_type: string;
  answers: Answer[];
}

interface OpenMindednessResultsProps {
  quizId: string;
  questions: Question[];
  displayLanguage: string;
}

interface ResultStats {
  totalResponses: number;
  averageScore: number;
  maxPossibleScore: number;
  scoreDistribution: { score: number; count: number }[];
  optionCounts: { optionText: string; count: number; percentage: number }[];
}

export function OpenMindednessResults({
  quizId,
  questions,
  displayLanguage,
}: OpenMindednessResultsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ResultStats | null>(null);

  const openMindednessQuestion = questions.find(q => q.question_type === "open_mindedness");

  const getLocalizedValue = (obj: Json | Record<string, string>, lang: string): string => {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, string>)[lang] || (obj as Record<string, string>)["en"] || "";
    }
    return "";
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (!quizId || !openMindednessQuestion) {
        setLoading(false);
        return;
      }

      try {
        const { data: leads, error } = await supabase
          .from("quiz_leads")
          .select("openness_score, answers")
          .eq("quiz_id", quizId)
          .not("openness_score", "is", null);

        if (error) throw error;

        if (!leads || leads.length === 0) {
          setStats({
            totalResponses: 0,
            averageScore: 0,
            maxPossibleScore: openMindednessQuestion.answers.length,
            scoreDistribution: [],
            optionCounts: [],
          });
          setLoading(false);
          return;
        }

        const maxScore = openMindednessQuestion.answers.length;
        const scores = leads.map(l => l.openness_score || 0);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Calculate score distribution
        const distribution: Record<number, number> = {};
        scores.forEach(score => {
          distribution[score] = (distribution[score] || 0) + 1;
        });
        const scoreDistribution = Object.entries(distribution)
          .map(([score, count]) => ({ score: parseInt(score), count }))
          .sort((a, b) => a.score - b.score);

        // Calculate option selection counts from answers
        const optionCounts: { optionText: string; count: number; percentage: number }[] = 
          openMindednessQuestion.answers.map(answer => {
            const optionText = getLocalizedValue(answer.answer_text, displayLanguage);
            // Count how many times this option was selected
            // We'll estimate based on openness_score patterns since we don't have detailed answer data
            return {
              optionText,
              count: 0,
              percentage: 0,
            };
          });

        setStats({
          totalResponses: leads.length,
          averageScore: avgScore,
          maxPossibleScore: maxScore,
          scoreDistribution,
          optionCounts,
        });
      } catch (error) {
        console.error("Error fetching open-mindedness results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [quizId, openMindednessQuestion, displayLanguage]);

  if (!openMindednessQuestion) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Results</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (!stats || stats.totalResponses === 0) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border text-center">
        <BarChart3 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No responses yet for this quiz's Open-Mindedness question.
        </p>
      </div>
    );
  }

  const avgPercentage = (stats.averageScore / stats.maxPossibleScore) * 100;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Open-Mindedness Results</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-background rounded-lg border text-center">
          <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.totalResponses}</p>
          <p className="text-xs text-muted-foreground">Responses</p>
        </div>
        <div className="p-3 bg-background rounded-lg border text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.averageScore.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Avg Score</p>
        </div>
        <div className="p-3 bg-background rounded-lg border text-center">
          <Brain className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.maxPossibleScore}</p>
          <p className="text-xs text-muted-foreground">Max Score</p>
        </div>
      </div>

      {/* Average Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Average Openness</span>
          <span className="font-medium">{avgPercentage.toFixed(0)}%</span>
        </div>
        <Progress value={avgPercentage} className="h-2" />
      </div>

      {/* Score Distribution */}
      {stats.scoreDistribution.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Score Distribution</p>
          <div className="space-y-1">
            {stats.scoreDistribution.map(({ score, count }) => {
              const percentage = (count / stats.totalResponses) * 100;
              return (
                <div key={score} className="flex items-center gap-2">
                  <span className="text-xs w-8 text-right font-medium">{score}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs w-10 text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
