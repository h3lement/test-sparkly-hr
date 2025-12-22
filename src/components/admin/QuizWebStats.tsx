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

interface QuizWebStatsProps {
  quizId: string;
  quizSlug: string;
  includeOpenMindedness?: boolean;
  quizType?: "standard" | "hypothesis" | "emotional";
}

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export function QuizWebStats({ quizId, quizSlug, includeOpenMindedness, quizType = "standard" }: QuizWebStatsProps) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [pageViews, setPageViews] = useState<PageViewData[]>([]);
  const [dynamicStepCount, setDynamicStepCount] = useState(0);
  const [stats, setStats] = useState({
    totalPageViews: 0,
    totalSessions: 0,
    completions: 0,
    abandoned: 0,
    completionRate: 0,
  });
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const { toast } = useToast();

  const isHypothesis = quizType === "hypothesis";

  // Build funnel steps based on quiz type and configuration
  const getFunnelSteps = (pageCount: number) => {
    if (isHypothesis) {
      // Hypothesis quiz has a different flow: welcome -> pages (p1, p2, etc.) -> email -> results
      const steps = [
        { slug: 'welcome', label: 'Welcome' },
      ];
      
      // Add dynamic page steps based on actual page count
      for (let i = 1; i <= pageCount; i++) {
        steps.push({ slug: `p${i}`, label: `Page ${i}` });
      }
      
      if (includeOpenMindedness) {
        steps.push({ slug: 'mindedness', label: 'Open-Mind' });
      }
      
      steps.push({ slug: 'email', label: 'Email' });
      steps.push({ slug: 'results', label: 'Results' });
      
      return steps;
    }
    
    // Standard quiz flow
    const steps = [
      { slug: 'welcome', label: 'Welcome' },
    ];
    
    // Add dynamic question steps based on actual question count
    for (let i = 1; i <= pageCount; i++) {
      steps.push({ slug: `q${i}`, label: `Q${i}` });
    }
    
    if (includeOpenMindedness) {
      steps.push({ slug: 'mindedness', label: 'Open-Mind' });
    }
    
    steps.push({ slug: 'email', label: 'Email' });
    steps.push({ slug: 'results', label: 'Results' });
    
    return steps;
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch actual step count based on quiz type
      let stepCount = 0;
      if (isHypothesis) {
        // For hypothesis quizzes, fetch actual page count
        const { count, error: countError } = await supabase
          .from('hypothesis_pages')
          .select('*', { count: 'exact', head: true })
          .eq('quiz_id', quizId);
        
        if (!countError) {
          stepCount = count || 0;
        }
      } else {
        // For standard quizzes, fetch actual question count
        const { count, error: countError } = await supabase
          .from('quiz_questions')
          .select('*', { count: 'exact', head: true })
          .eq('quiz_id', quizId);
        
        if (!countError) {
          stepCount = count || 0;
        }
      }
      setDynamicStepCount(stepCount);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      // Filter page views by quiz slug prefix
      const { data, error } = await supabase
        .from('page_views')
        .select('session_id, page_slug, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Filter for this specific quiz's page views
      // Page slugs should be like: quiz-slug/welcome, quiz-slug/q1, etc.
      // Or just welcome, q1, etc. for the default quiz
      const filteredData = (data || []).filter(view => {
        // Match pages that belong to this quiz
        const slug = view.page_slug;
        return slug.startsWith(`${quizSlug}/`) || 
               (quizSlug === 'team-performance' && !slug.includes('/'));
      });
      
      setPageViews(filteredData);
      calculateStats(filteredData, stepCount);
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

  const calculateStats = (views: PageViewData[], pageCount: number) => {
    const FUNNEL_STEPS = getFunnelSteps(pageCount);
    
    // Get unique sessions and their visited pages
    const sessionProgress = new Map<string, Set<string>>();
    
    views.forEach((view) => {
      if (!sessionProgress.has(view.session_id)) {
        sessionProgress.set(view.session_id, new Set());
      }
      // Extract the step from page_slug (e.g., "quiz-slug/welcome" -> "welcome")
      const stepSlug = view.page_slug.includes('/') 
        ? view.page_slug.split('/').pop()! 
        : view.page_slug;
      sessionProgress.get(view.session_id)!.add(stepSlug);
    });

    const totalSessions = sessionProgress.size;

    // Count unique sessions that reached each step
    const stepReachedCounts = new Map<string, number>();
    FUNNEL_STEPS.forEach(step => {
      let count = 0;
      sessionProgress.forEach((visitedPages) => {
        if (visitedPages.has(step.slug)) {
          count++;
        }
      });
      stepReachedCounts.set(step.slug, count);
    });

    // Get welcome count for percentage calculation
    const welcomeCount = stepReachedCounts.get('welcome') || 0;

    // Calculate funnel data
    const funnel: FunnelStep[] = FUNNEL_STEPS.map((step) => {
      const count = stepReachedCounts.get(step.slug) || 0;
      return {
        slug: step.slug,
        label: step.label,
        count,
        percentage: welcomeCount > 0 ? Math.round((count / welcomeCount) * 100) : 0,
      };
    });

    // Calculate completions
    const completions = stepReachedCounts.get('results') || 0;
    const abandoned = welcomeCount - completions;
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
  }, [dateRange, quizSlug]);

  // Real-time subscription for page views
  useEffect(() => {
    const channel = supabase
      .channel(`quiz-web-stats-${quizSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'page_views'
        },
        (payload) => {
          // Check if this page view is for our quiz
          const newPageSlug = (payload.new as { page_slug: string }).page_slug;
          if (newPageSlug?.startsWith(`${quizSlug}/`) || 
              (quizSlug === 'team-performance' && !newPageSlug?.includes('/'))) {
            // Refetch stats on new page view
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizSlug]);

  const maxFunnelCount = Math.max(...funnelData.map((f) => f.count), 1);

  // Get badge color based on percentage
  const getBadgeColor = (percentage: number, isFirst: boolean) => {
    if (isFirst) return 'bg-primary text-primary-foreground';
    if (percentage >= 80) return 'bg-green-500 text-white';
    if (percentage >= 50) return 'bg-amber-500 text-white';
    if (percentage > 0) return 'bg-red-500 text-white';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Web Funnel</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[120px] h-7 text-xs">
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
          <Button
            onClick={fetchStats}
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          label="Page Views"
          value={stats.totalPageViews}
          icon={<Eye className="w-4 h-4 text-muted-foreground" />}
        />
        <StatCard
          label="Sessions"
          value={stats.totalSessions}
          icon={<Users className="w-4 h-4 text-muted-foreground" />}
        />
        <StatCard
          label="Completions"
          value={stats.completions}
          icon={<CheckCircle className="w-4 h-4 text-green-500" />}
          valueColor="text-green-600"
        />
        <StatCard
          label="Abandoned"
          value={stats.abandoned}
          icon={<XCircle className="w-4 h-4 text-red-500" />}
          valueColor="text-red-600"
        />
        <StatCard
          label="Conversion"
          value={`${stats.completionRate.toFixed(0)}%`}
          icon={<TrendingDown className="w-4 h-4 text-primary" />}
          valueColor={stats.completionRate >= 50 ? "text-green-600" : stats.completionRate >= 25 ? "text-amber-600" : "text-red-600"}
        />
      </div>

      {/* Funnel Chart */}
      <div className="bg-muted/30 rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium">User Journey Funnel</span>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : pageViews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No session data for this period.</p>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 h-40">
            {funnelData.map((step, index) => {
              const heightPercentage = (step.count / maxFunnelCount) * 100;
              
              return (
                <div
                  key={step.slug}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                >
                  {/* Count above bar */}
                  <span className="text-xs font-bold text-foreground mb-1">
                    {step.count}
                  </span>
                  
                  {/* Vertical Bar */}
                  <div
                    className="w-full max-w-[40px] bg-primary/70 rounded-t transition-all duration-500 ease-out"
                    style={{ height: `${Math.max(heightPercentage, 5)}%` }}
                  />
                  
                  {/* Label below bar */}
                  <div className="mt-2 text-center w-full flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-medium text-foreground">
                      {step.label}
                    </span>
                    {/* Percentage badge */}
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${getBadgeColor(step.percentage, index === 0)}`}>
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
    <div className="bg-card rounded-lg border p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        {icon}
      </div>
      <p className={`text-lg font-bold ${valueColor || 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
