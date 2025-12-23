import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  RefreshCw, 
  Search, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  TestTube, 
  User, 
  Shield, 
  RotateCcw, 
  Info, 
  Eye,
  Wifi,
  ChevronLeft,
  ChevronRight,
  Send,
  Clock,
  ExternalLink,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Settings,
  History,
  Loader2,
  Inbox,
  MailCheck,
  MailX,
  MousePointer,
  EyeIcon
} from "lucide-react";
import { ActivityLogDialog } from "./ActivityLogDialog";
import { EmailDetailDialog } from "./EmailDetailDialog";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { EmailSettings } from "./EmailSettings";

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  language: string | null;
  quiz_lead_id: string | null;
  quiz_id: string | null;
  created_at: string;
  resend_attempts: number;
  last_attempt_at: string | null;
  original_log_id: string | null;
  html_body: string | null;
  // Delivery tracking fields
  delivery_status: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  complaint_type: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number | null;
  click_count: number | null;
  quiz_lead?: {
    quiz_id: string | null;
  } | null;
  // Queue item indicator
  isQueueItem?: boolean;
  scheduled_for?: string;
}

interface QueueItem {
  id: string;
  recipient_email: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  status: string;
  email_type: string;
  language: string | null;
  quiz_id: string | null;
  quiz_lead_id: string | null;
  created_at: string;
  scheduled_for: string;
  html_body: string | null;
  error_message: string | null;
  retry_count: number;
}

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface EmailLogsMonitorProps {
  onViewQuizLead?: (leadId: string) => void;
  initialEmailFilter?: string | null;
  onEmailFilterCleared?: () => void;
}

interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  lastProcessed: string | null;
}

