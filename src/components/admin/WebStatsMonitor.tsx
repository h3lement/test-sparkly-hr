import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Eye, Users, CheckCircle, XCircle, BarChart3, TrendingDown } from 'lucide-react';
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

    // For each session, determine the FURTHEST step they reached in the funnel
    const sessionFurthestStep = new Map<string, number>();
    
    views.forEach((view) => {
      const stepIndex = FUNNEL_STEPS.findIndex((s) => s.slug === view.page_slug);
      if (stepIndex === -1) return; // Unknown step, skip
      
      const currentFurthest = sessionFurthestStep.get(view.session_id) ?? -1;
      if (stepIndex > currentFurthest) {
        sessionFurthestStep.set(view.session_id, stepIndex);
      }
    });

    // Calculate funnel data - count sessions that reached AT LEAST this step
    // A session "reached" a step if their furthest step is >= this step's index
    const funnel: FunnelStep[] = FUNNEL_STEPS.map((step, stepIndex) => {
      const count = Array.from(sessionFurthestStep.values()).filter(
        (furthestIndex) => furthestIndex >= stepIndex
      ).length;
      
      // Percentage is relative to sessions that started (reached welcome)
      const startedSessions = Array.from(sessionFurthestStep.values()).filter(
        (furthestIndex) => furthestIndex >= 0
      ).length;
      
      return {
        slug: step.slug,
        label: step.label,
        count,
        percentage: startedSessions > 0 ? Math.round((count / startedSessions) * 100) : 0,
      };
    });

    // Calculate completions (sessions that reached results - last step)
    const resultsIndex = FUNNEL_STEPS.findIndex((s) => s.slug === 'results');
    const completions = Array.from(sessionFurthestStep.values()).filter(
      (furthestIndex) => furthestIndex >= resultsIndex
    ).length;

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
          <h1 className="text-3xl font-serif italic text-foreground">Web Stats</h1>
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
            className="h-10 w-10 rounded-full"
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
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">User Journey Funnel</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Welcome → Questions → Email → Results
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
          <div className="flex items-end gap-1 sm:gap-2 h-64 overflow-x-auto pb-2">
            {funnelData.map((step) => {
              const heightPercentage = (step.count / maxFunnelCount) * 100;
              const getPercentageColor = (pct: number) => {
                if (pct >= 80) return 'bg-green-500 text-white';
                if (pct >= 50) return 'bg-green-400 text-white';
                if (pct >= 30) return 'bg-amber-400 text-white';
                if (pct > 0) return 'bg-red-400 text-white';
                return 'bg-gray-300 text-gray-600';
              };
              
              return (
                <div
                  key={step.slug}
                  className="flex-1 min-w-[50px] flex flex-col items-center"
                >
                  {/* Count above bar */}
                  <span className="text-sm font-semibold text-foreground mb-1">
                    {step.count}
                  </span>
                  
                  {/* Bar */}
                  <div
                    className="w-full bg-slate-600 rounded-t transition-all duration-500 ease-out"
                    style={{ height: `${Math.max(heightPercentage, 8)}%` }}
                  />
                  
                  {/* Label and percentage */}
                  <div className="mt-3 text-center w-full">
                    <span className="text-xs font-medium text-foreground block truncate px-1">
                      {step.label}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full mt-1.5 inline-block font-medium ${getPercentageColor(step.percentage)}`}
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
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <span className={`text-3xl font-bold ${valueColor || 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
