import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Download, 
  Search, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  FileText
} from "lucide-react";
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

export function RespondentsList() {
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

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
          .select("id, title, slug"),
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

  const filteredLeads = leads.filter(lead =>
    lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.result_category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Button onClick={downloadCSV} variant="default" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by email or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>
        <span className="px-3 py-1.5 bg-secondary rounded-full text-sm text-foreground font-medium">
          {filteredLeads.length} respondent{filteredLeads.length !== 1 ? "s" : ""}
        </span>
      </div>

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
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Score</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Result</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Openness</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Lang</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Submitted</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.map((lead) => {
                const isExpanded = expandedRow === lead.id;
                const quizQuestions = getQuestionsForQuiz(lead.quiz_id);
                const leadAnswers = parseLeadAnswers(lead.answers);
                const hasAnswers = quizQuestions.length > 0 && Object.keys(leadAnswers).length > 0;

                return (
                  <>
                    <tr 
                      key={lead.id} 
                      className={`hover:bg-secondary/30 transition-colors ${hasAnswers ? 'cursor-pointer' : ''}`}
                      onClick={() => hasAnswers && setExpandedRow(isExpanded ? null : lead.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 bg-secondary">
                            <AvatarFallback className="text-xs bg-secondary text-foreground">
                              {lead.email.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground">{lead.email}</span>
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
                      <td className="px-6 py-4 text-sm text-foreground">
                        {lead.score}/{lead.total_questions}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {lead.result_category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {lead.openness_score !== null ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {lead.openness_score}/4
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="uppercase text-xs">
                          {lead.language || 'en'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
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
                        <td colSpan={7} className="px-6 py-4 bg-secondary/20">
                          <div className="space-y-3">
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
        </div>
      )}
    </div>
  );
}
