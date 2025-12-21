import { useState, useEffect } from "react";
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
import { 
  Mail, 
  FileText, 
  Calendar, 
  User, 
  Target, 
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
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
  const [openMindednessLevel, setOpenMindednessLevel] = useState<OpenMindednessLevel | null>(null);
  const [emailLog, setEmailLog] = useState<EmailLog | null>(null);
  const [activeTab, setActiveTab] = useState("results");

  useEffect(() => {
    if (open && lead) {
      fetchData();
    }
  }, [open, lead]);

  const fetchData = async () => {
    if (!lead) return;
    setLoading(true);
    
    try {
      // Fetch result level that matches the score
      const { data: resultLevels } = await supabase
        .from("quiz_result_levels")
        .select("*")
        .eq("quiz_id", lead.quiz_id)
        .lte("min_score", lead.score)
        .gte("max_score", lead.score)
        .maybeSingle();

      // If no exact match, find by range
      if (!resultLevels) {
        const { data: allLevels } = await supabase
          .from("quiz_result_levels")
          .select("*")
          .eq("quiz_id", lead.quiz_id)
          .order("min_score");

        if (allLevels && allLevels.length > 0) {
          const matchingLevel = allLevels.find(
            (level) => lead.score >= level.min_score && lead.score <= level.max_score
          );
          setResultLevel(matchingLevel || allLevels[0]);
        }
      } else {
        setResultLevel(resultLevels);
      }

      // Fetch open-mindedness level if applicable
      if (lead.openness_score !== null) {
        const { data: omLevels } = await supabase
          .from("open_mindedness_result_levels")
          .select("*")
          .eq("quiz_id", lead.quiz_id)
          .order("min_score");

        if (omLevels && omLevels.length > 0) {
          const matchingLevel = omLevels.find(
            (level) => lead.openness_score! >= level.min_score && lead.openness_score! <= level.max_score
          );
          setOpenMindednessLevel(matchingLevel || null);
        }
      }

      // Fetch email log for this lead
      const { data: emailLogs } = await supabase
        .from("email_logs")
        .select("*")
        .eq("quiz_lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setEmailLog(emailLogs);
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
  const percentage = lead.total_questions > 0 
    ? Math.round((lead.score / lead.total_questions) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            <span className="truncate">{lead.email}</span>
            <Badge variant="outline" className="text-xs ml-auto">
              {format(new Date(lead.created_at), "dd MMM yyyy HH:mm")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-2 w-full flex-shrink-0">
            <TabsTrigger value="results" className="gap-1">
              <FileText className="w-4 h-4" />
              Results
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1">
              <Mail className="w-4 h-4" />
              Email Sent
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="results" className="h-full m-0">
              <ScrollArea className="h-[calc(85vh-180px)]">
                {loading ? (
                  <div className="space-y-4 p-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-24" />
                  </div>
                ) : (
                  <div className="space-y-4 p-1">
                    {/* Score Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <p className="text-2xl font-bold">{lead.score}/{lead.total_questions}</p>
                        <p className="text-xs text-muted-foreground">Score ({percentage}%)</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <Brain className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                        <p className="text-2xl font-bold">
                          {lead.openness_score !== null ? lead.openness_score : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">Open-Mindedness</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {format(new Date(lead.created_at), "dd MMM")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>

                    {/* Result Level */}
                    {resultLevel && (
                      <div className={`rounded-lg p-4 bg-gradient-to-br ${resultLevel.color_class || "from-primary/20 to-primary/10"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{resultLevel.emoji}</span>
                          <h3 className="text-lg font-bold">
                            {getLocalizedText(resultLevel.title, respondentLang)}
                          </h3>
                        </div>
                        <p className="text-sm opacity-90">
                          {getLocalizedText(resultLevel.description, respondentLang)}
                        </p>
                        
                        {/* Insights */}
                        {resultLevel.insights && (
                          <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-1">
                              <Sparkles className="w-4 h-4" />
                              Key Insights
                            </h4>
                            <ul className="space-y-1">
                              {getInsights(resultLevel.insights, respondentLang).map((insight, i) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Open-Mindedness Result */}
                    {openMindednessLevel && (
                      <div className="rounded-lg p-4 bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{openMindednessLevel.emoji}</span>
                          <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300">
                            {getLocalizedText(openMindednessLevel.title, respondentLang)}
                          </h3>
                        </div>
                        <p className="text-sm text-purple-900/80 dark:text-purple-100/80">
                          {getLocalizedText(openMindednessLevel.description, respondentLang)}
                        </p>
                      </div>
                    )}

                    {/* Result Category Badge */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Result Category:</span>
                      <Badge variant="secondary">{lead.result_category}</Badge>
                      {lead.language && (
                        <Badge variant="outline" className="text-xs">
                          {lead.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="email" className="h-full m-0">
              <ScrollArea className="h-[calc(85vh-180px)]">
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
                        <div>
                          <span className="text-muted-foreground">Subject:</span>
                          <p className="font-medium">{emailLog.subject}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {format(new Date(emailLog.created_at), "dd MMM yyyy HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email Content Preview */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b">
                        <span className="text-xs font-medium">Email Content</span>
                      </div>
                      {emailLog.html_body ? (
                        <div 
                          className="p-4 bg-white dark:bg-background prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: emailLog.html_body }}
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
