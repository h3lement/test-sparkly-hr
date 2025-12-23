import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Search,
  Users,
  Mail,
  Brain,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  X
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin";
import { RespondentDetailDialog } from "./RespondentDetailDialog";
import { logActivity } from "@/hooks/useActivityLog";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface QuizLead {
  id: string;
  email: string;
  score: number;
  total_questions: number;
  result_category: string;
  openness_score: number | null;
  language: string | null;
  created_at: string;
  answers: Json;
  quiz_id: string | null;
}

interface HypothesisLead {
  id: string;
  email: string;
  score: number;
  total_questions: number;
  language: string | null;
  created_at: string;
  quiz_id: string;
  session_id: string;
  feedback_action_plan: string | null;
  feedback_new_learnings: string | null;
}

// Unified type for display
type RespondentLead = QuizLead | (HypothesisLead & { result_category: string; openness_score: null; answers: null });

interface QuizRespondentsProps {
  quizId: string;
  displayLanguage: string;
  quizType?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];

export function QuizRespondents({ quizId, displayLanguage, quizType = "standard" }: QuizRespondentsProps) {
  const [leads, setLeads] = useState<RespondentLead[]>([]);
  const isHypothesisQuiz = quizType === "hypothesis";
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "score" | "email">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<QuizLead | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<QuizLead | null>(null);
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, itemsPerPage]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const tableName = isHypothesisQuiz ? "hypothesis_leads" : "quiz_leads";
      
      // Build count query
      let countQuery = supabase
        .from(tableName)
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", quizId);

      // Build data query
      let dataQuery = supabase
        .from(tableName)
        .select("*")
        .eq("quiz_id", quizId);

      // Apply search filter
      if (debouncedSearch) {
        const searchPattern = `%${debouncedSearch}%`;
        if (isHypothesisQuiz) {
          countQuery = countQuery.ilike("email", searchPattern);
          dataQuery = dataQuery.ilike("email", searchPattern);
        } else {
          countQuery = countQuery.or(`email.ilike.${searchPattern},result_category.ilike.${searchPattern}`);
          dataQuery = dataQuery.or(`email.ilike.${searchPattern},result_category.ilike.${searchPattern}`);
        }
      }

      // Apply date filters
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

      // Get count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get paginated data
      const { data, error } = await dataQuery
        .order(sortField, { ascending: sortDirection === "asc" })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;
      
      // Transform hypothesis leads to match the display format
      if (isHypothesisQuiz && data) {
        const transformedData = (data as HypothesisLead[]).map(lead => ({
          ...lead,
          result_category: `${Math.round((lead.score / lead.total_questions) * 100)}% correct`,
          openness_score: null,
          answers: null,
        }));
        setLeads(transformedData);
      } else {
        setLeads((data as QuizLead[]) || []);
      }
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Error",
        description: "Failed to load respondents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [quizId, sortField, sortDirection, currentPage, debouncedSearch, dateFrom, dateTo, itemsPerPage, toast, isHypothesisQuiz]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Real-time subscription for new leads
  useEffect(() => {
    const tableName = isHypothesisQuiz ? "hypothesis_leads" : "quiz_leads";
    const channel = supabase
      .channel(`${tableName}-realtime-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: `quiz_id=eq.${quizId}`
        },
        (payload) => {
          if (currentPage === 1 && !debouncedSearch && !dateFrom && !dateTo) {
            if (isHypothesisQuiz) {
              const lead = payload.new as HypothesisLead;
              const transformedLead = {
                ...lead,
                result_category: `${Math.round((lead.score / lead.total_questions) * 100)}% correct`,
                openness_score: null,
                answers: null,
              };
              setLeads(prev => [transformedLead, ...prev.slice(0, itemsPerPage - 1)]);
            } else {
              setLeads(prev => [payload.new as QuizLead, ...prev.slice(0, itemsPerPage - 1)]);
            }
          }
          setTotalCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, currentPage, debouncedSearch, dateFrom, dateTo, itemsPerPage, isHypothesisQuiz]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!selectedLead) return;
    const tableName = isHypothesisQuiz ? "hypothesis_leads" : "quiz_leads";
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", selectedLead.id);

      if (error) throw error;

      await logActivity({
        actionType: "DELETE",
        tableName: tableName,
        recordId: selectedLead.id,
        description: `Deleted respondent ${selectedLead.email}`,
      });

      toast({ title: "Deleted", description: "Respondent removed" });
      fetchLeads();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedLead(null);
    }
  };

  const handleEmailClick = (lead: QuizLead) => {
    setDetailLead(lead);
    setDetailDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo;

  const exportToCsv = () => {
    if (leads.length === 0) return;

    const headers = ["#", "Email", "Score", "Total Questions", "Percentage", "Result", "Openness Score", "Language", "Date"];
    const rows = leads.map((lead, index) => [
      (currentPage - 1) * itemsPerPage + index + 1,
      lead.email,
      lead.score,
      lead.total_questions,
      lead.total_questions > 0 ? Math.round((lead.score / lead.total_questions) * 100) + "%" : "0%",
      lead.result_category,
      lead.openness_score || "",
      lead.language || "",
      format(new Date(lead.created_at), "dd MMM yyyy HH:mm"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-respondents-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const getRowNumber = (index: number) => (currentPage - 1) * itemsPerPage + index + 1;

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  if (loading && leads.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
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
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Respondents</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs cursor-help">
                {totalCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Unique / Total</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            disabled={leads.length === 0}
            className="h-7 text-xs gap-1"
          >
            <Download className="w-3 h-3" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLeads}
            disabled={loading}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search email or result..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-7 h-7 text-xs"
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
      </div>

      {/* Date Range */}
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

      {/* Table */}
      {leads.length === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          {hasActiveFilters ? (
            <>
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No respondents match your filters</p>
              <Button variant="link" size="sm" onClick={clearFilters} className="text-xs h-6 mt-1">
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No respondents yet</p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <AdminTable>
            <AdminTableHeader>
              <AdminTableCell header className="w-10">#</AdminTableCell>
              <AdminTableCell header>
                <button 
                  className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("email")}
                >
                  Email <SortIcon field="email" />
                </button>
              </AdminTableCell>
              <AdminTableCell header className="w-24">
                <button 
                  className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("score")}
                >
                  Score <SortIcon field="score" />
                </button>
              </AdminTableCell>
              <AdminTableCell header className="w-16">
                <span className="flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5" /> OM
                </span>
              </AdminTableCell>
              <AdminTableCell header>Result</AdminTableCell>
              <AdminTableCell header align="right" className="w-28">
                <button 
                  className="flex items-center justify-end gap-1 cursor-pointer hover:text-foreground ml-auto"
                  onClick={() => handleSort("created_at")}
                >
                  Date <SortIcon field="created_at" />
                </button>
              </AdminTableCell>
              <AdminTableCell header className="w-10">&nbsp;</AdminTableCell>
            </AdminTableHeader>
            <AdminTableBody>
              {leads.map((lead, index) => {
                return (
                  <AdminTableRow key={lead.id} index={index}>
                    <AdminTableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {getRowNumber(index)}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 flex-shrink-0 bg-secondary">
                          <AvatarFallback className="text-xs bg-secondary text-foreground">
                            {lead.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => handleEmailClick(lead)}
                            className="text-sm text-foreground hover:text-primary hover:underline transition-colors truncate"
                            title={lead.email}
                          >
                            {lead.email}
                          </button>
                          {lead.language && (
                            <Badge variant="secondary" className="uppercase text-xs flex-shrink-0">
                              {lead.language}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="text-sm text-foreground">{lead.score}/{lead.total_questions}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      {lead.openness_score !== null ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {lead.openness_score}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {lead.result_category}
                      </Badge>
                    </AdminTableCell>
                    <AdminTableCell align="right">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), "dd MMM HH:mm")}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell align="right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedLead(lead);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })}
            </AdminTableBody>
          </AdminTable>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="px-2 text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Respondent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLead?.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Respondent Detail Dialog */}
      <RespondentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        lead={detailLead}
        displayLanguage={displayLanguage}
      />
    </div>
  );
}
