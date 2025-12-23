import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatTimestamp } from "@/lib/utils";
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  Users,
  Calendar,
  Wifi,
  Mail,
  MailCheck,
  MailOpen,
  MailX,
  MailWarning,
  Clock,
  RotateCcw
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizableTableHead } from "@/components/ui/resizable-table-head";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ActivityLogDialog } from "./ActivityLogDialog";
import { RespondentsGrowthChart, type DateRangeOption } from "./RespondentsGrowthChart";
import { EmailPreviewPopover, prefetchEmailPreviews } from "./EmailPreviewPopover";
import { logActivity } from "@/hooks/useActivityLog";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { Json } from "@/integrations/supabase/types";

// Import admin components
import {
  AdminPageHeader,
  AdminCard,
  AdminCardContent,
  AdminFilters,
  AdminSearch,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
  AdminEmptyState,
  AdminLoading,
  AdminPagination,
} from "@/components/admin";

interface QuizLead {
  id: string;
  email: string;
  score: number;
  total_questions: number;
  result_category: string;
  created_at: string;
  openness_score: number | null;
  language: string | null;
  quiz_id: string | null;
  answers: Json | null;
  leadType: "quiz" | "hypothesis"; // Track source table
}

interface Quiz {
  id: string;
  title: Json;
  slug: string;
  description: Json;
  is_active: boolean;
  headline?: Json;
  headline_highlight?: Json;
  badge_text?: Json;
  cta_text?: Json;
  cta_url?: string;
  duration_text?: Json;
  discover_items?: Json;
}

interface QuizQuestion {
  id: string;
  question_text: Json;
  question_order: number;
  quiz_id: string;
}

interface QuizAnswer {
  id: string;
  question_id: string;
  answer_text: Json;
  score_value: number;
  answer_order: number;
}

interface EmailLogStatus {
  lead_id: string;
  status: string;
  delivery_status: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  delivered_at: string | null;
  created_at: string;
  subject: string;
  html_body: string | null;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface RespondentsPreferences {
  itemsPerPage: number;
  showUniqueEmails: boolean;
  showUniqueEmailQuiz: boolean;
}

interface RespondentsListProps {
  highlightedLeadId?: string | null;
  onHighlightCleared?: () => void;
  onViewEmailHistory?: (leadId: string, email: string) => void;
}

export function RespondentsList({ highlightedLeadId, onHighlightCleared, onViewEmailHistory }: RespondentsListProps = {}) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [emailLogs, setEmailLogs] = useState<Map<string, EmailLogStatus>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuizFilter, setSelectedQuizFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeOption>("365");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [activityLogLead, setActivityLogLead] = useState<QuizLead | null>(null);
  const { toast } = useToast();

  // User preferences
  const { preferences, savePreferences, loading: prefsLoading } = useUserPreferences<RespondentsPreferences>({
    key: "respondents_list_prefs",
    defaultValue: {
      itemsPerPage: 25,
      showUniqueEmails: false,
      showUniqueEmailQuiz: false,
    },
  });

  // Column widths default values
  const defaultColumnWidths = useMemo(() => ({
    email: 220,
    quiz: 180,
    score: 80,
    result: 140,
    openness: 90,
    lang: 60,
    emailStatus: 80,
    submitted: 140,
    actions: 50,
  }), []);

  // Resizable columns
  const { columnWidths, handleMouseDown, resetWidths, loaded: columnsLoaded } = useResizableColumns({
    defaultWidths: defaultColumnWidths,
    storageKey: "respondents_column_widths",
    minWidth: 50,
  });

  const itemsPerPage = preferences.itemsPerPage ?? 25;
  const showUniqueEmails = preferences.showUniqueEmails ?? false;
  const showUniqueEmailQuiz = preferences.showUniqueEmailQuiz ?? false;

  const setItemsPerPage = useCallback((value: number) => {
    savePreferences({ ...preferences, itemsPerPage: value });
  }, [preferences, savePreferences]);

