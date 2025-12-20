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
  Calendar
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface QuizStatsProps {
  quizId: string;
  displayLanguage: string;
}

interface StatsData {
  totalResponses: number;
  averageScore: number;
  averagePercentage: number;
  averageOpenness: number | null;
  resultDistribution: { name: string; count: number; percentage: number }[];
  dailyTrend: { date: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function QuizStats({ quizId, displayLanguage }: QuizStatsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from("quiz_leads")
        .select("score, total_questions, result_category, openness_score, created_at")
        .eq("quiz_id", quizId);

      if (error) throw error;

      if (!leads || leads.length === 0) {
        setStats({
          totalResponses: 0,
          averageScore: 0,
          averagePercentage: 0,
          averageOpenness: null,
          resultDistribution: [],
          dailyTrend: [],
          scoreDistribution: [],
        });
        setLoading(false);
        return;
      }

      // Calculate averages
      const totalResponses = leads.length;
      const avgScore = leads.reduce((sum, l) => sum + l.score, 0) / totalResponses;
      const avgTotal = leads.reduce((sum, l) => sum + l.total_questions, 0) / totalResponses;
      const avgPercentage = avgTotal > 0 ? (avgScore / avgTotal) * 100 : 0;

      // Calculate openness average (only for leads that have it)
      const opennessLeads = leads.filter((l) => l.openness_score !== null);
      const avgOpenness = opennessLeads.length > 0
        ? opennessLeads.reduce((sum, l) => sum + (l.openness_score || 0), 0) / opennessLeads.length
        : null;

      // Result distribution
      const resultCounts: Record<string, number> = {};
      leads.forEach((l) => {
        resultCounts[l.result_category] = (resultCounts[l.result_category] || 0) + 1;
      });
      const resultDistribution = Object.entries(resultCounts)
        .map(([name, count]) => ({
          name,
          count,
          percentage: (count / totalResponses) * 100,
        }))
        .sort((a, b) => b.count - a.count);

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
      const maxScore = Math.max(...leads.map((l) => l.total_questions));
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
        averagePercentage: avgPercentage,
        averageOpenness: avgOpenness,
        resultDistribution,
        dailyTrend,
        scoreDistribution,
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
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.totalResponses}</p>
            <p className="text-xs text-muted-foreground">Responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Target className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.averagePercentage.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.averageScore.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Points</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Brain className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold">
              {stats.averageOpenness !== null ? stats.averageOpenness.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Avg Openness</p>
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
        </div>
      )}
    </div>
  );
}