export function EmailLogsMonitor({ onViewQuizLead, initialEmailFilter, onEmailFilterCleared }: EmailLogsMonitorProps = {}) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialEmailFilter || "");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterQuiz, setFilterQuiz] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [detailDialogLog, setDetailDialogLog] = useState<EmailLog | null>(null);
  const [activityLogEmail, setActivityLogEmail] = useState<EmailLog | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, processing: 0, failed: 0, lastProcessed: null });
  const [queueLoading, setQueueLoading] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sortColumns, setSortColumns] = useState<Array<{ column: string; direction: "asc" | "desc" }>>(() => {
    try {
      const stored = localStorage.getItem("email-logs-sort-preferences");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return [{ column: "created_at", direction: "desc" }];
  });
  const { toast } = useToast();

  // Default column widths
  const defaultColumnWidths = {
    row: 50,
    type: 130,
    status: 110,
    quiz: 120,
    recipient: 200,
    subject: 250,
    sent: 100,
    actions: 180,
  };

  const { columnWidths, handleMouseDown } = useResizableColumns({
    defaultWidths: defaultColumnWidths,
    storageKey: "email-logs-column-widths",
    minWidth: 60,
  });

  // Process email queue function
  const processQueue = useCallback(async (silent = false) => {
    if (processingQueue) return;

    setProcessingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-email-queue", {
        body: {},
      });

      if (error) throw error;

      if (!silent && data?.processed > 0) {
        toast({
          title: "Queue processed",
          description: `Processed ${data.processed} email(s)`,
        });
      }

      // Refresh data after processing
      fetchQueueStats();
      fetchLogs();
    } catch (error: any) {
      console.error("Error processing queue:", error);
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to process email queue",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingQueue(false);
    }
  }, [processingQueue, toast]);

  const requeueQueueItem = useCallback(
    async (queueId: string, sendNow = false) => {
      try {
        const { error } = await supabase
          .from("email_queue")
          .update({
            status: "pending",
            retry_count: 0,
            error_message: null,
            processing_started_at: null,
            scheduled_for: new Date().toISOString(),
          })
          .eq("id", queueId);

        if (error) throw error;

        toast({
          title: "Re-queued",
          description: sendNow ? "Email re-queued and will be sent now." : "Email moved back to pending queue.",
        });

        fetchQueueStats();
        fetchLogs();

        if (sendNow) {
          // Give realtime a moment to deliver updates
          setTimeout(() => {
            processQueue(true);
          }, 300);
        }
      } catch (error: any) {
        console.error("Error re-queuing email:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to re-queue email",
          variant: "destructive",
        });
      }
    },
    [processQueue, toast]
  );

  const requeueAllFailed = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("email_queue")
        .update({
          status: "pending",
          retry_count: 0,
          error_message: null,
          processing_started_at: null,
          scheduled_for: new Date().toISOString(),
        })
        .eq("status", "failed");

      if (error) throw error;

      toast({
        title: "Failed emails re-queued",
        description: "Retrying failed emails now.",
      });

      fetchQueueStats();
      fetchLogs();

      setTimeout(() => {
        processQueue(false);
      }, 300);
    } catch (error: any) {
      console.error("Error re-queuing failed emails:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to re-queue failed emails",
         variant: "destructive",
       });
     }
   }, [processQueue, toast]);

  // Auto-process queue when connection is re-established
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("Connection re-established, processing pending emails...");
      toast({
        title: "Connection restored",
        description: "Processing pending emails...",
      });
      // Small delay to ensure connection is stable
      setTimeout(() => {
        processQueue(false);
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Connection lost",
        description: "Emails will be queued and sent when connection is restored",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [processQueue, toast]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, queueRes, quizzesRes] = await Promise.all([
        supabase
          .from("email_logs")
          .select("*, quiz_lead:quiz_leads(quiz_id)")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("email_queue")
          .select("*")
          .in("status", ["pending", "processing", "failed"])
          .order("created_at", { ascending: false }),
        supabase
          .from("quizzes")
          .select("id, title, slug"),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (quizzesRes.error) throw quizzesRes.error;
      
      setLogs((logsRes.data as EmailLog[]) || []);
      setQueueItems((queueRes.data as QueueItem[]) || []);
      setQuizzes((quizzesRes.data as Quiz[]) || []);
    } catch (error: any) {
      console.error("Error fetching email logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch email logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchQueueStats = useCallback(async () => {
    setQueueLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_queue")
        .select("status, sent_at")
        .in("status", ["pending", "processing", "failed"]);

      if (error) throw error;

      const pending = data?.filter((d) => d.status === "pending").length || 0;
      const processing = data?.filter((d) => d.status === "processing").length || 0;
      const failed = data?.filter((d) => d.status === "failed").length || 0;

      // Get last processed time
      const { data: lastSent } = await supabase
        .from("email_queue")
        .select("sent_at")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setQueueStats({
        pending,
        processing,
        failed,
        lastProcessed: lastSent?.sent_at || null,
      });
    } catch (error) {
      console.error("Error fetching queue stats:", error);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchQueueStats();
  }, [fetchLogs, fetchQueueStats]);

  // Handle initial email filter changes
  useEffect(() => {
    if (initialEmailFilter) {
      setSearchQuery(initialEmailFilter);
      setCurrentPage(1);
    }
  }, [initialEmailFilter]);

  // Realtime subscription for both email_logs and email_queue
  useEffect(() => {
    const logsChannel = supabase
      .channel("email-logs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_logs" },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    const queueChannel = supabase
      .channel("email-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_queue" },
        () => {
          fetchQueueStats();
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(queueChannel);
    };
  }, [fetchLogs, fetchQueueStats]);

  const resendEmail = async (logId: string) => {
    setResendingId(logId);
    try {
      const { data, error } = await supabase.functions.invoke("resend-email", {
        body: { logId },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Email resent",
          description: `Email successfully resent (attempt #${data.attempts})`,
        });
        fetchLogs();
      } else {
        toast({
          title: "Resend failed",
          description: data.error || "Failed to resend email",
          variant: "destructive",
        });
        fetchLogs();
      }
    } catch (error: any) {
      console.error("Error resending email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend email",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case "test":
        return { label: "Test", icon: TestTube, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      case "quiz_result_user":
        return { label: "Quiz Taker", icon: User, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
      case "quiz_result_admin":
        return { label: "Admin Notif", icon: Shield, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
      case "domain_reputation_alert":
        return { label: "Domain Alert", icon: AlertCircle, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" };
      default:
        return { label: type, icon: Mail, color: "bg-secondary text-secondary-foreground" };
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

  const formatFullTimestamp = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  };

  const getQuizTitle = (log: EmailLog) => {
    // Try direct quiz_id first, then fall back to quiz_lead
    const quizId = log.quiz_id || log.quiz_lead?.quiz_id;
    if (!quizId) return null;
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return null;
    const title = quiz.title as Record<string, string>;
    return title?.en || title?.et || quiz.slug;
  };

  // Save sort preferences to localStorage
  useEffect(() => {
    localStorage.setItem("email-logs-sort-preferences", JSON.stringify(sortColumns));
  }, [sortColumns]);

  // Handle column sorting (Shift+click for multi-column)
  const handleSort = (column: string, shiftKey: boolean) => {
    setSortColumns((prev) => {
      const existingIndex = prev.findIndex((s) => s.column === column);
      
      if (shiftKey) {
        // Multi-column sort: add or toggle
        if (existingIndex >= 0) {
          // Toggle direction if already sorted
          const newSort = [...prev];
          newSort[existingIndex] = {
            ...newSort[existingIndex],
            direction: newSort[existingIndex].direction === "asc" ? "desc" : "asc",
          };
          return newSort;
        } else {
          // Add new column to sort
          return [...prev, { column, direction: column === "created_at" ? "desc" : "asc" }];
        }
      } else {
        // Single column sort
        if (existingIndex >= 0 && prev.length === 1) {
          // Toggle direction
          return [{ column, direction: prev[0].direction === "asc" ? "desc" : "asc" }];
        }
        // Set as only sort column
        return [{ column, direction: column === "created_at" ? "desc" : "asc" }];
      }
    });
  };

  // Get sort icon for column header
  const getSortIcon = (column: string) => {
    const sortInfo = sortColumns.find((s) => s.column === column);
    const sortIndex = sortColumns.findIndex((s) => s.column === column);
    
    if (!sortInfo) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    }
    
    return (
      <span className="flex items-center">
        {sortInfo.direction === "asc" 
          ? <ArrowUp className="w-3 h-3 ml-1" />
          : <ArrowDown className="w-3 h-3 ml-1" />}
        {sortColumns.length > 1 && (
          <span className="text-[10px] ml-0.5 text-primary font-bold">{sortIndex + 1}</span>
        )}
      </span>
    );
  };

  // Convert queue items to EmailLog format for unified display
  const combinedLogs = useMemo(() => {
    // Convert queue items to EmailLog format
    const queueAsLogs: EmailLog[] = queueItems.map((item) => ({
      id: item.id,
      email_type: item.email_type,
      recipient_email: item.recipient_email,
      sender_email: item.sender_email,
      sender_name: item.sender_name,
      subject: item.subject,
      status: item.status, // pending, processing, failed
      resend_id: null,
      error_message: item.error_message,
      language: item.language,
      quiz_lead_id: item.quiz_lead_id,
      quiz_id: item.quiz_id,
      created_at: item.created_at,
      resend_attempts: item.retry_count,
      last_attempt_at: null,
      original_log_id: null,
      html_body: item.html_body,
      delivery_status: null,
      delivered_at: null,
      bounced_at: null,
      complained_at: null,
      bounce_type: null,
      bounce_reason: null,
      complaint_type: null,
      opened_at: null,
      clicked_at: null,
      open_count: null,
      click_count: null,
      quiz_lead: null,
      isQueueItem: true,
      scheduled_for: item.scheduled_for,
    }));

    // Combine queue items first (they appear at top), then logs
    return [...queueAsLogs, ...logs];
  }, [logs, queueItems]);

  // Filter and search
  const filteredLogs = useMemo(() => {
    let result = combinedLogs;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((log) =>
        log.recipient_email.toLowerCase().includes(query) ||
        log.subject.toLowerCase().includes(query) ||
        (log.sender_email && log.sender_email.toLowerCase().includes(query)) ||
        (log.resend_id && log.resend_id.toLowerCase().includes(query)) ||
        (log.error_message && log.error_message.toLowerCase().includes(query))
      );
    }

    // Type filter
    if (filterType !== "all") {
      result = result.filter((log) => log.email_type === filterType);
    }

    // Status filter - include queue statuses
    if (filterStatus !== "all") {
      if (filterStatus === "pending") {
        result = result.filter((log) => log.status === "pending" || log.status === "processing");
      } else if (filterStatus === "queued") {
        result = result.filter((log) => log.isQueueItem);
      } else {
        result = result.filter((log) => log.status === filterStatus);
      }
    }

    // Quiz filter - check both direct quiz_id and quiz_lead.quiz_id
    if (filterQuiz === "no_quiz") {
      result = result.filter((log) => !log.quiz_id && !log.quiz_lead?.quiz_id);
    } else if (filterQuiz !== "all") {
      result = result.filter((log) => log.quiz_id === filterQuiz || log.quiz_lead?.quiz_id === filterQuiz);
    }

    return result;
  }, [combinedLogs, searchQuery, filterType, filterStatus, filterQuiz]);

  // Helper to get value for sorting
  const getSortValue = (log: EmailLog, column: string): any => {
    switch (column) {
      case "email_type":
        return log.email_type;
      case "status":
        return log.status;
      case "quiz":
        return log.quiz_id || log.quiz_lead?.quiz_id || "";
      case "recipient":
        return log.recipient_email.toLowerCase();
      case "subject":
        return log.subject.toLowerCase();
      case "created_at":
      default:
        return new Date(log.created_at).getTime();
    }
  };

  // Sort filtered logs with multi-column support
  const sortedLogs = useMemo(() => {
    const sorted = [...filteredLogs].sort((a, b) => {
      for (const { column, direction } of sortColumns) {
        const aVal = getSortValue(a, column);
        const bVal = getSortValue(b, column);

        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [filteredLogs, sortColumns]);

  // Pagination
  const totalItems = sortedLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStatus, filterQuiz, sortColumns]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }

    return pages;
  };

  // Stats (reflect current filters/search so counts match the table)
  const stats = useMemo(() => {
    const base = filteredLogs;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      total: base.length,
      sent: base.filter((l) => l.status === "sent").length,
      failed: base.filter((l) => l.status === "failed" && !l.isQueueItem).length,
      pending: base.filter((l) => l.isQueueItem).length,
      todaySent: base.filter((l) => l.status === "sent" && new Date(l.created_at) >= today).length,
      // Count quiz_result_user AND legacy quiz_results type
      quizUsers: base.filter((l) => l.email_type === "quiz_result_user" || l.email_type === "quiz_results").length,
      adminNotifs: base.filter((l) => l.email_type === "quiz_result_admin").length,
      testEmails: base.filter((l) => l.email_type === "test").length,
    };
  }, [filteredLogs]);

  const [activeTab, setActiveTab] = useState("history");

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Email Management</h1>
          <p className="text-muted-foreground mt-1">Monitor emails and configure sending</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "history" && (
            <>
              {/* Queue Status Block */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Queue:</span>
                {queueLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    {queueStats.pending > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-3 w-3" />
                        {queueStats.pending}
                      </span>
                    )}
                    {queueStats.processing > 0 && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {queueStats.processing}
                      </span>
                    )}
                    {queueStats.failed > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {queueStats.failed}
                      </span>
                    )}
                    {queueStats.pending === 0 && queueStats.processing === 0 && queueStats.failed === 0 && (
                      <span className="text-muted-foreground">Empty</span>
                    )}
                  </div>
                )}
                {(queueStats.pending > 0 || queueStats.failed > 0) && (
                  <div className="flex items-center gap-1">
                    {queueStats.failed > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={requeueAllFailed}
                        disabled={processingQueue}
                        title="Move failed emails back to pending and send again"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span className="ml-1">Retry failed</span>
                      </Button>
                    )}

                    {(queueStats.pending > 0 || queueStats.failed > 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => processQueue(false)}
                        disabled={processingQueue}
                        title="Process pending emails now"
                      >
                        {processingQueue ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        <span className="ml-1">Process</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className={`flex items-center gap-1.5 text-sm ${isOnline ? "text-green-600" : "text-red-600"}`}>
                <Wifi className={`h-4 w-4 ${!isOnline ? "opacity-50" : ""}`} />
                <span>{isOnline ? "Live" : "Offline"}</span>
              </div>
              <Button onClick={() => { fetchLogs(); fetchQueueStats(); }} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Email History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Email Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Send className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todaySent}</p>
                <p className="text-sm text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.quizUsers}</p>
                <p className="text-sm text-muted-foreground">Quiz Takers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.adminNotifs}</p>
                <p className="text-sm text-muted-foreground">Admin Notifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="test">Tests</SelectItem>
            <SelectItem value="quiz_result_user">Quiz Takers</SelectItem>
            <SelectItem value="quiz_result_admin">Admin Notifs</SelectItem>
            <SelectItem value="domain_reputation_alert">Domain Alerts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterQuiz} onValueChange={setFilterQuiz}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Quiz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quizzes</SelectItem>
            <SelectItem value="no_quiz">No Quiz</SelectItem>
            {quizzes.map((quiz) => {
              const title = quiz.title as Record<string, string>;
              return (
                <SelectItem key={quiz.id} value={quiz.id}>
                  {title?.en || title?.et || quiz.slug}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-sm">
          {filteredLogs.length} results
        </Badge>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading email logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No email logs found.</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || filterType !== "all" || filterStatus !== "all"
              ? "Try adjusting your search or filters."
              : "Emails will appear here after they are sent."}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th style={{ width: columnWidths.row }} className="text-center px-2 py-3 text-sm font-medium text-muted-foreground">
                    #
                  </th>
                  <th 
                    style={{ width: columnWidths.type }} 
                    className="text-left px-4 py-3 text-sm font-medium text-muted-foreground relative group cursor-pointer hover:bg-muted/60"
                    onClick={(e) => handleSort("email_type", e.shiftKey)}
                  >
                    <span className="flex items-center">
                      Type
                      {getSortIcon("email_type")}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-border"
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown("type", e); }}
                    />
                  </th>
                  <th 
                    style={{ width: columnWidths.status }} 
                    className="text-left px-4 py-3 text-sm font-medium text-muted-foreground relative group cursor-pointer hover:bg-muted/60"
                    onClick={(e) => handleSort("status", e.shiftKey)}
                  >
                    <span className="flex items-center">
                      Status
                      {getSortIcon("status")}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-border"
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown("status", e); }}
                    />
                  </th>
                  <th 
                    style={{ width: columnWidths.quiz }} 
                    className="text-left px-4 py-3 text-sm font-medium text-muted-foreground relative group cursor-pointer hover:bg-muted/60"
                    onClick={(e) => handleSort("quiz", e.shiftKey)}
                  >
                    <span className="flex items-center">
                      Quiz
                      {getSortIcon("quiz")}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-border"
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown("quiz", e); }}
                    />
                  </th>
                  <th 
                    style={{ width: columnWidths.recipient }} 
                    className="text-left px-4 py-3 text-sm font-medium text-muted-foreground relative group cursor-pointer hover:bg-muted/60"
                    onClick={(e) => handleSort("recipient", e.shiftKey)}
                  >
                    <span className="flex items-center">
                      Recipient
                      {getSortIcon("recipient")}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-border"
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown("recipient", e); }}
                    />
                  </th>
                  <th 
                    style={{ width: columnWidths.subject }} 
                    className="text-left px-4 py-3 text-sm font-medium text-muted-foreground relative group cursor-pointer hover:bg-muted/60"
                    onClick={(e) => handleSort("subject", e.shiftKey)}
                  >
                    <span className="flex items-center">
                      Subject
                      {getSortIcon("subject")}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-border"
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown("subject", e); }}
                    />
                  </th>
                  <th 
                    style={{ width: columnWidths.sent }} 
                    className="text-left px-4 py-3 text-sm font-medium text-muted-foreground relative group cursor-pointer hover:bg-muted/60"
                    onClick={(e) => handleSort("created_at", e.shiftKey)}
                  >
                    <span className="flex items-center">
                      Sent
                      {getSortIcon("created_at")}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-border"
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown("sent", e); }}
                    />
                  </th>
                  <th style={{ width: columnWidths.actions }} className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, index) => {
                  const typeInfo = getEmailTypeLabel(log.email_type);
                  const TypeIcon = typeInfo.icon;
                  const totalAttempts = 1 + (log.resend_attempts || 0);
                  const isResend = !!log.original_log_id;
                  const quizTitle = getQuizTitle(log);
                  const isEvenRow = index % 2 === 0;
                  const rowNumber = startIndex + index + 1;

                  return (
                    <tr key={log.id} className={`border-b border-border last:border-b-0 list-row-interactive ${isEvenRow ? "list-row-even" : "list-row-odd"}`}>
                      <td style={{ width: columnWidths.row }} className="px-2 py-3 text-center">
                        <span className="text-xs text-muted-foreground font-mono">{rowNumber}</span>
                      </td>
                      <td style={{ width: columnWidths.type }} className="px-4 py-3 overflow-hidden">
                        <div className="flex items-center gap-1 overflow-hidden">
                          <Badge variant="outline" className={`${typeInfo.color} gap-1 shrink-0`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeInfo.label}
                          </Badge>
                          {isResend && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs shrink-0">
                              Resent
                            </Badge>
                          )}
                          {log.isQueueItem && (
                            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20 text-xs shrink-0">
                              <Inbox className="w-2.5 h-2.5 mr-0.5" />
                              Queue
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td style={{ width: columnWidths.status }} className="px-4 py-3 overflow-hidden">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {/* Queue status display */}
                          {log.isQueueItem && log.status === "pending" ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              Pending
                            </Badge>
                          ) : log.isQueueItem && log.status === "processing" ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1 shrink-0">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing
                            </Badge>
                          ) : log.isQueueItem && log.status === "failed" ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Queue Failed
                            </Badge>
                          ) : log.delivery_status === 'delivered' ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 shrink-0">
                              <MailCheck className="w-3 h-3" />
                              Delivered
                            </Badge>
                          ) : log.delivery_status === 'bounced' ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1 shrink-0">
                              <MailX className="w-3 h-3" />
                              Bounced
                            </Badge>
                          ) : log.delivery_status === 'complained' ? (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Complaint
                            </Badge>
                          ) : log.delivery_status === 'opened' || log.delivery_status === 'clicked' ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1 shrink-0">
                              <EyeIcon className="w-3 h-3" />
                              Opened
                            </Badge>
                          ) : log.status === "sent" ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              Sent
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1 shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              Failed
                            </Badge>
                          )}
                          {/* Engagement indicators */}
                          {(log.open_count ?? 0) > 0 && (
                            <span className="text-xs text-blue-600 flex items-center gap-0.5" title={`Opened ${log.open_count} times`}>
                              <EyeIcon className="w-3 h-3" />
                              {log.open_count}
                            </span>
                          )}
                          {(log.click_count ?? 0) > 0 && (
                            <span className="text-xs text-purple-600 flex items-center gap-0.5" title={`Clicked ${log.click_count} times`}>
                              <MousePointer className="w-3 h-3" />
                              {log.click_count}
                            </span>
                          )}
                          {totalAttempts > 1 && (
                            <span className="text-xs text-amber-600 font-medium shrink-0">×{totalAttempts}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ width: columnWidths.quiz }} className="px-4 py-3 overflow-hidden">
                        <span className="text-sm text-muted-foreground truncate block" title={quizTitle || "—"}>
                          {quizTitle || "—"}
                        </span>
                      </td>
                      <td style={{ width: columnWidths.recipient }} className="px-4 py-3 overflow-hidden">
                        <span className="text-sm text-foreground truncate block" title={log.recipient_email}>{log.recipient_email}</span>
                      </td>
                      <td style={{ width: columnWidths.subject }} className="px-4 py-3 overflow-hidden">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Badge variant="secondary" className="text-xs uppercase shrink-0">
                            {log.language || "en"}
                          </Badge>
                          <span className="text-sm text-muted-foreground truncate" title={log.subject}>
                            {log.subject}
                          </span>
                        </div>
                      </td>
                      <td style={{ width: columnWidths.sent }} className="px-4 py-3 overflow-hidden">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatDate(log.created_at)}</span>
                        </div>
                      </td>
                      <td style={{ width: columnWidths.actions }} className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {log.quiz_lead_id && onViewQuizLead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => onViewQuizLead(log.quiz_lead_id!)}
                              title="View quiz lead"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedLog(log)}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDetailDialogLog(log)}
                            title="Full email details & history"
                          >
                            <Info className="w-4 h-4" />
                          </Button>

                          {log.isQueueItem ? (
                            log.status === "failed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => requeueQueueItem(log.id, true)}
                                disabled={processingQueue}
                                className="gap-1"
                                title="Move back to pending and send again"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Requeue
                              </Button>
                            ) : null
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendEmail(log.id)}
                              disabled={resendingId === log.id}
                              className="gap-1"
                            >
                              <RotateCcw className={`w-3 h-3 ${resendingId === log.id ? "animate-spin" : ""}`} />
                              {resendingId === log.id ? "..." : "Resend"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing</span>
                <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>of {totalItems} results</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {getPageNumbers().map((page, idx) =>
                  page === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  )
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">Email Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Header Info */}
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground font-medium">From:</span>
                  <span>{selectedLog.sender_name} &lt;{selectedLog.sender_email}&gt;</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground font-medium">To:</span>
                  <span>{selectedLog.recipient_email}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Subject:</span>
                  <span className="font-medium">{selectedLog.subject}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Date:</span>
                  <span>{formatFullTimestamp(selectedLog.created_at)}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Language:</span>
                  <span className="uppercase">{selectedLog.language || "en"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <span className={selectedLog.status === "sent" ? "text-green-600" : "text-red-600"}>
                    {selectedLog.status === "sent" ? "Sent" : "Failed"}
                  </span>
                </div>
                {selectedLog.delivery_status && selectedLog.delivery_status !== 'sent' && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground font-medium">Delivery:</span>
                    <span className={
                      selectedLog.delivery_status === 'delivered' ? 'text-emerald-600' :
                      selectedLog.delivery_status === 'bounced' ? 'text-red-600' :
                      selectedLog.delivery_status === 'complained' ? 'text-orange-600' :
                      selectedLog.delivery_status === 'opened' || selectedLog.delivery_status === 'clicked' ? 'text-blue-600' :
                      'text-muted-foreground'
                    }>
                      {selectedLog.delivery_status.charAt(0).toUpperCase() + selectedLog.delivery_status.slice(1)}
                    </span>
                  </div>
                )}
                {selectedLog.delivered_at && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground font-medium">Delivered:</span>
                    <span className="text-emerald-600">{formatFullTimestamp(selectedLog.delivered_at)}</span>
                  </div>
                )}
                {selectedLog.opened_at && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground font-medium">First Open:</span>
                    <span className="text-blue-600">{formatFullTimestamp(selectedLog.opened_at)} ({selectedLog.open_count || 1} opens)</span>
                  </div>
                )}
                {selectedLog.clicked_at && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground font-medium">First Click:</span>
                    <span className="text-purple-600">{formatFullTimestamp(selectedLog.clicked_at)} ({selectedLog.click_count || 1} clicks)</span>
                  </div>
                )}
                {selectedLog.bounced_at && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-red-500 font-medium">Bounced:</span>
                    <span className="text-red-600">{formatFullTimestamp(selectedLog.bounced_at)}</span>
                  </div>
                )}
                {selectedLog.bounce_type && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-red-500 font-medium">Bounce Type:</span>
                    <span className="text-red-600">{selectedLog.bounce_type}</span>
                  </div>
                )}
                {selectedLog.bounce_reason && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-red-500 font-medium">Reason:</span>
                    <span className="text-red-600">{selectedLog.bounce_reason}</span>
                  </div>
                )}
                {selectedLog.complained_at && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-orange-500 font-medium">Complaint:</span>
                    <span className="text-orange-600">{formatFullTimestamp(selectedLog.complained_at)} ({selectedLog.complaint_type || 'unknown'})</span>
                  </div>
                )}
                {selectedLog.resend_id && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground font-medium">Resend ID:</span>
                    <span className="font-mono text-xs">{selectedLog.resend_id}</span>
                  </div>
                )}
                {selectedLog.error_message && (
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-red-500 font-medium">Error:</span>
                    <span className="text-red-600">{selectedLog.error_message}</span>
                  </div>
                )}
              </div>

              {/* Email Body */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <span className="text-sm font-medium text-muted-foreground">Email Body</span>
                </div>
                {selectedLog.html_body ? (
                  <iframe
                    srcDoc={selectedLog.html_body}
                    className="w-full h-[400px] bg-white"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Email body not available</p>
                    <p className="text-xs mt-1">Older emails may not have body content stored</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EmailDetailDialog
        open={!!detailDialogLog}
        onClose={() => setDetailDialogLog(null)}
        log={detailDialogLog}
        quizTitle={detailDialogLog ? getQuizTitle(detailDialogLog) : null}
      />

      <ActivityLogDialog
        open={!!activityLogEmail}
        onClose={() => setActivityLogEmail(null)}
        tableName="email_logs"
        recordId={activityLogEmail?.id || ""}
        recordTitle={activityLogEmail?.recipient_email}
      />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <EmailSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