  const setShowUniqueEmails = useCallback((value: boolean) => {
    savePreferences({ ...preferences, showUniqueEmails: value, showUniqueEmailQuiz: value ? false : preferences.showUniqueEmailQuiz });
  }, [preferences, savePreferences]);

  const setShowUniqueEmailQuiz = useCallback((value: boolean) => {
    savePreferences({ ...preferences, showUniqueEmailQuiz: value, showUniqueEmails: value ? false : preferences.showUniqueEmails });
  }, [preferences, savePreferences]);

  // Calculate quiz count per email (case-insensitive)
  const emailQuizCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((lead) => {
      const normalizedEmail = lead.email.toLowerCase();
      counts[normalizedEmail] = (counts[normalizedEmail] || 0) + 1;
    });
    return counts;
  }, [leads]);

  // Helper to get count for an email (case-insensitive)
  const getEmailQuizCount = (email: string) => {
    return emailQuizCounts[email.toLowerCase()] || 1;
  };


  // Get all submissions for a specific email, ordered by latest first (case-insensitive)
  const getSubmissionsForEmail = (email: string) => {
    return leads
      .filter((lead) => lead.email.toLowerCase() === email.toLowerCase())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  useEffect(() => {
    fetchData();
  }, []);


  // Handle highlighted lead from Email History
  useEffect(() => {
    if (highlightedLeadId && leads.length > 0) {
      // Find the lead and scroll to it
      const leadIndex = leads.findIndex(l => l.id === highlightedLeadId);
      if (leadIndex >= 0) {
        // Calculate which page the lead is on
        const pageNumber = Math.floor(leadIndex / (preferences.itemsPerPage ?? 25)) + 1;
        setCurrentPage(pageNumber);
        
        // Scroll to the row after a short delay
        setTimeout(() => {
          const element = document.getElementById(`lead-row-${highlightedLeadId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
      
      // Clear highlight after a few seconds
      setTimeout(() => {
        onHighlightCleared?.();
      }, 3000);
    }
  }, [highlightedLeadId, leads, preferences.itemsPerPage, onHighlightCleared]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, hypothesisLeadsRes, quizzesRes, questionsRes, answersRes, emailLogsRes] = await Promise.all([
        supabase
          .from("quiz_leads")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("hypothesis_leads")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("quizzes")
          .select("*")
          .eq("is_active", true),
        supabase
          .from("quiz_questions")
          .select("*")
          .order("question_order", { ascending: true }),
        supabase
          .from("quiz_answers")
          .select("*")
          .order("answer_order", { ascending: true }),
        supabase
          .from("email_logs")
          .select("quiz_lead_id, hypothesis_lead_id, status, delivery_status, opened_at, clicked_at, bounced_at, delivered_at, created_at, subject, html_body")
          .in("email_type", ["quiz_result_user", "hypothesis_result_user"])
          .order("created_at", { ascending: false }),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (hypothesisLeadsRes.error) throw hypothesisLeadsRes.error;
      if (quizzesRes.error) throw quizzesRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (answersRes.error) throw answersRes.error;
      if (emailLogsRes.error) throw emailLogsRes.error;

      // Build email logs map by lead_id (use first/most recent log per lead)
      const logsMap = new Map<string, EmailLogStatus>();
      (emailLogsRes.data || []).forEach((log) => {
        const leadId = log.quiz_lead_id || log.hypothesis_lead_id;
        if (leadId && !logsMap.has(leadId)) {
          logsMap.set(leadId, {
            lead_id: leadId,
            status: log.status,
            delivery_status: log.delivery_status,
            opened_at: log.opened_at,
            clicked_at: log.clicked_at,
            bounced_at: log.bounced_at,
            delivered_at: log.delivered_at,
            created_at: log.created_at,
            subject: log.subject,
            html_body: log.html_body,
          });
        }
      });
      setEmailLogs(logsMap);

      // Convert hypothesis leads to match QuizLead interface
      const hypothesisLeadsConverted: QuizLead[] = (hypothesisLeadsRes.data || []).map((hl) => ({
        id: hl.id,
        email: hl.email,
        score: hl.score,
        total_questions: hl.total_questions,
        result_category: `${hl.score}/${hl.total_questions}`, // No category for hypothesis
        created_at: hl.created_at,
        openness_score: hl.openness_score ?? null,
        language: hl.language,
        quiz_id: hl.quiz_id,
        answers: null,
        leadType: "hypothesis" as const,
      }));

      // Convert quiz leads with leadType
      const quizLeadsConverted: QuizLead[] = (leadsRes.data || []).map((ql) => ({
        ...ql,
        leadType: "quiz" as const,
      }));

      // Get active quiz IDs
      const activeQuizIds = new Set((quizzesRes.data || []).map(q => q.id));

      // Merge and sort by created_at, filtering to only active quizzes
      const allLeads = [...quizLeadsConverted, ...hypothesisLeadsConverted]
        .filter(lead => lead.quiz_id && activeQuizIds.has(lead.quiz_id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLeads(allLeads);
      setQuizzes(quizzesRes.data || []);
      setQuestions(questionsRes.data || []);
      setAnswers(answersRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch respondents data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteLead = async (leadId: string, email: string) => {
    try {
      // Log the activity before deletion
      await logActivity({
        actionType: "DELETE",
        tableName: "quiz_leads",
        recordId: leadId,
        description: `Respondent submission from "${email}" deleted`,
      });

      const { error } = await supabase
        .from("quiz_leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead deleted",
        description: `Removed submission from ${email}`,
      });

      setLeads(leads.filter(lead => lead.id !== leadId));
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
    }
  };

  const downloadCSV = () => {
    if (leads.length === 0) {
      toast({
        title: "No data",
        description: "There are no leads to download",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Email", "Quiz", "Score", "Total Questions", "Percentage", "Result Category", "Openness Score", "Language", "Date"];
    const csvContent = [
      headers.join(","),
      ...leads.map((lead) => {
        const quiz = quizzes.find(q => q.id === lead.quiz_id);
        const quizTitle = quiz ? getLocalizedText(quiz.title) : "Unknown Quiz";
        const percentage = Math.round((lead.score / lead.total_questions) * 100);
        return [
          `"${lead.email}"`,
          `"${quizTitle}"`,
          lead.score,
          lead.total_questions,
          `${percentage}%`,
          `"${lead.result_category}"`,
          lead.openness_score ?? "",
          lead.language || "en",
          `"${new Date(lead.created_at).toLocaleString()}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz-respondents-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLocalizedText = (json: Json, lang: string = "en"): string => {
    if (typeof json === "string") return json;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return (json as Record<string, string>)[lang] || (json as Record<string, string>)["en"] || "";
    }
    return "";
  };

  // Use global formatTimestamp for consistency with email history table

  const getQuestionsForQuiz = (quizId: string | null) => {
    if (!quizId) return [];
    return questions.filter(q => q.quiz_id === quizId);
  };

  const getAnswersForQuestion = (questionId: string) => {
    return answers.filter(a => a.question_id === questionId);
  };

  const parseLeadAnswers = (answersJson: Json | null): Record<string, string> => {
    if (!answersJson || typeof answersJson !== "object" || Array.isArray(answersJson)) {
      return {};
    }
    return answersJson as Record<string, string>;
  };

  // Get email status icon and info for a lead
  const getEmailStatusInfo = (leadId: string) => {
    const log = emailLogs.get(leadId);
    if (!log) {
      return { icon: Clock, color: "text-muted-foreground", label: "No email sent" };
    }
    if (log.bounced_at) {
      return { icon: MailX, color: "text-destructive", label: "Bounced" };
    }
    if (log.clicked_at) {
      return { icon: MailCheck, color: "text-green-600", label: "Clicked" };
    }
    if (log.opened_at) {
      return { icon: MailOpen, color: "text-blue-500", label: "Opened" };
    }
    if (log.delivery_status === "delivered") {
      return { icon: MailCheck, color: "text-green-500", label: "Delivered" };
    }
    if (log.status === "sent") {
      return { icon: Mail, color: "text-primary", label: "Sent" };
    }
    if (log.status === "failed") {
      return { icon: MailWarning, color: "text-destructive", label: "Failed" };
    }
    return { icon: Mail, color: "text-muted-foreground", label: log.status };
  };

  // Apply quiz filter first
  const quizFilteredLeads = useMemo(() => {
    if (selectedQuizFilter === "all") return leads;
    return leads.filter(lead => lead.quiz_id === selectedQuizFilter);
  }, [leads, selectedQuizFilter]);

  // Apply search filter
  const searchFilteredLeads = quizFilteredLeads.filter(lead =>
    lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.result_category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate unique counts for toggle labels (based on search-filtered leads)
  const uniqueEmailCount = useMemo(() => {
    return new Set(searchFilteredLeads.map((lead) => lead.email)).size;
  }, [searchFilteredLeads]);

  const uniqueEmailQuizCount = useMemo(() => {
    return new Set(searchFilteredLeads.map((lead) => `${lead.email}::${lead.quiz_id || "unknown"}`)).size;
  }, [searchFilteredLeads]);

  // Apply unique filters
  const filteredLeads = useMemo(() => {
    let result = [...searchFilteredLeads].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (showUniqueEmails) {
      // Keep only the latest submission for each email
      const seen = new Set<string>();
      result = result.filter((lead) => {
        if (seen.has(lead.email)) return false;
        seen.add(lead.email);
        return true;
      });
    } else if (showUniqueEmailQuiz) {
      // Keep only the latest submission for each email+quiz combo
      const seen = new Set<string>();
      result = result.filter((lead) => {
        const key = `${lead.email}::${lead.quiz_id || "unknown"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return result;
  }, [searchFilteredLeads, showUniqueEmails, showUniqueEmailQuiz]);

  // Pagination calculations
  const totalItems = filteredLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedLeads = useMemo(
    () => filteredLeads.slice(startIndex, endIndex),
    [filteredLeads, startIndex, endIndex]
  );

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedQuizFilter, showUniqueEmails, showUniqueEmailQuiz]);

  // Prefetch email previews for the current page leads without sent emails
  const [prefetchedPreviews, setPrefetchedPreviews] = useState<Map<string, { html: string; subject: string }>>(new Map());
  const [prefetching, setPrefetching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Clear previous page cache immediately to avoid showing mismatched previews
    setPrefetchedPreviews(new Map());

    // Prefetch email previews for leads that don't have sent email logs
    const leadsWithoutSentEmail = paginatedLeads.filter((lead) => !emailLogs.has(lead.id));
    if (leadsWithoutSentEmail.length === 0) {
      setPrefetching(false);
      return () => {
        cancelled = true;
      };
    }

    // Prefetch in background
    setPrefetching(true);
    prefetchEmailPreviews(leadsWithoutSentEmail)
      .then((results) => {
        if (!cancelled) setPrefetchedPreviews(results);
      })
      .finally(() => {
        if (!cancelled) setPrefetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paginatedLeads, emailLogs]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleQuizClick = (quizId: string | null, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!quizId) return;
    navigate(`/admin/quiz/${quizId}`);
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Respondents"
        description="View quiz submissions"
        actions={
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={resetWidths} variant="ghost" size="sm">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset column widths</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={downloadCSV} variant="default" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <AdminFilters>
        <AdminSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search emails..."
        />
        <Select value={selectedQuizFilter} onValueChange={setSelectedQuizFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary/50 border-border text-sm">
            <SelectValue placeholder="All quizzes" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            <SelectItem value="all">All quizzes</SelectItem>
            {quizzes.map((quiz) => (
              <SelectItem key={quiz.id} value={quiz.id}>
                {getLocalizedText(quiz.title)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Period filter + Live (keep on same row as filters) */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
            <SelectTrigger className="w-[140px] h-9 bg-secondary/50 border-border text-sm">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <Wifi className="h-4 w-4" />
            <span>Live</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border">
          <Switch
            id="unique-emails"
            checked={showUniqueEmails}
            onCheckedChange={(checked) => {
              setShowUniqueEmails(checked);
              if (checked) setShowUniqueEmailQuiz(false);
            }}
            className="scale-90"
          />
          <Label htmlFor="unique-emails" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            Unique
          </Label>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {uniqueEmailCount}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border">
          <Switch
            id="unique-email-quiz"
            checked={showUniqueEmailQuiz}
            onCheckedChange={(checked) => {
              setShowUniqueEmailQuiz(checked);
              if (checked) setShowUniqueEmails(false);
            }}
            className="scale-90"
          />
          <Label htmlFor="unique-email-quiz" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            Unique+Quiz
          </Label>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {uniqueEmailQuizCount}
          </Badge>
        </div>
      </AdminFilters>

      {/* Respondents Growth Chart */}
      <RespondentsGrowthChart 
        quizzes={quizzes} 
        leads={filteredLeads} 
        loading={loading}
        onLeadInserted={fetchData}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showControls={false}
      />

      {loading ? (
        <AdminLoading message="Loading respondents..." />
      ) : filteredLeads.length === 0 ? (
        <AdminEmptyState
          icon={Users}
          title="No submissions found"
          description="Quiz submissions will appear here once users complete quizzes."
        />
      ) : (
        <AdminCard>
          <AdminCardContent noPadding>
            <AdminTable className="table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <ResizableTableHead columnKey="email" width={columnWidths.email} onResizeStart={handleMouseDown}>
                    Email
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="quiz" width={columnWidths.quiz} onResizeStart={handleMouseDown}>
                    Quiz
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="score" width={columnWidths.score} onResizeStart={handleMouseDown}>
                    Score
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="result" width={columnWidths.result} onResizeStart={handleMouseDown}>
                    Result
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="openness" width={columnWidths.openness} onResizeStart={handleMouseDown}>
                    Openness
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="lang" width={columnWidths.lang} onResizeStart={handleMouseDown}>
                    Lang
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="emailStatus" width={columnWidths.emailStatus} onResizeStart={handleMouseDown} className="text-center">
                    <div className="inline-flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>Email</span>
                    </div>
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="submitted" width={columnWidths.submitted} onResizeStart={handleMouseDown}>
                    Submitted
                  </ResizableTableHead>
                  <ResizableTableHead columnKey="actions" width={columnWidths.actions} onResizeStart={handleMouseDown} resizable={false} className="text-right">
                    &nbsp;
                  </ResizableTableHead>
                </tr>
              </thead>
              <AdminTableBody>
                {paginatedLeads.map((lead, index) => {
                  // Find quiz by id, or fallback to first quiz if quiz_id is null (for legacy data)
                  const quiz = lead.quiz_id 
                    ? quizzes.find(q => q.id === lead.quiz_id)
                    : quizzes.length > 0 ? quizzes[0] : null;
                  const effectiveQuizId = quiz?.id || null;
                  const emailStatus = getEmailStatusInfo(lead.id);
                  const EmailIcon = emailStatus.icon;
                  const prefetched = prefetchedPreviews.get(lead.id);

                  return (
                    <AdminTableRow 
                      key={lead.id}
                      id={`lead-row-${lead.id}`}
                      index={index}
                      className={cn(
                        highlightedLeadId === lead.id && 'bg-primary/20 ring-2 ring-primary ring-inset animate-pulse'
                      )}
                    >
                      <AdminTableCell style={{ width: columnWidths.email, minWidth: columnWidths.email }}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Avatar className="h-9 w-9 bg-secondary flex-shrink-0">
                            <AvatarFallback className="text-xs bg-secondary text-foreground">
                              {lead.email.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(lead.email);
                              }}
                              className="text-sm text-foreground hover:text-primary hover:underline transition-colors text-left truncate"
                            >
                              {lead.email}
                            </button>
                            <Badge 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-primary/20 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(lead.email);
                              }}
                            >
                              {getEmailQuizCount(lead.email)}
                            </Badge>
                          </div>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.quiz, minWidth: columnWidths.quiz }}>
                        {quiz ? (
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <button
                              type="button"
                              onClick={(e) => handleQuizClick(effectiveQuizId, e)}
                              className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors text-left truncate"
                              title="Click to edit quiz"
                            >
                              {getLocalizedText(quiz.title, lead.language || "en") || quiz.slug}
                            </button>
                            <a
                              href={`/${quiz.slug.replace(/^\/+/, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors truncate"
                            >
                              /{quiz.slug.replace(/^\/+/, "")}
                            </a>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.score, minWidth: columnWidths.score }}>
                        <span className="text-sm text-foreground">{lead.score}/{lead.total_questions}</span>
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.result, minWidth: columnWidths.result }}>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 truncate max-w-full">
                          {lead.result_category}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.openness, minWidth: columnWidths.openness }}>
                        {lead.openness_score !== null ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {lead.openness_score}/4
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.lang, minWidth: columnWidths.lang }}>
                        <Badge variant="secondary" className="uppercase text-xs">
                          {lead.language || 'en'}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.emailStatus, minWidth: columnWidths.emailStatus }} align="center">
                        <EmailPreviewPopover
                          leadId={lead.id}
                          leadCreatedAt={lead.created_at}
                          leadType={lead.leadType}
                          emailLog={emailLogs.get(lead.id)}
                          emailStatusLabel={emailStatus.label}
                          emailStatusColor={emailStatus.color}
                          EmailIcon={EmailIcon}
                          prefetchedHtml={prefetched?.html}
                          prefetchedSubject={prefetched?.subject}
                          prefetchLoading={prefetching && !prefetched}
                        />
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.submitted, minWidth: columnWidths.submitted }}>
                        <span className="text-sm text-muted-foreground">{formatTimestamp(lead.created_at)}</span>
                      </AdminTableCell>
                      <AdminTableCell style={{ width: columnWidths.actions, minWidth: columnWidths.actions }} align="right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLead(lead.id, lead.email);
                          }}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </AdminTable>

            {/* Pagination Controls - auto-hides when <= 25 items */}
            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </AdminCardContent>
        </AdminCard>
      )}

      {/* Email Quiz History Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Quiz History for</span>
              <span className="text-primary">{selectedEmail}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2">
            {selectedEmail && (
              <div className="space-y-3">
                {getSubmissionsForEmail(selectedEmail).map((submission, idx) => {
                  const quiz = quizzes.find((q) => q.id === submission.quiz_id);
                  return (
                    <div
                      key={submission.id}
                      className="bg-secondary/30 rounded-lg p-4 border border-border"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              #{getSubmissionsForEmail(selectedEmail).length - idx}
                            </Badge>
                            {quiz ? (
                              <button
                                onClick={() => {
                                  setSelectedEmail(null);
                                  handleQuizClick(submission.quiz_id);
                                }}
                                className="text-sm font-medium text-foreground truncate hover:text-primary hover:underline transition-colors text-left"
                              >
                                {getLocalizedText(quiz.title, submission.language || "en")}
                              </button>
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground truncate">
                                Unknown Quiz
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              {submission.result_category}
                            </Badge>
                            <span className="text-muted-foreground">
                              Score: {submission.score}/{submission.total_questions}
                            </span>
                            {submission.openness_score !== null && (
                              <span className="text-muted-foreground">
                                Openness: {submission.openness_score}/4
                              </span>
                            )}
                            <Badge variant="secondary" className="uppercase text-xs">
                              {submission.language || "en"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-muted-foreground">
                            {formatTimestamp(submission.created_at)}
                          </p>
                          {idx === 0 && (
                            <Badge className="mt-1 text-xs bg-green-500/10 text-green-600 border-green-500/20">
                              Latest
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ActivityLogDialog
        open={!!activityLogLead}
        onClose={() => setActivityLogLead(null)}
        tableName="quiz_leads"
        recordId={activityLogLead?.id || ""}
        recordTitle={activityLogLead?.email}
      />
    </div>
  );
}
