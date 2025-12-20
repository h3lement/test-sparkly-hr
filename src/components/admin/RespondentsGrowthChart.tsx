import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TrendingUp, User, Users, Wifi, WifiOff, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
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
  onLeadInserted?: () => void;
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

type DateRangeOption = "30" | "90" | "365" | "all";

const getLocalizedText = (json: Json, lang: string = "en"): string => {
  if (typeof json === "string") return json;
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return (json as Record<string, string>)[lang] || (json as Record<string, string>)["en"] || "";
  }
  return "";
};

const getCutoffDate = (range: DateRangeOption) => {
  if (range === "all") return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  date.setHours(0, 0, 0, 0);
  return date;
};

export function RespondentsGrowthChart({ quizzes, leads, loading, onLeadInserted }: RespondentsGrowthChartProps) {
  const [dateRange, setDateRange] = useState<DateRangeOption>("365");
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Realtime subscription
  useEffect(() => {
    if (!realtimeEnabled) return;

    const channel = supabase
      .channel("respondents-chart-leads")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quiz_leads" },
        () => {
          onLeadInserted?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeEnabled, onLeadInserted]);

  // Filter leads based on date range
  const filteredLeads = useMemo(() => {
    const cutoff = getCutoffDate(dateRange);
    if (!cutoff) return leads;
    return leads.filter((lead) => new Date(lead.created_at) >= cutoff);
  }, [leads, dateRange]);

  // Calculate how many months to display
  const monthsToDisplay = useMemo(() => {
    if (dateRange === "30") return 2;
    if (dateRange === "90") return 4;
    if (dateRange === "365") return 13;
    return 24; // "all"
  }, [dateRange]);

  // Generate chart data
  const chartData = useMemo(() => {
    const months: ChartDataPoint[] = [];
    const now = new Date();

    // First pass: collect all emails before the chart window for accurate cumulative count
    const chartWindowStart = new Date(now.getFullYear(), now.getMonth() - monthsToDisplay + 1, 1);
    const emailsBeforeWindow = new Set<string>();
    leads.forEach((lead) => {
      if (new Date(lead.created_at) < chartWindowStart) {
        emailsBeforeWindow.add(lead.email);
      }
    });

    const cumulativeEmails = new Set<string>(emailsBeforeWindow);

    for (let i = monthsToDisplay - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const dataPoint: ChartDataPoint = { month: monthLabel };
      quizzes.forEach((quiz) => {
        dataPoint[quiz.slug] = 0;
      });
      dataPoint["total"] = 0;

      leads.forEach((lead) => {
        const leadDate = new Date(lead.created_at);
        const leadMonthKey = `${leadDate.getFullYear()}-${String(leadDate.getMonth() + 1).padStart(2, "0")}`;
        if (leadMonthKey === monthKey) {
          const quiz = quizzes.find((q) => q.id === lead.quiz_id);
          if (quiz) {
            dataPoint[quiz.slug] = (dataPoint[quiz.slug] as number) + 1;
          }
          dataPoint["total"] = (dataPoint["total"] as number) + 1;
          cumulativeEmails.add(lead.email);
        }
      });

      dataPoint["cumulativeUnique"] = cumulativeEmails.size;
      months.push(dataPoint);
    }

    return months;
  }, [leads, quizzes, monthsToDisplay]);

  // Calculate stats based on filtered leads
  const totalResponses = filteredLeads.length;
  const uniqueRespondents = new Set(filteredLeads.map((l) => l.email)).size;
  const now = new Date();
  const thisMonthLeads = filteredLeads.filter((l) => {
    const leadDate = new Date(l.created_at);
    return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;
  const thisMonthUniqueEmails = new Set(
    filteredLeads
      .filter((l) => {
        const leadDate = new Date(l.created_at);
        return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
      })
      .map((l) => l.email)
  ).size;

  const rangeLabel = dateRange === "all" ? "All Time" : `Last ${dateRange} days`;

  return (
    <div className="space-y-6 mb-8">
      {/* Controls: Date Range + Realtime Toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="realtime-respondents"
            checked={realtimeEnabled}
            onCheckedChange={setRealtimeEnabled}
          />
          <Label htmlFor="realtime-respondents" className="flex items-center gap-1.5 text-sm cursor-pointer">
            {realtimeEnabled ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            Realtime
          </Label>
        </div>
      </div>

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
                <p className="text-sm text-muted-foreground">Responses ({rangeLabel})</p>
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
                <p className="text-sm text-muted-foreground">Unique ({rangeLabel})</p>
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

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Responses Growth
          </CardTitle>
          <CardDescription>
            Based on {filteredLeads.length} submissions ({rangeLabel}).
          </CardDescription>
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
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
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
                  key="cumulativeUnique"
                  type="monotone"
                  dataKey="cumulativeUnique"
                  name="Cumulative Unique Respondents"
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
