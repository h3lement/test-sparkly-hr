import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { 
  RefreshCw, 
  Clock, 
  User, 
  FileEdit, 
  Plus, 
  Trash2, 
  ToggleLeft,
  TrendingUp
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action_type: string;
  table_name: string;
  record_id: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface Quiz {
  id: string;
  title: Json;
  slug: string;
}

interface QuizLead {
  id: string;
  quiz_id: string | null;
  created_at: string;
}

interface ChartDataPoint {
  month: string;
  [quizSlug: string]: number | string;
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

export function ActivityDashboard() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [activitiesRes, quizzesRes, leadsRes] = await Promise.all([
        supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("quizzes").select("id, title, slug"),
        supabase
          .from("quiz_leads")
          .select("id, quiz_id, created_at")
          .gte("created_at", get13MonthsAgo().toISOString()),
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (quizzesRes.error) throw quizzesRes.error;
      if (leadsRes.error) throw leadsRes.error;

      setActivities(activitiesRes.data || []);
      setQuizzes(quizzesRes.data || []);
      setLeads(leadsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const get13MonthsAgo = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 12);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getLocalizedText = (json: Json, lang: string = "en"): string => {
    if (typeof json === "string") return json;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return (json as Record<string, string>)[lang] || (json as Record<string, string>)["en"] || "";
    }
    return "";
  };

  // Generate 13-month chart data with a line per quiz
  const chartData = useMemo(() => {
    const months: ChartDataPoint[] = [];
    const now = new Date();
    
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
      
      // Count leads for this month
      leads.forEach((lead) => {
        const leadMonth = lead.created_at.slice(0, 7);
        if (leadMonth === monthKey) {
          const quiz = quizzes.find((q) => q.id === lead.quiz_id);
          if (quiz) {
            dataPoint[quiz.slug] = (dataPoint[quiz.slug] as number) + 1;
          }
          dataPoint["total"] = (dataPoint["total"] as number) + 1;
        }
      });
      
      months.push(dataPoint);
    }
    
    return months;
  }, [leads, quizzes]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === "all") return activities;
    return activities.filter((a) => a.table_name === activityFilter);
  }, [activities, activityFilter]);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "CREATE":
        return <Plus className="h-4 w-4" />;
      case "UPDATE":
        return <FileEdit className="h-4 w-4" />;
      case "DELETE":
        return <Trash2 className="h-4 w-4" />;
      case "STATUS_CHANGE":
        return <ToggleLeft className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "CREATE":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "DELETE":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "STATUS_CHANGE":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getTableLabel = (table: string) => {
    switch (table) {
      case "quizzes":
        return "Quiz";
      case "quiz_leads":
        return "Respondent";
      case "email_logs":
        return "Email";
      default:
        return table;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Calculate totals for stats
  const totalRespondents = leads.length;
  const thisMonthLeads = leads.filter((l) => {
    const leadDate = new Date(l.created_at);
    const now = new Date();
    return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activity Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of responses growth and recent activities</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
                <p className="text-2xl font-bold">{totalRespondents}</p>
                <p className="text-sm text-muted-foreground">Total (13 months)</p>
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
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activities.length}</p>
                <p className="text-sm text-muted-foreground">Recent Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <FileEdit className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{quizzes.length}</p>
                <p className="text-sm text-muted-foreground">Active Quizzes</p>
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
                  name="Total"
                  stroke="#374151"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Global Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="quizzes">Quizzes</SelectItem>
                <SelectItem value="quiz_leads">Responses</SelectItem>
                <SelectItem value="email_logs">Emails</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activities recorded yet.</p>
              <p className="text-sm mt-1">Activities will appear here as changes happen.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 bg-secondary/30 rounded-lg border border-border"
                  >
                    <Badge
                      variant="outline"
                      className={`${getActionColor(activity.action_type)} gap-1 shrink-0`}
                    >
                      {getActionIcon(activity.action_type)}
                      {activity.action_type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {getTableLabel(activity.table_name)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {activity.record_id.slice(0, 8)}...
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-foreground">{activity.description}</p>
                      )}
                      {activity.field_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">{activity.field_name}:</span>
                          {activity.old_value && (
                            <span className="line-through text-red-500/70 mx-1">
                              {activity.old_value.slice(0, 30)}
                              {activity.old_value.length > 30 && "..."}
                            </span>
                          )}
                          {activity.old_value && activity.new_value && "→"}
                          {activity.new_value && (
                            <span className="text-green-600 mx-1">
                              {activity.new_value.slice(0, 30)}
                              {activity.new_value.length > 30 && "..."}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground" title={formatFullDate(activity.created_at)}>
                        {formatDate(activity.created_at)}
                      </p>
                      {activity.user_email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 justify-end">
                          <User className="h-3 w-3" />
                          <span>{activity.user_email.split("@")[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
