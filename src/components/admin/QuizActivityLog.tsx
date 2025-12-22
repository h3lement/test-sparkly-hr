import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin";
import { 
  RefreshCw, 
  FileEdit, 
  Plus, 
  Trash2, 
  ToggleLeft,
  Activity,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Search,
  X,
  Filter,
  Calendar
} from "lucide-react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";

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

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "STATUS_CHANGE", label: "Status" },
];

const TABLE_TYPES = [
  { value: "all", label: "All Tables" },
  { value: "quizzes", label: "Quizzes" },
  { value: "quiz_questions", label: "Questions" },
  { value: "quiz_answers", label: "Answers" },
  { value: "quiz_result_levels", label: "Results" },
];

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
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, tableFilter, dateFrom, dateTo, itemsPerPage]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Build query
      let countQuery = supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .eq("record_id", quizId);

      let dataQuery = supabase
        .from("activity_logs")
        .select("*")
        .eq("record_id", quizId);

      // Apply action filter
      if (actionFilter !== "all") {
        countQuery = countQuery.eq("action_type", actionFilter);
        dataQuery = dataQuery.eq("action_type", actionFilter);
      }

      // Apply table filter
      if (tableFilter !== "all") {
        countQuery = countQuery.eq("table_name", tableFilter);
        dataQuery = dataQuery.eq("table_name", tableFilter);
      }

      // Apply date range filter
      if (dateFrom) {
        const fromDate = startOfDay(parseISO(dateFrom)).toISOString();
        countQuery = countQuery.gte("created_at", fromDate);
        dataQuery = dataQuery.gte("created_at", fromDate);
      }
      if (dateTo) {
        const toDate = endOfDay(parseISO(dateTo)).toISOString();
        countQuery = countQuery.lte("created_at", toDate);
        dataQuery = dataQuery.lte("created_at", toDate);
      }

      // Apply search filter (search in description, field_name, user_email, old_value, new_value)
      if (debouncedSearch) {
        const searchPattern = `%${debouncedSearch}%`;
        countQuery = countQuery.or(`description.ilike.${searchPattern},field_name.ilike.${searchPattern},user_email.ilike.${searchPattern},old_value.ilike.${searchPattern},new_value.ilike.${searchPattern}`);
        dataQuery = dataQuery.or(`description.ilike.${searchPattern},field_name.ilike.${searchPattern},user_email.ilike.${searchPattern},old_value.ilike.${searchPattern},new_value.ilike.${searchPattern}`);
      }

      // Get count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get paginated logs
      const { data, error } = await dataQuery
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  }, [quizId, currentPage, actionFilter, tableFilter, debouncedSearch, dateFrom, dateTo, itemsPerPage]);

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
          const newLog = payload.new as ActivityLog;
          
          // Check if the new log matches current filters
          const matchesAction = actionFilter === "all" || newLog.action_type === actionFilter;
          const matchesTable = tableFilter === "all" || newLog.table_name === tableFilter;
          const matchesSearch = !debouncedSearch || 
            (newLog.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             newLog.field_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             newLog.user_email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             newLog.old_value?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             newLog.new_value?.toLowerCase().includes(debouncedSearch.toLowerCase()));

          // Check date range
          let matchesDate = true;
          if (dateFrom) {
            matchesDate = matchesDate && new Date(newLog.created_at) >= startOfDay(parseISO(dateFrom));
          }
          if (dateTo) {
            matchesDate = matchesDate && new Date(newLog.created_at) <= endOfDay(parseISO(dateTo));
          }

          if (matchesAction && matchesTable && matchesSearch && matchesDate && currentPage === 1) {
            setLogs(prev => [newLog, ...prev.slice(0, itemsPerPage - 1)]);
          }
          
          if (matchesAction && matchesTable && matchesSearch && matchesDate) {
            setTotalCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, currentPage, actionFilter, tableFilter, debouncedSearch, dateFrom, dateTo, itemsPerPage]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getInitial = (email: string | null) => {
    if (!email) return "S";
    return email.charAt(0).toUpperCase();
  };

  const formatTimestamp = (dateStr: string) => {
    return format(new Date(dateStr), "dd MMM yyyy HH:mm");
  };

  const getShortEmail = (email: string | null) => {
    if (!email) return "System";
    const parts = email.split("@");
    return parts[0];
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActionFilter("all");
    setTableFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = searchQuery || actionFilter !== "all" || tableFilter !== "all" || dateFrom || dateTo;

  // Calculate row number for display
  const getRowNumber = (index: number) => {
    return (currentPage - 1) * itemsPerPage + index + 1;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-8 w-full" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-7" />
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

      {/* Search and Filters Row 1 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search description, user, values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs pl-7 pr-7"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-7 text-xs w-[95px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value} className="text-xs">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="h-7 text-xs w-[90px]">
            <SelectValue placeholder="Table" />
          </SelectTrigger>
          <SelectContent>
            {TABLE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value} className="text-xs">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">From:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-7 text-xs w-[120px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">To:</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-7 text-xs w-[120px]"
          />
        </div>

        <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(parseInt(v))}>
          <SelectTrigger className="h-7 text-xs w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEMS_PER_PAGE_OPTIONS.map((num) => (
              <SelectItem key={num} value={num.toString()} className="text-xs">
                {num} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
            Clear all
          </Button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-6 border rounded-lg border-dashed">
          {hasActiveFilters ? (
            <>
              <Filter className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">No logs match your filters</p>
              <Button
                variant="link"
                size="sm"
                onClick={clearFilters}
                className="text-xs h-6 mt-1"
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">No activity recorded yet</p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <AdminTable>
            <AdminTableHeader>
              <AdminTableCell header className="w-10">#</AdminTableCell>
              <AdminTableCell header className="w-28">User</AdminTableCell>
              <AdminTableCell header className="w-24">Table</AdminTableCell>
              <AdminTableCell header>Description</AdminTableCell>
              <AdminTableCell header className="w-20">Action</AdminTableCell>
              <AdminTableCell header align="right" className="w-32">Timestamp</AdminTableCell>
            </AdminTableHeader>
            <AdminTableBody>
              {logs.map((log, index) => (
                <AdminTableRow key={log.id} index={index}>
                  <AdminTableCell>
                    <span className="text-xs text-muted-foreground font-mono">
                      {getRowNumber(index)}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div 
                      className="flex items-center gap-2 min-w-0"
                      title={log.user_email || "System"}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0 bg-secondary">
                        <AvatarFallback className="text-xs bg-secondary text-foreground">
                          {getInitial(log.user_email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{getShortEmail(log.user_email)}</span>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="text-sm text-muted-foreground truncate" title={log.table_name}>
                      {log.table_name.replace("quiz_", "").replace("_", " ")}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground" title={log.description || undefined}>
                        {log.description || "No description"}
                      </div>
                      {log.field_name && (
                        <div className="truncate text-xs text-muted-foreground" title={`${log.old_value} → ${log.new_value}`}>
                          <span className="font-medium">{log.field_name}</span>
                          {log.old_value && <span className="text-red-500/70"> {log.old_value.substring(0, 15)}{log.old_value.length > 15 ? "…" : ""}</span>}
                          {log.new_value && <span className="text-green-500/70"> → {log.new_value.substring(0, 15)}{log.new_value.length > 15 ? "…" : ""}</span>}
                        </div>
                      )}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs px-2 py-0.5 ${ACTION_COLORS[log.action_type] || "bg-muted"}`}
                    >
                      {ACTION_ICONS[log.action_type] || <AlertCircle className="w-3 h-3" />}
                    </Badge>
                  </AdminTableCell>
                  <AdminTableCell align="right">
                    <span className="text-sm text-muted-foreground">
                      {formatTimestamp(log.created_at)}
                    </span>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
        </div>
      )}

      {/* Pagination */}
      {totalPages >= 1 && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="px-2 text-muted-foreground">
              {currentPage} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
