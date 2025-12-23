import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Mail, 
  FileText, 
  Calendar, 
  User, 
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { cn, formatTimestamp, formatTimestampShort } from "@/lib/utils";
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
  quiz_id: string | null;
}

interface ResultLevel {
  id: string;
  title: Json;
  description: Json;
  insights: Json;
  emoji: string;
  color_class: string;
  min_score: number;
  max_score: number;
}

interface OpenMindednessLevel {
  id: string;
  title: Json;
  description: Json;
  emoji: string;
  color_class: string;
  min_score: number;
  max_score: number;
}

interface EmailLog {
  id: string;
  subject: string;
  html_body: string | null;
  status: string;
  created_at: string;
  sender_email: string;
  sender_name: string;
  language: string | null;
}

interface QuizData {
  cta_text: Json;
  cta_url: string | null;
  cta_title: Json;
  cta_description: Json;
}

interface RespondentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: QuizLead | null;
  displayLanguage: string;
}

export function RespondentDetailDialog({ 
  open, 
  onOpenChange, 
  lead,
  displayLanguage 
}: RespondentDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [resultLevel, setResultLevel] = useState<ResultLevel | null>(null);
  const [allResultLevels, setAllResultLevels] = useState<ResultLevel[]>([]);
  const [openMindednessLevel, setOpenMindednessLevel] = useState<OpenMindednessLevel | null>(null);
  const [allOmLevels, setAllOmLevels] = useState<OpenMindednessLevel[]>([]);
  const [emailLog, setEmailLog] = useState<EmailLog | null>(null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [activeTab, setActiveTab] = useState("results");
  const [uiTranslations, setUiTranslations] = useState<Record<string, string>>({});

  // Helper to get UI translation
  const t = useCallback((key: string, fallback: string): string => {
    return uiTranslations[key] || fallback;
  }, [uiTranslations]);

  useEffect(() => {
    if (open && lead) {
      fetchData();
    }
  }, [open, lead]);

  const fetchData = async () => {
    if (!lead) return;
    setLoading(true);

    // Use respondent's stored language for fetching + display
    const respondentLang = lead.language || displayLanguage || "en";

    try {
      // Fetch all result levels for this quiz
      const { data: allLevels } = await supabase
        .from("quiz_result_levels")
        .select("*")
        .eq("quiz_id", lead.quiz_id)
        .order("min_score");

      if (allLevels && allLevels.length > 0) {
        setAllResultLevels(allLevels);
        const matchingLevel = allLevels.find(
          (level) => lead.score >= level.min_score && lead.score <= level.max_score
        );
        setResultLevel(matchingLevel || allLevels[0]);
      }

      // Fetch all open-mindedness levels
      if (lead.openness_score !== null) {
        const { data: omLevels } = await supabase
          .from("open_mindedness_result_levels")
          .select("*")
          .eq("quiz_id", lead.quiz_id)
          .order("min_score");

        if (omLevels && omLevels.length > 0) {
          setAllOmLevels(omLevels);
          const matchingLevel = omLevels.find(
            (level) => lead.openness_score! >= level.min_score && lead.openness_score! <= level.max_score
          );
          setOpenMindednessLevel(matchingLevel || null);
        }
      }

      // Fetch quiz data for CTA
      if (lead.quiz_id) {
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("cta_text, cta_url, cta_title, cta_description")
          .eq("id", lead.quiz_id)
          .single();

        if (quiz) {
          setQuizData(quiz);
        }

        // Fetch UI translations for this quiz in respondent's language
        const { data: translations } = await supabase
          .from("ui_translations")
          .select("translation_key, translations")
          .eq("quiz_id", lead.quiz_id);

        if (translations) {
          const translationMap: Record<string, string> = {};
          translations.forEach((item) => {
            const translationsObj = item.translations as Record<string, string>;
            const translatedValue = translationsObj?.[respondentLang] || translationsObj?.["en"];
            if (translatedValue) {
              translationMap[item.translation_key] = translatedValue;
            }
          });
          setUiTranslations(translationMap);
        }
      }

      // Fetch email log for this lead in the respondent's language
      let emailLogData = null;

      const { data: emailByLeadId } = await supabase
        .from("email_logs")
        .select("*")
        .eq("quiz_lead_id", lead.id)
        .eq("email_type", "quiz_result_user")
        .eq("language", respondentLang)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (emailByLeadId) {
        emailLogData = emailByLeadId;
      } else {
        // Fallback: find by recipient email sent around the same time (within 1 minute)
        const leadDate = new Date(lead.created_at);
        const minDate = new Date(leadDate.getTime() - 60000).toISOString(); // 1 min before
        const maxDate = new Date(leadDate.getTime() + 60000).toISOString(); // 1 min after

        const { data: emailByMatch } = await supabase
          .from("email_logs")
          .select("*")
          .eq("recipient_email", lead.email)
          .eq("email_type", "quiz_result_user")
          .eq("language", respondentLang)
          .gte("created_at", minDate)
          .lte("created_at", maxDate)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        emailLogData = emailByMatch;
      }

      setEmailLog(emailLogData);
    } catch (error) {
      console.error("Error fetching respondent details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (json: Json, lang: string): string => {
    if (!json || typeof json !== "object") return "";
    const record = json as Record<string, string>;
    return record[lang] || record["en"] || Object.values(record)[0] || "";
  };

  const getInsights = (insights: Json, lang: string): string[] => {
    if (!insights || !Array.isArray(insights)) return [];
    return insights.map((insight) => {
      if (typeof insight === "string") return insight;
      if (typeof insight === "object" && insight !== null) {
        const record = insight as Record<string, string>;
        return record[lang] || record["en"] || Object.values(record)[0] || "";
      }
      return "";
    }).filter(Boolean);
  };

  if (!lead) return null;

  const respondentLang = lead.language || displayLanguage || "en";
  const maxScore = allResultLevels.length > 0 
    ? Math.max(...allResultLevels.map(r => r.max_score))
    : lead.total_questions;
  const percentage = maxScore > 0 ? Math.round((lead.score / maxScore) * 100) : 0;
  
  const omMaxScore = allOmLevels.length > 0
    ? Math.max(...allOmLevels.map(l => l.max_score))
    : 4;
  const omPercentage = lead.openness_score !== null 
    ? Math.round((lead.openness_score / omMaxScore) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            <span className="truncate">{lead.email}</span>
            <Badge variant="outline" className="text-xs ml-auto">
              {formatTimestampShort(lead.created_at)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-2 w-full flex-shrink-0">
            <TabsTrigger value="results" className="gap-1">
              <FileText className="w-4 h-4" />
              Results Preview
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1">
              <Mail className="w-4 h-4" />
              Email Sent
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="results" className="h-full m-0">
              <ScrollArea className="h-[calc(90vh-180px)]">
                {loading ? (
                  <div className="space-y-4 p-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-24" />
                  </div>
                ) : (
                  <div className="space-y-4 p-1">
                    {/* Header - exact match to DynamicResultsScreen */}
                    <header className="text-center mb-4">
                      <p className="text-sm text-muted-foreground mb-1">{t("resultsFor", "Results for")} {lead.email}</p>
                      {resultLevel && (
                        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-1">
                          <span>{resultLevel.emoji}</span> {getLocalizedText(resultLevel.title, respondentLang)}
                        </h2>
                      )}
                    </header>

                    {/* Score visualization - exact match to DynamicResultsScreen "glass" section */}
                    <section className="glass rounded-2xl p-6">
                      <div className="text-center mb-4">
                        <div className="text-5xl font-bold gradient-text mb-1">
                          {lead.score}
                        </div>
                        <p className="text-muted-foreground text-sm">{t("outOf", "out of")} {maxScore} {t("points", "points")}</p>
                      </div>
                      
                      <div 
                        className="h-4 bg-secondary rounded-full overflow-hidden mb-3"
                        role="progressbar"
                        aria-valuenow={percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div 
                          className={cn(
                            "h-full bg-gradient-to-r transition-all duration-1000",
                            resultLevel?.color_class || "from-primary to-purple-600"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{t("best", "Best")}</span>
                        <span>{t("needsWork", "Needs Work")}</span>
                      </div>
                    </section>

                    {/* Leadership Open-Mindedness - exact match to DynamicResultsScreen */}
                    {lead.openness_score !== null && (
                      <section className="glass rounded-2xl p-6">
                        <h3 className="font-heading text-xl font-semibold mb-3">
                          <span>{openMindednessLevel?.emoji || "🧠"}</span> {openMindednessLevel ? getLocalizedText(openMindednessLevel.title, respondentLang) : t("leadershipOpenMindedness", "Leadership Open-Mindedness")}
                        </h3>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="text-4xl font-bold gradient-text">
                            {lead.openness_score}/{omMaxScore}
                          </div>
                          <div className="flex-1">
                            <div 
                              className="h-3 bg-secondary rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={omPercentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div 
                                className={cn(
                                  "h-full bg-gradient-to-r transition-all duration-1000",
                                  openMindednessLevel?.color_class || "from-blue-500 to-indigo-600"
                                )}
                                style={{ width: `${omPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {openMindednessLevel && (
                          <p className="text-muted-foreground">
                            {getLocalizedText(openMindednessLevel.description, respondentLang)}
                          </p>
                        )}
                      </section>
                    )}

                    {/* Result description - exact match to DynamicResultsScreen "What This Means" */}
                    {resultLevel && (
                      <section className="glass rounded-2xl p-6">
                        <h3 className="font-heading text-xl font-semibold mb-3">{t("whatThisMeans", "What This Means")}</h3>
                        <p className="text-muted-foreground leading-relaxed mb-5">
                          {getLocalizedText(resultLevel.description, respondentLang)}
                        </p>
                        
                        {resultLevel.insights && getInsights(resultLevel.insights, respondentLang).length > 0 && (
                          <>
                            <h4 className="font-semibold mb-3">{t("keyInsights", "Key Insights:")}</h4>
                            <ol className="space-y-3" role="list">
                              {getInsights(resultLevel.insights, respondentLang).map((insight, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ol>
                          </>
                        )}
                      </section>
                    )}

                    {/* CTA section - exact match to DynamicResultsScreen */}
                    <section className="glass rounded-2xl p-6 text-center">
                      <h3 className="font-heading text-xl font-semibold mb-2">
                        {quizData?.cta_title ? getLocalizedText(quizData.cta_title, respondentLang) : t("wantToImprove", "Ready for Precise Employee Assessment?")}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {quizData?.cta_description ? getLocalizedText(quizData.cta_description, respondentLang) : t("wantToImproveDesc", "This quiz provides a general overview. For accurate, in-depth analysis of your team's performance and actionable improvement strategies, continue with professional testing.")}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <a 
                          href={quizData?.cta_url || "https://sparkly.hr"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 gradient-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
                        >
                          {quizData?.cta_text ? getLocalizedText(quizData.cta_text, respondentLang) : t("visitSparkly", "Continue to Sparkly.hr")}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </section>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
                      <Calendar className="w-3 h-3" />
                      <span>Completed: {formatTimestamp(lead.created_at)}</span>
                      {lead.language && (
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {lead.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="email" className="h-full m-0">
              <ScrollArea className="h-[calc(90vh-180px)]">
                {loading ? (
                  <div className="space-y-4 p-4">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-64" />
                  </div>
                ) : emailLog ? (
                  <div className="space-y-4 p-1">
                    {/* Email Metadata */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Email Details</span>
                        </div>
                        <Badge 
                          variant={emailLog.status === "sent" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {emailLog.status === "sent" ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Sent</>
                          ) : (
                            <><AlertCircle className="w-3 h-3 mr-1" /> {emailLog.status}</>
                          )}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">From:</span>
                          <p className="font-medium">{emailLog.sender_name} &lt;{emailLog.sender_email}&gt;</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">To:</span>
                          <p className="font-medium">{lead.email}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Subject:</span>
                          <p className="font-medium">{emailLog.subject}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {formatTimestampShort(emailLog.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Open-Mindedness Summary (if applicable) */}
                    {lead.openness_score !== null && openMindednessLevel && (
                      <div className="glass rounded-lg p-4">
                        <h4 className="font-heading text-sm font-semibold mb-2 flex items-center gap-2">
                          <span>{openMindednessLevel.emoji || "🧠"}</span>
                          Leadership Open-Mindedness
                        </h4>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-2xl font-bold gradient-text">
                            {lead.openness_score}/{omMaxScore}
                          </div>
                          <div className="flex-1">
                            <div 
                              className="h-2 bg-secondary rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={omPercentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div 
                                className={cn(
                                  "h-full bg-gradient-to-r transition-all duration-500",
                                  openMindednessLevel.color_class || "from-blue-500 to-indigo-600"
                                )}
                                style={{ width: `${omPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-foreground mb-1">
                          {getLocalizedText(openMindednessLevel.title, respondentLang)}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {getLocalizedText(openMindednessLevel.description, respondentLang)}
                        </p>
                      </div>
                    )}

                    {/* Email Content Preview - Exact HTML as sent */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                        <span className="text-xs font-medium">Email Preview (as sent)</span>
                        {emailLog.language && (
                          <Badge variant="outline" className="text-[10px]">
                            {emailLog.language.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      {emailLog.html_body ? (
                        <iframe
                          srcDoc={emailLog.html_body}
                          className="w-full border-0 bg-white"
                          style={{ height: "60vh" }}
                          title="Email Preview"
                          sandbox="allow-same-origin"
                        />
                      ) : (
                        <div className="p-4 text-center text-muted-foreground">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Email content not stored</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Mail className="w-12 h-12 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-medium mb-1">No Email Found</h3>
                    <p className="text-xs text-muted-foreground max-w-[250px]">
                      No email log was found for this respondent. The email may not have been sent or logs may have been cleared.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
