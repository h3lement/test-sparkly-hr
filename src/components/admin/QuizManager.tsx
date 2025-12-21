import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, RefreshCw, Copy, Info, ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { ActivityLogDialog } from "./ActivityLogDialog";
import { logActivity } from "@/hooks/useActivityLog";
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
  updated_by_email?: string;
  display_order?: number;
}

// Sortable Row Component
interface SortableQuizRowProps {
  quiz: Quiz;
  isDragEnabled: boolean;
  getLocalizedText: (json: Json) => string;
  handleEditQuiz: (quiz: Quiz) => void;
  toggleQuizStatus: (quiz: Quiz) => void;
  duplicateQuiz: (quiz: Quiz) => void;
  deleteQuiz: (quiz: Quiz) => void;
  formatDateTime: (dateString: string, userEmail?: string) => { date: string; user: string | null };
  setActivityLogQuiz: (quiz: Quiz | null) => void;
}

function SortableQuizRow({
  quiz,
  isDragEnabled,
  getLocalizedText,
  handleEditQuiz,
  toggleQuizStatus,
  duplicateQuiz,
  deleteQuiz,
  formatDateTime,
  setActivityLogQuiz,
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

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="hover:bg-secondary/30 group"
    >
      {isDragEnabled && (
        <TableCell className="w-10 px-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TableCell>
      )}
      <TableCell className="font-medium">
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
      <TableCell className="text-muted-foreground font-mono text-sm">
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
      <TableCell className="text-center">
        {quiz.questions_count}
      </TableCell>
      <TableCell className="text-center">
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
      <TableCell className="text-center">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          {quiz.respondents_count}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
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
      <TableCell className="text-muted-foreground">
        {(() => {
          const { date, user } = formatDateTime(quiz.updated_at, quiz.updated_by_email);
          return (
            <div className="flex flex-col text-sm">
              <span>{date}</span>
              {user && <span className="text-xs text-muted-foreground/70 capitalize">{user}</span>}
            </div>
          );
        })()}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActivityLogQuiz(quiz)}
            title="Activity log"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => duplicateQuiz(quiz)}
            title="Duplicate quiz"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                title="Delete quiz"
              >
                <Trash2 className="h-4 w-4" />
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityLogQuiz, setActivityLogQuiz] = useState<Quiz | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("display_order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

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
          const { count: respondentsCount } = await supabase
            .from(respondentsTable)
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id);
          
          // Get last editor from activity logs
          const { data: lastActivity } = await supabase
            .from("activity_logs")
            .select("user_email, created_at")
            .eq("table_name", "quizzes")
            .eq("record_id", quiz.id)
            .order("created_at", { ascending: false })
            .limit(1);
          
          return { 
            ...quiz, 
            questions_count: questionsCount,
            pages_count: pagesCount,
            respondents_count: respondentsCount || 0,
            updated_by_email: lastActivity?.[0]?.user_email || null,
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
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    
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

  // Check if drag is enabled (only when sorting by display_order)
  const isDragEnabled = sortColumn === "display_order" && !searchQuery;

  return (
    <div className="max-w-6xl">
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
          <Button onClick={handleCreateQuiz} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Quiz
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>
        <span className="px-3 py-1.5 bg-secondary rounded-full text-sm text-foreground font-medium">
          {sortedAndFilteredQuizzes.length} quiz{sortedAndFilteredQuizzes.length !== 1 ? "zes" : ""}
        </span>
      </div>

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
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  {isDragEnabled && (
                    <TableHead className="w-10"></TableHead>
                  )}
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("title")}
                  >
                    <span className="flex items-center">Title <SortIcon column="title" /></span>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("slug")}
                  >
                    <span className="flex items-center">Slug <SortIcon column="slug" /></span>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("questions")}
                  >
                    <span className="flex items-center justify-center">Questions <SortIcon column="questions" /></span>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("pages")}
                  >
                    <span className="flex items-center justify-center">Pages <SortIcon column="pages" /></span>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("respondents")}
                  >
                    <span className="flex items-center justify-center">Respondents <SortIcon column="respondents" /></span>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-center cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("status")}
                  >
                    <span className="flex items-center justify-center">Status <SortIcon column="status" /></span>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-secondary/80 select-none"
                    onClick={() => handleSort("updated_at")}
                  >
                    <span className="flex items-center">Updated <SortIcon column="updated_at" /></span>
                  </TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext
                items={sortedAndFilteredQuizzes.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {sortedAndFilteredQuizzes.map((quiz) => (
                    <SortableQuizRow
                      key={quiz.id}
                      quiz={quiz}
                      isDragEnabled={isDragEnabled}
                      getLocalizedText={getLocalizedText}
                      handleEditQuiz={handleEditQuiz}
                      toggleQuizStatus={toggleQuizStatus}
                      duplicateQuiz={duplicateQuiz}
                      deleteQuiz={deleteQuiz}
                      formatDateTime={formatDateTime}
                      setActivityLogQuiz={setActivityLogQuiz}
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
