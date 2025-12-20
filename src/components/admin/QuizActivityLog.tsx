import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  ChevronRight
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

const ITEMS_PER_PAGE = 20;

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="w-3 h-3" />,
  update: <FileEdit className="w-3 h-3" />,
  delete: <Trash2 className="w-3 h-3" />,
  toggle: <ToggleLeft className="w-3 h-3" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  toggle: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-7 w-20" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Activity Log</span>
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Changes to this quiz will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border"
            >
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="text-[10px]">
                  {log.user_email ? log.user_email.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {log.user_email || "System"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[log.action_type] || ""}`}
                  >
                    <span className="mr-1">{ACTION_ICONS[log.action_type]}</span>
                    {log.action_type}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {log.table_name}
                  </Badge>
                </div>
                {log.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {log.description}
                  </p>
                )}
                {log.field_name && (
                  <div className="text-xs mt-1 space-y-0.5">
                    <span className="text-muted-foreground">Field: </span>
                    <span className="font-medium">{log.field_name}</span>
                    {log.old_value && (
                      <span className="text-red-500/70"> "{log.old_value.substring(0, 50)}{log.old_value.length > 50 ? "..." : ""}"</span>
                    )}
                    {log.new_value && (
                      <span className="text-green-500/70"> → "{log.new_value.substring(0, 50)}{log.new_value.length > 50 ? "..." : ""}"</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
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
