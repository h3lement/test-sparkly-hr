import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Mail, AlertTriangle, Check, ChevronDown, ChevronUp, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmailVersionHistory, WebVersionHistory } from "./VersionHistoryTables";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { supabase } from "@/integrations/supabase/client";

interface EmailTemplate {
  id: string;
  version_number: number;
  template_type: string;
  sender_name: string;
  sender_email: string;
  subjects: Record<string, string>;
  body_content?: Record<string, string>;
  is_live: boolean;
  created_at: string;
  created_by_email: string | null;
  quiz_id: string | null;
}

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
  primary_language: string;
}

interface QuizLiveStatus {
  quiz: Quiz;
  hasLiveEmail: boolean;
  hasLiveWeb: boolean;
}

// Email translations for preview - includes sample result data
const emailTranslations: Record<string, {
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  visitSparkly: string;
  leadershipOpenMindedness: string;
  openMindednessOutOf: string;
  sampleResultTitle: string;
  sampleResultDescription: string;
  sampleInsight1: string;
  sampleInsight2: string;
  sampleInsight3: string;
}> = {
  en: {
    yourResults: "Your Team Performance Results",
    outOf: "out of",
    points: "points",
    keyInsights: "Key Insights",
    wantToImprove: "Want to improve your team's performance?",
    visitSparkly: "Visit Sparkly.hr",
    leadershipOpenMindedness: "Leadership Open-Mindedness",
    openMindednessOutOf: "out of 4",
    sampleResultTitle: "Room for Improvement",
    sampleResultDescription: "Your team has solid potential, but friction points are costing you valuable time and slowing growth.",
    sampleInsight1: "Hidden Time Drain: Tasks that should take 2 hours often stretch to 4-6 hours.",
    sampleInsight2: "Communication Debt: Delays and rework often trace back to assumptions.",
    sampleInsight3: "Untapped Potential: Your team likely has capabilities you're not fully leveraging.",
  },
  et: {
    yourResults: "Sinu meeskonna tulemuslikkuse tulemused",
    outOf: "punkti",
    points: "punktist",
    keyInsights: "Peamised tähelepanekud",
    wantToImprove: "Soovid parandada oma meeskonna tulemuslikkust?",
    visitSparkly: "Külasta Sparkly.hr",
    leadershipOpenMindedness: "Avatud mõtlemisega juhtimine",
    openMindednessOutOf: "4-st",
    sampleResultTitle: "Arenguruumi on",
    sampleResultDescription: "Sinu meeskonnal on tugev potentsiaal, kuid hõõrdumiskohad kulutavad sinu väärtuslikku aega ja aeglustavad kasvu.",
    sampleInsight1: "Peidetud ajakadu: Ülesanded, mis peaksid võtma 2 tundi, venivad sageli 4-6 tunnini.",
    sampleInsight2: "Kommunikatsioonivõlg: Viivitused ja ümbertöötlemine tulenevad sageli oletustest.",
    sampleInsight3: "Kasutamata potentsiaal: Sinu meeskonnal on tõenäoliselt võimeid, mida sa täielikult ei kasuta.",
  },
};

