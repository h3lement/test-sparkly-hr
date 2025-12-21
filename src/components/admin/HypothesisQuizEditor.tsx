import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Loader2, RefreshCcw } from "lucide-react";
import { HypothesisPageEditor } from "./HypothesisPageEditor";
import { useHypothesisQuizData, type HypothesisPage, type HypothesisQuestion } from "@/hooks/useHypothesisQuizData";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HypothesisQuizEditorProps {
  quizId: string;
  language: string;
}

export function HypothesisQuizEditor({ quizId, language }: HypothesisQuizEditorProps) {
  const { toast } = useToast();
  const {
    pages: savedPages,
    loading,
    error,
    refetch,
    savePage,
    saveQuestion,
    deletePage,
    deleteQuestion,
  } = useHypothesisQuizData(quizId);

  // Local state for editing
  const [pages, setPages] = useState<HypothesisPage[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state with saved data
  useEffect(() => {
    if ((savedPages.length > 0 || !loading) && !hasChanges) {
      setPages(savedPages);
      setHasChanges(false);
    }
  }, [savedPages, loading, hasChanges]);

  // Reload from database (useful after imports/changes made outside the editor)
  const handleReload = async () => {
    if (hasChanges) {
      toast({
        title: "Unsaved changes",
        description: "Save your changes before reloading.",
        variant: "destructive",
      });
      return;
    }

    try {
      await refetch();
      toast({ title: "Reloaded latest quiz data" });
    } catch (err: any) {
      toast({
        title: "Reload failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Auto-refresh while there are no local edits (keeps the editor in sync after imports)
  useEffect(() => {
    if (hasChanges) return;

    const intervalId = window.setInterval(() => {
      refetch();
    }, 15000);

    const onVisibilityChange = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasChanges, refetch]);

  const handleAddPage = () => {
    const newPage: HypothesisPage = {
      id: `new-${Date.now()}`,
      quiz_id: quizId,
      page_number: pages.length + 1,
      title: {},
      description: {},
      questions: [],
    };
    setPages([...pages, newPage]);
    setHasChanges(true);
  };

  const handleUpdatePage = (pageId: string, updates: Partial<HypothesisPage>) => {
    setPages(pages.map(p => 
      p.id === pageId ? { ...p, ...updates } : p
    ));
    setHasChanges(true);
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await deletePage(pageId);
      setPages(pages.filter(p => p.id !== pageId));
      // Renumber remaining pages
      setPages(prev => prev.map((p, i) => ({ ...p, page_number: i + 1 })));
      toast({ title: "Page deleted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleAddQuestion = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const newQuestion: HypothesisQuestion = {
      id: `new-${Date.now()}`,
      page_id: pageId,
      question_order: page.questions.length + 1,
      hypothesis_text: {},
      hypothesis_text_woman: {},
      hypothesis_text_man: {},
      interview_question: {},
      interview_question_woman: {},
      interview_question_man: {},
      truth_explanation: {},
      correct_answer_woman: false,
      correct_answer_man: false,
    };

    setPages(pages.map(p =>
      p.id === pageId
        ? { ...p, questions: [...p.questions, newQuestion] }
        : p
    ));
    setHasChanges(true);
  };

  const handleUpdateQuestion = (
    pageId: string,
    questionId: string,
    updates: Partial<HypothesisQuestion>
  ) => {
    setPages(pages.map(p =>
      p.id === pageId
        ? {
            ...p,
            questions: p.questions.map(q =>
              q.id === questionId ? { ...q, ...updates } : q
            ),
          }
        : p
    ));
    setHasChanges(true);
  };

  const handleDeleteQuestion = async (pageId: string, questionId: string) => {
    try {
      await deleteQuestion(questionId);
      setPages(pages.map(p =>
        p.id === pageId
          ? {
              ...p,
              questions: p.questions
                .filter(q => q.id !== questionId)
                .map((q, i) => ({ ...q, question_order: i + 1 })),
            }
          : p
      ));
      toast({ title: "Hypothesis deleted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save pages and update IDs
      const pageIdMap: Record<string, string> = {};
      
      for (const page of pages) {
        const savedId = await savePage({
          id: page.id,
          page_number: page.page_number,
          title: page.title,
          description: page.description,
        });
        pageIdMap[page.id] = savedId;

        // Save questions for this page
        for (const question of page.questions) {
          await saveQuestion({
            id: question.id,
            page_id: savedId,
            question_order: question.question_order,
            hypothesis_text: question.hypothesis_text,
            interview_question: question.interview_question,
            truth_explanation: question.truth_explanation,
          });
        }
      }

      await refetch();
      setHasChanges(false);
      toast({ title: "All changes saved" });
    } catch (err: any) {
      console.error("Error saving:", err);
      toast({
        title: "Error saving",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate total hypotheses
  const totalHypotheses = pages.reduce((sum, p) => sum + p.questions.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Error loading hypothesis data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Hypothesis Pages</h3>
          <p className="text-sm text-muted-foreground">
            {pages.length} page{pages.length !== 1 ? "s" : ""} • {totalHypotheses} hypothesis{totalHypotheses !== 1 ? "es" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReload} disabled={saving || hasChanges}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reload
          </Button>
          <Button variant="outline" onClick={handleAddPage} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            Add Page
          </Button>
          <Button onClick={handleSaveAll} disabled={saving || !hasChanges}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      {totalHypotheses > 0 && (
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {totalHypotheses} / 50 hypotheses
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min((totalHypotheses / 50) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Pages */}
      {pages.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No pages yet. Create your first page to start adding hypotheses.
          </p>
          <Button onClick={handleAddPage}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Page
          </Button>
        </div>
      ) : (
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {pages
              .sort((a, b) => a.page_number - b.page_number)
              .map((page, index, sortedPages) => {
                const questionsBeforeThisPage = sortedPages
                  .slice(0, index)
                  .reduce((sum, p) => sum + p.questions.length, 0);
                return (
                  <HypothesisPageEditor
                    key={page.id}
                    page={page}
                    pageIndex={index}
                    language={language}
                    questionsBeforeThisPage={questionsBeforeThisPage}
                    onUpdatePage={(updates) => handleUpdatePage(page.id, updates)}
                    onDeletePage={() => handleDeletePage(page.id)}
                    onAddQuestion={() => handleAddQuestion(page.id)}
                    onUpdateQuestion={(qId, updates) => handleUpdateQuestion(page.id, qId, updates)}
                    onDeleteQuestion={(qId) => handleDeleteQuestion(page.id, qId)}
                  />
                );
              })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
