import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Search,
  Users,
  Mail,
  Calendar,
  Brain
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { logActivity } from "@/hooks/useActivityLog";
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
}

interface QuizRespondentsProps {
  quizId: string;
  displayLanguage: string;
}

const ITEMS_PER_PAGE = 20;

export function QuizRespondents({ quizId, displayLanguage }: QuizRespondentsProps) {
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "score" | "email">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<QuizLead | null>(null);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from("quiz_leads")
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", quizId);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get paginated data
      let query = supabase
        .from("quiz_leads")
        .select("*")
        .eq("quiz_id", quizId)
        .order(sortField, { ascending: sortDirection === "asc" })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (searchQuery) {
        query = query.ilike("email", `%${searchQuery}%`);
      }

      const { data, error } = await query;
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
  }, [quizId, sortField, sortDirection, currentPage, searchQuery, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

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

  const exportToCsv = () => {
    if (leads.length === 0) return;

    const headers = ["Email", "Score", "Total Questions", "Result", "Openness Score", "Language", "Date"];
    const rows = leads.map((lead) => [
      lead.email,
      lead.score,
      lead.total_questions,
      lead.result_category,
      lead.openness_score || "",
      lead.language || "",
      new Date(lead.created_at).toLocaleDateString(),
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No respondents yet</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th
                  className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center gap-1">
                    Email <SortIcon field="email" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-center font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort("score")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Score <SortIcon field="score" />
                  </div>
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Brain className="w-3 h-3" /> OM
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-medium">Result</th>
                <th
                  className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Date <SortIcon field="created_at" />
                  </div>
                </th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((lead) => {
                const percentage = lead.total_questions > 0 
                  ? Math.round((lead.score / lead.total_questions) * 100) 
                  : 0;
                return (
                  <tr key={lead.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px]">
                            {lead.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[180px]">{lead.email}</span>
                        {lead.language && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {lead.language.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">{lead.score}/{lead.total_questions}</span>
                        <Progress value={percentage} className="w-12 h-1.5" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {lead.openness_score !== null ? (
                        <Badge variant="secondary" className="text-xs">
                          {lead.openness_score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                        {lead.result_category}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          setSelectedLead(lead);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
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
    </div>
  );
}
