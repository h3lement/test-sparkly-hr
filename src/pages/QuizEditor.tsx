import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useDirtyTracking, useQuestionsDirtyTracking } from "@/hooks/useDirtyTracking";
import { Plus, Trash2, ChevronDown, Save, ArrowLeft, Languages, Loader2, Eye, Sparkles, Brain, ExternalLink, History, AlertTriangle, CheckCircle2, AlertCircle, FileQuestion } from "lucide-react";
import { AiModelSelector, AI_MODELS, type AiModelId } from "@/components/admin/AiModelSelector";
import { QuizErrorChecker, QuizErrorDisplay, CheckErrorsButton, getFirstErrorTab, type CheckErrorsResult } from "@/components/admin/QuizErrorChecker";
import { RegenerationDialog, type RegenerationType } from "@/components/admin/RegenerationDialog";
import { SortableQuestionList } from "@/components/admin/SortableQuestionList";
import { SortableResultList } from "@/components/admin/SortableResultList";
import { GenerateResultsDialog } from "@/components/admin/GenerateResultsDialog";
import { ResultVersionsDialog } from "@/components/admin/ResultVersionsDialog";
import { BulkAiFillButton } from "@/components/admin/BulkAiFillButton";
import { AutoSuggestScoresButton } from "@/components/admin/AutoSuggestScoresButton";
import { SyncAnswerWeightsButton } from "@/components/admin/SyncAnswerWeightsButton";
import { AutoSaveIndicator } from "@/components/admin/AutoSaveIndicator";
import { ToneOfVoiceEditor } from "@/components/admin/ToneOfVoiceEditor";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { OpenMindednessEditor } from "@/components/admin/OpenMindednessEditor";
import { OpenMindednessResultLevels } from "@/components/admin/OpenMindednessResultLevels";
import { QuizRespondents } from "@/components/admin/QuizRespondents";
import { QuizStats } from "@/components/admin/QuizStats";
import { QuizActivityLog } from "@/components/admin/QuizActivityLog";
import { QuizWebStats } from "@/components/admin/QuizWebStats";
import { HypothesisQuizEditor } from "@/components/admin/HypothesisQuizEditor";
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
  cta_title?: Json;
  cta_description?: Json;
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
  const location = useLocation();
  const isCreating = quizId === "new";
  
  // Get return path from location state, fallback to quizzes tab
  const returnPath = (location.state as { from?: string })?.from || "/admin?tab=quizzes";
  
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
  const [ctaTitle, setCtaTitle] = useState<Record<string, string>>({});
  const [ctaDescription, setCtaDescription] = useState<Record<string, string>>({});
  const [ctaUrl, setCtaUrl] = useState("");
  const [durationText, setDurationText] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);
  
  // Quiz behavior settings
  const [quizType, setQuizType] = useState<"standard" | "hypothesis" | "emotional">("standard");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [enableScoring, setEnableScoring] = useState(true);
  const [includeOpenMindedness, setIncludeOpenMindedness] = useState(true);
  
  // Tone of voice
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [toneSource, setToneSource] = useState<"ai" | "extracted" | "manual">("manual");
  const [useToneForAi, setUseToneForAi] = useState(true);
  const [toneIntensity, setToneIntensity] = useState(4); // Default to "Balanced"
  
  // ICP & Buying Persona for AI context
  const [icpDescription, setIcpDescription] = useState("");
  const [buyingPersona, setBuyingPersona] = useState("");
  
  // AI headline assistance
  const [suggestingHeadline, setSuggestingHeadline] = useState(false);
  const [useAiHeadline, setUseAiHeadline] = useState(true);

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);

  // Result levels state
  const [resultLevels, setResultLevels] = useState<ResultLevel[]>([]);
  
  // AI Results dialogs
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [totalAiCost, setTotalAiCost] = useState<number>(0);
  
  // AI Model selection
  const [selectedAiModel, setSelectedAiModel] = useState<AiModelId>("google/gemini-2.5-flash");
  const [previousAiModel, setPreviousAiModel] = useState<AiModelId>("google/gemini-2.5-flash");
  const [showRegenerationDialog, setShowRegenerationDialog] = useState(false);
  const [regenerationTasks, setRegenerationTasks] = useState<Array<{
    id: string;
    label: string;
    status: "pending" | "running" | "done" | "error";
    errorMessage?: string;
  }>>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationProgress, setRegenerationProgress] = useState(0);

  // Error checking state
  const [errorCheckResult, setErrorCheckResult] = useState<CheckErrorsResult | null>(null);
  const [isCheckingErrors, setIsCheckingErrors] = useState(false);

  // Tab counts for Respondents, Log, and Web
  const [respondentsCount, setRespondentsCount] = useState(0);
  const [activityLogsCount, setActivityLogsCount] = useState(0);
  const [webConversionRate, setWebConversionRate] = useState(0);

  // Check admin role
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  
  // Track if initial load is complete (to prevent auto-save on first render)
  const initialLoadComplete = useRef(false);
  const savedQuizIdRef = useRef<string | undefined>(quizId);

  // Dirty tracking for optimized saves
  const quizFieldsRef = useRef<Record<string, unknown>>({});
  const questionsDirtyTracking = useQuestionsDirtyTracking();
  const resultLevelsDirtyTracking = useDirtyTracking<ResultLevel>();

  // Calculate pending changes count for the indicator
  const getPendingChangesCount = useCallback(() => {
    if (!initialLoadComplete.current) return 0;
    
    const currentQuizFields = {
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      title, description, headline, headline_highlight: headlineHighlight,
      badge_text: badgeText, cta_text: ctaText, cta_title: ctaTitle, cta_description: ctaDescription, cta_url: ctaUrl,
      duration_text: durationText, is_active: isActive, primary_language: primaryLanguage,
      quiz_type: quizType, shuffle_questions: shuffleQuestions, shuffle_answers: shuffleAnswers, enable_scoring: enableScoring,
      include_open_mindedness: includeOpenMindedness, tone_of_voice: toneOfVoice,
      tone_source: toneSource, use_tone_for_ai: useToneForAi, tone_intensity: toneIntensity,
      icp_description: icpDescription, buying_persona: buyingPersona,
    };
    
    let count = 0;
    
    // Check quiz fields
    if (JSON.stringify(currentQuizFields) !== JSON.stringify(quizFieldsRef.current)) {
      count += 1; // Count as 1 change for quiz settings
    }
    
    // Count dirty questions
    count += questionsDirtyTracking.getDirtyQuestions(questions).length;
    count += questionsDirtyTracking.getDirtyAnswers(questions).length;
    count += questionsDirtyTracking.getDeletedQuestionIds(questions).length;
    count += questionsDirtyTracking.getDeletedAnswerIds(questions).length;
    
    // Count dirty result levels
    count += resultLevelsDirtyTracking.getDirtyEntities(resultLevels).length;
    count += resultLevelsDirtyTracking.getDeletedIds(resultLevels).length;
    
    return count;
  }, [slug, title, description, headline, headlineHighlight, badgeText, ctaText, ctaTitle, ctaDescription, ctaUrl, durationText, isActive, primaryLanguage, shuffleQuestions, shuffleAnswers, enableScoring, includeOpenMindedness, toneOfVoice, toneSource, useToneForAi, toneIntensity, icpDescription, buyingPersona, questions, resultLevels, questionsDirtyTracking, resultLevelsDirtyTracking]);

  const pendingChangesCount = getPendingChangesCount();

  // Auto-save callback - optimized with parallel batching and dirty tracking
  const performAutoSave = useCallback(async () => {
    if (!savedQuizIdRef.current || savedQuizIdRef.current === "new") return;
    if (!slug.trim()) return;

    const currentQuizFields = {
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      title,
      description,
      headline,
      headline_highlight: headlineHighlight,
      badge_text: badgeText,
      cta_text: ctaText,
      cta_title: ctaTitle,
      cta_description: ctaDescription,
      cta_url: ctaUrl,
      duration_text: durationText,
      is_active: isActive,
      primary_language: primaryLanguage,
      quiz_type: quizType,
      shuffle_questions: shuffleQuestions,
      shuffle_answers: shuffleAnswers,
      enable_scoring: enableScoring,
      include_open_mindedness: includeOpenMindedness,
      tone_of_voice: toneOfVoice,
      tone_source: toneSource,
      use_tone_for_ai: useToneForAi,
      tone_intensity: toneIntensity,
      icp_description: icpDescription,
      buying_persona: buyingPersona,
    };

    // Check if quiz fields changed
    const quizFieldsChanged = JSON.stringify(currentQuizFields) !== JSON.stringify(quizFieldsRef.current);

    // Get dirty entities
    const dirtyQuestions = questionsDirtyTracking.getDirtyQuestions(questions);
    const dirtyAnswers = questionsDirtyTracking.getDirtyAnswers(questions);
    const deletedQuestionIds = questionsDirtyTracking.getDeletedQuestionIds(questions);
    const deletedAnswerIds = questionsDirtyTracking.getDeletedAnswerIds(questions);
    const dirtyResultLevels = resultLevelsDirtyTracking.getDirtyEntities(resultLevels);
    const deletedResultLevelIds = resultLevelsDirtyTracking.getDeletedIds(resultLevels);

    // Skip if nothing changed
    if (!quizFieldsChanged && 
        dirtyQuestions.length === 0 && 
        dirtyAnswers.length === 0 && 
        deletedQuestionIds.length === 0 &&
        deletedAnswerIds.length === 0 &&
        dirtyResultLevels.length === 0 &&
        deletedResultLevelIds.length === 0) {
      return;
    }

    const promises: Promise<void>[] = [];

    // Update quiz fields if changed
    if (quizFieldsChanged) {
      promises.push(
        (async () => {
          const { error } = await supabase
            .from("quizzes")
            .update(currentQuizFields)
            .eq("id", savedQuizIdRef.current!);
          if (error) throw error;
          
          // Log activity for quiz update
          await logActivity({
            actionType: "UPDATE",
            tableName: "quizzes",
            recordId: savedQuizIdRef.current!,
            description: `Quiz auto-saved`,
          });
          
          quizFieldsRef.current = currentQuizFields;
        })()
      );
    }

    // Handle deleted answers first (in parallel)
    for (const answerId of deletedAnswerIds) {
      promises.push(
        (async () => {
          const { error } = await supabase
            .from("quiz_answers")
            .delete()
            .eq("id", answerId);
          if (error) throw error;
        })()
      );
    }

    // Handle deleted questions (in parallel)
    for (const questionId of deletedQuestionIds) {
      promises.push(
        (async () => {
          const { error } = await supabase
            .from("quiz_questions")
            .delete()
            .eq("id", questionId);
          if (error) throw error;
        })()
      );
    }

    // Handle deleted result levels (in parallel)
    for (const levelId of deletedResultLevelIds) {
      promises.push(
        (async () => {
          const { error } = await supabase
            .from("quiz_result_levels")
            .delete()
            .eq("id", levelId);
          if (error) throw error;
        })()
      );
    }

    // Save dirty questions (in parallel)
    for (const question of dirtyQuestions) {
      if (question.id.startsWith("new-")) {
        promises.push(
          (async () => {
            const { data, error } = await supabase
              .from("quiz_questions")
              .insert({
                quiz_id: savedQuizIdRef.current!,
                question_text: question.question_text as Json,
                question_order: question.question_order,
                question_type: question.question_type,
              })
              .select()
              .single();
            if (error) throw error;
            // Update local state with real ID
            setQuestions(prev => prev.map(q => 
              q.id === question.id ? { ...q, id: data.id } : q
            ));
          })()
        );
      } else {
        promises.push(
          (async () => {
            const { error } = await supabase
              .from("quiz_questions")
              .update({
                question_text: question.question_text as Json,
                question_order: question.question_order,
                question_type: question.question_type,
              })
              .eq("id", question.id);
            if (error) throw error;
          })()
        );
      }
    }

    // Save dirty answers (in parallel)
    for (const { answer, questionId } of dirtyAnswers) {
      // For new answers, we need the real question ID
      const realQuestionId = questions.find(q => 
        q.id === questionId || q.answers.some(a => a.id === answer.id)
      )?.id;
      
      if (!realQuestionId || realQuestionId.startsWith("new-")) {
        // Question is new too, answer will be saved after question is created
        continue;
      }

      if (answer.id.startsWith("new-")) {
        promises.push(
          (async () => {
            const { data, error } = await supabase
              .from("quiz_answers")
              .insert({
                question_id: realQuestionId,
                answer_text: answer.answer_text as Json,
                answer_order: answer.answer_order,
                score_value: answer.score_value,
              })
              .select()
              .single();
            if (error) throw error;
            // Update local state with real ID
            setQuestions(prev => prev.map(q => ({
              ...q,
              answers: q.answers.map(a => 
                a.id === answer.id ? { ...a, id: data.id } : a
              ),
            })));
          })()
        );
      } else {
        promises.push(
          (async () => {
            const { error } = await supabase
              .from("quiz_answers")
              .update({
                answer_text: answer.answer_text as Json,
                answer_order: answer.answer_order,
                score_value: answer.score_value,
              })
              .eq("id", answer.id);
            if (error) throw error;
          })()
        );
      }
    }

    // Save dirty result levels (in parallel)
    for (const level of dirtyResultLevels) {
      if (level.id.startsWith("new-")) {
        promises.push(
          (async () => {
            const { data, error } = await supabase
              .from("quiz_result_levels")
              .insert({
                quiz_id: savedQuizIdRef.current!,
                min_score: level.min_score,
                max_score: level.max_score,
                title: level.title as Json,
                description: level.description as Json,
                insights: level.insights as Json,
                emoji: level.emoji,
                color_class: level.color_class,
              })
              .select()
              .single();
            if (error) throw error;
            // Update local state with real ID
            setResultLevels(prev => prev.map(l => 
              l.id === level.id ? { ...l, id: data.id } : l
            ));
          })()
        );
      } else {
        promises.push(
          (async () => {
            const { error } = await supabase
              .from("quiz_result_levels")
              .update({
                min_score: level.min_score,
                max_score: level.max_score,
                title: level.title as Json,
                description: level.description as Json,
                insights: level.insights as Json,
                emoji: level.emoji,
                color_class: level.color_class,
              })
              .eq("id", level.id);
            if (error) throw error;
          })()
        );
      }
    }

    // Execute all updates in parallel
    await Promise.all(promises);

    // Mark everything as clean after successful save
    questionsDirtyTracking.markClean(questions);
    resultLevelsDirtyTracking.markClean(resultLevels);
  }, [slug, title, description, headline, headlineHighlight, badgeText, ctaText, ctaTitle, ctaDescription, ctaUrl, durationText, isActive, primaryLanguage, shuffleQuestions, shuffleAnswers, enableScoring, includeOpenMindedness, toneOfVoice, toneSource, useToneForAi, toneIntensity, icpDescription, buyingPersona, questions, resultLevels, questionsDirtyTracking, resultLevelsDirtyTracking]);

  // Auto-save hook
  const { status: autoSaveStatus, triggerSave, saveNow } = useAutoSave({
    onSave: performAutoSave,
    debounceMs: 1500,
    enabled: !isCreating && !!savedQuizIdRef.current && savedQuizIdRef.current !== "new",
  });

  // Trigger auto-save when data changes
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    if (isCreating) return;
    triggerSave();
  }, [slug, title, description, headline, headlineHighlight, badgeText, ctaText, ctaTitle, ctaDescription, ctaUrl, durationText, isActive, shuffleQuestions, shuffleAnswers, enableScoring, includeOpenMindedness, toneOfVoice, toneSource, useToneForAi, toneIntensity, icpDescription, buyingPersona, questions, resultLevels, triggerSave, isCreating]);

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
      } else if (isCreating) {
        // Initialize new quiz with default OM question template
        initializeNewQuizWithOM();
        setLoading(false);
      } else {
        setLoading(false);
      }
    };

    checkAdminAndLoad();
  }, [quizId, isCreating, navigate]);

  // Real-time subscription for tab counts
  useEffect(() => {
    if (!quizId || quizId === "new" || !slug) return;

    // Subscribe to quiz_leads changes for respondents/stats count
    // Subscribe to leads changes based on quiz type
    const leadsTable = quizType === "hypothesis" ? "hypothesis_leads" : "quiz_leads";
    const leadsChannel = supabase
      .channel(`quiz-leads-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: leadsTable,
          filter: `quiz_id=eq.${quizId}`
        },
        async () => {
          const { count } = await supabase
            .from(leadsTable)
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quizId);
          setRespondentsCount(count || 0);
        }
      )
      .subscribe();

    // Subscribe to activity_logs changes for log count
    const logsChannel = supabase
      .channel(`activity-logs-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `record_id=eq.${quizId}`
        },
        async () => {
          const { count } = await supabase
            .from("activity_logs")
            .select("*", { count: "exact", head: true })
            .eq("record_id", quizId);
          setActivityLogsCount(count || 0);
        }
      )
      .subscribe();

    // Subscribe to page_views changes for web count
    const viewsChannel = supabase
      .channel(`page-views-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'page_views'
        },
        async (payload) => {
          // Only update if the page_slug matches this quiz
          if (payload.new && (payload.new as { page_slug: string }).page_slug?.startsWith(slug)) {
            // Recalculate conversion rate
            const { data: pageViewsData } = await supabase
              .from("page_views")
              .select("session_id, page_slug")
              .or(`page_slug.like.${slug}/%,page_slug.eq.welcome,page_slug.eq.results`);
            
            const sessionPages = new Map<string, Set<string>>();
            (pageViewsData || []).forEach(view => {
              const stepSlug = view.page_slug.includes('/') 
                ? view.page_slug.split('/').pop()! 
                : view.page_slug;
              if (!sessionPages.has(view.session_id)) {
                sessionPages.set(view.session_id, new Set());
              }
              sessionPages.get(view.session_id)!.add(stepSlug);
            });
            
            let welcomeCount = 0;
            let resultsCount = 0;
            sessionPages.forEach(pages => {
              if (pages.has('welcome')) welcomeCount++;
              if (pages.has('results')) resultsCount++;
            });
            
            const convRate = welcomeCount > 0 ? Math.round((resultsCount / welcomeCount) * 100) : 0;
            setWebConversionRate(convRate);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(viewsChannel);
    };
  }, [quizId, slug]);

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
      setCtaTitle(jsonToRecord((quiz as any).cta_title));
      setCtaDescription(jsonToRecord((quiz as any).cta_description));
      setCtaUrl(quiz.cta_url || "https://sparkly.hr");
      setDurationText(jsonToRecord(quiz.duration_text));
      setIsActive(quiz.is_active);
      setPrimaryLanguage(quiz.primary_language || "en");
      setTranslationMeta((quiz as any).translation_meta || {});
      setQuizType((quiz as any).quiz_type || "standard");
      setShuffleQuestions((quiz as any).shuffle_questions || false);
      setShuffleAnswers((quiz as any).shuffle_answers || false);
      setEnableScoring((quiz as any).enable_scoring !== false);
      setIncludeOpenMindedness((quiz as any).include_open_mindedness || false);
      setToneOfVoice((quiz as any).tone_of_voice || "");
      setToneSource((quiz as any).tone_source || "manual");
      setUseToneForAi((quiz as any).use_tone_for_ai !== false);
      setToneIntensity((quiz as any).tone_intensity ?? 4);
      setIcpDescription((quiz as any).icp_description || "");
      setBuyingPersona((quiz as any).buying_persona || "");

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

      const loadedResultLevels = (levelsData || []).map(l => ({
        id: l.id,
        min_score: l.min_score,
        max_score: l.max_score,
        title: l.title,
        description: l.description,
        insights: l.insights,
        emoji: l.emoji || "🌟",
        color_class: l.color_class || "from-emerald-500 to-green-600",
      }));
      setResultLevels(loadedResultLevels);

      // Load total AI generation cost
      const { data: versionsData } = await supabase
        .from("quiz_result_versions")
        .select("estimated_cost_eur")
        .eq("quiz_id", id);

      const totalCost = (versionsData || []).reduce((sum, v) => sum + (v.estimated_cost_eur || 0), 0);
      setTotalAiCost(totalCost);

      // Load respondents count based on quiz type
      const leadsTable = (quiz as any).quiz_type === "hypothesis" ? "hypothesis_leads" : "quiz_leads";
      const { count: leadsCount } = await supabase
        .from(leadsTable)
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", id);
      setRespondentsCount(leadsCount || 0);

      // Load activity logs count
      const { count: logsCount } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .eq("record_id", id);
      setActivityLogsCount(logsCount || 0);

      // Load web conversion rate (results/welcome)
      const { data: pageViewsData } = await supabase
        .from("page_views")
        .select("session_id, page_slug")
        .or(`page_slug.like.${quiz.slug}/%,page_slug.eq.welcome,page_slug.eq.results`);
      
      // Calculate conversion rate
      const sessionPages = new Map<string, Set<string>>();
      (pageViewsData || []).forEach(view => {
        const stepSlug = view.page_slug.includes('/') 
          ? view.page_slug.split('/').pop()! 
          : view.page_slug;
        if (!sessionPages.has(view.session_id)) {
          sessionPages.set(view.session_id, new Set());
        }
        sessionPages.get(view.session_id)!.add(stepSlug);
      });
      
      let welcomeCount = 0;
      let resultsCount = 0;
      sessionPages.forEach(pages => {
        if (pages.has('welcome')) welcomeCount++;
        if (pages.has('results')) resultsCount++;
      });
      
      const convRate = welcomeCount > 0 ? Math.round((resultsCount / welcomeCount) * 100) : 0;
      setWebConversionRate(convRate);

      // Mark loaded data as clean for dirty tracking
      questionsDirtyTracking.markClean(questionsWithAnswers);
      resultLevelsDirtyTracking.markClean(loadedResultLevels);
      
      // Store quiz fields baseline
      quizFieldsRef.current = {
        slug: quiz.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title: jsonToRecord(quiz.title),
        description: jsonToRecord(quiz.description),
        headline: jsonToRecord(quiz.headline),
        headline_highlight: jsonToRecord(quiz.headline_highlight),
        badge_text: jsonToRecord(quiz.badge_text),
        cta_text: jsonToRecord(quiz.cta_text),
        cta_title: jsonToRecord((quiz as any).cta_title),
        cta_description: jsonToRecord((quiz as any).cta_description),
        cta_url: quiz.cta_url || "https://sparkly.hr",
        duration_text: jsonToRecord(quiz.duration_text),
        is_active: quiz.is_active,
        primary_language: quiz.primary_language || "en",
        shuffle_questions: (quiz as any).shuffle_questions || false,
        enable_scoring: (quiz as any).enable_scoring !== false,
        include_open_mindedness: (quiz as any).include_open_mindedness || false,
        tone_of_voice: (quiz as any).tone_of_voice || "",
        tone_source: (quiz as any).tone_source || "manual",
        use_tone_for_ai: (quiz as any).use_tone_for_ai !== false,
        tone_intensity: (quiz as any).tone_intensity ?? 4,
        icp_description: (quiz as any).icp_description || "",
        buying_persona: (quiz as any).buying_persona || "",
      };
    } catch (error: any) {
      console.error("Error loading quiz:", error);
      toast({
        title: "Error",
        description: "Failed to load quiz data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      // Mark initial load complete after a brief delay to avoid triggering auto-save
      setTimeout(() => {
        savedQuizIdRef.current = id;
        initialLoadComplete.current = true;
      }, 100);
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

  // Default Open-Mindedness question translations for all EU languages
  const DEFAULT_OM_QUESTION_TEXT: Record<string, string> = {
    en: "Which of these assessment methods do you believe can provide valuable insights when used together?",
    et: "Millised hindamismeetodid võivad Teie arvates koos kasutades anda väärtuslikke teadmisi?",
    de: "Welche dieser Bewertungsmethoden können Ihrer Meinung nach bei kombinierter Anwendung wertvolle Erkenntnisse liefern?",
    fr: "Quelles méthodes d'évaluation pensez-vous pouvoir apporter des informations précieuses lorsqu'elles sont utilisées ensemble ?",
    it: "Quali di questi metodi di valutazione ritieni possano fornire informazioni preziose quando utilizzati insieme?",
    es: "¿Cuáles de estos métodos de evaluación crees que pueden proporcionar información valiosa cuando se usan juntos?",
    pl: "Które z tych metod oceny mogą Twoim zdaniem dostarczyć cennych informacji, gdy są stosowane razem?",
    ro: "Care dintre aceste metode de evaluare credeți că pot oferi informații valoroase atunci când sunt utilizate împreună?",
    nl: "Welke van deze beoordelingsmethoden kunnen volgens u waardevolle inzichten opleveren wanneer ze samen worden gebruikt?",
    el: "Ποιες από αυτές τις μεθόδους αξιολόγησης πιστεύετε ότι μπορούν να παρέχουν πολύτιμες πληροφορίες όταν χρησιμοποιούνται μαζί;",
    pt: "Quais desses métodos de avaliação você acredita que podem fornecer insights valiosos quando usados em conjunto?",
    cs: "Které z těchto metod hodnocení podle vás mohou poskytnout cenné poznatky, když se používají společně?",
    hu: "Ön szerint mely értékelési módszerek nyújthatnak értékes betekintést, ha együtt alkalmazzák őket?",
    sv: "Vilka av dessa bedömningsmetoder tror du kan ge värdefulla insikter när de används tillsammans?",
    bg: "Кои от тези методи за оценка смятате, че могат да предоставят ценни прозрения, когато се използват заедно?",
    da: "Hvilke af disse vurderingsmetoder mener du kan give værdifuld indsigt, når de bruges sammen?",
    fi: "Mitkä näistä arviointimenetelmistä voivat mielestäsi tarjota arvokkaita oivalluksia yhdessä käytettynä?",
    sk: "Ktoré z týchto metód hodnotenia môžu podľa vás poskytnúť cenné poznatky, ak sa používajú spoločne?",
    hr: "Koje od ovih metoda procjene smatrate da mogu pružiti vrijedne uvide kada se koriste zajedno?",
    lt: "Kurie iš šių vertinimo metodų, jūsų manymu, gali suteikti vertingų įžvalgų, kai naudojami kartu?",
    sl: "Katere od teh metod ocenjevanja lahko po vašem mnenju zagotovijo dragocene vpoglede, ko se uporabljajo skupaj?",
    lv: "Kuras no šīm vērtēšanas metodēm, jūsuprāt, var sniegt vērtīgu ieskatu, ja tās tiek izmantotas kopā?",
    ga: "Cé acu de na modhanna measúnaithe seo a chreideann tú gur féidir leo léargais luachmhara a sholáthar nuair a úsáidtear le chéile iad?",
    mt: "Liema minn dawn il-metodi ta' valutazzjoni taħseb li jistgħu jipprovdu għarfien siewi meta jintużaw flimkien?",
  };

  const DEFAULT_OM_ANSWERS: Array<{ text: Record<string, string>; order: number; score: number }> = [
    {
      text: {
        en: "Human judgment and intuition", et: "Inimese otsustusvõime ja intuitsioon",
        de: "Menschliches Urteilsvermögen und Intuition", fr: "Jugement humain et intuition",
        it: "Giudizio umano e intuizione", es: "Juicio humano e intuición",
        pl: "Osąd ludzki i intuicja", ro: "Judecata umană și intuiția",
        nl: "Menselijk oordeel en intuïtie", el: "Ανθρώπινη κρίση και διαίσθηση",
        pt: "Julgamento humano e intuição", cs: "Lidský úsudek a intuice",
        hu: "Emberi ítélőképesség és intuíció", sv: "Mänskligt omdöme och intuition",
        bg: "Човешка преценка и интуиция", da: "Menneskelig dømmekraft og intuition",
        fi: "Inhimillinen harkinta ja intuitio", sk: "Ľudský úsudok a intuícia",
        hr: "Ljudska prosudba i intuicija", lt: "Žmogaus sprendimas ir intuicija",
        sl: "Človeška presoja in intuicija", lv: "Cilvēka spriedums un intuīcija",
        ga: "Breithiúnas agus léargas daonna", mt: "Ġudizzju uman u intuitu",
      },
      order: 1, score: 1,
    },
    {
      text: {
        en: "AI-powered analysis", et: "Tehisintellektil põhinev analüüs",
        de: "KI-gestützte Analyse", fr: "Analyse basée sur l'IA",
        it: "Analisi basata sull'IA", es: "Análisis impulsado por IA",
        pl: "Analiza oparta na AI", ro: "Analiză bazată pe AI",
        nl: "AI-gestuurde analyse", el: "Ανάλυση με τεχνητή νοημοσύνη",
        pt: "Análise baseada em IA", cs: "Analýza s pomocí AI",
        hu: "AI-alapú elemzés", sv: "AI-driven analys",
        bg: "Анализ, базиран на ИИ", da: "AI-drevet analyse",
        fi: "Tekoälyyn perustuva analyysi", sk: "Analýza pomocou AI",
        hr: "Analiza temeljena na AI", lt: "DI paremta analizė",
        sl: "Analiza na podlagi UI", lv: "Ar MI darbināta analīze",
        ga: "Anailís bunaithe ar AI", mt: "Analiżi mħaddma bl-AI",
      },
      order: 2, score: 1,
    },
    {
      text: {
        en: "Psychological assessments", et: "Psühholoogilised hindamised",
        de: "Psychologische Bewertungen", fr: "Évaluations psychologiques",
        it: "Valutazioni psicologiche", es: "Evaluaciones psicológicas",
        pl: "Oceny psychologiczne", ro: "Evaluări psihologice",
        nl: "Psychologische beoordelingen", el: "Ψυχολογικές αξιολογήσεις",
        pt: "Avaliações psicológicas", cs: "Psychologická hodnocení",
        hu: "Pszichológiai értékelések", sv: "Psykologiska bedömningar",
        bg: "Психологически оценки", da: "Psykologiske vurderinger",
        fi: "Psykologiset arvioinnit", sk: "Psychologické hodnotenia",
        hr: "Psihološke procjene", lt: "Psichologiniai vertinimai",
        sl: "Psihološke ocene", lv: "Psiholoģiskie novērtējumi",
        ga: "Measúnuithe síceolaíocha", mt: "Valutazzjonijiet psikoloġiċi",
      },
      order: 3, score: 1,
    },
    {
      text: {
        en: "Human Design methodology", et: "Human Design metoodika",
        de: "Human Design Methodik", fr: "Méthodologie Human Design",
        it: "Metodologia Human Design", es: "Metodología Human Design",
        pl: "Metodologia Human Design", ro: "Metodologia Human Design",
        nl: "Human Design methodologie", el: "Μεθοδολογία Human Design",
        pt: "Metodologia Human Design", cs: "Metodologie Human Design",
        hu: "Human Design módszertan", sv: "Human Design-metodik",
        bg: "Методология Human Design", da: "Human Design-metodik",
        fi: "Human Design -metodologia", sk: "Metodológia Human Design",
        hr: "Human Design metodologija", lt: "Human Design metodologija",
        sl: "Metodologija Human Design", lv: "Human Design metodoloģija",
        ga: "Modheolaíocht Human Design", mt: "Metodoloġija Human Design",
      },
      order: 4, score: 1,
    },
  ];

  const DEFAULT_OM_RESULT_LEVELS = {
    focused: {
      title: {
        en: "Focused Perspective", et: "Fokuseeritud vaatenurk",
        de: "Fokussierte Perspektive", fr: "Perspective ciblée",
        it: "Prospettiva focalizzata", es: "Perspectiva enfocada",
        pl: "Skupiona perspektywa", ro: "Perspectivă focalizată",
        nl: "Gefocust perspectief", el: "Εστιασμένη προοπτική",
        pt: "Perspectiva focada", cs: "Zaměřená perspektiva",
        hu: "Fókuszált perspektíva", sv: "Fokuserat perspektiv",
        bg: "Фокусирана перспектива", da: "Fokuseret perspektiv",
        fi: "Kohdennettu näkökulma", sk: "Zameraná perspektíva",
        hr: "Fokusirana perspektiva", lt: "Sutelkta perspektyva",
        sl: "Osredotočena perspektiva", lv: "Fokusēta perspektīva",
        ga: "Dearcadh dírithe", mt: "Perspettiva ffukata",
      },
      description: {
        en: "You tend to rely on a single trusted approach. While depth is valuable, exploring additional methods might reveal new insights.",
        et: "Eelistate toetuda ühele usaldusväärsele lähenemisele. Kuigi sügavus on väärtuslik, võivad täiendavad meetodid pakkuda uusi teadmisi.",
        de: "Sie neigen dazu, sich auf einen einzigen bewährten Ansatz zu verlassen. Obwohl Tiefe wertvoll ist, könnten zusätzliche Methoden neue Erkenntnisse liefern.",
        fr: "Vous avez tendance à vous fier à une seule approche éprouvée. Bien que la profondeur soit précieuse, explorer des méthodes supplémentaires pourrait révéler de nouvelles perspectives.",
        it: "Tendi a fare affidamento su un unico approccio consolidato. Sebbene la profondità sia preziosa, esplorare metodi aggiuntivi potrebbe rivelare nuove intuizioni.",
        es: "Tiende a confiar en un único enfoque probado. Aunque la profundidad es valiosa, explorar métodos adicionales podría revelar nuevas perspectivas.",
        pl: "Masz tendencję do polegania na jednym sprawdzonym podejściu. Chociaż głębia jest cenna, dodatkowe metody mogą ujawnić nowe spostrzeżenia.",
        ro: "Aveți tendința de a vă baza pe o singură abordare de încredere. Deși profunzimea este valoroasă, explorarea metodelor suplimentare ar putea dezvălui noi perspective.",
        nl: "U vertrouwt meestal op één beproefde aanpak. Hoewel diepgang waardevol is, kunnen aanvullende methoden nieuwe inzichten opleveren.",
        el: "Τείνετε να βασίζεστε σε μία μόνο αξιόπιστη προσέγγιση. Αν και το βάθος είναι πολύτιμο, η εξερεύνηση πρόσθετων μεθόδων μπορεί να αποκαλύψει νέες ιδέες.",
        pt: "Você tende a confiar em uma única abordagem confiável. Embora a profundidade seja valiosa, explorar métodos adicionais pode revelar novos insights.",
        cs: "Máte tendenci spoléhat se na jediný osvědčený přístup. I když je hloubka cenná, prozkoumání dalších metod může odhalit nové poznatky.",
        hu: "Hajlamos egyetlen bevált megközelítésre támaszkodni. Bár a mélység értékes, további módszerek felfedezése új betekintéseket tárhat fel.",
        sv: "Du tenderar att förlita dig på ett enda beprövat tillvägagångssätt. Även om djup är värdefullt kan utforskning av ytterligare metoder avslöja nya insikter.",
        bg: "Склонни сте да разчитате на един доверен подход. Въпреки че дълбочината е ценна, изследването на допълнителни методи може да разкрие нови прозрения.",
        da: "Du har tendens til at stole på én enkelt gennemprøvet tilgang. Selvom dybde er værdifuldt, kan udforskning af yderligere metoder afsløre nye indsigter.",
        fi: "Sinulla on taipumus luottaa yhteen luotettavaan lähestymistapaan. Vaikka syvyys on arvokasta, lisämenetelmien tutkiminen saattaa paljastaa uusia oivalluksia.",
        sk: "Máte tendenciu spoliehať sa na jeden overený prístup. Aj keď je hĺbka cenná, skúmanie ďalších metód môže odhaliť nové poznatky.",
        hr: "Skloni ste oslanjanju na jedan provjereni pristup. Iako je dubina vrijedna, istraživanje dodatnih metoda moglo bi otkriti nove uvide.",
        lt: "Jūs linkę pasikliauti vienu patikimu požiūriu. Nors gylis yra vertingas, papildomų metodų tyrinėjimas gali atskleisti naujas įžvalgas.",
        sl: "Običajno se zanašate na en sam preizkušen pristop. Čeprav je globina dragocena, bi lahko raziskovanje dodatnih metod razkrilo nove uvide.",
        lv: "Jums ir tendence paļauties uz vienu uzticamu pieeju. Lai gan dziļums ir vērtīgs, papildu metožu izpēte varētu atklāt jaunas atziņas.",
        ga: "Is gnách leat brath ar aon chur chuige amháin iontaofa. Cé go bhfuil doimhneacht luachmhar, d'fhéadfadh modhanna breise léargais nua a nochtadh.",
        mt: "Int tendenza li tiddependi fuq approċċ wieħed ta' fiduċja. Filwaqt li l-profondità hija siewja, l-esplorazzjoni ta' metodi addizzjonali tista' tikxef għarfien ġdid.",
      },
    },
    balanced: {
      title: {
        en: "Balanced Approach", et: "Tasakaalustatud lähenemine",
        de: "Ausgewogener Ansatz", fr: "Approche équilibrée",
        it: "Approccio equilibrato", es: "Enfoque equilibrado",
        pl: "Zrównoważone podejście", ro: "Abordare echilibrată",
        nl: "Evenwichtige aanpak", el: "Ισορροπημένη προσέγγιση",
        pt: "Abordagem equilibrada", cs: "Vyvážený přístup",
        hu: "Kiegyensúlyozott megközelítés", sv: "Balanserat tillvägagångssätt",
        bg: "Балансиран подход", da: "Afbalanceret tilgang",
        fi: "Tasapainoinen lähestymistapa", sk: "Vyvážený prístup",
        hr: "Uravnotežen pristup", lt: "Subalansuotas požiūris",
        sl: "Uravnotežen pristop", lv: "Līdzsvarota pieeja",
        ga: "Cur chuige cothrom", mt: "Approċċ ibbilanċjat",
      },
      description: {
        en: "You are open to combining a few assessment methods. This balanced view helps you see different perspectives while maintaining focus.",
        et: "Olete avatud mõne hindamismeetodi kombineerimisele. See tasakaalustatud vaade aitab näha erinevaid vaatenurki, säilitades fookuse.",
        de: "Sie sind offen für die Kombination einiger Bewertungsmethoden. Diese ausgewogene Sichtweise hilft Ihnen, verschiedene Perspektiven zu sehen und gleichzeitig den Fokus zu behalten.",
        fr: "Vous êtes ouvert à combiner quelques méthodes d'évaluation. Cette vision équilibrée vous aide à voir différentes perspectives tout en maintenant le focus.",
        it: "Sei aperto a combinare alcuni metodi di valutazione. Questa visione equilibrata ti aiuta a vedere diverse prospettive mantenendo il focus.",
        es: "Está abierto a combinar algunos métodos de evaluación. Esta visión equilibrada le ayuda a ver diferentes perspectivas mientras mantiene el enfoque.",
        pl: "Jesteś otwarty na łączenie kilku metod oceny. Ten zrównoważony pogląd pomaga widzieć różne perspektywy, zachowując skupienie.",
        ro: "Sunteți deschis să combinați câteva metode de evaluare. Această viziune echilibrată vă ajută să vedeți perspective diferite, menținând în același timp concentrarea.",
        nl: "U staat open voor het combineren van enkele beoordelingsmethoden. Deze evenwichtige kijk helpt u verschillende perspectieven te zien terwijl u gefocust blijft.",
        el: "Είστε ανοιχτοί στο συνδυασμό μερικών μεθόδων αξιολόγησης. Αυτή η ισορροπημένη άποψη σας βοηθά να δείτε διαφορετικές προοπτικές διατηρώντας την εστίαση.",
        pt: "Você está aberto a combinar alguns métodos de avaliação. Esta visão equilibrada ajuda a ver diferentes perspectivas mantendo o foco.",
        cs: "Jste otevřeni kombinování několika metod hodnocení. Tento vyvážený pohled vám pomáhá vidět různé perspektivy při zachování zaměření.",
        hu: "Nyitott néhány értékelési módszer kombinálására. Ez a kiegyensúlyozott nézet segít különböző perspektívákat látni, miközben fenntartja a fókuszt.",
        sv: "Du är öppen för att kombinera några bedömningsmetoder. Denna balanserade syn hjälper dig att se olika perspektiv samtidigt som du behåller fokus.",
        bg: "Вие сте отворени за комбиниране на няколко метода за оценка. Този балансиран поглед ви помага да видите различни перспективи, като същевременно поддържате фокус.",
        da: "Du er åben for at kombinere nogle vurderingsmetoder. Dette afbalancerede syn hjælper dig med at se forskellige perspektiver, mens du bevarer fokus.",
        fi: "Olet avoin yhdistämään muutamia arviointimenetelmiä. Tämä tasapainoinen näkemys auttaa näkemään eri näkökulmia säilyttäen keskittymisen.",
        sk: "Ste otvorení kombinovaniu niekoľkých metód hodnotenia. Tento vyvážený pohľad vám pomáha vidieť rôzne perspektívy pri zachovaní zamerania.",
        hr: "Otvoreni ste za kombiniranje nekoliko metoda procjene. Ovaj uravnotežen pogled pomaže vam vidjeti različite perspektive zadržavajući fokus.",
        lt: "Esate atviri kelių vertinimo metodų derinimui. Šis subalansuotas požiūris padeda matyti skirtingas perspektyvas išlaikant dėmesį.",
        sl: "Odprti ste za kombiniranje nekaj metod ocenjevanja. Ta uravnotežen pogled vam pomaga videti različne perspektive, hkrati pa ohranjate osredotočenost.",
        lv: "Jūs esat atvērti dažu vērtēšanas metožu kombinēšanai. Šis līdzsvarotais skatījums palīdz redzēt dažādas perspektīvas, vienlaikus saglabājot fokusu.",
        ga: "Tá tú oscailte do roinnt modhanna measúnaithe a chomhcheangal. Cuidíonn an dearcadh cothrom seo leat dearcaí éagsúla a fheiceáil agus fócas á choinneáil.",
        mt: "Inti miftuħ biex tikkombina ftit metodi ta' valutazzjoni. Din il-perspettiva bbilanċjata tgħinek tara perspettivi differenti filwaqt li żżomm il-fokus.",
      },
    },
    explorer: {
      title: {
        en: "Open-Minded Explorer", et: "Avatud meelega avastaja",
        de: "Aufgeschlossener Entdecker", fr: "Explorateur ouvert d'esprit",
        it: "Esploratore aperto", es: "Explorador de mente abierta",
        pl: "Otwarty odkrywca", ro: "Explorator deschis la minte",
        nl: "Open-minded ontdekker", el: "Ανοιχτόμυαλος εξερευνητής",
        pt: "Explorador de mente aberta", cs: "Otevřený průzkumník",
        hu: "Nyitott felfedező", sv: "Öppensinnad utforskare",
        bg: "Отворен изследовател", da: "Åbensindet opdagelsesrejsende",
        fi: "Avomielinen tutkija", sk: "Otvorený prieskumník",
        hr: "Otvoreni istraživač", lt: "Atviras tyrinėtojas",
        sl: "Odprt raziskovalec", lv: "Atvērta prāta pētnieks",
        ga: "Taiscéalaí oscailte", mt: "Esploratur b'moħħ miftuħ",
      },
      description: {
        en: "Excellent! You embrace multiple assessment methods and understand that diverse approaches together provide the most complete picture of talent.",
        et: "Suurepärane! Võtate omaks mitmeid hindamismeetodeid ja mõistate, et erinevad lähenemised koos annavad talendist kõige terviklikuma pildi.",
        de: "Ausgezeichnet! Sie setzen auf mehrere Bewertungsmethoden und verstehen, dass verschiedene Ansätze zusammen das vollständigste Bild von Talent liefern.",
        fr: "Excellent ! Vous adoptez plusieurs méthodes d'évaluation et comprenez que des approches diverses ensemble fournissent l'image la plus complète du talent.",
        it: "Eccellente! Abbracci diversi metodi di valutazione e capisci che approcci diversi insieme forniscono l'immagine più completa del talento.",
        es: "¡Excelente! Adopta múltiples métodos de evaluación y comprende que diversos enfoques juntos proporcionan la imagen más completa del talento.",
        pl: "Doskonale! Stosujesz wiele metod oceny i rozumiesz, że różnorodne podejścia razem dają najpełniejszy obraz talentu.",
        ro: "Excelent! Îmbrățișați mai multe metode de evaluare și înțelegeți că abordările diverse împreună oferă imaginea cea mai completă a talentului.",
        nl: "Uitstekend! U omarmt meerdere beoordelingsmethoden en begrijpt dat diverse benaderingen samen het meest complete beeld van talent geven.",
        el: "Εξαιρετικά! Αγκαλιάζετε πολλαπλές μεθόδους αξιολόγησης και κατανοείτε ότι διαφορετικές προσεγγίσεις μαζί παρέχουν την πληρέστερη εικόνα του ταλέντου.",
        pt: "Excelente! Você abraça vários métodos de avaliação e entende que abordagens diversas juntas fornecem a imagem mais completa do talento.",
        cs: "Výborně! Přijímáte více metod hodnocení a chápete, že různé přístupy dohromady poskytují nejúplnější obraz o talentu.",
        hu: "Kiváló! Több értékelési módszert alkalmaz, és megérti, hogy a különböző megközelítések együtt adják a legteljesebb képet a tehetségről.",
        sv: "Utmärkt! Du omfamnar flera bedömningsmetoder och förstår att olika tillvägagångssätt tillsammans ger den mest kompletta bilden av talang.",
        bg: "Отлично! Вие прегръщате множество методи за оценка и разбирате, че различните подходи заедно дават най-пълната картина на таланта.",
        da: "Fremragende! Du omfavner flere vurderingsmetoder og forstår, at forskellige tilgange sammen giver det mest komplette billede af talent.",
        fi: "Erinomaista! Otat vastaan useita arviointimenetelmiä ja ymmärrät, että erilaiset lähestymistavat yhdessä antavat täydellisimmän kuvan lahjakkuudesta.",
        sk: "Výborne! Prijímate viacero metód hodnotenia a chápete, že rôzne prístupy spolu poskytujú najúplnejší obraz talentu.",
        hr: "Izvrsno! Prihvaćate više metoda procjene i razumijete da različiti pristupi zajedno daju najpotpuniju sliku talenta.",
        lt: "Puiku! Jūs priimate kelis vertinimo metodus ir suprantate, kad įvairūs požiūriai kartu suteikia išsamiausią talento vaizdą.",
        sl: "Odlično! Sprejemate več metod ocenjevanja in razumete, da raznovrstni pristopi skupaj zagotavljajo najcelovitejšo sliko talenta.",
        lv: "Lieliski! Jūs pieņemat vairākas vērtēšanas metodes un saprotat, ka dažādas pieejas kopā sniedz vispilnīgāko priekšstatu par talantu.",
        ga: "Go hiontach! Glacann tú le modhanna measúnaithe iolracha agus tuigeann tú go dtugann cur chuige éagsúla le chéile an pictiúr is iomláine de thalann.",
        mt: "Eċċellenti! Int tħaddan metodi multipli ta' valutazzjoni u tifhem li approċċi diversi flimkien jipprovdu l-istampa l-aktar kompluta tat-talent.",
      },
    },
  };

  // Default Open-Mindedness question template for new quizzes
  const getDefaultOMQuestion = (): Question => ({
    id: `new-${Date.now()}`,
    question_text: DEFAULT_OM_QUESTION_TEXT,
    question_order: 1000,
    question_type: "open_mindedness",
    answers: DEFAULT_OM_ANSWERS.map((a, i) => ({
      id: `new-${Date.now()}-${i + 1}`,
      answer_text: a.text,
      answer_order: a.order,
      score_value: a.score,
    })),
  });

  // Initialize new quiz with default OM question template
  const initializeNewQuizWithOM = () => {
    setQuestions([getDefaultOMQuestion()]);
  };

  // Create default OM question and result levels for new quizzes
  const createDefaultOMQuestionAndLevels = async (quizId: string) => {
    // Create the OM question
    const { data: questionData, error: questionError } = await supabase
      .from("quiz_questions")
      .insert({
        quiz_id: quizId,
        question_text: DEFAULT_OM_QUESTION_TEXT,
        question_order: 1000,
        question_type: "open_mindedness",
      })
      .select()
      .single();

    if (questionError) {
      console.error("Error creating OM question:", questionError);
      return;
    }

    // Create default OM answers
    const { error: answersError } = await supabase.from("quiz_answers").insert(
      DEFAULT_OM_ANSWERS.map((a) => ({
        question_id: questionData.id,
        answer_text: a.text,
        answer_order: a.order,
        score_value: a.score,
      }))
    );

    if (answersError) {
      console.error("Error creating OM answers:", answersError);
    }

    // Create default OM result levels
    const defaultResultLevels = [
      {
        quiz_id: quizId,
        min_score: 0,
        max_score: 1,
        title: DEFAULT_OM_RESULT_LEVELS.focused.title,
        description: DEFAULT_OM_RESULT_LEVELS.focused.description,
        emoji: "🎯",
        color_class: "from-amber-500 to-orange-600",
      },
      {
        quiz_id: quizId,
        min_score: 2,
        max_score: 2,
        title: DEFAULT_OM_RESULT_LEVELS.balanced.title,
        description: DEFAULT_OM_RESULT_LEVELS.balanced.description,
        emoji: "⚖️",
        color_class: "from-blue-500 to-indigo-600",
      },
      {
        quiz_id: quizId,
        min_score: 3,
        max_score: 4,
        title: DEFAULT_OM_RESULT_LEVELS.explorer.title,
        description: DEFAULT_OM_RESULT_LEVELS.explorer.description,
        emoji: "🌟",
        color_class: "from-emerald-500 to-green-600",
      },
    ];

    const { error: levelsError } = await supabase
      .from("open_mindedness_result_levels")
      .insert(defaultResultLevels);

    if (levelsError) {
      console.error("Error creating OM result levels:", levelsError);
    }
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
        cta_title: ctaTitle,
        cta_description: ctaDescription,
        cta_url: ctaUrl,
        duration_text: durationText,
        is_active: isActive,
        primary_language: primaryLanguage,
        quiz_type: quizType,
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        enable_scoring: enableScoring,
        include_open_mindedness: includeOpenMindedness,
        tone_of_voice: toneOfVoice,
        tone_source: toneSource,
        use_tone_for_ai: useToneForAi,
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

        // Auto-create default OM question and result levels when includeOpenMindedness is enabled
        if (includeOpenMindedness) {
          await createDefaultOMQuestionAndLevels(savedQuizId);
        }
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
        body: { quizId, sourceLanguage: primaryLanguage, model: selectedAiModel },
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

  // Toggle open-mindedness and save immediately to database
  const handleOpenMindednessToggle = async (checked: boolean) => {
    setIncludeOpenMindedness(checked);
    
    if (!isCreating && quizId) {
      try {
        const { error } = await supabase
          .from("quizzes")
          .update({ include_open_mindedness: checked })
          .eq("id", quizId);

        if (error) throw error;

        toast({
          title: checked ? "Module enabled" : "Module disabled",
          description: `Open-Mindedness module is now ${checked ? 'ON' : 'OFF'}`,
        });

        await logActivity({
          actionType: "UPDATE",
          tableName: "quizzes",
          recordId: quizId,
          fieldName: "include_open_mindedness",
          oldValue: String(!checked),
          newValue: String(checked),
          description: `Open-Mindedness module ${checked ? 'enabled' : 'disabled'}`,
        });
      } catch (error: any) {
        console.error("Error updating open-mindedness setting:", error);
        setIncludeOpenMindedness(!checked); // Revert on error
        toast({
          title: "Error",
          description: "Failed to update setting",
          variant: "destructive",
        });
      }
    }
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

  const duplicateQuestion = (index: number) => {
    const question = questions[index];
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      question_text: { ...jsonToRecord(question.question_text) },
      question_order: questions.length + 1,
      question_type: question.question_type,
      answers: question.answers.map((a, i) => ({
        id: `new-${Date.now()}-${i}`,
        answer_text: { ...jsonToRecord(a.answer_text) },
        answer_order: a.answer_order,
        score_value: a.score_value,
      })),
    };
    setQuestions([...questions, newQuestion]);
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

  // Validate point ranges coverage
  const getPointRangeValidation = () => {
    if (resultLevels.length === 0) {
      return { isValid: false, message: "No result levels", gaps: [], overlaps: [] };
    }

    // Calculate max possible score from questions
    let maxPossibleScore = 0;
    let minPossibleScore = 0;
    for (const q of questions.filter(q => q.question_type !== "open_mindedness")) {
      if (q.answers.length > 0) {
        const scores = q.answers.map(a => a.score_value);
        maxPossibleScore += Math.max(...scores);
        minPossibleScore += Math.min(...scores);
      }
    }

    // Sort levels by min_score
    const sortedLevels = [...resultLevels].sort((a, b) => a.min_score - b.min_score);
    const gaps: string[] = [];
    const overlaps: string[] = [];

    // Check start coverage
    if (sortedLevels[0]?.min_score > minPossibleScore) {
      gaps.push(`${minPossibleScore}-${sortedLevels[0].min_score - 1}`);
    }

    // Check gaps and overlaps between levels
    for (let i = 0; i < sortedLevels.length - 1; i++) {
      const current = sortedLevels[i];
      const next = sortedLevels[i + 1];
      
      if (current.max_score + 1 < next.min_score) {
        gaps.push(`${current.max_score + 1}-${next.min_score - 1}`);
      } else if (current.max_score >= next.min_score) {
        overlaps.push(`${next.min_score}-${current.max_score}`);
      }
    }

    // Check end coverage
    const lastLevel = sortedLevels[sortedLevels.length - 1];
    if (lastLevel?.max_score < maxPossibleScore) {
      gaps.push(`${lastLevel.max_score + 1}-${maxPossibleScore}`);
    }

    const isValid = gaps.length === 0 && overlaps.length === 0;
    let message = isValid ? `All points covered (${minPossibleScore}–${maxPossibleScore})` : "";
    if (gaps.length > 0) message = `Gaps: ${gaps.join(", ")}`;
    if (overlaps.length > 0) message += `${gaps.length > 0 ? " | " : ""}Overlaps: ${overlaps.join(", ")}`;

    return { isValid, message, gaps, overlaps, minScore: minPossibleScore, maxScore: maxPossibleScore };
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

  // Error checking hook
  const errorChecker = QuizErrorChecker({
    quizId: quizId || "",
    slug,
    title,
    description,
    headline,
    headlineHighlight,
    ctaText,
    ctaUrl,
    durationText,
    questions,
    resultLevels,
    includeOpenMindedness,
    primaryLanguage,
    getLocalizedValue,
  });

  const handleCheckErrors = async () => {
    setIsCheckingErrors(true);
    const result = await errorChecker.checkErrors();
    setErrorCheckResult(result);
    setIsCheckingErrors(false);
    
    if (result.isValid) {
      toast({
        title: "All checks passed!",
        description: "Your quiz is ready to launch.",
      });
    } else {
      toast({
        title: `Found ${result.errors.length} issue${result.errors.length > 1 ? "s" : ""}`,
        description: "Please review and fix the errors before launching.",
        variant: "destructive",
      });
    }
  };

  // Handle activation toggle with error check
  const handleActivationToggle = async (checked: boolean) => {
    // If trying to activate, run error check first
    if (checked && !isCreating) {
      setIsCheckingErrors(true);
      const result = await errorChecker.checkErrors();
      setErrorCheckResult(result);
      setIsCheckingErrors(false);

      if (!result.isValid) {
        toast({
          title: "Cannot activate quiz",
          description: `Please fix ${result.errors.length} issue${result.errors.length > 1 ? "s" : ""} before activating.`,
          variant: "destructive",
        });
        return; // Don't activate if errors exist
      }

      toast({
        title: "Quiz activated!",
        description: "All checks passed. Your quiz is now live.",
      });
    }

    setIsActive(checked);
  };

  // Handle AI model change
  const handleAiModelChange = (newModel: AiModelId) => {
    if (newModel !== selectedAiModel) {
      setPreviousAiModel(selectedAiModel);
      setSelectedAiModel(newModel);
      setRegenerationTasks([]);
      setRegenerationProgress(0);
      setShowRegenerationDialog(true);
    }
  };

  // Handle regeneration
  const handleRegeneration = async (type: RegenerationType) => {
    if (type === "none") {
      setShowRegenerationDialog(false);
      return;
    }

    setIsRegenerating(true);
    
    // Define tasks based on what needs regeneration
    const tasks: Array<{
      id: string;
      label: string;
      status: "pending" | "running" | "done" | "error";
      errorMessage?: string;
    }> = [];

    // Check what AI content exists/is missing
    const hasResults = resultLevels.length > 0;
    const hasTone = !!toneOfVoice;
    const hasIcp = !!icpDescription;
    const hasPersona = !!buyingPersona;

    if (type === "all") {
      tasks.push({ id: "results", label: "Result Levels", status: "pending" });
      if (hasTone) tasks.push({ id: "tone", label: "Tone of Voice", status: "pending" });
      if (hasIcp) tasks.push({ id: "icp", label: "ICP Description", status: "pending" });
      if (hasPersona) tasks.push({ id: "persona", label: "Buying Persona", status: "pending" });
    } else {
      // Only missing
      if (!hasResults) tasks.push({ id: "results", label: "Result Levels", status: "pending" });
      if (!hasTone) tasks.push({ id: "tone", label: "Tone of Voice", status: "pending" });
      if (!hasIcp) tasks.push({ id: "icp", label: "ICP Description", status: "pending" });
      if (!hasPersona) tasks.push({ id: "persona", label: "Buying Persona", status: "pending" });
    }

    if (tasks.length === 0) {
      toast({
        title: "Nothing to regenerate",
        description: type === "missing" ? "All AI content already exists" : "No AI content to regenerate",
      });
      setIsRegenerating(false);
      setShowRegenerationDialog(false);
      return;
    }

    setRegenerationTasks(tasks);

    // Process tasks sequentially
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Update task to running
      setRegenerationTasks(prev => 
        prev.map(t => t.id === task.id ? { ...t, status: "running" } : t)
      );

      try {
        // Simulate task execution - in reality, these would call the actual edge functions
        // For now, we'll just show the progress UI
        if (task.id === "results" && quizId && quizId !== "new") {
          // Trigger result generation would happen here
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          // Other tasks
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        // Mark as done
        setRegenerationTasks(prev => 
          prev.map(t => t.id === task.id ? { ...t, status: "done" } : t)
        );
      } catch (error) {
        setRegenerationTasks(prev => 
          prev.map(t => t.id === task.id ? { 
            ...t, 
            status: "error", 
            errorMessage: error instanceof Error ? error.message : "Failed" 
          } : t)
        );
      }

      // Update progress
      setRegenerationProgress(((i + 1) / tasks.length) * 100);
    }

    setIsRegenerating(false);
    toast({
      title: "Regeneration complete",
      description: `Processed ${tasks.length} item(s) with ${selectedAiModel.split('/')[1]}`,
    });
  };

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
                  onClick={() => navigate(returnPath)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <h1 className="text-2xl font-bold">
                  {isCreating ? "Create New Quiz" : `Edit Quiz: ${getLocalizedValue(title, "en") || slug}`}
                </h1>
                {!isCreating && quizType === "hypothesis" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <FileQuestion className="w-3.5 h-3.5" />
                    Hypothesis Quiz
                  </span>
                )}
                {!isCreating && quizType === "standard" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    Standard Quiz
                  </span>
                )}
                {!isCreating && quizType === "emotional" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-600 border border-teal-500/20">
                    🧘 Emotional Quiz
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Auto-save indicator for existing quizzes */}
                {!isCreating && <AutoSaveIndicator status={autoSaveStatus} pendingChangesCount={pendingChangesCount} />}
                
                {/* Check Errors button */}
                {!isCreating && (
                  <CheckErrorsButton
                    onClick={handleCheckErrors}
                    isChecking={isCheckingErrors}
                    lastCheck={errorCheckResult}
                    onFixClick={() => {
                      if (errorCheckResult?.errors) {
                        const firstTab = getFirstErrorTab(errorCheckResult.errors);
                        if (firstTab) {
                          setActiveTab(firstTab);
                        }
                      }
                    }}
                  />
                )}
                
                {!isCreating && slug && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/${slug}`, '_blank')}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Quiz
                  </Button>
                )}
                {/* Manual save only for new quizzes */}
                {isCreating && (
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Create Quiz"}
                  </Button>
                )}
              </div>
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
          
          {/* AI Cost and Model Selector - after translate button */}
          {!isCreating && !previewLanguage && (
            <AiModelSelector
              totalCost={totalAiCost}
              selectedModel={selectedAiModel}
              onModelChange={handleAiModelChange}
              disabled={isRegenerating}
            />
          )}
          
          {previewLanguage && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
              Preview mode - changes disabled
            </span>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="admin-tabs-list">
            <TabsTrigger value="general" className="admin-tab-trigger gap-1.5">
              General
              {errorCheckResult && !errorCheckResult.isValid && (() => {
                const count = errorCheckResult.errors.filter(e => e.tab === "general").length;
                return count > 0 ? (
                  <span className="admin-tab-trigger-badge admin-tab-trigger-badge-error">
                    {count}
                  </span>
                ) : null;
              })()}
            </TabsTrigger>
            {quizType !== "hypothesis" && (
              <TabsTrigger value="questions" className="admin-tab-trigger gap-1.5">
                Questions
                <span className="admin-tab-trigger-badge admin-tab-trigger-badge-count">
                  {questions.filter(q => q.question_type !== "open_mindedness").length}
                </span>
                {errorCheckResult && !errorCheckResult.isValid && (() => {
                  const count = errorCheckResult.errors.filter(e => e.tab === "questions").length;
                  return count > 0 ? (
                    <span className="admin-tab-trigger-badge admin-tab-trigger-badge-error">
                      {count}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
            )}
            {quizType === "hypothesis" && (
              <TabsTrigger value="hypothesis" className="admin-tab-trigger gap-1.5">
                <FileQuestion className="w-4 h-4" />
                Hypotheses
              </TabsTrigger>
            )}
            <TabsTrigger value="results" className="admin-tab-trigger gap-1.5">
              Results
              <span className="admin-tab-trigger-badge admin-tab-trigger-badge-count">
                {resultLevels.length}
              </span>
              {errorCheckResult && !errorCheckResult.isValid && (() => {
                const count = errorCheckResult.errors.filter(e => e.tab === "results").length;
                return count > 0 ? (
                  <span className="admin-tab-trigger-badge admin-tab-trigger-badge-error">
                    {count}
                  </span>
                ) : null;
              })()}
            </TabsTrigger>
            <TabsTrigger value="mindedness" className="admin-tab-trigger gap-1.5">
              Open-Mind
              <span className={`admin-tab-trigger-badge ${includeOpenMindedness ? 'admin-tab-trigger-badge-success' : 'admin-tab-trigger-badge-muted'}`}>
                {includeOpenMindedness ? 'ON' : 'OFF'}
              </span>
            </TabsTrigger>
            <TabsTrigger value="respondents" className="admin-tab-trigger gap-1.5">
              Respondents
              <span className="admin-tab-trigger-badge admin-tab-trigger-badge-count">
                {respondentsCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="admin-tab-trigger gap-1.5">
              Stats
              <span className="admin-tab-trigger-badge admin-tab-trigger-badge-count">
                {respondentsCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="web" className="admin-tab-trigger gap-1.5">
              Web
              <span className="admin-tab-trigger-badge admin-tab-trigger-badge-count">
                {webConversionRate}%
              </span>
            </TabsTrigger>
            <TabsTrigger value="log" className="admin-tab-trigger gap-1.5">
              Log
              <span className="admin-tab-trigger-badge admin-tab-trigger-badge-count">
                {activityLogsCount}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="admin-tab-content space-y-3">
            {/* Error display for this tab */}
            {errorCheckResult && !errorCheckResult.isValid && (
              <QuizErrorDisplay errors={errorCheckResult.errors} activeTab="general" />
            )}
            
            <div className="grid grid-cols-7 gap-3">
              <div>
                <Label htmlFor="slug" className="text-xs">Slug</Label>
                <div className="flex gap-1">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="quiz-url"
                    className="h-8 flex-1"
                  />
                  {slug && !isCreating && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => window.open(`/${slug}`, '_blank')}
                      title={`Open /${slug}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Quiz Type</Label>
                <Select value={quizType} onValueChange={(v: "standard" | "hypothesis" | "emotional") => setQuizType(v)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="hypothesis">Hypothesis</SelectItem>
                    <SelectItem value="emotional">Emotional</SelectItem>
                  </SelectContent>
                </Select>
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
                <Switch 
                  checked={isActive} 
                  onCheckedChange={handleActivationToggle}
                  disabled={isCheckingErrors}
                />
                <Label className="text-xs flex items-center gap-1">
                  {isCheckingErrors ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      {isActive ? "Active" : "Inactive"}
                    </>
                  )}
                </Label>
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

            {/* Tone of Voice */}
            <ToneOfVoiceEditor
              toneOfVoice={toneOfVoice}
              toneSource={toneSource}
              useToneForAi={useToneForAi}
              toneIntensity={toneIntensity}
              icpDescription={icpDescription}
              buyingPersona={buyingPersona}
              quizId={isCreating ? undefined : quizId}
              model={selectedAiModel}
              isPreviewMode={isPreviewMode}
              onToneChange={setToneOfVoice}
              onSourceChange={setToneSource}
              onUseToneChange={setUseToneForAi}
              onIntensityChange={setToneIntensity}
              onIcpChange={setIcpDescription}
              onBuyingPersonaChange={setBuyingPersona}
            />

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
                <Label className="text-xs">CTA Button Text ({displayLanguage.toUpperCase()})</Label>
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
              <div className="md:col-span-2">
                <Label className="text-xs">CTA Section Title ({displayLanguage.toUpperCase()})</Label>
                <Input
                  value={ctaTitle[displayLanguage] || ""}
                  onChange={(e) => setLocalizedValue(setCtaTitle, displayLanguage, e.target.value)}
                  placeholder="Ready for Precise Employee Assessment?"
                  className="h-8"
                  disabled={isPreviewMode}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">CTA Section Description ({displayLanguage.toUpperCase()})</Label>
                <Textarea
                  value={ctaDescription[displayLanguage] || ""}
                  onChange={(e) => setLocalizedValue(setCtaDescription, displayLanguage, e.target.value)}
                  placeholder="This quiz provides a general overview. For accurate, in-depth analysis..."
                  className="min-h-[60px]"
                  disabled={isPreviewMode}
                />
              </div>
            </div>
          </TabsContent>

          {quizType !== "hypothesis" && (
            <TabsContent value="questions" className="admin-tab-content space-y-3">
              {/* Error display for this tab */}
              {errorCheckResult && !errorCheckResult.isValid && (
                <QuizErrorDisplay errors={errorCheckResult.errors} activeTab="questions" />
              )}

              {/* Question Settings and Points Summary */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg border">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={shuffleQuestions} 
                      onCheckedChange={setShuffleQuestions}
                      disabled={isPreviewMode}
                    />
                    <Label className="text-xs">Shuffle questions</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={shuffleAnswers} 
                      onCheckedChange={setShuffleAnswers}
                      disabled={isPreviewMode}
                    />
                    <Label className="text-xs">Shuffle answers</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={includeOpenMindedness} 
                      onCheckedChange={handleOpenMindednessToggle}
                      disabled={isPreviewMode || isCreating}
                    />
                    <Label className="text-xs">Include Open-Mindedness module</Label>
                  </div>
                </div>

                {/* Total Points Summary */}
                {enableScoring && (() => {
                  const regularQuestions = questions.filter(q => q.question_type !== "open_mindedness");
                  const totalMaxPoints = regularQuestions.reduce((sum, q) => {
                    const maxScore = q.answers.length > 0 ? Math.max(...q.answers.map(a => a.score_value)) : 0;
                    return sum + maxScore;
                  }, 0);
                  const questionCount = regularQuestions.length;
                  return (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{questionCount} questions</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium text-primary">{totalMaxPoints} max pts</span>
                    </div>
                  );
                })()}
              </div>

              {!isPreviewMode && (
                <Button onClick={addQuestion} variant="outline" size="sm" className="w-full h-8 text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Question
                </Button>
              )}

              <SortableQuestionList
                questions={questions}
                displayLanguage={displayLanguage}
                isPreviewMode={isPreviewMode}
                enableScoring={enableScoring}
                onReorderQuestions={(reorderedQuestions) => setQuestions(reorderedQuestions)}
                onUpdateQuestion={updateQuestion}
                onDeleteQuestion={deleteQuestion}
                onDuplicateQuestion={duplicateQuestion}
                onAddAnswer={addAnswer}
                onUpdateAnswer={updateAnswer}
                onDeleteAnswer={deleteAnswer}
                onReorderAnswers={(qIndex, reorderedAnswers) => {
                  updateQuestion(qIndex, { answers: reorderedAnswers });
                }}
                getLocalizedValue={getLocalizedValue}
                jsonToRecord={jsonToRecord}
              />
            </TabsContent>
          )}

          <TabsContent value="mindedness" className="admin-tab-content space-y-3">
            {/* Error display for this tab */}
            {errorCheckResult && !errorCheckResult.isValid && (
              <QuizErrorDisplay errors={errorCheckResult.errors} activeTab="mindedness" />
            )}
            
            {/* Toggle control */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-primary" />
                <div>
                  <Label className="text-sm font-medium">Open-Mindedness Module</Label>
                  <p className="text-xs text-muted-foreground">
                    Multi-select question shown after all quiz questions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${includeOpenMindedness ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  {includeOpenMindedness ? 'Enabled' : 'Disabled'}
                </span>
                <Switch 
                  checked={includeOpenMindedness} 
                  onCheckedChange={handleOpenMindednessToggle}
                  disabled={isPreviewMode || isCreating}
                />
              </div>
            </div>

            {isCreating && (
              <div className="text-center py-6 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground">
                  Save the quiz first to configure the Open-Mindedness module.
                </p>
              </div>
            )}

            {!isCreating && (
              <>
                <OpenMindednessEditor
                  questions={questions}
                  setQuestions={setQuestions}
                  displayLanguage={displayLanguage}
                  isPreviewMode={isPreviewMode}
                  includeOpenMindedness={includeOpenMindedness}
                  enableScoring={enableScoring}
                />
                
                {/* Open-Mindedness Result Levels */}
                {includeOpenMindedness && quizId && (
                  <OpenMindednessResultLevels
                    quizId={quizId}
                    questions={questions}
                    displayLanguage={displayLanguage}
                    isPreviewMode={isPreviewMode}
                    model={selectedAiModel}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="results" className="admin-tab-content space-y-3">
            {/* Error display for this tab */}
            {errorCheckResult && !errorCheckResult.isValid && (
              <QuizErrorDisplay errors={errorCheckResult.errors} activeTab="results" />
            )}
            
            {/* Compact Results Header */}
            <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg border">
              {/* Point Range Validator */}
              {(() => {
                const validation = getPointRangeValidation();
                return (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                    validation.isValid 
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" 
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  }`}>
                    {validation.isValid ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span className="font-medium">{validation.message}</span>
                  </div>
                );
              })()}

              {/* AI Model Selector - moved to header */}

              <div className="flex-1" />

              {/* Action Buttons */}
              {!isPreviewMode && !isCreating && (
                <>
                  {(() => {
                    const validation = getPointRangeValidation();
                    return (
                      <>
                        <AutoSuggestScoresButton
                          resultLevels={resultLevels}
                          minPossibleScore={validation.minScore ?? 0}
                          maxPossibleScore={validation.maxScore ?? 100}
                          onUpdateLevels={setResultLevels}
                        />
                        <SyncAnswerWeightsButton
                          quizId={quizId!}
                          questions={questions}
                          resultLevels={resultLevels}
                          language={primaryLanguage}
                          onUpdateQuestions={setQuestions}
                          getLocalizedValue={getLocalizedValue}
                        />
                      </>
                    );
                  })()}
                  <BulkAiFillButton
                    quizId={quizId!}
                    language={primaryLanguage}
                    model={selectedAiModel}
                    resultLevels={resultLevels}
                    onUpdateLevel={updateResultLevel}
                    getLocalizedValue={getLocalizedValue}
                    jsonToRecord={jsonToRecord}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVersionsDialog(true)}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    Versions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGenerateDialog(true)}
                    className="h-7 px-2 text-xs gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate with AI
                  </Button>
                </>
              )}
              {!isPreviewMode && (
                <Button 
                  onClick={addResultLevel} 
                  size="sm" 
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Level
                </Button>
              )}
            </div>

            <SortableResultList
              resultLevels={resultLevels}
              displayLanguage={displayLanguage}
              isPreviewMode={isPreviewMode}
              quizId={quizId}
              model={selectedAiModel}
              onReorderLevels={(reorderedLevels) => setResultLevels(reorderedLevels)}
              onUpdateLevel={updateResultLevel}
              onDeleteLevel={deleteResultLevel}
              getLocalizedValue={getLocalizedValue}
              jsonToRecord={jsonToRecord}
            />

            {/* AI Dialogs */}
            {!isCreating && quizId && (
              <>
                <GenerateResultsDialog
                  open={showGenerateDialog}
                  onOpenChange={setShowGenerateDialog}
                  quizId={quizId}
                  language={primaryLanguage}
                  model={selectedAiModel}
                  onResultsGenerated={(levels) => setResultLevels(levels)}
                />
                <ResultVersionsDialog
                  open={showVersionsDialog}
                  onOpenChange={setShowVersionsDialog}
                  quizId={quizId}
                  onRestoreVersion={(levels) => setResultLevels(levels)}
                />
              </>
            )}
          </TabsContent>

          {/* Respondents Tab */}
          <TabsContent value="respondents" className="admin-tab-content space-y-3">
            {isCreating ? (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground">
                  Save the quiz first to view respondents.
                </p>
              </div>
            ) : quizId ? (
              <QuizRespondents quizId={quizId} displayLanguage={displayLanguage} quizType={quizType} />
            ) : null}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="admin-tab-content space-y-4">
            {isCreating ? (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground">
                  Save the quiz first to view statistics.
                </p>
              </div>
            ) : quizId ? (
              <>
                <QuizStats 
                  quizId={quizId} 
                  displayLanguage={displayLanguage}
                  questions={questions}
                  includeOpenMindedness={includeOpenMindedness}
                  quizType={quizType}
                />
              </>
            ) : null}
          </TabsContent>

          {/* Hypothesis Tab - only for hypothesis quizzes */}
          {quizType === "hypothesis" && (
            <TabsContent value="hypothesis" className="admin-tab-content space-y-4">
              {isCreating ? (
                <div className="text-center py-8 border rounded-lg border-dashed">
                  <p className="text-sm text-muted-foreground">
                    Save the quiz first to manage hypothesis pages.
                  </p>
                </div>
              ) : quizId ? (
                <HypothesisQuizEditor quizId={quizId} language={displayLanguage} />
              ) : null}
            </TabsContent>
          )}

          {/* Web Stats Tab */}
          <TabsContent value="web" className="admin-tab-content space-y-4">
            {isCreating ? (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground">
                  Save the quiz first to view web statistics.
                </p>
              </div>
            ) : quizId ? (
              <QuizWebStats 
                quizId={quizId} 
                quizSlug={slug}
                includeOpenMindedness={includeOpenMindedness}
                quizType={quizType}
              />
            ) : null}
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="log" className="admin-tab-content space-y-3">
            {isCreating ? (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground">
                  Save the quiz first to view activity log.
                </p>
              </div>
            ) : quizId ? (
              <QuizActivityLog quizId={quizId} />
            ) : null}
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </main>

      {/* AI Model Regeneration Dialog */}
      <RegenerationDialog
        open={showRegenerationDialog}
        onOpenChange={setShowRegenerationDialog}
        newModel={selectedAiModel}
        oldModel={previousAiModel}
        onRegenerate={handleRegeneration}
        tasks={regenerationTasks}
        isRunning={isRegenerating}
        progress={regenerationProgress}
      />
    </div>
  );
}
