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
    console.log('Fetching stats for date range:', dateRange);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      console.log('Start date:', startDate.toISOString());

      const { data, error } = await supabase
        .from('page_views')
        .select('session_id, page_slug, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched page views:', data?.length, 'records');
      console.log('Raw data:', data);
      
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
    console.log('Calculating stats for', views.length, 'views');
    
    // Get unique sessions
    const sessions = new Set(views.map((v) => v.session_id));
    const totalSessions = sessions.size;

    // Count total page views per page (all visits, not unique)
    const pageViewCounts = new Map<string, number>();
    
    views.forEach((view) => {
      const currentCount = pageViewCounts.get(view.page_slug) || 0;
      pageViewCounts.set(view.page_slug, currentCount + 1);
    });

    console.log('Page view counts:', Object.fromEntries(pageViewCounts));

    // Get welcome count for percentage calculation
    const welcomeCount = pageViewCounts.get('welcome') || 0;

    // Calculate funnel data - total page views per page
    const funnel: FunnelStep[] = FUNNEL_STEPS.map((step) => {
      const count = pageViewCounts.get(step.slug) || 0;
      
      return {
        slug: step.slug,
        label: step.label,
        count,
        percentage: welcomeCount > 0 ? Math.round((count / welcomeCount) * 100) : 0,
      };
    });

    console.log('Funnel data:', funnel);

    // Calculate completions (total results page views)
    const completions = pageViewCounts.get('results') || 0;

    // Calculate abandoned (welcome views minus results views)
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
          <div className="flex items-end gap-3 sm:gap-4 h-72 px-4">
            {funnelData.map((step, index) => {
              const heightPercentage = (step.count / maxFunnelCount) * 100;
              const getBarColor = (idx: number) => {
                const colors = [
                  'bg-primary',
                  'bg-primary/90',
                  'bg-primary/80',
                  'bg-primary/70',
                  'bg-primary/60',
                  'bg-primary/50',
                  'bg-amber-500',
                  'bg-amber-400',
                  'bg-green-500',
                  'bg-green-600',
                ];
                return colors[idx] || 'bg-primary';
              };
              
              return (
                <div
                  key={step.slug}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                >
                  {/* Count above bar */}
                  <span className="text-lg font-bold text-foreground mb-2">
                    {step.count}
                  </span>
                  
                  {/* Vertical Bar */}
                  <div
                    className={`w-full max-w-[60px] ${getBarColor(index)} rounded-t-lg transition-all duration-500 ease-out shadow-md`}
                    style={{ height: `${Math.max(heightPercentage, 5)}%` }}
                  />
                  
                  {/* Label below bar */}
                  <div className="mt-3 text-center w-full">
                    <span className="text-xs font-semibold text-foreground block">
                      {step.label}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 block">
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
