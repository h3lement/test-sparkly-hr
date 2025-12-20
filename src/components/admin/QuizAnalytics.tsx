import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, Users, Target, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns';

interface Quiz {
  id: string;
  slug: string;
  title: Record<string, string> | null;
}

interface QuizLead {
  id: string;
  score: number;
  total_questions: number;
  answers: Record<string, number> | null;
  result_category: string;
  quiz_id: string;
  created_at: string;
}

interface TrendData {
  date: string;
  submissions: number;
  avgScore: number;
}

interface AnalyticsData {
  totalSubmissions: number;
  averageScore: number;
  averagePercentage: number;
  resultDistribution: { name: string; count: number }[];
  answerDistribution: { question: string; answers: { label: string; count: number }[] }[];
  dailyTrend: TrendData[];
  weeklyTrend: TrendData[];
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function QuizAnalytics() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionsMap, setQuestionsMap] = useState<Record<string, { text: string; answers: { id: string; text: string }[] }>>({});
  const [trendView, setTrendView] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (selectedQuizId) {
      fetchAnalytics(selectedQuizId);
    }
  }, [selectedQuizId]);

  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from('quizzes')
      .select('id, slug, title')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const typedQuizzes: Quiz[] = data.map(q => ({
        id: q.id,
        slug: q.slug,
        title: q.title as Record<string, string> | null
      }));
      setQuizzes(typedQuizzes);
      if (typedQuizzes.length > 0 && !selectedQuizId) {
        setSelectedQuizId(typedQuizzes[0].id);
      }
    }
  };

  const fetchAnalytics = async (quizId: string) => {
    setLoading(true);
    try {
      // Fetch quiz leads
      const { data: leads, error: leadsError } = await supabase
        .from('quiz_leads')
        .select('*')
        .eq('quiz_id', quizId)
        .order('created_at', { ascending: true });

      if (leadsError) throw leadsError;

      // Fetch questions and answers for this quiz
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id, question_text, question_order')
        .eq('quiz_id', quizId)
        .order('question_order');

      if (questionsError) throw questionsError;

      const { data: answers, error: answersError } = await supabase
        .from('quiz_answers')
        .select('id, question_id, answer_text, answer_order')
        .in('question_id', questions?.map(q => q.id) || [])
        .order('answer_order');

      if (answersError) throw answersError;

      // Build questions map
      const qMap: Record<string, { text: string; answers: { id: string; text: string }[] }> = {};
      questions?.forEach(q => {
        const qText = (q.question_text as { en?: string })?.en || 'Question';
        qMap[q.id] = {
          text: qText.length > 40 ? qText.substring(0, 40) + '...' : qText,
          answers: []
        };
      });

      answers?.forEach(a => {
        if (qMap[a.question_id]) {
          const aText = (a.answer_text as { en?: string })?.en || 'Answer';
          qMap[a.question_id].answers.push({
            id: a.id,
            text: aText.length > 25 ? aText.substring(0, 25) + '...' : aText
          });
        }
      });

      setQuestionsMap(qMap);

      // Calculate analytics
      const typedLeads = (leads || []) as QuizLead[];
      const totalSubmissions = typedLeads.length;
      
      const totalScore = typedLeads.reduce((acc, lead) => acc + lead.score, 0);
      const totalPossible = typedLeads.reduce((acc, lead) => acc + lead.total_questions, 0);
      const averageScore = totalSubmissions > 0 ? totalScore / totalSubmissions : 0;
      const averagePercentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

      // Result distribution
      const resultCounts: Record<string, number> = {};
      typedLeads.forEach(lead => {
        resultCounts[lead.result_category] = (resultCounts[lead.result_category] || 0) + 1;
      });
      const resultDistribution = Object.entries(resultCounts).map(([name, count]) => ({ name, count }));

      // Answer distribution per question
      const answerCounts: Record<string, Record<string, number>> = {};
      typedLeads.forEach(lead => {
        if (lead.answers && typeof lead.answers === 'object') {
          Object.entries(lead.answers).forEach(([questionId, answerIndex]) => {
            if (!answerCounts[questionId]) {
              answerCounts[questionId] = {};
            }
            const answerKey = String(answerIndex);
            answerCounts[questionId][answerKey] = (answerCounts[questionId][answerKey] || 0) + 1;
          });
        }
      });

      const answerDistribution = Object.entries(answerCounts).map(([questionId, counts]) => {
        const questionInfo = qMap[questionId];
        const answersData = Object.entries(counts).map(([answerIndex, count]) => {
          const idx = parseInt(answerIndex);
          const answerInfo = questionInfo?.answers[idx];
          return {
            label: answerInfo?.text || `Option ${idx + 1}`,
            count
          };
        }).sort((a, b) => b.count - a.count);

        return {
          question: questionInfo?.text || questionId,
          answers: answersData
        };
      });

      // Calculate daily trends (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });
      
      const dailyTrend: TrendData[] = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const dayLeads = typedLeads.filter(lead => {
          const leadDate = new Date(lead.created_at);
          return leadDate >= dayStart && leadDate < dayEnd;
        });
        
        const submissions = dayLeads.length;
        const avgScore = submissions > 0 
          ? dayLeads.reduce((acc, l) => acc + (l.score / l.total_questions) * 100, 0) / submissions 
          : 0;
        
        return {
          date: format(day, 'MMM d'),
          submissions,
          avgScore: Math.round(avgScore)
        };
      });

      // Calculate weekly trends (last 12 weeks)
      const twelveWeeksAgo = subDays(now, 84);
      const weeks = eachWeekOfInterval({ start: twelveWeeksAgo, end: now });
      
      const weeklyTrend: TrendData[] = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        
        const weekLeads = typedLeads.filter(lead => {
          const leadDate = new Date(lead.created_at);
          return leadDate >= weekStart && leadDate <= weekEnd;
        });
        
        const submissions = weekLeads.length;
        const avgScore = submissions > 0 
          ? weekLeads.reduce((acc, l) => acc + (l.score / l.total_questions) * 100, 0) / submissions 
          : 0;
        
        return {
          date: format(weekStart, 'MMM d'),
          submissions,
          avgScore: Math.round(avgScore)
        };
      });

      setAnalytics({
        totalSubmissions,
        averageScore,
        averagePercentage,
        resultDistribution,
        answerDistribution,
        dailyTrend,
        weeklyTrend
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuizTitle = (quiz: Quiz) => {
    return quiz.title?.en || quiz.title?.hr || quiz.slug;
  };

  const trendData = trendView === 'daily' ? analytics?.dailyTrend : analytics?.weeklyTrend;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Quiz Analytics</h2>
        <div className="flex items-center gap-4">
          <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a quiz" />
            </SelectTrigger>
            <SelectContent>
              {quizzes.map((quiz) => (
                <SelectItem key={quiz.id} value={quiz.id}>
                  {getQuizTitle(quiz)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => selectedQuizId && fetchAnalytics(selectedQuizId)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalSubmissions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.averageScore.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">points per submission</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Percentage</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.averagePercentage.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">correct answers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Result Categories</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.resultDistribution.length}</div>
                <p className="text-xs text-muted-foreground">unique outcomes</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Charts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Submissions Over Time
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={trendView === 'daily' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTrendView('daily')}
                >
                  Daily
                </Button>
                <Button
                  variant={trendView === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTrendView('weekly')}
                >
                  Weekly
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {trendData && trendData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }} 
                        interval={trendView === 'daily' ? 4 : 0}
                        className="text-muted-foreground"
                      />
                      <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="submissions" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorSubmissions)" 
                        name="Submissions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No trend data available</p>
              )}
            </CardContent>
          </Card>

          {/* Average Score Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Average Score Trend ({trendView === 'daily' ? 'Last 30 Days' : 'Last 12 Weeks'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData && trendData.some(d => d.submissions > 0) ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData.filter(d => d.submissions > 0)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }} 
                        domain={[0, 100]}
                        className="text-muted-foreground"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value}%`, 'Avg Score']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="avgScore" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                        name="Avg Score %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No score data available for this period</p>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Result Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Result Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.resultDistribution.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.resultDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {analytics.resultDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Score Distribution (using result categories as proxy) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submissions by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.resultDistribution.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.resultDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Popular Answers per Question */}
          {analytics.answerDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Popular Answer Choices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {analytics.answerDistribution.map((q, qIndex) => (
                    <div key={qIndex} className="space-y-2">
                      <h4 className="font-medium text-sm text-foreground">{q.question}</h4>
                      <div className="space-y-1">
                        {q.answers.slice(0, 4).map((a, aIndex) => {
                          const maxCount = Math.max(...q.answers.map(ans => ans.count));
                          const percentage = maxCount > 0 ? (a.count / maxCount) * 100 : 0;
                          return (
                            <div key={aIndex} className="flex items-center gap-3">
                              <div className="w-36 text-xs text-muted-foreground truncate">{a.label}</div>
                              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${percentage}%`,
                                    backgroundColor: COLORS[aIndex % COLORS.length]
                                  }}
                                />
                              </div>
                              <div className="w-12 text-xs text-muted-foreground text-right">{a.count}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!analytics && !loading && selectedQuizId && (
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">Select a quiz to view analytics</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">Loading analytics...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
