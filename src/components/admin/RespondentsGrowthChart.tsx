import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, User, Users } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Quiz {
  id: string;
  title: Json;
  slug: string;
}

interface QuizLead {
  id: string;
  email: string;
  quiz_id: string | null;
  created_at: string;
}

interface ChartDataPoint {
  month: string;
  [key: string]: number | string;
}

interface RespondentsGrowthChartProps {
  quizzes: Quiz[];
  leads: QuizLead[];
  loading: boolean;
}

// Color palette for quiz lines
const QUIZ_COLORS = [
  "#8B5CF6", // violet
  "#F97316", // orange
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#EC4899", // pink
  "#F59E0B", // amber
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#EF4444", // red
  "#84CC16", // lime
];

const getLocalizedText = (json: Json, lang: string = "en"): string => {
  if (typeof json === "string") return json;
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return (json as Record<string, string>)[lang] || (json as Record<string, string>)["en"] || "";
  }
  return "";
};

const get13MonthsAgo = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

export function RespondentsGrowthChart({ quizzes, leads, loading }: RespondentsGrowthChartProps) {
  // Filter leads to last 13 months
  const recentLeads = useMemo(() => {
    const cutoff = get13MonthsAgo();
    return leads.filter((lead) => new Date(lead.created_at) >= cutoff);
  }, [leads]);

  // Generate 13-month chart data with a line per quiz + unique respondents
  const chartData = useMemo(() => {
    const months: ChartDataPoint[] = [];
    const now = new Date();
    
    // Track unique emails seen up to each month for cumulative unique count
    const cumulativeEmails = new Set<string>();
    
    // Generate last 13 months
    for (let i = 12; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      
      const dataPoint: ChartDataPoint = { month: monthLabel };
      
      // Initialize counts for each quiz
      quizzes.forEach((quiz) => {
        dataPoint[quiz.slug] = 0;
      });
      dataPoint["total"] = 0;
      
      // Track new unique emails this month
      const monthUniqueEmails = new Set<string>();
      
      // Count leads for this month
      recentLeads.forEach((lead) => {
        const leadMonth = lead.created_at.slice(0, 7);
        if (leadMonth === monthKey) {
          const quiz = quizzes.find((q) => q.id === lead.quiz_id);
          if (quiz) {
            dataPoint[quiz.slug] = (dataPoint[quiz.slug] as number) + 1;
          }
          dataPoint["total"] = (dataPoint["total"] as number) + 1;
          
          // Track new unique respondents
          if (!cumulativeEmails.has(lead.email)) {
            monthUniqueEmails.add(lead.email);
            cumulativeEmails.add(lead.email);
          }
        }
      });
      
      dataPoint["uniqueNew"] = monthUniqueEmails.size;
      
      months.push(dataPoint);
    }
    
    return months;
  }, [recentLeads, quizzes]);

  // Calculate totals for stats
  const totalResponses = recentLeads.length;
  const uniqueRespondents = new Set(recentLeads.map((l) => l.email)).size;
  const thisMonthLeads = recentLeads.filter((l) => {
    const leadDate = new Date(l.created_at);
    const now = new Date();
    return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;
  const thisMonthUniqueEmails = new Set(
    recentLeads
      .filter((l) => {
        const leadDate = new Date(l.created_at);
        const now = new Date();
        return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
      })
      .map((l) => l.email)
  ).size;

  return (
    <div className="space-y-6 mb-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalResponses}</p>
                <p className="text-sm text-muted-foreground">Responses (13mo)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueRespondents}</p>
                <p className="text-sm text-muted-foreground">Unique (13mo)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thisMonthLeads}</p>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thisMonthUniqueEmails}</p>
                <p className="text-sm text-muted-foreground">New Unique</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 13-Month Responses Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Responses Growth (13 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                {quizzes.map((quiz, index) => (
                  <Line
                    key={quiz.id}
                    type="monotone"
                    dataKey={quiz.slug}
                    name={getLocalizedText(quiz.title)}
                    stroke={QUIZ_COLORS[index % QUIZ_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
                <Line
                  key="total"
                  type="monotone"
                  dataKey="total"
                  name="Total Responses"
                  stroke="#374151"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  key="uniqueNew"
                  type="monotone"
                  dataKey="uniqueNew"
                  name="New Unique Respondents"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#0EA5E9" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