export function TemplateVersionsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("web");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<string>("en");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [liveStatus, setLiveStatus] = useState<QuizLiveStatus[]>([]);
  const [showMissingDetails, setShowMissingDetails] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, slug, primary_language")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const typedQuizzes = data.map(q => ({
        ...q,
        title: q.title as Record<string, string>,
      }));
      setQuizzes(typedQuizzes);
      return typedQuizzes;
    }
    return [];
  }, []);

  const fetchLiveStatus = useCallback(async (quizList: Quiz[]) => {
    if (quizList.length === 0) return;

    // Fetch live email templates
    const { data: liveEmails } = await supabase
      .from("email_templates")
      .select("quiz_id")
      .eq("is_live", true)
      .eq("template_type", "quiz_results");

    // Fetch live web result versions
    const { data: liveWebs } = await supabase
      .from("quiz_result_versions")
      .select("quiz_id")
      .eq("is_live", true);

    const liveEmailQuizIds = new Set((liveEmails || []).map(e => e.quiz_id));
    const liveWebQuizIds = new Set((liveWebs || []).map(w => w.quiz_id));

    const status: QuizLiveStatus[] = quizList.map(quiz => ({
      quiz,
      hasLiveEmail: liveEmailQuizIds.has(quiz.id),
      hasLiveWeb: liveWebQuizIds.has(quiz.id),
    }));

    setLiveStatus(status);
  }, []);

  useEffect(() => {
    const init = async () => {
      const quizList = await fetchQuizzes();
      await fetchLiveStatus(quizList);
    };
    init();
  }, [fetchQuizzes, fetchLiveStatus]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("template-versions-live-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_templates" },
        () => fetchLiveStatus(quizzes)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_result_versions" },
        () => fetchLiveStatus(quizzes)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizzes, fetchLiveStatus]);

  const handlePreview = async (template: EmailTemplate, language?: string) => {
    setPreviewTemplate(template);
    setPreviewLanguage(language || "en");
    
    // Find the quiz for this template
    if (template.quiz_id) {
      const quiz = quizzes.find(q => q.id === template.quiz_id);
      setPreviewQuiz(quiz || null);
    } else {
      setPreviewQuiz(null);
    }
    
    setPreviewDialogOpen(true);
  };

  const handleLoadTemplate = (template: EmailTemplate) => {
    // This would normally load into an editor - for now just log
    console.log("Load template:", template);
  };

  const getQuizTitle = (quiz: Quiz) => quiz.title?.en || quiz.title?.et || quiz.slug;

  // Compute missing live templates
  const missingLiveTemplates = liveStatus.filter(s => !s.hasLiveEmail || !s.hasLiveWeb);
  const allComplete = missingLiveTemplates.length === 0 && liveStatus.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Template Versions</h2>
        <p className="text-muted-foreground">
          View and manage all web result and email template versions
        </p>
      </div>

      {/* Live Template Status Banner */}
      {liveStatus.length > 0 && (
        <div className={`rounded-lg border p-4 ${
          allComplete 
            ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {allComplete ? (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
              )}
              <div>
                <h3 className={`font-medium ${allComplete ? "text-green-800 dark:text-green-200" : "text-amber-800 dark:text-amber-200"}`}>
                  {allComplete 
                    ? "All quizzes have live templates" 
                    : `${missingLiveTemplates.length} ${missingLiveTemplates.length === 1 ? "quiz is" : "quizzes are"} missing live templates`
                  }
                </h3>
                {!allComplete && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Set live templates to ensure quiz takers see results and receive emails
                  </p>
                )}
              </div>
            </div>
            {!allComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMissingDetails(!showMissingDetails)}
                className="gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
              >
                {showMissingDetails ? "Hide" : "Show"} details
                {showMissingDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
          </div>

          {/* Expanded details */}
          {showMissingDetails && !allComplete && (
            <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800 space-y-2">
              {missingLiveTemplates.map(({ quiz, hasLiveEmail, hasLiveWeb }) => (
                <div 
                  key={quiz.id} 
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-white/50 dark:bg-black/20"
                >
                  <span className="font-medium text-amber-900 dark:text-amber-100">
                    {getQuizTitle(quiz)}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Status badges */}
                    <Badge 
                      variant={hasLiveWeb ? "default" : "destructive"} 
                      className={`text-xs ${hasLiveWeb ? "bg-green-600" : ""}`}
                    >
                      <Globe className="w-3 h-3 mr-1" />
                      Web {hasLiveWeb ? "✓" : "✗"}
                    </Badge>
                    <Badge 
                      variant={hasLiveEmail ? "default" : "destructive"}
                      className={`text-xs ${hasLiveEmail ? "bg-green-600" : ""}`}
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Email {hasLiveEmail ? "✓" : "✗"}
                    </Badge>
                    
                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-amber-300 dark:border-amber-700">
                      {!hasLiveWeb && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/quiz/${quiz.id}/results`)}
                          className="h-7 text-xs gap-1 bg-white dark:bg-gray-900"
                          title="Generate web results"
                        >
                          <Sparkles className="w-3 h-3" />
                          Generate Web
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                      {!hasLiveEmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/quiz/${quiz.id}/email`)}
                          className="h-7 text-xs gap-1 bg-white dark:bg-gray-900"
                          title="Create email template"
                        >
                          <Mail className="w-3 h-3" />
                          Create Email
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="web" className="gap-2">
            <Globe className="w-4 h-4" />
            Web Results
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="mt-6">
          <WebVersionHistory />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailVersionHistory 
            onLoadTemplate={handleLoadTemplate}
            onPreview={handlePreview}
          />
        </TabsContent>
      </Tabs>

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        template={previewTemplate}
        quiz={previewQuiz}
        emailTranslations={emailTranslations}
        initialLanguage={previewLanguage}
      />
    </div>
  );
}
