import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  Users, 
  Target, 
  TrendingUp, 
  BarChart3,
  Brain,
  Calendar,
  Percent,
  Hash
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface Question {
  id: string;
  question_text: Json;
  question_order: number;
  question_type: string;
  answers: { id: string; answer_text: Json; answer_order: number; score_value: number }[];
}

interface QuizStatsProps {
  quizId: string;
  displayLanguage: string;
  questions?: Question[];
  includeOpenMindedness?: boolean;
  quizType?: "standard" | "hypothesis" | "emotional";
}

interface StatsData {
  totalResponses: number;
  averageScore: number;
  medianScore: number;
  averagePercentage: number;
  medianPercentage: number;
  averageOpenness: number | null;
  medianOpenness: number | null;
  maxOpennessScore: number;
  resultDistribution: { name: string; count: number; percentage: number }[];
  dailyTrend: { date: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
  opennessDistribution: { score: number; count: number }[];
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// Helper to calculate median
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function QuizStats({ quizId, displayLanguage, questions, includeOpenMindedness, quizType = "standard" }: QuizStatsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Get max openness score from questions
  const openMindednessQuestion = questions?.find(q => q.question_type === "open_mindedness");
  const maxOpennessScore = openMindednessQuestion?.answers?.length || 4;
  
  const isHypothesis = quizType === "hypothesis";
  
  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch leads from the correct table based on quiz type
      let leads: Array<{
        score: number;
        total_questions: number;
        created_at: string;
        result_category?: string;
        openness_score?: number | null;
      }> = [];

      if (isHypothesis) {
        const { data, error } = await supabase
          .from("hypothesis_leads")
          .select("score, total_questions, created_at")
          .eq("quiz_id", quizId);
        if (error) throw error;
        leads = (data || []).map(l => ({ ...l, result_category: undefined, openness_score: null }));
      } else {
        const { data, error } = await supabase
          .from("quiz_leads")
          .select("score, total_questions, result_category, openness_score, created_at")
          .eq("quiz_id", quizId);
        if (error) throw error;
        leads = data || [];
      }

      if (leads.length === 0) {
        setStats({
          totalResponses: 0,
          averageScore: 0,
          medianScore: 0,
          averagePercentage: 0,
          medianPercentage: 0,
          averageOpenness: null,
          medianOpenness: null,
          maxOpennessScore,
          resultDistribution: [],
          dailyTrend: [],
          scoreDistribution: [],
          opennessDistribution: [],
        });
        setLoading(false);
        return;
      }

      // Calculate averages and medians
      const totalResponses = leads.length;
      const scores = leads.map(l => l.score);
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / totalResponses;
      const medianScore = calculateMedian(scores);
      
      const percentages = leads.map(l => l.total_questions > 0 ? (l.score / l.total_questions) * 100 : 0);
      const avgPercentage = percentages.reduce((sum, p) => sum + p, 0) / totalResponses;
      const medianPercentage = calculateMedian(percentages);

      // Calculate openness stats (only for standard quizzes)
      let avgOpenness: number | null = null;
      let medianOpenness: number | null = null;
      let opennessDistribution: { score: number; count: number }[] = [];
      
      if (!isHypothesis) {
        const opennessLeads = leads.filter(l => l.openness_score !== null && l.openness_score !== undefined);
        const opennessScores = opennessLeads.map(l => l.openness_score || 0);
        avgOpenness = opennessLeads.length > 0
          ? opennessScores.reduce((sum, s) => sum + s, 0) / opennessLeads.length
          : null;
        medianOpenness = opennessLeads.length > 0
          ? calculateMedian(opennessScores)
          : null;

        // Openness distribution
        const opennessDistMap: Record<number, number> = {};
        opennessScores.forEach(score => {
          opennessDistMap[score] = (opennessDistMap[score] || 0) + 1;
        });
        opennessDistribution = Object.entries(opennessDistMap)
          .map(([score, count]) => ({ score: parseInt(score), count }))
          .sort((a, b) => a.score - b.score);
      }

      // Result distribution (only for standard quizzes with result_category)
      let resultDistribution: { name: string; count: number; percentage: number }[] = [];
      
      if (!isHypothesis) {
        const resultCounts: Record<string, number> = {};
        leads.forEach(l => {
          if (l.result_category) {
            resultCounts[l.result_category] = (resultCounts[l.result_category] || 0) + 1;
          }
        });
        resultDistribution = Object.entries(resultCounts)
          .map(([name, count]) => ({
            name,
            count,
            percentage: (count / totalResponses) * 100,
          }))
          .sort((a, b) => b.count - a.count);
      }

      // Daily trend (last 14 days)
      const last14Days = Array.from({ length: 14 }, (_, i) => {
        const date = startOfDay(subDays(new Date(), 13 - i));
        return { date, count: 0 };
      });

      leads.forEach((lead) => {
        const leadDate = startOfDay(new Date(lead.created_at));
        const dayEntry = last14Days.find(
          (d) => d.date.getTime() === leadDate.getTime()
        );
        if (dayEntry) dayEntry.count++;
      });

      const dailyTrend = last14Days.map((d) => ({
        date: format(d.date, "MMM d"),
        count: d.count,
      }));

      // Score distribution
      const ranges = [
        { range: "0-25%", min: 0, max: 0.25 },
        { range: "26-50%", min: 0.25, max: 0.5 },
        { range: "51-75%", min: 0.5, max: 0.75 },
        { range: "76-100%", min: 0.75, max: 1.01 },
      ];

      const scoreDistribution = ranges.map((r) => ({
        range: r.range,
        count: leads.filter((l) => {
          const pct = l.total_questions > 0 ? l.score / l.total_questions : 0;
          return pct >= r.min && pct < r.max;
        }).length,
      }));

      setStats({
        totalResponses,
        averageScore: avgScore,
        medianScore,
        averagePercentage: avgPercentage,
        medianPercentage,
        averageOpenness: avgOpenness,
        medianOpenness,
        maxOpennessScore,
        resultDistribution,
        dailyTrend,
        scoreDistribution,
        opennessDistribution,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [quizId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed">
        <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Failed to load statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Quiz Statistics</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.totalResponses}</p>
            <p className="text-xs text-muted-foreground">Responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <Percent className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{stats.averagePercentage.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Avg | Med: {stats.medianPercentage.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <Hash className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{stats.averageScore.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Avg | Med: {stats.medianScore.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Brain className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold">
              {stats.averageOpenness !== null ? stats.averageOpenness.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.medianOpenness !== null ? `Avg OM | Med: ${stats.medianOpenness.toFixed(1)}` : "Avg Openness"}
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.totalResponses === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No data yet. Share your quiz to get responses!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Daily Trend */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Last 14 Days</span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={stats.dailyTrend}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    width={20}
                  />
                  <Tooltip 
                    contentStyle={{ fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Result Distribution */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Result Distribution</span>
              </div>
              {stats.resultDistribution.length > 0 ? (
                <div className="space-y-2">
                  {stats.resultDistribution.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[150px]">{item.name}</span>
                        <span className="text-muted-foreground">{item.count} ({item.percentage.toFixed(0)}%)</span>
                      </div>
                      <Progress 
                        value={item.percentage} 
                        className="h-1.5"
                        style={{ 
                          ["--progress-color" as any]: COLORS[i % COLORS.length] 
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No results yet</p>
              )}
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Score Distribution</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {stats.scoreDistribution.map((item, i) => (
                  <div key={item.range} className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-lg font-bold" style={{ color: COLORS[i] }}>
                      {item.count}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.range}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Open-Mindedness Distribution */}
          {includeOpenMindedness && stats.opennessDistribution.length > 0 && (
            <Card className="col-span-2">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-medium">Open-Mindedness Distribution</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Max: {stats.maxOpennessScore} pts
                  </span>
                </div>
                <div className="space-y-1.5">
                  {stats.opennessDistribution.map(({ score, count }) => {
                    const percentage = stats.totalResponses > 0 
                      ? (count / stats.totalResponses) * 100 
                      : 0;
                    return (
                      <div key={score} className="flex items-center gap-2">
                        <span className="text-xs w-6 text-right font-medium">{score}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs w-16 text-muted-foreground">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
