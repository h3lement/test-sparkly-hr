import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logActivity } from "@/hooks/useActivityLog";
import type { Json } from "@/integrations/supabase/types";

interface Quiz {
  id: string;
  slug: string;
  title: Json;
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

interface Question {
  id: string;
  question_text: Json;
  question_order: number;
  question_type: string;
  answers: Answer[];
}

interface Answer {
  id: string;
  answer_text: Json;
  answer_order: number;
  score_value: number;
}

interface ResultLevel {
  id: string;
  min_score: number;
  max_score: number;
  title: Json;
  description: Json;
  insights: Json;
  emoji: string;
  color_class: string;
}

interface QuizEditorDialogProps {
  open: boolean;
  onClose: () => void;
  quiz: Quiz | null;
  isCreating: boolean;
  onSaved: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hr", label: "Croatian" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "sl", label: "Slovenian" },
];

export function QuizEditorDialog({
  open,
  onClose,
  quiz,
  isCreating,
  onSaved,
}: QuizEditorDialogProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const { toast } = useToast();

  // Quiz details state
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState<Record<string, string>>({});
  const [description, setDescription] = useState<Record<string, string>>({});
  const [headline, setHeadline] = useState<Record<string, string>>({});
  const [headlineHighlight, setHeadlineHighlight] = useState<Record<string, string>>({});
  const [badgeText, setBadgeText] = useState<Record<string, string>>({});
  const [ctaText, setCtaText] = useState<Record<string, string>>({});
  const [ctaUrl, setCtaUrl] = useState("");
  const [durationText, setDurationText] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);

  // Result levels state
  const [resultLevels, setResultLevels] = useState<ResultLevel[]>([]);

  useEffect(() => {
    if (open) {
      if (quiz && !isCreating) {
        loadQuizData(quiz);
      } else {
        resetForm();
      }
    }
  }, [open, quiz, isCreating]);

  const resetForm = () => {
    setSlug("");
    setTitle({});
    setDescription({});
    setHeadline({});
    setHeadlineHighlight({});
    setBadgeText({});
    setCtaText({});
    setCtaUrl("https://sparkly.hr");
    setDurationText({});
    setIsActive(true);
    setQuestions([]);
    setResultLevels([]);
    setActiveTab("details");
    setCurrentLang("en");
  };

