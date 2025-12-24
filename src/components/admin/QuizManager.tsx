import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, RefreshCw, Copy, Info, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Rows3, Rows4, RotateCcw, Languages, Loader2 } from "lucide-react";
import { BatchTranslateButton } from "@/components/admin/BatchTranslateButton";
import { formatTimestamp } from "@/lib/utils";
import { withRetry } from "@/hooks/useSupabaseConnection";
import { DataFetchWrapper } from "@/components/admin/DataFetchWrapper";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResizableTableHead } from "@/components/ui/resizable-table-head";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ActivityLogDialog } from "./ActivityLogDialog";
import { logActivity } from "@/hooks/useActivityLog";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import type { Json } from "@/integrations/supabase/types";

interface Quiz {
  id: string;
  slug: string;
  title: Json;
  description: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  quiz_type: string;
  include_open_mindedness?: boolean;
  questions_count?: number;
  pages_count?: number;
  respondents_count?: number;
  unique_respondents_count?: number;
  updated_by_email?: string;
  display_order?: number;
  ai_cost_eur?: number;
  cta_template_id?: string | null;
  cta_template?: {
    id: string;
    name: string | null;
    is_live: boolean;
  } | null;
}

interface CTATemplate {
  id: string;
  name: string | null;
  is_live: boolean;
}

// Sortable Row Component
interface SortableQuizRowProps {
  quiz: Quiz;
  index: number;
  isDragEnabled: boolean;
  compactView: boolean;
  ctaTemplates: CTATemplate[];
  updatingCta: string | null;
  getLocalizedText: (json: Json) => string;
  handleEditQuiz: (quiz: Quiz) => void;
  toggleQuizStatus: (quiz: Quiz) => void;
  duplicateQuiz: (quiz: Quiz) => void;
  deleteQuiz: (quiz: Quiz) => void;
  formatDateTime: (dateString: string, userEmail?: string) => { date: string; user: string | null };
  setActivityLogQuiz: (quiz: Quiz | null) => void;
  handleCtaChange: (quizId: string, ctaId: string | null) => void;
}

