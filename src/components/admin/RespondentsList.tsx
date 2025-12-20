import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  RefreshCw, 
  Download, 
  Search, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  FileText,
  ChevronLeft,
  ChevronRight,
  Upload,
  CalendarIcon,
  X
} from "lucide-react";
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
import { RespondentsGrowthChart } from "./RespondentsGrowthChart";
import { logActivity } from "@/hooks/useActivityLog";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { Json } from "@/integrations/supabase/types";

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
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedQuizFilter, setSelectedQuizFilter] = useState<string>("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [activityLogLead, setActivityLogLead] = useState<QuizLead | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      
      const { data, error } = await supabase.functions.invoke("import-quiz-leads", {
        body: { csvContent: text },
      });

      if (error) throw error;

      toast({
        title: "Import successful",
        description: `Imported ${data.inserted} respondents (${data.parseErrors} parse errors)`,
      });
      
      fetchData();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  // User preferences
  const { preferences, savePreferences, loading: prefsLoading } = useUserPreferences<RespondentsPreferences>({
    key: "respondents_list_prefs",
    defaultValue: {
      itemsPerPage: 25,
      showUniqueEmails: false,
      showUniqueEmailQuiz: false,
    },
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
      const [leadsRes, quizzesRes, questionsRes, answersRes] = await Promise.all([
        supabase
          .from("quiz_leads")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("quizzes")
          .select("*"),
        supabase
          .from("quiz_questions")
          .select("*")
          .order("question_order", { ascending: true }),
        supabase
          .from("quiz_answers")
          .select("*")
          .order("answer_order", { ascending: true }),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (quizzesRes.error) throw quizzesRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (answersRes.error) throw answersRes.error;

      setLeads(leadsRes.data || []);
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
      if (expandedRow === leadId) setExpandedRow(null);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  // Apply quiz filter first
  const quizFilteredLeads = useMemo(() => {
    if (selectedQuizFilter === "all") return leads;
    return leads.filter(lead => lead.quiz_id === selectedQuizFilter);
  }, [leads, selectedQuizFilter]);

  // Apply date range filter
  const dateFilteredLeads = useMemo(() => {
    return quizFilteredLeads.filter(lead => {
      const leadDate = new Date(lead.created_at);
      if (dateFrom && leadDate < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (leadDate > endOfDay) return false;
      }
      return true;
    });
  }, [quizFilteredLeads, dateFrom, dateTo]);

  // Apply search filter
  const searchFilteredLeads = dateFilteredLeads.filter(lead =>
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
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedQuizFilter, showUniqueEmails, showUniqueEmailQuiz, dateFrom, dateTo]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setExpandedRow(null);
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

  const handleQuizClick = (quizId: string | null, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!quizId) return;
    navigate(`/admin/quiz/${quizId}`);
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Respondents</h1>
          <p className="text-muted-foreground mt-1">View quiz submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <label>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
              disabled={importing}
            />
            <Button variant="outline" size="sm" disabled={importing} asChild>
              <span>
                <Upload className={`w-4 h-4 mr-2 ${importing ? "animate-pulse" : ""}`} />
                {importing ? "Importing..." : "Import CSV"}
              </span>
            </Button>
          </label>
          <Button onClick={downloadCSV} variant="default" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Filters - all on one row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 bg-secondary/50 border-border text-sm"
          />
        </div>
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
        
        {/* Date Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 bg-secondary/50 border-border text-sm justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "MMM d") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 bg-secondary/50 border-border text-sm justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "MMM d") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2"
            onClick={() => {
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        
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
      </div>

      {/* Respondents Growth Chart */}
      <RespondentsGrowthChart 
        quizzes={quizzes} 
        leads={dateFilteredLeads} 
        loading={loading}
        onLeadInserted={fetchData}
      />

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading respondents...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No submissions found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Quiz</th>
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Score</th>
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Result</th>
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Openness</th>
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Lang</th>
                <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Submitted</th>
                <th className="text-right density-px density-py-sm text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedLeads.map((lead) => {
                const isExpanded = expandedRow === lead.id;
                // Find quiz by id, or fallback to first quiz if quiz_id is null (for legacy data)
                const quiz = lead.quiz_id 
                  ? quizzes.find(q => q.id === lead.quiz_id)
                  : quizzes.length > 0 ? quizzes[0] : null;
                const effectiveQuizId = quiz?.id || null;
                const quizQuestions = getQuestionsForQuiz(effectiveQuizId);
                const leadAnswers = parseLeadAnswers(lead.answers);
                const hasAnswers = quizQuestions.length > 0 && Object.keys(leadAnswers).length > 0;

                return (
                  <>
                    <tr 
                      key={lead.id}
                      id={`lead-row-${lead.id}`}
                      className={`hover:bg-secondary/30 transition-all ${hasAnswers ? 'cursor-pointer' : ''} ${highlightedLeadId === lead.id ? 'bg-primary/20 ring-2 ring-primary ring-inset animate-pulse' : ''}`}
                      onClick={() => hasAnswers && setExpandedRow(isExpanded ? null : lead.id)}
                    >
                      <td className="density-px density-py">
                        <div className="flex items-center density-gap">
                          <Avatar className="h-9 w-9 bg-secondary">
                            <AvatarFallback className="text-xs bg-secondary text-foreground">
                              {lead.email.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(lead.email);
                              }}
                              className="text-sm text-foreground hover:text-primary hover:underline transition-colors text-left"
                            >
                              {lead.email}
                            </button>
                            <Badge 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-primary/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(lead.email);
                              }}
                            >
                              {getEmailQuizCount(lead.email)}
                            </Badge>
                            {hasAnswers && (
                              isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="density-px density-py">
                        {quiz ? (
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleQuizClick(effectiveQuizId, e)}
                              className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors text-left"
                              title="Click to edit quiz"
                            >
                              {getLocalizedText(quiz.title, lead.language || "en") || quiz.slug}
                            </button>
                            <a
                              href={`/${quiz.slug.replace(/^\/+/, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                            >
                              /{quiz.slug.replace(/^\/+/, "")}
                            </a>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                      </td>
                      <td className="density-px density-py text-sm text-foreground">
                        {lead.score}/{lead.total_questions}
                      </td>
                      <td className="density-px density-py">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {lead.result_category}
                        </Badge>
                      </td>
                      <td className="density-px density-py">
                        {lead.openness_score !== null ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {lead.openness_score}/4
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="density-px density-py">
                        <Badge variant="secondary" className="uppercase text-xs">
                          {lead.language || 'en'}
                        </Badge>
                      </td>
                      <td className="density-px density-py text-sm text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="density-px density-py text-right">
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
                      </td>
                    </tr>
                    {isExpanded && hasAnswers && (
                      <tr key={`${lead.id}-expanded`}>
                        <td colSpan={8} className="density-px density-py bg-secondary/20">
                          <div className="density-gap-lg">
                            <p className="text-sm font-medium text-foreground">Quiz Answers</p>
                            <div className="grid gap-2">
                              {quizQuestions.map((question, qIdx) => {
                                const questionAnswers = getAnswersForQuestion(question.id);
                                const selectedAnswerId = leadAnswers[question.id];
                                const selectedAnswer = questionAnswers.find(a => a.id === selectedAnswerId);

                                return (
                                  <div
                                    key={question.id}
                                    className="bg-card rounded-lg p-3 border border-border"
                                  >
                                    <p className="text-sm text-muted-foreground mb-1">
                                      Q{qIdx + 1}: {getLocalizedText(question.question_text, lead.language || "en")}
                                    </p>
                                    {selectedAnswer ? (
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-foreground">
                                          {getLocalizedText(selectedAnswer.answer_text, lead.language || "en")}
                                        </p>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            selectedAnswer.score_value >= 3 
                                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                                              : selectedAnswer.score_value >= 2
                                              ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                              : "bg-red-500/10 text-red-600 border-red-500/20"
                                          }`}
                                        >
                                          {selectedAnswer.score_value} pt{selectedAnswer.score_value !== 1 ? "s" : ""}
                                        </Badge>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground italic">No answer recorded</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
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
                            {formatDate(submission.created_at)}
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
