import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Clock, 
  FileEdit, 
  Plus, 
  Trash2, 
  ToggleLeft,
  Activity,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Check
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

interface QuizActivityLogProps {
  quizId: string;
}

const ITEMS_PER_PAGE = 30;

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <Plus className="w-3 h-3" />,
  UPDATE: <FileEdit className="w-3 h-3" />,
  DELETE: <Trash2 className="w-3 h-3" />,
  STATUS_CHANGE: <ToggleLeft className="w-3 h-3" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
  UPDATE: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  STATUS_CHANGE: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export function QuizActivityLog({ quizId }: QuizActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Get count
      const { count, error: countError } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .eq("record_id", quizId);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get paginated logs
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("record_id", quizId)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  }, [quizId, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Real-time subscription for new logs
  useEffect(() => {
    const channel = supabase
      .channel(`activity-logs-realtime-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `record_id=eq.${quizId}`
        },
        (payload) => {
          // Add new log to the top if on first page
          if (currentPage === 1) {
            setLogs(prev => [payload.new as ActivityLog, ...prev.slice(0, ITEMS_PER_PAGE - 1)]);
            setTotalCount(prev => prev + 1);
          } else {
            // Just update count if not on first page
            setTotalCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, currentPage]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getInitial = (email: string | null) => {
    if (!email) return "S";
    return email.charAt(0).toUpperCase();
  };

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  };

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-16" />
        </div>
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Activity Log</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {totalCount}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="h-6 text-[10px] gap-1 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-6 border rounded-lg border-dashed">
          <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No activity recorded yet</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[32px_1fr_80px_90px_100px] gap-2 px-2 py-1.5 bg-muted/50 text-[10px] font-medium text-muted-foreground border-b">
            <span></span>
            <span>Description</span>
            <span>Action</span>
            <span>Table</span>
            <span className="text-right">Time</span>
          </div>
          
          {/* Log Rows */}
          <div className="max-h-[400px] overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className={`grid grid-cols-[32px_1fr_80px_90px_100px] gap-2 px-2 py-1.5 items-center text-xs border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                  index % 2 === 0 ? "bg-background" : "bg-muted/20"
                }`}
              >
                {/* Avatar */}
                <div 
                  className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary"
                  title={log.user_email || "System"}
                >
                  {getInitial(log.user_email)}
                </div>

                {/* Description */}
                <div className="min-w-0">
                  <div className="truncate text-foreground" title={log.description || undefined}>
                    {log.description || "No description"}
                  </div>
                  {log.field_name && (
                    <div className="truncate text-[10px] text-muted-foreground" title={`${log.old_value} → ${log.new_value}`}>
                      <span className="font-medium">{log.field_name}</span>
                      {log.old_value && <span className="text-red-500/70"> {log.old_value.substring(0, 20)}{log.old_value.length > 20 ? "…" : ""}</span>}
                      {log.new_value && <span className="text-green-500/70"> → {log.new_value.substring(0, 20)}{log.new_value.length > 20 ? "…" : ""}</span>}
                    </div>
                  )}
                </div>

                {/* Action Badge */}
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 h-5 justify-center gap-0.5 ${ACTION_COLORS[log.action_type] || "bg-muted"}`}
                >
                  {ACTION_ICONS[log.action_type] || <AlertCircle className="w-3 h-3" />}
                  <span className="hidden sm:inline">{log.action_type}</span>
                </Badge>

                {/* Table */}
                <span className="text-[10px] text-muted-foreground truncate" title={log.table_name}>
                  {log.table_name}
                </span>

                {/* Time */}
                <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{formatTime(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
