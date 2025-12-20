import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save, ArrowLeft, Languages, Loader2, Eye, Sparkles } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Primary languages admin can edit in
const PRIMARY_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
];

// All target languages for display/reference (EU languages)
const ALL_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "es", label: "Spanish" },
  { code: "pl", label: "Polish" },
  { code: "ro", label: "Romanian" },
  { code: "nl", label: "Dutch" },
  { code: "el", label: "Greek" },
  { code: "pt", label: "Portuguese" },
  { code: "cs", label: "Czech" },
  { code: "hu", label: "Hungarian" },
  { code: "sv", label: "Swedish" },
  { code: "bg", label: "Bulgarian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "sk", label: "Slovak" },
  { code: "hr", label: "Croatian" },
  { code: "lt", label: "Lithuanian" },
  { code: "sl", label: "Slovenian" },
  { code: "lv", label: "Latvian" },
  { code: "ga", label: "Irish" },
  { code: "mt", label: "Maltese" },
];

interface TranslationMeta {
  source_hashes?: Record<string, string>;
  translations?: Record<string, {
    translated_at: string;
    field_hashes: Record<string, string>;
    is_complete: boolean;
  }>;
  total_cost_usd?: number;
}

export default function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const isCreating = quizId === "new";
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const { toast } = useToast();
  
  // User preference for language selection
  const { preferences: editorPrefs, updatePreference: updateEditorPref } = useUserPreferences<{ language: string }>({
    key: "quiz_editor",
    defaultValue: { language: "en" },
  });
  
  const primaryLanguage = editorPrefs.language || "en";
  const setPrimaryLanguage = (lang: string) => updateEditorPref("language", lang);
  
  // Preview language for viewing translations
  const [previewLanguage, setPreviewLanguage] = useState<string | null>(null);
  
  // Translation metadata state
  const [translationMeta, setTranslationMeta] = useState<TranslationMeta>({});
  const [showLanguageList, setShowLanguageList] = useState(false);

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
  
  // Quiz behavior settings
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [enableScoring, setEnableScoring] = useState(true);
  const [includeOpenMindedness, setIncludeOpenMindedness] = useState(false);
  
  // AI headline assistance
  const [suggestingHeadline, setSuggestingHeadline] = useState(false);
  const [useAiHeadline, setUseAiHeadline] = useState(true);

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);

  // Result levels state
  const [resultLevels, setResultLevels] = useState<ResultLevel[]>([]);

  // Check admin role
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

      setIsAdmin(true);
      setCheckingRole(false);

      if (!isCreating && quizId) {
        await loadQuizData(quizId);
      } else {
        setLoading(false);
      }
    };

    checkAdminAndLoad();
  }, [quizId, isCreating, navigate]);

  const loadQuizData = async (id: string) => {
    setLoading(true);
    try {
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!quiz) {
        toast({
          title: "Quiz not found",
          description: "The requested quiz does not exist",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

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
      setPrimaryLanguage(quiz.primary_language || "en");
      setTranslationMeta((quiz as any).translation_meta || {});
      setShuffleQuestions((quiz as any).shuffle_questions || false);
      setEnableScoring((quiz as any).enable_scoring !== false);
      setIncludeOpenMindedness((quiz as any).include_open_mindedness || false);

      // Load questions with answers
      const { data: questionsData } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", id)
        .order("question_order");

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
        .eq("quiz_id", id)
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
    } catch (error: any) {
      console.error("Error loading quiz:", error);
      toast({
        title: "Error",
        description: "Failed to load quiz data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
      let savedQuizId = quizId;

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
        primary_language: primaryLanguage,
        shuffle_questions: shuffleQuestions,
        enable_scoring: enableScoring,
        include_open_mindedness: includeOpenMindedness,
      };

      if (isCreating) {
        const { data, error } = await supabase
          .from("quizzes")
          .insert(quizData)
          .select()
          .single();

        if (error) throw error;
        savedQuizId = data.id;

        await logActivity({
          actionType: "CREATE",
          tableName: "quizzes",
          recordId: savedQuizId,
          description: `Quiz "${title.en || slug}" created`,
        });
      } else {
        const { error } = await supabase
          .from("quizzes")
          .update(quizData)
          .eq("id", quizId);

        if (error) throw error;

        await logActivity({
          actionType: "UPDATE",
          tableName: "quizzes",
          recordId: quizId!,
          description: `Quiz "${title.en || slug}" updated`,
        });
      }

      // Save questions and answers
      for (const question of questions) {
        let questionId = question.id;

        if (question.id.startsWith("new-")) {
          const { data, error } = await supabase
            .from("quiz_questions")
            .insert({
              quiz_id: savedQuizId,
              question_text: question.question_text,
              question_order: question.question_order,
              question_type: question.question_type,
            })
            .select()
            .single();

          if (error) throw error;
          questionId = data.id;
        } else {
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

        for (const answer of question.answers) {
          if (answer.id.startsWith("new-")) {
            await supabase.from("quiz_answers").insert({
              question_id: questionId,
              answer_text: answer.answer_text,
              answer_order: answer.answer_order,
              score_value: answer.score_value,
            });
          } else {
            await supabase
              .from("quiz_answers")
              .update({
                answer_text: answer.answer_text,
                answer_order: answer.answer_order,
                score_value: answer.score_value,
              })
              .eq("id", answer.id);
          }
        }
      }

      // Save result levels
      for (const level of resultLevels) {
        if (level.id.startsWith("new-")) {
          await supabase.from("quiz_result_levels").insert({
            quiz_id: savedQuizId,
            min_score: level.min_score,
            max_score: level.max_score,
            title: level.title,
            description: level.description,
            insights: level.insights,
            emoji: level.emoji,
            color_class: level.color_class,
          });
        } else {
          await supabase
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
        }
      }

      toast({
        title: isCreating ? "Quiz created" : "Quiz saved",
        description: `"${title.en || slug}" has been ${isCreating ? "created" : "updated"}`,
      });

      if (isCreating && savedQuizId) {
        navigate(`/admin/quiz/${savedQuizId}`, { replace: true });
      }
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

  const handleTranslate = async () => {
    if (!quizId || isCreating) return;
    
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-quiz", {
        body: { quizId, sourceLanguage: primaryLanguage },
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      const costInfo = data.sessionCost ? ` (Cost: $${data.sessionCost.toFixed(4)})` : "";
      const skippedInfo = data.skippedCount > 0 ? `, ${data.skippedCount} already translated` : "";
      
      toast({
        title: "Translation complete",
        description: `Translated ${data.translatedCount || 0} texts to ${data.translatedLanguages?.length || 0} languages${skippedInfo}${costInfo}`,
      });

      // Reload quiz data to show translations
      await loadQuizData(quizId);
    } catch (error: any) {
      console.error("Translation error:", error);
      toast({
        title: "Translation failed",
        description: error.message || "Failed to translate quiz",
        variant: "destructive",
      });
    } finally {
      setTranslating(false);
    }
  };

  // Get translation status for a language
  const getTranslationStatus = (langCode: string) => {
    const langMeta = translationMeta.translations?.[langCode];
    if (!langMeta) return { translated: false, needsUpdate: false, date: null };
    
    const hasChanges = Object.keys(translationMeta.source_hashes || {}).some(
      path => (translationMeta.source_hashes?.[path] || "") !== (langMeta.field_hashes?.[path] || "")
    );
    
    return {
      translated: true,
      needsUpdate: hasChanges,
      date: langMeta.translated_at ? new Date(langMeta.translated_at) : null,
      isComplete: langMeta.is_complete,
    };
  };

  // Count languages with translations
  const getTranslationStats = () => {
    const otherLanguages = ALL_LANGUAGES.filter(l => l.code !== primaryLanguage);
    const translated = otherLanguages.filter(l => getTranslationStatus(l.code).translated).length;
    const needsUpdate = otherLanguages.filter(l => getTranslationStatus(l.code).needsUpdate).length;
    return { total: otherLanguages.length, translated, needsUpdate };
  };

  // AI headline suggestion - combines headline + highlight using **syntax**
  const suggestHeadlineHighlight = async () => {
    const currentTitle = title[primaryLanguage] || "";
    const currentDesc = description[primaryLanguage] || "";
    
    if (!currentTitle && !currentDesc) {
      toast({
        title: "Need context",
        description: "Add a title or description first for AI to suggest a headline",
        variant: "destructive",
      });
      return;
    }
    
    setSuggestingHeadline(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-headline", {
        body: { 
          title: currentTitle, 
          description: currentDesc,
          language: primaryLanguage,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      if (data.headline) {
        // Parse the AI response - it returns headline with **highlighted** parts
        const fullHeadline = data.headline;
        const highlightMatch = fullHeadline.match(/\*\*(.+?)\*\*/);
        
        if (highlightMatch) {
          // Extract highlight and clean headline
          const highlightText = highlightMatch[1];
          const cleanHeadline = fullHeadline.replace(/\*\*(.+?)\*\*/, "").trim();
          
          setLocalizedValue(setHeadline, primaryLanguage, cleanHeadline);
          setLocalizedValue(setHeadlineHighlight, primaryLanguage, highlightText);
        } else {
          // No highlight markers, use as-is
          setLocalizedValue(setHeadline, primaryLanguage, fullHeadline);
        }
        
        toast({
          title: "Headline suggested",
          description: "AI generated a headline with highlights. Edit as needed.",
        });
      }
    } catch (error: any) {
      console.error("Headline suggestion error:", error);
      toast({
        title: "Suggestion failed",
        description: error.message || "Failed to generate headline",
        variant: "destructive",
      });
    } finally {
      setSuggestingHeadline(false);
    }
  };

  // Auto-suggest headline when title changes (if AI mode is on)
  const handleTitleChange = (value: string) => {
    setLocalizedValue(setTitle, displayLanguage, value);
    // Debounced auto-suggest could be added here
  };

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
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const deleteQuestion = async (index: number) => {
    const question = questions[index];
    if (!question.id.startsWith("new-")) {
      await supabase.from("quiz_answers").delete().eq("question_id", question.id);
      await supabase.from("quiz_questions").delete().eq("id", question.id);
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addAnswer = (questionIndex: number) => {
    const question = questions[questionIndex];
    const newAnswer: Answer = {
      id: `new-${Date.now()}`,
      answer_text: {},
      answer_order: question.answers.length + 1,
      score_value: 1,
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
    const updatedAnswers = question.answers.map((a, i) =>
      i === answerIndex ? { ...a, ...updates } : a
    );
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

  const addResultLevel = () => {
    const newLevel: ResultLevel = {
      id: `new-${Date.now()}`,
      min_score: 0,
      max_score: 100,
      title: {},
      description: {},
      insights: [],
      emoji: "🌟",
      color_class: "from-emerald-500 to-green-600",
    };
    setResultLevels([...resultLevels, newLevel]);
  };

  const updateResultLevel = (index: number, updates: Partial<ResultLevel>) => {
    setResultLevels(
      resultLevels.map((l, i) => (i === index ? { ...l, ...updates } : l))
    );
  };

  const deleteResultLevel = async (index: number) => {
    const level = resultLevels[index];
    if (!level.id.startsWith("new-")) {
      await supabase.from("quiz_result_levels").delete().eq("id", level.id);
    }
    setResultLevels(resultLevels.filter((_, i) => i !== index));
  };

  // Display language: use preview language if set, otherwise primary language
  const displayLanguage = previewLanguage || primaryLanguage;
  const isPreviewMode = !!previewLanguage;

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (checkingRole || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background flex overflow-hidden">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab="quizzes"
        onTabChange={(tab) => {
          if (tab !== "quizzes") {
            navigate("/admin");
          }
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 density-padding-lg overflow-y-auto min-h-0">
          <div className="admin-page">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <h1 className="text-2xl font-bold">
                  {isCreating ? "Create New Quiz" : `Edit Quiz: ${getLocalizedValue(title, "en") || slug}`}
                </h1>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Quiz"}
              </Button>
            </div>

        {/* Language Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b">
          {/* Edit Language Toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Edit in:</Label>
            <div className="flex items-center rounded-md border bg-muted p-0.5">
              {PRIMARY_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setPrimaryLanguage(lang.code);
                    setPreviewLanguage(null);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    primaryLanguage === lang.code && !previewLanguage
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language Count Badge with Dropdown */}
          {!isCreating && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageList(!showLanguageList)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border bg-muted hover:bg-muted/80 transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                <span className="font-medium">{getTranslationStats().translated}/{getTranslationStats().total}</span>
                <span className="text-muted-foreground">languages</span>
                {getTranslationStats().needsUpdate > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded">
                    {getTranslationStats().needsUpdate} outdated
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showLanguageList ? "rotate-180" : ""}`} />
              </button>
              
              {showLanguageList && (
                <div className="absolute top-full left-0 mt-1 z-50 w-72 p-2 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <span className="text-xs font-medium">Translation Status</span>
                    {translationMeta.total_cost_usd !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        Total cost: ${translationMeta.total_cost_usd.toFixed(4)}
                      </span>
                    )}
                  </div>
                  {ALL_LANGUAGES.filter(l => l.code !== primaryLanguage).map(lang => {
                    const status = getTranslationStatus(lang.code);
                    return (
                      <div
                        key={lang.code}
                        className="flex items-center justify-between py-1.5 px-1 hover:bg-muted rounded cursor-pointer"
                        onClick={() => {
                          setPreviewLanguage(lang.code);
                          setShowLanguageList(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{lang.label}</span>
                          <span className="text-xs text-muted-foreground uppercase">{lang.code}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {status.translated ? (
                            <>
                              {status.needsUpdate ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                                  Outdated
                                </span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                  ✓ Translated
                                </span>
                              )}
                              {status.date && (
                                <span className="text-xs text-muted-foreground">
                                  {status.date.toLocaleDateString()}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Not translated
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Preview Language Dropdown */}
          {!isCreating && (
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                Preview:
              </Label>
              <Select 
                value={previewLanguage || ""} 
                onValueChange={(val) => setPreviewLanguage(val || null)}
              >
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_LANGUAGES.map(lang => {
                    const status = getTranslationStatus(lang.code);
                    return (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          {lang.label}
                          {lang.code !== primaryLanguage && status.translated && !status.needsUpdate && (
                            <span className="text-green-600">✓</span>
                          )}
                          {lang.code !== primaryLanguage && status.needsUpdate && (
                            <span className="text-amber-600">⚠</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {previewLanguage && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-xs"
                  onClick={() => setPreviewLanguage(null)}
                >
                  Exit Preview
                </Button>
              )}
            </div>
          )}
          
          {!isCreating && !previewLanguage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranslate}
              disabled={translating}
              className="gap-2"
            >
              {translating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
              {translating ? "Translating..." : "AI Translate"}
            </Button>
          )}
          
          {previewLanguage && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
              Preview mode - changes disabled
            </span>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="results">Results ({resultLevels.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <div className="grid grid-cols-6 gap-3">
              <div>
                <Label htmlFor="slug" className="text-xs">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="quiz-url"
                  className="h-8"
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Title ({displayLanguage.toUpperCase()})</Label>
                <Input
                  value={title[displayLanguage] || ""}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Quiz title"
                  className="h-8"
                  disabled={isPreviewMode}
                />
              </div>
              <div>
                <Label className="text-xs">Badge ({displayLanguage.toUpperCase()})</Label>
                <Input
                  value={badgeText[displayLanguage] || ""}
                  onChange={(e) => setLocalizedValue(setBadgeText, displayLanguage, e.target.value)}
                  placeholder="Free"
                  className="h-8"
                  disabled={isPreviewMode}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label className="text-xs">Active</Label>
              </div>
            </div>

            {/* Headline with AI assistance */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  Headline ({displayLanguage.toUpperCase()})
                  <span className="text-muted-foreground font-normal">
                    — Use **asterisks** to highlight words
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUseAiHeadline(!useAiHeadline)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      useAiHeadline 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    AI Auto
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={suggestHeadlineHighlight}
                    disabled={suggestingHeadline || isPreviewMode}
                  >
                    {suggestingHeadline ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Suggest
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    value={headline[displayLanguage] || ""}
                    onChange={(e) => setLocalizedValue(setHeadline, displayLanguage, e.target.value)}
                    placeholder="Discover your hidden"
                    className="h-8"
                    disabled={isPreviewMode}
                  />
                  <span className="text-xs text-muted-foreground">Main text</span>
                </div>
                <div>
                  <Input
                    value={headlineHighlight[displayLanguage] || ""}
                    onChange={(e) => setLocalizedValue(setHeadlineHighlight, displayLanguage, e.target.value)}
                    placeholder="leadership potential"
                    className="h-8 border-primary/50 bg-primary/5"
                    disabled={isPreviewMode}
                  />
                  <span className="text-xs text-muted-foreground">Highlighted text (shown bold/colored)</span>
                </div>
              </div>
              
              {/* Preview */}
              {(headline[displayLanguage] || headlineHighlight[displayLanguage]) && (
                <div className="text-sm p-2 rounded bg-muted/50 border">
                  <span className="text-muted-foreground">Preview: </span>
                  <span>{headline[displayLanguage] || ""} </span>
                  <span className="font-bold text-primary">{headlineHighlight[displayLanguage] || ""}</span>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Description ({displayLanguage.toUpperCase()})</Label>
              <Textarea
                value={description[displayLanguage] || ""}
                onChange={(e) => setLocalizedValue(setDescription, displayLanguage, e.target.value)}
                placeholder="Quiz description"
                rows={2}
                className="resize-none"
                disabled={isPreviewMode}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Duration Text ({displayLanguage.toUpperCase()})</Label>
                <Input
                  value={durationText[displayLanguage] || ""}
                  onChange={(e) => setLocalizedValue(setDurationText, displayLanguage, e.target.value)}
                  placeholder="Takes only 2 minutes"
                  className="h-8"
                  disabled={isPreviewMode}
                />
              </div>
              <div>
                <Label className="text-xs">CTA Text ({displayLanguage.toUpperCase()})</Label>
                <Input
                  value={ctaText[displayLanguage] || ""}
                  onChange={(e) => setLocalizedValue(setCtaText, displayLanguage, e.target.value)}
                  placeholder="Start Quiz"
                  className="h-8"
                  disabled={isPreviewMode}
                />
              </div>
              <div>
                <Label className="text-xs">CTA URL</Label>
                <Input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://sparkly.hr"
                  className="h-8"
                  disabled={isPreviewMode}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="space-y-3">
            {/* Question Settings */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={shuffleQuestions} 
                  onCheckedChange={setShuffleQuestions}
                  disabled={isPreviewMode}
                />
                <Label className="text-xs">Shuffle order each time</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={enableScoring} 
                  onCheckedChange={setEnableScoring}
                  disabled={isPreviewMode}
                />
                <Label className="text-xs">Answers have points (for results)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={includeOpenMindedness} 
                  onCheckedChange={setIncludeOpenMindedness}
                  disabled={isPreviewMode}
                />
                <Label className="text-xs">Include Open-Mindedness module</Label>
              </div>
            </div>

            {!isPreviewMode && (
              <Button onClick={addQuestion} variant="outline" size="sm" className="w-full h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add Question
              </Button>
            )}

            <Accordion type="single" collapsible className="space-y-1">
              {questions.filter(q => q.question_type !== "open_mindedness").map((question, filteredIndex) => {
                const qIndex = questions.findIndex(q => q.id === question.id);
                return (
                <AccordionItem
                  key={question.id}
                  value={question.id}
                  className="border rounded px-3 py-0"
                >
                  <AccordionTrigger className="hover:no-underline py-2">
                    <div className="flex items-center gap-1.5 text-left text-sm">
                      <GripVertical className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">
                        Q{qIndex + 1}: {getLocalizedValue(question.question_text, displayLanguage) || "New Question"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({question.answers.length})
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-2 pb-3">
                    <div>
                      <Label className="text-xs">Question ({displayLanguage.toUpperCase()})</Label>
                      <Textarea
                        value={getLocalizedValue(question.question_text, displayLanguage)}
                        onChange={(e) => {
                          const updated = { ...jsonToRecord(question.question_text), [displayLanguage]: e.target.value };
                          updateQuestion(qIndex, { question_text: updated });
                        }}
                        placeholder="Enter question text"
                        rows={2}
                        className="resize-none text-sm"
                        disabled={isPreviewMode}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Answers</Label>
                        {!isPreviewMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => addAnswer(qIndex)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>

                      {question.answers.map((answer, aIndex) => (
                        <div
                          key={answer.id}
                          className="flex items-center gap-1.5 p-1.5 bg-secondary/30 rounded"
                        >
                          <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <Input
                            value={getLocalizedValue(answer.answer_text, displayLanguage)}
                            onChange={(e) => {
                              const updated = { ...jsonToRecord(answer.answer_text), [displayLanguage]: e.target.value };
                              updateAnswer(qIndex, aIndex, { answer_text: updated });
                            }}
                            placeholder={`Answer ${aIndex + 1}`}
                            className="flex-1 h-7 text-sm"
                            disabled={isPreviewMode}
                          />
                          {enableScoring && (
                            <Input
                              type="number"
                              value={answer.score_value}
                              onChange={(e) =>
                                updateAnswer(qIndex, aIndex, {
                                  score_value: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-14 h-7 text-sm text-center"
                              title="Score"
                              disabled={isPreviewMode}
                            />
                          )}
                          {!isPreviewMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteAnswer(qIndex, aIndex)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {!isPreviewMode && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => deleteQuestion(qIndex)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>

          <TabsContent value="results" className="space-y-2">
            {!isPreviewMode && (
              <Button onClick={addResultLevel} variant="outline" size="sm" className="w-full h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add Result Level
              </Button>
            )}

            {resultLevels.map((level, index) => (
              <div
                key={level.id}
                className="border rounded p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    {level.emoji} {getLocalizedValue(level.title, displayLanguage) || `Level ${index + 1}`}
                  </h4>
                  {!isPreviewMode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteResultLevel(index)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Min</Label>
                    <Input
                      type="number"
                      value={level.min_score}
                      onChange={(e) =>
                        updateResultLevel(index, {
                          min_score: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-7 text-sm"
                      disabled={isPreviewMode}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max</Label>
                    <Input
                      type="number"
                      value={level.max_score}
                      onChange={(e) =>
                        updateResultLevel(index, {
                          max_score: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-7 text-sm"
                      disabled={isPreviewMode}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Emoji</Label>
                    <Input
                      value={level.emoji}
                      onChange={(e) =>
                        updateResultLevel(index, { emoji: e.target.value })
                      }
                      className="h-7 text-sm"
                      disabled={isPreviewMode}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input
                      value={level.color_class}
                      onChange={(e) =>
                        updateResultLevel(index, { color_class: e.target.value })
                      }
                      placeholder="from-emerald-500 to-green-600"
                      className="h-7 text-sm"
                      disabled={isPreviewMode}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Title ({displayLanguage.toUpperCase()})</Label>
                  <Input
                    value={getLocalizedValue(level.title, displayLanguage)}
                    onChange={(e) => {
                      const updated = { ...jsonToRecord(level.title), [displayLanguage]: e.target.value };
                      updateResultLevel(index, { title: updated });
                    }}
                    placeholder="Result title"
                    className="h-7 text-sm"
                    disabled={isPreviewMode}
                  />
                </div>

                <div>
                  <Label className="text-xs">Description ({displayLanguage.toUpperCase()})</Label>
                  <Textarea
                    value={getLocalizedValue(level.description, displayLanguage)}
                    onChange={(e) => {
                      const updated = { ...jsonToRecord(level.description), [displayLanguage]: e.target.value };
                      updateResultLevel(index, { description: updated });
                    }}
                    placeholder="Result description"
                    rows={2}
                    className="resize-none text-sm"
                    disabled={isPreviewMode}
                  />
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
