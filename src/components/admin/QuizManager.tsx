import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, RefreshCw, Copy, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  questions_count?: number;
  respondents_count?: number;
}

export function QuizManager() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityLogQuiz, setActivityLogQuiz] = useState<Quiz | null>(null);
  const { toast } = useToast();

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
          const [questionsRes, respondentsRes] = await Promise.all([
            supabase
              .from("quiz_questions")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id),
            supabase
              .from("quiz_leads")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id),
          ]);
          return { 
            ...quiz, 
            questions_count: questionsRes.count || 0,
            respondents_count: respondentsRes.count || 0,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredQuizzes = quizzes.filter(quiz =>
    getLocalizedText(quiz.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateQuiz = () => {
    navigate("/admin/quiz/new");
  };

  const handleEditQuiz = (quiz: Quiz) => {
    navigate(`/admin/quiz/${quiz.id}`);
  };

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
          {filteredQuizzes.length} quiz{filteredQuizzes.length !== 1 ? "zes" : ""}
        </span>
      </div>

      {/* Quizzes table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? "No quizzes match your search" : "No quizzes yet. Create your first quiz!"}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="font-semibold">Title</TableHead>
                <TableHead className="font-semibold">Slug</TableHead>
                <TableHead className="font-semibold text-center">Questions</TableHead>
                <TableHead className="font-semibold text-center">Respondents</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold">Updated</TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuizzes.map((quiz) => (
                <TableRow key={quiz.id} className="hover:bg-secondary/30 group">
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => handleEditQuiz(quiz)}
                      className="text-left text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                      title="Edit quiz"
                    >
                      {getLocalizedText(quiz.title) || quiz.slug}
                    </button>
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
                    {formatDate(quiz.updated_at)}
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
              ))}
            </TableBody>
          </Table>
        </div>
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
