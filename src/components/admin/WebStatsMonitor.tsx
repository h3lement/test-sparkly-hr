import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Eye, Users, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface PageViewData {
  session_id: string;
  page_slug: string;
  created_at: string;
}

interface FunnelStep {
  slug: string;
  label: string;
  count: number;
  percentage: number;
}

const FUNNEL_STEPS = [
  { slug: 'welcome', label: 'Welcome' },
  { slug: 'q1', label: 'Q1' },
  { slug: 'q2', label: 'Q2' },
  { slug: 'q3', label: 'Q3' },
  { slug: 'q4', label: 'Q4' },
  { slug: 'q5', label: 'Q5' },
  { slug: 'q6', label: 'Q6' },
  { slug: 'mindedness', label: 'Open-Mind' },
  { slug: 'email', label: 'Email' },
  { slug: 'results', label: 'Results' },
];

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export function WebStatsMonitor() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [pageViews, setPageViews] = useState<PageViewData[]>([]);
  const [stats, setStats] = useState({
    totalPageViews: 0,
    totalSessions: 0,
    completions: 0,
    abandoned: 0,
    completionRate: 0,
  });
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const { toast } = useToast();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const { data, error } = await supabase
        .from('page_views')
        .select('session_id, page_slug, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPageViews(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch web stats',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (views: PageViewData[]) => {
    // Get unique sessions
    const sessions = new Set(views.map((v) => v.session_id));
    const totalSessions = sessions.size;

    // Get sessions that reached each step
    const sessionSteps = new Map<string, Set<string>>();
    views.forEach((view) => {
      if (!sessionSteps.has(view.session_id)) {
        sessionSteps.set(view.session_id, new Set());
      }
      sessionSteps.get(view.session_id)!.add(view.page_slug);
    });

    // Calculate funnel data
    const funnel: FunnelStep[] = FUNNEL_STEPS.map((step) => {
      const count = Array.from(sessionSteps.values()).filter((steps) =>
        steps.has(step.slug)
      ).length;
      return {
        slug: step.slug,
        label: step.label,
        count,
        percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
      };
    });

    // Calculate completions (sessions that reached results)
    const completions = funnel.find((f) => f.slug === 'results')?.count || 0;

    // Calculate abandoned (sessions that started but didn't complete)
    const welcomeCount = funnel.find((f) => f.slug === 'welcome')?.count || 0;
    const abandoned = welcomeCount - completions;

    // Completion rate
    const completionRate = welcomeCount > 0 ? (completions / welcomeCount) * 100 : 0;

    setStats({
      totalPageViews: views.length,
      totalSessions,
      completions,
      abandoned: Math.max(0, abandoned),
      completionRate,
    });

    setFunnelData(funnel);
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const maxFunnelCount = Math.max(...funnelData.map((f) => f.count), 1);

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Web Stats</h1>
          <p className="text-muted-foreground mt-1">
            Track page views and complete user journey
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchStats}
            variant="outline"
            size="icon"
            disabled={loading}
            className="h-10 w-10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Page Views"
          value={stats.totalPageViews}
          icon={<Eye className="w-5 h-5 text-muted-foreground" />}
        />
        <StatCard
          label="Total Sessions"
          value={stats.totalSessions}
          icon={<Users className="w-5 h-5 text-muted-foreground" />}
        />
        <StatCard
          label="Completions"
          value={stats.completions}
          icon={<CheckCircle className="w-5 h-5 text-muted-foreground" />}
          valueColor="text-green-600"
        />
        <StatCard
          label="Abandoned"
          value={stats.abandoned}
          icon={<XCircle className="w-5 h-5 text-muted-foreground" />}
          valueColor="text-red-600"
        />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate.toFixed(1)}%`}
          icon={<BarChart3 className="w-5 h-5 text-muted-foreground" />}
        />
      </div>

      {/* Funnel Chart */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">User Journey Funnel</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {FUNNEL_STEPS.map((s) => s.label).join(' → ')}
        </p>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading funnel data...</p>
          </div>
        ) : funnelData.length === 0 || stats.totalSessions === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No session data available for this period.</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-64">
            {funnelData.map((step, index) => {
              const heightPercentage = (step.count / maxFunnelCount) * 100;
              return (
                <div
                  key={step.slug}
                  className="flex-1 flex flex-col items-center"
                >
                  <span className="text-sm font-medium text-foreground mb-1">
                    {step.count}
                  </span>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm transition-all duration-300"
                    style={{ height: `${Math.max(heightPercentage, 4)}%` }}
                  />
                  <div className="mt-2 text-center">
                    <span className="text-xs font-medium text-foreground block">
                      {step.label}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                        step.percentage >= 50
                          ? 'bg-green-100 text-green-700'
                          : step.percentage >= 25
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {step.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <span className={`text-2xl font-bold ${valueColor || 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