  const loadQuizData = async (quiz: Quiz) => {
    setSlug(quiz.slug);
    setTitle(jsonToRecord(quiz.title));
    setDescription(jsonToRecord(quiz.description));
    setHeadline(jsonToRecord(quiz.headline));
    setHeadlineHighlight(jsonToRecord(quiz.headline_highlight));
    setBadgeText(jsonToRecord(quiz.badge_text));
    setCtaText(jsonToRecord(quiz.cta_text));
    setCtaUrl(quiz.cta_url || "https://sparkly.hr");
    setDurationText(jsonToRecord(quiz.duration_text));
    setIsActive(quiz.is_active);

    // Load questions with answers
    const { data: questionsData, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("question_order");

    if (questionsError) {
      console.error("Error loading questions:", questionsError);
      return;
    }

    const questionsWithAnswers: Question[] = [];
    for (const q of questionsData || []) {
      const { data: answersData } = await supabase
        .from("quiz_answers")
        .select("*")
        .eq("question_id", q.id)
        .order("answer_order");

      questionsWithAnswers.push({
        id: q.id,
        question_text: q.question_text,
        question_order: q.question_order,
        question_type: q.question_type,
        answers: (answersData || []).map(a => ({
          id: a.id,
          answer_text: a.answer_text,
          answer_order: a.answer_order,
          score_value: a.score_value,
        })),
      });
    }
    setQuestions(questionsWithAnswers);

    // Load result levels
    const { data: levelsData } = await supabase
      .from("quiz_result_levels")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("min_score");

    setResultLevels(
      (levelsData || []).map(l => ({
        id: l.id,
        min_score: l.min_score,
        max_score: l.max_score,
        title: l.title,
        description: l.description,
        insights: l.insights,
        emoji: l.emoji || "🌟",
        color_class: l.color_class || "from-emerald-500 to-green-600",
      }))
    );
  };

  const jsonToRecord = (json: Json | undefined): Record<string, string> => {
    if (!json) return {};
    if (typeof json === "string") return { en: json };
    if (typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, string>;
    }
    return {};
  };

  const handleSave = async () => {
    if (!slug.trim()) {
      toast({
        title: "Validation Error",
        description: "Quiz slug is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      let quizId = quiz?.id;

      // Save quiz details
      const quizData = {
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title,
        description,
        headline,
        headline_highlight: headlineHighlight,
        badge_text: badgeText,
        cta_text: ctaText,
        cta_url: ctaUrl,
        duration_text: durationText,
        is_active: isActive,
      };

      if (isCreating) {
        const { data, error } = await supabase
          .from("quizzes")
          .insert(quizData)
          .select()
          .single();

        if (error) throw error;
        quizId = data.id;

        // Log quiz creation
        await logActivity({
          actionType: "CREATE",
          tableName: "quizzes",
          recordId: quizId,
          description: `Quiz "${title.en || slug}" created`,
        });
      } else {
        const { error } = await supabase
          .from("quizzes")
          .update(quizData)
          .eq("id", quiz!.id);

        if (error) throw error;

        // Log quiz update
        await logActivity({
          actionType: "UPDATE",
          tableName: "quizzes",
          recordId: quiz!.id,
          description: `Quiz "${title.en || slug}" updated`,
        });
      }

      // Save questions and answers
      for (const question of questions) {
        let questionId = question.id;

        if (question.id.startsWith("new-")) {
          // Create new question
          const { data, error } = await supabase
            .from("quiz_questions")
            .insert({
              quiz_id: quizId,
              question_text: question.question_text,
              question_order: question.question_order,
              question_type: question.question_type,
            })
            .select()
            .single();

          if (error) throw error;
          questionId = data.id;
        } else {
          // Update existing question
          const { error } = await supabase
            .from("quiz_questions")
            .update({
              question_text: question.question_text,
              question_order: question.question_order,
              question_type: question.question_type,
            })
            .eq("id", question.id);

          if (error) throw error;
        }

        // Save answers
        for (const answer of question.answers) {
          if (answer.id.startsWith("new-")) {
            const { error } = await supabase.from("quiz_answers").insert({
              question_id: questionId,
              answer_text: answer.answer_text,
              answer_order: answer.answer_order,
              score_value: answer.score_value,
            });
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("quiz_answers")
              .update({
                answer_text: answer.answer_text,
                answer_order: answer.answer_order,
                score_value: answer.score_value,
              })
              .eq("id", answer.id);
            if (error) throw error;
          }
        }
      }

      // Save result levels
      for (const level of resultLevels) {
        if (level.id.startsWith("new-")) {
          const { error } = await supabase.from("quiz_result_levels").insert({
            quiz_id: quizId,
            min_score: level.min_score,
            max_score: level.max_score,
            title: level.title,
            description: level.description,
            insights: level.insights,
            emoji: level.emoji,
            color_class: level.color_class,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("quiz_result_levels")
            .update({
              min_score: level.min_score,
              max_score: level.max_score,
              title: level.title,
              description: level.description,
              insights: level.insights,
              emoji: level.emoji,
              color_class: level.color_class,
            })
            .eq("id", level.id);
          if (error) throw error;
        }
      }

      toast({
        title: "Quiz saved",
        description: isCreating ? "New quiz created successfully" : "Quiz updated successfully",
      });
      onSaved();
    } catch (error: any) {
      console.error("Error saving quiz:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save quiz",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Question management
  const addQuestion = () => {
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      question_text: {},
      question_order: questions.length + 1,
      question_type: "single_choice",
      answers: [],
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const deleteQuestion = async (index: number) => {
    const question = questions[index];
    if (!question.id.startsWith("new-")) {
      await supabase.from("quiz_questions").delete().eq("id", question.id);
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Answer management
  const addAnswer = (questionIndex: number) => {
    const question = questions[questionIndex];
    const newAnswer: Answer = {
      id: `new-${Date.now()}`,
      answer_text: {},
      answer_order: question.answers.length + 1,
      score_value: question.answers.length + 1,
    };
    updateQuestion(questionIndex, {
      answers: [...question.answers, newAnswer],
    });
  };

  const updateAnswer = (
    questionIndex: number,
    answerIndex: number,
    updates: Partial<Answer>
  ) => {
    const question = questions[questionIndex];
    const updatedAnswers = [...question.answers];
    updatedAnswers[answerIndex] = { ...updatedAnswers[answerIndex], ...updates };
    updateQuestion(questionIndex, { answers: updatedAnswers });
  };

  const deleteAnswer = async (questionIndex: number, answerIndex: number) => {
    const question = questions[questionIndex];
    const answer = question.answers[answerIndex];
    if (!answer.id.startsWith("new-")) {
      await supabase.from("quiz_answers").delete().eq("id", answer.id);
    }
    updateQuestion(questionIndex, {
      answers: question.answers.filter((_, i) => i !== answerIndex),
    });
  };

  // Result level management
  const addResultLevel = () => {
    const newLevel: ResultLevel = {
      id: `new-${Date.now()}`,
      min_score: 0,
      max_score: 10,
      title: {},
      description: {},
      insights: [],
      emoji: "🌟",
      color_class: "from-emerald-500 to-green-600",
    };
    setResultLevels([...resultLevels, newLevel]);
  };

  const updateResultLevel = (index: number, updates: Partial<ResultLevel>) => {
    const updated = [...resultLevels];
    updated[index] = { ...updated[index], ...updates };
    setResultLevels(updated);
  };

  const deleteResultLevel = async (index: number) => {
    const level = resultLevels[index];
    if (!level.id.startsWith("new-")) {
      await supabase.from("quiz_result_levels").delete().eq("id", level.id);
    }
    setResultLevels(resultLevels.filter((_, i) => i !== index));
  };

  const getLocalizedValue = (obj: Json | Record<string, string>, lang: string): string => {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, string>)[lang] || "";
    }
    return "";
  };

  const setLocalizedValue = (
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    lang: string,
    value: string
  ) => {
    setter(prev => ({ ...prev, [lang]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "Create New Quiz" : `Edit Quiz: ${getLocalizedValue(title, "en") || slug}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b pb-4">
          <Label className="text-sm font-medium">Language:</Label>
          <div className="flex gap-1">
            {LANGUAGES.map(lang => (
              <Button
                key={lang.code}
                variant={currentLang === lang.code ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentLang(lang.code)}
              >
                {lang.code.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="results">Results ({resultLevels.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="details" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slug">Slug (URL path)</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="employee-performance"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Active</Label>
                </div>
              </div>

              <div>
                <Label>Title ({currentLang.toUpperCase()})</Label>
                <Input
                  value={title[currentLang] || ""}
                  onChange={(e) => setLocalizedValue(setTitle, currentLang, e.target.value)}
                  placeholder="Quiz title"
                />
              </div>

              <div>
                <Label>Headline ({currentLang.toUpperCase()})</Label>
                <Input
                  value={headline[currentLang] || ""}
                  onChange={(e) => setLocalizedValue(setHeadline, currentLang, e.target.value)}
                  placeholder="Discover your"
                />
              </div>

              <div>
                <Label>Headline Highlight ({currentLang.toUpperCase()})</Label>
                <Input
                  value={headlineHighlight[currentLang] || ""}
                  onChange={(e) => setLocalizedValue(setHeadlineHighlight, currentLang, e.target.value)}
                  placeholder="team's potential"
                />
              </div>

              <div>
                <Label>Description ({currentLang.toUpperCase()})</Label>
                <Textarea
                  value={description[currentLang] || ""}
                  onChange={(e) => setLocalizedValue(setDescription, currentLang, e.target.value)}
                  placeholder="Quiz description"
                  rows={3}
                />
              </div>

              <div>
                <Label>Badge Text ({currentLang.toUpperCase()})</Label>
                <Input
                  value={badgeText[currentLang] || ""}
                  onChange={(e) => setLocalizedValue(setBadgeText, currentLang, e.target.value)}
                  placeholder="Free Assessment"
                />
              </div>

              <div>
                <Label>Duration Text ({currentLang.toUpperCase()})</Label>
                <Input
                  value={durationText[currentLang] || ""}
                  onChange={(e) => setLocalizedValue(setDurationText, currentLang, e.target.value)}
                  placeholder="Takes only 2 minutes"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CTA Text ({currentLang.toUpperCase()})</Label>
                  <Input
                    value={ctaText[currentLang] || ""}
                    onChange={(e) => setLocalizedValue(setCtaText, currentLang, e.target.value)}
                    placeholder="Start Quiz"
                  />
                </div>
                <div>
                  <Label>CTA URL</Label>
                  <Input
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://sparkly.hr"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="mt-4 space-y-4">
              <Button onClick={addQuestion} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>

              <Accordion type="multiple" className="space-y-2">
                {questions.map((question, qIndex) => (
                  <AccordionItem
                    key={question.id}
                    value={question.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-muted-foreground">Q{qIndex + 1}.</span>
                        <span className="truncate max-w-md">
                          {getLocalizedValue(question.question_text, currentLang) || "New Question"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({question.answers.length} answers)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label>Question Text ({currentLang.toUpperCase()})</Label>
                        <Textarea
                          value={getLocalizedValue(question.question_text, currentLang)}
                          onChange={(e) => {
                            const updated = { ...jsonToRecord(question.question_text), [currentLang]: e.target.value };
                            updateQuestion(qIndex, { question_text: updated });
                          }}
                          placeholder="Enter question"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Answers</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addAnswer(qIndex)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Answer
                          </Button>
                        </div>

                        {question.answers.map((answer, aIndex) => (
                          <div
                            key={answer.id}
                            className="flex items-start gap-2 p-3 bg-secondary/50 rounded-lg"
                          >
                            <span className="text-sm text-muted-foreground mt-2">
                              {aIndex + 1}.
                            </span>
                            <div className="flex-1 space-y-2">
                              <Input
                                value={getLocalizedValue(answer.answer_text, currentLang)}
                                onChange={(e) => {
                                  const updated = { ...jsonToRecord(answer.answer_text), [currentLang]: e.target.value };
                                  updateAnswer(qIndex, aIndex, { answer_text: updated });
                                }}
                                placeholder="Answer text"
                              />
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Score:</Label>
                                <Input
                                  type="number"
                                  value={answer.score_value}
                                  onChange={(e) =>
                                    updateAnswer(qIndex, aIndex, {
                                      score_value: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20"
                                />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteAnswer(qIndex, aIndex)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteQuestion(qIndex)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Question
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            <TabsContent value="results" className="mt-4 space-y-4">
              <Button onClick={addResultLevel} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Result Level
              </Button>

              {resultLevels.map((level, index) => (
                <div
                  key={level.id}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {level.emoji} {getLocalizedValue(level.title, currentLang) || `Level ${index + 1}`}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteResultLevel(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Min Score</Label>
                      <Input
                        type="number"
                        value={level.min_score}
                        onChange={(e) =>
                          updateResultLevel(index, {
                            min_score: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Max Score</Label>
                      <Input
                        type="number"
                        value={level.max_score}
                        onChange={(e) =>
                          updateResultLevel(index, {
                            max_score: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Emoji</Label>
                      <Input
                        value={level.emoji}
                        onChange={(e) =>
                          updateResultLevel(index, { emoji: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Title ({currentLang.toUpperCase()})</Label>
                    <Input
                      value={getLocalizedValue(level.title, currentLang)}
                      onChange={(e) => {
                        const updated = { ...jsonToRecord(level.title), [currentLang]: e.target.value };
                        updateResultLevel(index, { title: updated });
                      }}
                      placeholder="Result title"
                    />
                  </div>

                  <div>
                    <Label>Description ({currentLang.toUpperCase()})</Label>
                    <Textarea
                      value={getLocalizedValue(level.description, currentLang)}
                      onChange={(e) => {
                        const updated = { ...jsonToRecord(level.description), [currentLang]: e.target.value };
                        updateResultLevel(index, { description: updated });
                      }}
                      placeholder="Result description"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Color Class</Label>
                    <Input
                      value={level.color_class}
                      onChange={(e) =>
                        updateResultLevel(index, { color_class: e.target.value })
                      }
                      placeholder="from-emerald-500 to-green-600"
                    />
                  </div>
                </div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Quiz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
