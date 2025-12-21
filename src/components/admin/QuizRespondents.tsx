import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
  ExternalLink,
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

interface QuizRespondentsProps {
  quizId: string;
  displayLanguage: string;
}

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];

export function QuizRespondents({ quizId, displayLanguage }: QuizRespondentsProps) {
  const [leads, setLeads] = useState<QuizLead[]>([]);
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
      // Build count query
      let countQuery = supabase
        .from("quiz_leads")
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", quizId);

      // Build data query
      let dataQuery = supabase
        .from("quiz_leads")
        .select("*")
        .eq("quiz_id", quizId);

      // Apply search filter
      if (debouncedSearch) {
        const searchPattern = `%${debouncedSearch}%`;
        countQuery = countQuery.or(`email.ilike.${searchPattern},result_category.ilike.${searchPattern}`);
        dataQuery = dataQuery.or(`email.ilike.${searchPattern},result_category.ilike.${searchPattern}`);
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
      setLeads(data || []);
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
  }, [quizId, sortField, sortDirection, currentPage, debouncedSearch, dateFrom, dateTo, itemsPerPage, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Real-time subscription for new leads
  useEffect(() => {
    const channel = supabase
      .channel(`quiz-leads-realtime-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quiz_leads',
          filter: `quiz_id=eq.${quizId}`
        },
        (payload) => {
          if (currentPage === 1 && !debouncedSearch && !dateFrom && !dateTo) {
            setLeads(prev => [payload.new as QuizLead, ...prev.slice(0, itemsPerPage - 1)]);
          }
          setTotalCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, currentPage, debouncedSearch, dateFrom, dateTo, itemsPerPage]);

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
    try {
      const { error } = await supabase
        .from("quiz_leads")
        .delete()
        .eq("id", selectedLead.id);

      if (error) throw error;

      await logActivity({
        actionType: "DELETE",
        tableName: "quiz_leads",
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
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
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
          {/* Table Header */}
          <div className="grid grid-cols-[32px_1fr_80px_50px_120px_100px_32px] gap-1 px-2 py-1.5 bg-muted/50 text-[10px] font-medium text-muted-foreground border-b">
            <span>#</span>
            <span 
              className="cursor-pointer hover:text-foreground flex items-center gap-1"
              onClick={() => handleSort("email")}
            >
              Email <SortIcon field="email" />
            </span>
            <span 
              className="text-center cursor-pointer hover:text-foreground flex items-center justify-center gap-1"
              onClick={() => handleSort("score")}
            >
              Score <SortIcon field="score" />
            </span>
            <span className="text-center flex items-center justify-center gap-0.5">
              <Brain className="w-3 h-3" /> OM
            </span>
            <span>Result</span>
            <span 
              className="text-right cursor-pointer hover:text-foreground flex items-center justify-end gap-1"
              onClick={() => handleSort("created_at")}
            >
              Date <SortIcon field="created_at" />
            </span>
            <span></span>
          </div>

          {/* Table Rows */}
          <div className="max-h-[400px] overflow-y-auto">
            {leads.map((lead, index) => {
              const percentage = lead.total_questions > 0 
                ? Math.round((lead.score / lead.total_questions) * 100) 
                : 0;
              return (
                <div
                  key={lead.id}
                  className={`grid grid-cols-[32px_1fr_80px_50px_120px_100px_32px] gap-1 px-2 py-1.5 items-center text-[11px] border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                    index % 2 === 0 ? "bg-background" : "bg-muted/20"
                  }`}
                >
                  {/* Row Number */}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {getRowNumber(index)}
                  </span>

                  {/* Email with Avatar */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar className="w-5 h-5 flex-shrink-0">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {lead.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => handleEmailClick(lead)}
                      className="truncate text-primary hover:underline cursor-pointer flex items-center gap-1 min-w-0"
                      title={lead.email}
                    >
                      <span className="truncate">{lead.email}</span>
                      <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0" />
                    </button>
                    {lead.language && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 flex-shrink-0">
                        {lead.language.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  {/* Score */}
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-medium text-[10px]">{lead.score}/{lead.total_questions}</span>
                    <Progress value={percentage} className="w-8 h-1" />
                  </div>

                  {/* Openness Score */}
                  <div className="text-center">
                    {lead.openness_score !== null ? (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1">
                        {lead.openness_score}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                  </div>

                  {/* Result Category */}
                  <Badge variant="outline" className="text-[9px] truncate justify-start" title={lead.result_category}>
                    {lead.result_category}
                  </Badge>

                  {/* Date */}
                  <div className="text-right text-[10px] text-muted-foreground font-mono">
                    {format(new Date(lead.created_at), "dd MMM HH:mm")}
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive hover:text-destructive"
                    onClick={() => {
                      setSelectedLead(lead);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
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