function SortableQuizRow({
  quiz,
  index,
  isDragEnabled,
  compactView,
  ctaTemplates,
  updatingCta,
  getLocalizedText,
  handleEditQuiz,
  toggleQuizStatus,
  duplicateQuiz,
  deleteQuiz,
  formatDateTime,
  setActivityLogQuiz,
  handleCtaChange,
}: SortableQuizRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: quiz.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cellPadding = compactView ? "py-1.5 px-2" : "py-3 px-4";
  const isEvenRow = index % 2 === 0;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`list-row-interactive group ${isEvenRow ? "list-row-even" : "list-row-odd"}`}
    >
      {isDragEnabled && (
        <TableCell className={`w-10 ${compactView ? "px-1" : "px-2"}`}>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className={compactView ? "h-3 w-3" : "h-4 w-4"} />
          </button>
        </TableCell>
      )}
      <TableCell className={`font-medium ${cellPadding}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEditQuiz(quiz)}
            className="text-left text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
            title="Edit quiz"
          >
            {getLocalizedText(quiz.title) || quiz.slug}
          </button>
          {quiz.quiz_type === "hypothesis" && (
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 text-primary border-primary/20"
            >
              Hypothesis
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className={`text-muted-foreground font-mono ${compactView ? "text-xs" : "text-sm"} ${cellPadding}`}>
        <a
          href={`/${quiz.slug.replace(/^\/+/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary hover:underline transition-colors"
          title="Open public quiz"
        >
          /{quiz.slug.replace(/^\/+/, "")}
        </a>
      </TableCell>
      <TableCell className={`text-right ${cellPadding}`}>
        {quiz.ai_cost_eur && quiz.ai_cost_eur > 0 ? (
          <span className="text-xs text-muted-foreground font-mono">
            €{quiz.ai_cost_eur.toFixed(4)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={`text-center ${cellPadding}`}>
        {quiz.questions_count}
      </TableCell>
      <TableCell className={`text-center ${cellPadding}`}>
        {quiz.quiz_type === "hypothesis" ? (
          <span>
            {quiz.pages_count || 0}
            {quiz.include_open_mindedness && (
              <span className="text-muted-foreground ml-1">+1</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {/* CTA Column */}
      <TableCell className={cellPadding}>
        <Select 
          value={quiz.cta_template?.id || "none"} 
          onValueChange={(val) => handleCtaChange(quiz.id, val === "none" ? null : val)}
          disabled={updatingCta === quiz.id}
        >
          <SelectTrigger className={`${compactView ? "h-7 text-xs" : "h-8 text-xs"}`}>
            {updatingCta === quiz.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <SelectValue placeholder="No CTA" />
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="none">
              <span className="text-muted-foreground">No CTA</span>
            </SelectItem>
            {ctaTemplates.map(cta => (
              <SelectItem key={cta.id} value={cta.id}>
                <span className={quiz.cta_template_id === cta.id ? "font-medium" : ""}>
                  {cta.name || "Untitled"}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className={`text-center ${cellPadding}`}>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          {quiz.unique_respondents_count}/{quiz.respondents_count}
        </Badge>
      </TableCell>
      <TableCell className={`text-center ${cellPadding}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleQuizStatus(quiz)}
          className="px-0 h-auto hover:bg-transparent"
        >
          <Badge 
            variant={quiz.is_active ? "default" : "secondary"}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            {quiz.is_active ? "Active" : "Inactive"}
          </Badge>
        </Button>
      </TableCell>
      <TableCell className={`text-muted-foreground ${cellPadding}`}>
        {(() => {
          const { date, user } = formatDateTime(quiz.updated_at, quiz.updated_by_email);
          return (
            <div className={`flex flex-col ${compactView ? "text-xs" : "text-sm"}`}>
              <span>{date}</span>
              {user && <span className="text-xs text-muted-foreground/70 capitalize">{user}</span>}
            </div>
          );
        })()}
      </TableCell>
      <TableCell className={cellPadding}>
        <div className={`flex items-center justify-center ${compactView ? "gap-0" : "gap-1"}`}>
          <Button
            variant="ghost"
            size={compactView ? "sm" : "icon"}
            className={compactView ? "h-7 w-7 p-0" : ""}
            onClick={() => setActivityLogQuiz(quiz)}
            title="Activity log"
          >
            <Info className={compactView ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
          <Button
            variant="ghost"
            size={compactView ? "sm" : "icon"}
            className={compactView ? "h-7 w-7 p-0" : ""}
            onClick={() => duplicateQuiz(quiz)}
            title="Duplicate quiz"
          >
            <Copy className={compactView ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size={compactView ? "sm" : "icon"}
                className={`text-destructive hover:text-destructive ${compactView ? "h-7 w-7 p-0" : ""}`}
                title="Delete quiz"
              >
                <Trash2 className={compactView ? "h-3 w-3" : "h-4 w-4"} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{getLocalizedText(quiz.title)}"? 
                  This will also delete all questions, answers, and result levels. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteQuiz(quiz)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function QuizManager() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [ctaTemplates, setCtaTemplates] = useState<CTATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityLogQuiz, setActivityLogQuiz] = useState<Quiz | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("display_order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [compactView, setCompactView] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0, currentQuiz: "" });
  const [updatingCta, setUpdatingCta] = useState<string | null>(null);
  const { toast } = useToast();

  // Default column widths
  const defaultColumnWidths = {
    title: 200,
    slug: 150,
    ai_cost: 80,
    questions: 90,
    pages: 70,
    cta: 120,
    respondents: 110,
    status: 90,
    updated: 130,
    actions: 100,
  };

  // Resizable columns with user preference storage
  const { columnWidths, handleMouseDown, resetWidths } = useResizableColumns({
    defaultWidths: defaultColumnWidths,
    storageKey: "quiz_manager_column_widths",
    minWidth: 50,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      // Fetch all CTA templates
      const { data: ctaData } = await supabase
        .from("cta_templates")
        .select("id, name, is_live")
        .order("created_at", { ascending: false });
      
      setCtaTemplates(ctaData || []);

      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("*")
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      // Get question and respondent counts for each quiz
      const quizzesWithCounts = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
          const isHypothesis = quiz.quiz_type === "hypothesis";
          
          let questionsCount = 0;
          let pagesCount = 0;
          
          if (isHypothesis) {
            // Get hypothesis pages for this quiz
            const { data: pages } = await supabase
              .from("hypothesis_pages")
              .select("id")
              .eq("quiz_id", quiz.id);
            
            pagesCount = pages?.length || 0;
            
            if (pages && pages.length > 0) {
              const pageIds = pages.map(p => p.id);
              const { count } = await supabase
                .from("hypothesis_questions")
                .select("*", { count: "exact", head: true })
                .in("page_id", pageIds);
              questionsCount = count || 0;
            }
          } else {
            // For standard/emotional quizzes, count only non-OM questions
            const { count } = await supabase
              .from("quiz_questions")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id)
              .neq("question_type", "open_mindedness");
            questionsCount = count || 0;
          }
          
          // Get respondents - use hypothesis_leads for hypothesis quizzes
          const respondentsTable = isHypothesis ? "hypothesis_leads" : "quiz_leads";
          const [{ count: respondentsCount }, { data: respondentsData }] = await Promise.all([
            supabase
              .from(respondentsTable)
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id),
            supabase
              .from(respondentsTable)
              .select("email")
              .eq("quiz_id", quiz.id)
              .limit(5000),  // Increased limit for unique counting
          ]);
          
          // Count unique emails (case-insensitive)
          const uniqueEmails = new Set(respondentsData?.map(r => r.email.toLowerCase()) || []);
          const uniqueRespondentsCount = uniqueEmails.size;
          
          // Get last editor from activity logs
          const { data: lastActivity } = await supabase
            .from("activity_logs")
            .select("user_email, created_at")
            .eq("table_name", "quizzes")
            .eq("record_id", quiz.id)
            .order("created_at", { ascending: false })
            .limit(1);
          
          // Get AI costs from quiz_result_versions and email_templates
          const [{ data: versionCosts }, { data: templateCosts }] = await Promise.all([
            supabase
              .from("quiz_result_versions")
              .select("estimated_cost_eur")
              .eq("quiz_id", quiz.id),
            supabase
              .from("email_templates")
              .select("estimated_cost_eur")
              .eq("quiz_id", quiz.id),
          ]);
          
          // Get translation cost from quiz.translation_meta (stored in USD, convert to EUR ~0.92)
          const translationMeta = quiz.translation_meta as { total_cost_usd?: number } | null;
          const translationCostUsd = translationMeta?.total_cost_usd || 0;
          const translationCostEur = translationCostUsd * 0.92; // USD to EUR conversion
          
          const totalAiCost = 
            (versionCosts || []).reduce((sum, v) => sum + (Number(v.estimated_cost_eur) || 0), 0) +
            (templateCosts || []).reduce((sum, t) => sum + (Number(t.estimated_cost_eur) || 0), 0) +
            translationCostEur;
          
          // Find CTA template for this quiz using cta_template_id
          const quizCta = quiz.cta_template_id 
            ? (ctaData || []).find(c => c.id === quiz.cta_template_id)
            : null;
          
          return { 
            ...quiz, 
            questions_count: questionsCount,
            pages_count: pagesCount,
            respondents_count: respondentsCount || 0,
            unique_respondents_count: uniqueRespondentsCount,
            updated_by_email: lastActivity?.[0]?.user_email || null,
            ai_cost_eur: totalAiCost,
            cta_template: quizCta ? { id: quizCta.id, name: quizCta.name, is_live: quizCta.is_live } : null,
          };
        })
      );

      setQuizzes(quizzesWithCounts);
    } catch (error: any) {
      console.error("Error fetching quizzes:", error);
      toast({
        title: "Error",
        description: "Failed to fetch quizzes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleQuizStatus = async (quiz: Quiz) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_active: !quiz.is_active })
        .eq("id", quiz.id);

      if (error) throw error;

      // Log the activity
      await logActivity({
        actionType: "STATUS_CHANGE",
        tableName: "quizzes",
        recordId: quiz.id,
        fieldName: "is_active",
        oldValue: quiz.is_active ? "Active" : "Inactive",
        newValue: !quiz.is_active ? "Active" : "Inactive",
        description: `Quiz "${getLocalizedText(quiz.title)}" ${quiz.is_active ? "deactivated" : "activated"}`,
      });

      setQuizzes(quizzes.map(q => 
        q.id === quiz.id ? { ...q, is_active: !q.is_active } : q
      ));

      toast({
        title: quiz.is_active ? "Quiz deactivated" : "Quiz activated",
        description: `"${getLocalizedText(quiz.title)}" is now ${quiz.is_active ? "hidden" : "visible"}`,
      });
    } catch (error: any) {
      console.error("Error toggling quiz status:", error);
      toast({
        title: "Error",
        description: "Failed to update quiz status",
        variant: "destructive",
      });
    }
  };

  const handleCtaChange = async (quizId: string, ctaId: string | null) => {
    setUpdatingCta(quizId);
    try {
      // Update the quiz's cta_template_id
      const { error } = await supabase
        .from("quizzes")
        .update({ cta_template_id: ctaId })
        .eq("id", quizId);

      if (error) throw error;

      // Update local state
      const updatedCta = ctaId ? ctaTemplates.find(c => c.id === ctaId) : null;
      setQuizzes(prev => prev.map(q => 
        q.id === quizId 
          ? { 
              ...q, 
              cta_template_id: ctaId,
              cta_template: updatedCta ? { id: updatedCta.id, name: updatedCta.name, is_live: updatedCta.is_live } : null 
            } 
          : q
      ));

      toast({
        title: ctaId ? "CTA Connected" : "CTA Disconnected",
        description: ctaId 
          ? `CTA "${updatedCta?.name || 'Template'}" attached to quiz`
          : "CTA template detached from quiz",
      });
    } catch (error: any) {
      console.error("Error updating CTA:", error);
      toast({
        title: "Error",
        description: "Failed to update CTA connection",
        variant: "destructive",
      });
    } finally {
      setUpdatingCta(null);
    }
  };

  const deleteQuiz = async (quiz: Quiz) => {
    try {
      // Log the activity before deletion
      await logActivity({
        actionType: "DELETE",
        tableName: "quizzes",
        recordId: quiz.id,
        description: `Quiz "${getLocalizedText(quiz.title)}" deleted`,
      });

      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quiz.id);

      if (error) throw error;

      setQuizzes(quizzes.filter(q => q.id !== quiz.id));
      toast({
        title: "Quiz deleted",
        description: `"${getLocalizedText(quiz.title)}" has been deleted`,
      });
    } catch (error: any) {
      console.error("Error deleting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to delete quiz",
        variant: "destructive",
      });
    }
  };

  const duplicateQuiz = async (quiz: Quiz) => {
    try {
      // Create new quiz with copied data
      const newSlug = `${quiz.slug}-copy-${Date.now()}`;
      const { data: newQuiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          slug: newSlug,
          title: quiz.title,
          description: quiz.description,
          headline: (quiz as any).headline || {},
          headline_highlight: (quiz as any).headline_highlight || {},
          badge_text: (quiz as any).badge_text || {},
          cta_text: (quiz as any).cta_text || {},
          cta_url: (quiz as any).cta_url,
          duration_text: (quiz as any).duration_text || {},
          discover_items: (quiz as any).discover_items || [],
          is_active: false,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Copy questions
      const { data: questions, error: questionsError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id);

      if (questionsError) throw questionsError;

      for (const question of questions || []) {
        const { data: newQuestion, error: newQuestionError } = await supabase
          .from("quiz_questions")
          .insert({
            quiz_id: newQuiz.id,
            question_text: question.question_text,
            question_order: question.question_order,
            question_type: question.question_type,
          })
          .select()
          .single();

        if (newQuestionError) throw newQuestionError;

        // Copy answers for this question
        const { data: answers, error: answersError } = await supabase
          .from("quiz_answers")
          .select("*")
          .eq("question_id", question.id);

        if (answersError) throw answersError;

        if (answers && answers.length > 0) {
          await supabase.from("quiz_answers").insert(
            answers.map(a => ({
              question_id: newQuestion.id,
              answer_text: a.answer_text,
              answer_order: a.answer_order,
              score_value: a.score_value,
            }))
          );
        }
      }

      // Copy result levels
      const { data: resultLevels, error: levelsError } = await supabase
        .from("quiz_result_levels")
        .select("*")
        .eq("quiz_id", quiz.id);

      if (levelsError) throw levelsError;

      if (resultLevels && resultLevels.length > 0) {
        await supabase.from("quiz_result_levels").insert(
          resultLevels.map(r => ({
            quiz_id: newQuiz.id,
            min_score: r.min_score,
            max_score: r.max_score,
            title: r.title,
            description: r.description,
            insights: r.insights,
            emoji: r.emoji,
            color_class: r.color_class,
          }))
        );
      }

      toast({
        title: "Quiz duplicated",
        description: `Created copy of "${getLocalizedText(quiz.title)}"`,
      });
      fetchQuizzes();
    } catch (error: any) {
      console.error("Error duplicating quiz:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate quiz",
        variant: "destructive",
      });
    }
  };

  const getLocalizedText = (json: Json, lang: string = "en"): string => {
    if (typeof json === "string") return json;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return (json as Record<string, string>)[lang] || (json as Record<string, string>)["en"] || "";
    }
    return "";
  };

  const formatDateTime = (dateString: string, userEmail?: string | null) => {
    const formatted = formatTimestamp(dateString);
    
    if (userEmail) {
      // Extract name from email (before @)
      const userName = userEmail.split("@")[0].replace(/[._]/g, " ");
      return { date: formatted, user: userName };
    }
    return { date: formatted, user: null };
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="w-3.5 h-3.5 ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1" />;
  };

  const sortedAndFilteredQuizzes = useMemo(() => {
    const filtered = quizzes.filter(quiz =>
      getLocalizedText(quiz.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      
      switch (sortColumn) {
        case "display_order":
          return multiplier * ((a.display_order || 0) - (b.display_order || 0));
        case "title":
          return multiplier * getLocalizedText(a.title).localeCompare(getLocalizedText(b.title));
        case "slug":
          return multiplier * a.slug.localeCompare(b.slug);
        case "ai_cost":
          return multiplier * ((a.ai_cost_eur || 0) - (b.ai_cost_eur || 0));
        case "questions":
          return multiplier * ((a.questions_count || 0) - (b.questions_count || 0));
        case "pages":
          return multiplier * ((a.pages_count || 0) - (b.pages_count || 0));
        case "respondents":
          return multiplier * ((a.respondents_count || 0) - (b.respondents_count || 0));
        case "status":
          return multiplier * ((a.is_active ? 1 : 0) - (b.is_active ? 1 : 0));
        case "updated_at":
          return multiplier * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        default:
          return multiplier * ((a.display_order || 0) - (b.display_order || 0));
      }
    });
  }, [quizzes, searchQuery, sortColumn, sortDirection]);

  // Handle drag end for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = sortedAndFilteredQuizzes.findIndex(q => q.id === active.id);
    const newIndex = sortedAndFilteredQuizzes.findIndex(q => q.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Reorder locally first for instant UI feedback
    const reorderedQuizzes = arrayMove(sortedAndFilteredQuizzes, oldIndex, newIndex);
    
    // Update display_order for all affected quizzes
    const updates = reorderedQuizzes.map((quiz, index) => ({
      id: quiz.id,
      display_order: index + 1,
    }));
    
    // Update local state
    setQuizzes(prev => {
      const updated = [...prev];
      updates.forEach(upd => {
        const idx = updated.findIndex(q => q.id === upd.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], display_order: upd.display_order };
        }
      });
      return updated;
    });
    
    // Persist to database
    try {
      for (const upd of updates) {
        await supabase
          .from("quizzes")
          .update({ display_order: upd.display_order })
          .eq("id", upd.id);
      }
      toast({
        title: "Order updated",
        description: "Quiz order has been saved",
      });
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Failed to save order",
        variant: "destructive",
      });
      fetchQuizzes(); // Revert on error
    }
  };

  const handleCreateQuiz = () => {
    navigate("/admin/quiz/new", { state: { from: "/admin?tab=quizzes" } });
  };

  const handleEditQuiz = (quiz: Quiz) => {
    navigate(`/admin/quiz/${quiz.id}`, { state: { from: "/admin?tab=quizzes" } });
  };

  // Translate all quizzes to all languages
  const translateAllQuizzes = async () => {
    if (translatingAll) return;
    
    const activeQuizzes = quizzes.filter(q => q.is_active);
    if (activeQuizzes.length === 0) {
      toast({
        title: "No active quizzes",
        description: "There are no active quizzes to translate",
        variant: "destructive",
      });
      return;
    }

    setTranslatingAll(true);
    setTranslationProgress({ current: 0, total: activeQuizzes.length, currentQuiz: "" });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < activeQuizzes.length; i++) {
      const quiz = activeQuizzes[i];
      const quizTitle = getLocalizedText(quiz.title) || quiz.slug;
      setTranslationProgress({ current: i + 1, total: activeQuizzes.length, currentQuiz: quizTitle });

      try {
        const { error } = await supabase.functions.invoke("translate-quiz", {
          body: {
            quizId: quiz.id,
            sourceLanguage: "en",
            includeUiText: true,
          },
        });

        if (error) {
          console.error(`Translation error for quiz ${quiz.id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Translation failed for quiz ${quiz.id}:`, err);
        errorCount++;
      }
    }

    setTranslatingAll(false);
    setTranslationProgress({ current: 0, total: 0, currentQuiz: "" });

    toast({
      title: "Translation complete",
      description: `Translated ${successCount} quizzes successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    // Refresh to show updated translation costs
    fetchQuizzes();
  };

  // Check if drag is enabled (only when sorting by display_order)
  const isDragEnabled = sortColumn === "display_order" && !searchQuery;

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quizzes</h1>
          <p className="text-muted-foreground mt-1">Manage your quizzes and their content</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchQuizzes} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <BatchTranslateButton onComplete={fetchQuizzes} />
          <Button 
            onClick={translateAllQuizzes} 
            variant="outline" 
            size="sm" 
            disabled={translatingAll || loading}
            title="Quick translate all active quizzes to all languages"
          >
            {translatingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Languages className="w-4 h-4 mr-2" />
            )}
            Quick Translate
          </Button>
          <Button onClick={handleCreateQuiz} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Quiz
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCompactView(!compactView)}
          title={compactView ? "Switch to normal view" : "Switch to compact view"}
          className="gap-1.5"
        >
          {compactView ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
          <span className="hidden sm:inline">{compactView ? "Normal" : "Compact"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetWidths}
          title="Reset column widths"
          className="gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reset Cols</span>
        </Button>
        <Button
          variant={isDragEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (!isDragEnabled) {
              setSortColumn("display_order");
              setSortDirection("asc");
              setSearchQuery("");
            }
          }}
          title={isDragEnabled ? "Drag mode active - drag rows to reorder" : "Enable drag-and-drop reordering"}
          className="gap-1.5"
        >
          <GripVertical className="h-4 w-4" />
          <span className="hidden sm:inline">Reorder</span>
        </Button>
        <span className="px-3 py-1.5 bg-secondary rounded-full text-sm text-foreground font-medium whitespace-nowrap">
          {sortedAndFilteredQuizzes.length} quiz{sortedAndFilteredQuizzes.length !== 1 ? "zes" : ""}
        </span>
      </div>

      {/* Translation progress */}
      {translatingAll && (
        <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Translating: {translationProgress.currentQuiz}
            </span>
            <span className="text-sm text-muted-foreground">
              {translationProgress.current} / {translationProgress.total}
            </span>
          </div>
          <Progress value={(translationProgress.current / translationProgress.total) * 100} className="h-2" />
        </div>
      )}

      {/* Quizzes table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sortedAndFilteredQuizzes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? "No quizzes match your search" : "No quizzes yet. Create your first quiz!"}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  {isDragEnabled && (
                    <TableHead className="w-10"></TableHead>
                  )}
                  <ResizableTableHead 
                    columnKey="title"
                    width={columnWidths.title}
                    onResizeStart={handleMouseDown}
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("title")}
                  >
                    <span className="flex items-center">Title <SortIcon column="title" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="slug"
                    width={columnWidths.slug}
                    onResizeStart={handleMouseDown}
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("slug")}
                  >
                    <span className="flex items-center">Slug <SortIcon column="slug" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="ai_cost"
                    width={columnWidths.ai_cost}
                    onResizeStart={handleMouseDown}
                    className="font-semibold text-right cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("ai_cost")}
                  >
                    <span className="flex items-center justify-end">AI € <SortIcon column="ai_cost" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="questions"
                    width={columnWidths.questions}
                    onResizeStart={handleMouseDown}
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("questions")}
                  >
                    <span className="flex items-center justify-center">Questions <SortIcon column="questions" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="pages"
                    width={columnWidths.pages}
                    onResizeStart={handleMouseDown}
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("pages")}
                  >
                    <span className="flex items-center justify-center">Pages <SortIcon column="pages" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="cta"
                    width={columnWidths.cta}
                    onResizeStart={handleMouseDown}
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                  >
                    <span className="flex items-center">CTA</span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="respondents"
                    width={columnWidths.respondents}
                    onResizeStart={handleMouseDown}
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("respondents")}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center justify-center cursor-help">Respondents <SortIcon column="respondents" /></span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Unique / Total</p>
                      </TooltipContent>
                    </Tooltip>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="status"
                    width={columnWidths.status}
                    onResizeStart={handleMouseDown}
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("status")}
                  >
                    <span className="flex items-center justify-center">Status <SortIcon column="status" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="updated"
                    width={columnWidths.updated}
                    onResizeStart={handleMouseDown}
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("updated_at")}
                  >
                    <span className="flex items-center">Updated <SortIcon column="updated_at" /></span>
                  </ResizableTableHead>
                  <ResizableTableHead 
                    columnKey="actions"
                    width={columnWidths.actions}
                    onResizeStart={handleMouseDown}
                    resizable={false}
                    className="font-semibold text-center"
                  >
                    Actions
                  </ResizableTableHead>
                </TableRow>
              </TableHeader>
              <SortableContext
                items={sortedAndFilteredQuizzes.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {sortedAndFilteredQuizzes.map((quiz, index) => (
                    <SortableQuizRow
                      key={quiz.id}
                      quiz={quiz}
                      index={index}
                      isDragEnabled={isDragEnabled}
                      compactView={compactView}
                      ctaTemplates={ctaTemplates}
                      updatingCta={updatingCta}
                      getLocalizedText={getLocalizedText}
                      handleEditQuiz={handleEditQuiz}
                      toggleQuizStatus={toggleQuizStatus}
                      duplicateQuiz={duplicateQuiz}
                      deleteQuiz={deleteQuiz}
                      formatDateTime={formatDateTime}
                      setActivityLogQuiz={setActivityLogQuiz}
                      handleCtaChange={handleCtaChange}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </div>
        </DndContext>
      )}

      <ActivityLogDialog
        open={!!activityLogQuiz}
        onClose={() => setActivityLogQuiz(null)}
        tableName="quizzes"
        recordId={activityLogQuiz?.id || ""}
        recordTitle={activityLogQuiz ? getLocalizedText(activityLogQuiz.title) : undefined}
      />
    </div>
  );
}
