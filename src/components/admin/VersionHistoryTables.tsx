import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  RefreshCw, 
  Mail, 
  Globe, 
  Check, 
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Users,
  Languages
} from "lucide-react";
import { format } from "date-fns";

// Total number of supported languages in the system (from translate-quiz edge function)
const TOTAL_LANGUAGES = 24;

// All supported language codes for the horizontal selector
const ALL_LANGUAGE_CODES = [
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "uk", name: "Ukrainian" },
];

interface EmailTemplate {
  id: string;
  version_number: number;
  template_type: string;
  sender_name: string;
  sender_email: string;
  subjects: Record<string, string>;
  body_content: Record<string, string>;
  is_live: boolean;
  created_at: string;
  created_by_email: string | null;
  quiz_id: string | null;
  estimated_cost_eur: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

interface WebResultVersion {
  id: string;
  quiz_id: string;
  version_number: number;
  result_levels: Array<{
    title: Record<string, string>;
    description: Record<string, string>;
    insights: Record<string, string[]>;
    min_score: number;
    max_score: number;
  }>;
  generation_params: Record<string, unknown>;
  created_at: string;
  created_by_email: string | null;
  estimated_cost_eur: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
}

interface EmailVersionHistoryProps {
  quizId?: string;
  onLoadTemplate?: (template: EmailTemplate) => void;
  onSetLive?: (templateId: string, versionNumber: number) => void;
  onPreview?: (template: EmailTemplate, language?: string) => void;
}

interface WebVersionHistoryProps {
  quizId?: string;
  onRestoreVersion?: (levels: WebResultVersion['result_levels']) => void;
}

// Language selection dialog for preview with horizontal language selector
function LanguageSelectDialog({
  open,
  onOpenChange,
  template,
  onSelectLanguage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  onSelectLanguage: (template: EmailTemplate, language: string) => void;
}) {
  if (!template) return null;

  const availableLanguages = ALL_LANGUAGE_CODES.filter(
    lang => template.subjects?.[lang.code]?.trim() || template.body_content?.[lang.code]?.trim()
  );

  // Auto-select EN on open if available
  const handleSelectLanguage = (langCode: string) => {
    onSelectLanguage(template, langCode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Select Preview Language
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose a language to preview the email template (v{template.version_number})
          </p>
          
          {/* Horizontal language code selector */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_LANGUAGE_CODES.map((lang) => {
              const isAvailable = availableLanguages.some(l => l.code === lang.code);
              return (
                <Button
                  key={lang.code}
                  variant={lang.code === "en" && isAvailable ? "default" : isAvailable ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => isAvailable && handleSelectLanguage(lang.code)}
                  disabled={!isAvailable}
                  className={`h-8 px-3 font-mono uppercase text-xs ${!isAvailable ? 'opacity-30 cursor-not-allowed' : ''}`}
                  title={`${lang.name}${!isAvailable ? ' (not available)' : ''}`}
                >
                  {lang.code}
                </Button>
              );
            })}
          </div>
          
          {availableLanguages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 mt-4">
              No translations available for this template
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmailVersionHistory({ quizId, onLoadTemplate, onSetLive, onPreview }: EmailVersionHistoryProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [emailStats, setEmailStats] = useState<Record<string, { sent: number; failed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [filterQuiz, setFilterQuiz] = useState<string>(quizId || "all");
  const [filterType, setFilterType] = useState<string>("all");
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch quizzes first
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("id, title, slug")
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      const typedQuizzes = (quizzesData || []).map(q => ({
        ...q,
        title: q.title as Record<string, string>,
      }));
      setQuizzes(typedQuizzes);

      // Fetch templates - all or filtered (include both quiz_results and admin_notification)
      let query = supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (quizId) {
        query = query.eq("quiz_id", quizId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        subjects: item.subjects as Record<string, string>,
        body_content: (item.body_content || {}) as Record<string, string>,
        quiz_id: item.quiz_id as string | null
      }));

      setTemplates(typedData);

      // Fetch email stats per template version (by matching time ranges)
      // For each template, count emails sent after its created_at and before the next version's created_at
      if (typedData.length > 0) {
        const statsMap: Record<string, { sent: number; failed: number }> = {};
        
        // Group templates by quiz_id for time-range calculations
        const templatesByQuiz: Record<string, typeof typedData> = {};
        typedData.forEach(t => {
          if (t.quiz_id) {
            if (!templatesByQuiz[t.quiz_id]) templatesByQuiz[t.quiz_id] = [];
            templatesByQuiz[t.quiz_id].push(t);
          }
        });

        // Sort each quiz's templates by created_at ascending for time range calculation
        Object.values(templatesByQuiz).forEach(quizTemplates => {
          quizTemplates.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

        // Fetch email logs grouped by quiz and time
        const { data: emailLogs } = await supabase
          .from("email_logs")
          .select("quiz_id, status, created_at")
          .eq("email_type", "quiz_results");

        if (emailLogs) {
          // For each template, count emails in its time range
          typedData.forEach(template => {
            if (!template.quiz_id) return;
            
            const quizTemplates = templatesByQuiz[template.quiz_id] || [];
            const templateIndex = quizTemplates.findIndex(t => t.id === template.id);
            const nextTemplate = quizTemplates[templateIndex + 1];
            
            const startTime = new Date(template.created_at).getTime();
            const endTime = nextTemplate ? new Date(nextTemplate.created_at).getTime() : Date.now();
            
            const relevantLogs = emailLogs.filter(log => {
              if (log.quiz_id !== template.quiz_id) return false;
              const logTime = new Date(log.created_at).getTime();
              return logTime >= startTime && logTime < endTime;
            });
            
            statsMap[template.id] = {
              sent: relevantLogs.filter(l => l.status === 'sent').length,
              failed: relevantLogs.filter(l => l.status === 'failed').length,
            };
          });
        }
        
        setEmailStats(statsMap);
      }
    } catch (error: any) {
      console.error("Error fetching email templates:", error);
      toast({
        title: "Error",
        description: "Failed to fetch email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [quizId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSetLive = async (templateId: string, versionNumber: number, templateQuizId: string | null) => {
    if (!templateQuizId) return;
    
    try {
      // Set all templates for this quiz to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results")
        .eq("quiz_id", templateQuizId);

      // Set selected as live
      const { error } = await supabase
        .from("email_templates")
        .update({ is_live: true })
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Live version updated",
        description: `Version ${versionNumber} is now live`,
      });

      fetchData();
      onSetLive?.(templateId, versionNumber);
    } catch (error: any) {
      console.error("Error setting live version:", error);
      toast({
        title: "Error",
        description: "Failed to update live version",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy HH:mm");
  };

  const getQuizTitle = (templateQuizId: string | null): string => {
    if (!templateQuizId) return "—";
    const quiz = quizzes.find(q => q.id === templateQuizId);
    if (!quiz) return "Unknown";
    return quiz.title?.en || quiz.title?.et || quiz.slug || "Untitled";
  };

  // Filter templates by quiz and type
  const filteredTemplates = useMemo(() => {
    const filtered = templates.filter(t => {
      const quizMatch = filterQuiz === "all" || t.quiz_id === filterQuiz;
      const typeMatch = filterType === "all" || t.template_type === filterType;
      return quizMatch && typeMatch;
    });

    // Sort: live first, then by created_at descending (newest first)
    return filtered.sort((a, b) => {
      // Live templates first
      if (a.is_live && !b.is_live) return -1;
      if (!a.is_live && b.is_live) return 1;
      // Then by created_at descending (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [templates, filterQuiz, filterType]);

  const getTemplateTypeLabel = (type: string) => {
    switch (type) {
      case 'quiz_results': return 'Quiz Taker';
      case 'admin_notification': return 'Admin';
      default: return type;
    }
  };

  const getTemplateTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'quiz_results': return 'secondary';
      case 'admin_notification': return 'outline';
      default: return 'secondary';
    }
  };

  // Count translated languages for email template
  const getEmailTranslationCount = (template: EmailTemplate): { subjects: number; body: number } => {
    const subjectLangs = Object.keys(template.subjects || {}).filter(k => template.subjects[k]?.trim());
    const bodyLangs = Object.keys(template.body_content || {}).filter(k => template.body_content[k]?.trim());
    return { subjects: subjectLangs.length, body: bodyLangs.length };
  };

  const handlePreviewClick = (template: EmailTemplate) => {
    setSelectedTemplateForPreview(template);
    setLanguageDialogOpen(true);
  };

  const handleLanguageSelect = (template: EmailTemplate, language: string) => {
    onPreview?.(template, language);
  };

  if (loading && templates.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-16" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <Card className="bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" />
              Email Template Versions
              <Badge variant="secondary" className="text-xs ml-2">
                {filteredTemplates.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quiz_results">Quiz Taker</SelectItem>
                  <SelectItem value="admin_notification">Admin</SelectItem>
                </SelectContent>
              </Select>
              {!quizId && quizzes.length > 0 && (
                <Select value={filterQuiz} onValueChange={setFilterQuiz}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="All Quizzes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quizzes</SelectItem>
                    {quizzes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title?.en || q.title?.et || q.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="h-8 gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && templates.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 border rounded-lg border-dashed bg-muted/30">
              <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-base text-muted-foreground">No email templates yet</p>
              <p className="text-sm text-muted-foreground mt-1">Save a template to get started</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
              {/* Table Header */}
              <div className={`grid ${quizId ? 'grid-cols-[70px_80px_1fr_1fr_70px_70px_80px_100px]' : 'grid-cols-[70px_80px_1fr_1fr_1fr_70px_70px_80px_100px]'} gap-3 px-4 py-3 bg-muted/40 text-sm font-medium text-foreground border-b`}>
                <span>Version</span>
                <span>Type</span>
                {!quizId && <span>Quiz</span>}
                <span>Sender</span>
                <span>Created</span>
                <span className="text-center" title="Languages translated">Lang</span>
                <span className="text-center">Sent</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Table Rows */}
              <div className="max-h-[400px] overflow-y-auto">
                {filteredTemplates.map((template, index) => {
                  // Extract user name from email (before @)
                  const creatorName = template.created_by_email 
                    ? template.created_by_email.split('@')[0]
                    : null;
                  const stats = emailStats[template.id] || { sent: 0, failed: 0 };
                  const translationCount = getEmailTranslationCount(template);

                  return (
                    <div
                      key={template.id}
                      className={`grid ${quizId ? 'grid-cols-[70px_80px_1fr_1fr_70px_70px_80px_100px]' : 'grid-cols-[70px_80px_1fr_1fr_1fr_70px_70px_80px_100px]'} gap-3 px-4 py-3 items-center text-sm border-b last:border-b-0 list-row-interactive ${
                        template.is_live ? "bg-primary/5" : index % 2 === 0 ? "list-row-even" : "list-row-odd"
                      }`}
                    >
                      {/* Version */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{template.version_number}</span>
                        {template.is_live && (
                          <Badge variant="default" className="text-xs h-5 px-1.5 bg-primary">
                            LIVE
                          </Badge>
                        )}
                      </div>

                      {/* Template Type */}
                      <div>
                        <Badge 
                          variant={getTemplateTypeBadgeVariant(template.template_type) as "secondary" | "outline"} 
                          className="text-xs"
                        >
                          {getTemplateTypeLabel(template.template_type)}
                        </Badge>
                      </div>

                      {/* Quiz (only when showing all) */}
                      {!quizId && (
                        <div className="truncate text-foreground font-medium" title={getQuizTitle(template.quiz_id)}>
                          {getQuizTitle(template.quiz_id)}
                        </div>
                      )}

                      {/* Sender */}
                      <div className="truncate text-muted-foreground" title={`${template.sender_name} <${template.sender_email}>`}>
                        {template.sender_name} &lt;{template.sender_email}&gt;
                      </div>

                      {/* Created - with user name */}
                      <div className="text-sm text-muted-foreground" title={template.created_by_email || "Unknown"}>
                        <div className="truncate">{formatDate(template.created_at)}</div>
                        {creatorName && (
                          <div className="text-xs text-muted-foreground/70 truncate">by {creatorName}</div>
                        )}
                      </div>

                      {/* Translation Count */}
                      <div className="flex items-center justify-center" title={`Subjects: ${translationCount.subjects}/${TOTAL_LANGUAGES}, Body: ${translationCount.body}/${TOTAL_LANGUAGES}`}>
                        <div className="flex items-center gap-1">
                          <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-xs ${Math.max(translationCount.subjects, translationCount.body) >= TOTAL_LANGUAGES ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                            {Math.max(translationCount.subjects, translationCount.body)}/{TOTAL_LANGUAGES}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-1" title={`Sent: ${stats.sent}, Failed: ${stats.failed}`}>
                        <Send className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={stats.sent > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {stats.sent}
                        </span>
                        {stats.failed > 0 && (
                          <span className="text-red-500 text-xs">({stats.failed})</span>
                        )}
                      </div>

                      {/* Cost */}
                      <div className="text-sm text-muted-foreground text-right">
                        {template.estimated_cost_eur ? `€${template.estimated_cost_eur.toFixed(4)}` : "-"}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        {onPreview && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewClick(template)}
                            className="h-8 w-8 p-0"
                            title="Preview & send test"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {onLoadTemplate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onLoadTemplate(template)}
                            className="h-8 w-8 p-0"
                            title="Load to editor"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
                        {!template.is_live && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetLive(template.id, template.version_number, template.quiz_id)}
                            className="h-8 w-8 p-0 text-primary"
                            title="Set as live"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language Selection Dialog */}
      <LanguageSelectDialog
        open={languageDialogOpen}
        onOpenChange={setLanguageDialogOpen}
        template={selectedTemplateForPreview}
        onSelectLanguage={handleLanguageSelect}
      />
    </>
  );
}

export function WebVersionHistory({ quizId, onRestoreVersion }: WebVersionHistoryProps) {
  const [versions, setVersions] = useState<WebResultVersion[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [leadStats, setLeadStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterQuiz, setFilterQuiz] = useState<string>(quizId || "all");
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch quizzes first
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("id, title, slug")
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      const typedQuizzes = (quizzesData || []).map(q => ({
        ...q,
        title: q.title as Record<string, string>,
      }));
      setQuizzes(typedQuizzes);

      // Fetch versions - all or filtered
      let query = supabase
        .from("quiz_result_versions")
        .select("*")
        .order("created_at", { ascending: false });

      if (quizId) {
        query = query.eq("quiz_id", quizId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        result_levels: item.result_levels as WebResultVersion['result_levels'],
        generation_params: item.generation_params as Record<string, unknown>,
      }));

      setVersions(typedData);

      // Fetch lead counts per version (by matching time ranges)
      if (typedData.length > 0) {
        const statsMap: Record<string, number> = {};
        
        // Group versions by quiz_id for time-range calculations
        const versionsByQuiz: Record<string, typeof typedData> = {};
        typedData.forEach(v => {
          if (!versionsByQuiz[v.quiz_id]) versionsByQuiz[v.quiz_id] = [];
          versionsByQuiz[v.quiz_id].push(v);
        });

        // Sort each quiz's versions by created_at ascending for time range calculation
        Object.values(versionsByQuiz).forEach(quizVersions => {
          quizVersions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

        // Fetch quiz leads
        const { data: quizLeads } = await supabase
          .from("quiz_leads")
          .select("quiz_id, created_at");

        if (quizLeads) {
          // For each version, count leads in its time range
          typedData.forEach(version => {
            const quizVersions = versionsByQuiz[version.quiz_id] || [];
            const versionIndex = quizVersions.findIndex(v => v.id === version.id);
            const nextVersion = quizVersions[versionIndex + 1];
            
            const startTime = new Date(version.created_at).getTime();
            const endTime = nextVersion ? new Date(nextVersion.created_at).getTime() : Date.now();
            
            const relevantLeads = quizLeads.filter(lead => {
              if (lead.quiz_id !== version.quiz_id) return false;
              const leadTime = new Date(lead.created_at).getTime();
              return leadTime >= startTime && leadTime < endTime;
            });
            
            statsMap[version.id] = relevantLeads.length;
          });
        }
        
        setLeadStats(statsMap);
      }
    } catch (error: any) {
      console.error("Error fetching web result versions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch web result versions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [quizId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy HH:mm");
  };

  const getQuizTitle = (versionQuizId: string): string => {
    const quiz = quizzes.find(q => q.id === versionQuizId);
    if (!quiz) return "Unknown";
    return quiz.title?.en || quiz.title?.et || quiz.slug || "Untitled";
  };

  // Count translated languages for web result version
  const getWebTranslationCount = (version: WebResultVersion): number => {
    if (!version.result_levels || version.result_levels.length === 0) return 0;
    // Get unique languages from the first level's title (all levels should have same languages)
    const firstLevel = version.result_levels[0];
    const languages = new Set<string>();
    Object.keys(firstLevel.title || {}).forEach(lang => {
      if (firstLevel.title[lang]?.trim()) languages.add(lang);
    });
    return languages.size;
  };

  // Sort by created_at descending (newest first)
  const filteredVersions = useMemo(() => {
    const filtered = versions.filter(v => {
      if (filterQuiz === "all") return true;
      return v.quiz_id === filterQuiz;
    });

    // Sort by created_at descending
    return filtered.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [versions, filterQuiz]);

  return (
    <Card className="bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4 text-primary" />
            Web Result Versions
            <Badge variant="secondary" className="text-xs ml-2">
              {filteredVersions.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {!quizId && quizzes.length > 0 && (
              <Select value={filterQuiz} onValueChange={setFilterQuiz}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="All Quizzes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  {quizzes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title?.en || q.title?.et || q.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && versions.length === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed bg-muted/30">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-base text-muted-foreground">No result versions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate results to create versions</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
            {/* Table Header */}
            <div className={`grid ${quizId ? 'grid-cols-[70px_80px_1fr_70px_70px_90px_100px]' : 'grid-cols-[70px_1fr_80px_1fr_70px_70px_90px_100px]'} gap-3 px-4 py-3 bg-muted/40 text-sm font-medium text-foreground border-b`}>
              <span>Version</span>
              {!quizId && <span>Quiz</span>}
              <span>Levels</span>
              <span>Created</span>
              <span className="text-center" title="Languages translated">Lang</span>
              <span className="text-center">Leads</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Table Rows */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredVersions.map((version, index) => {
                const isExpanded = expandedId === version.id;
                // Extract user name from email (before @)
                const creatorName = version.created_by_email 
                  ? version.created_by_email.split('@')[0]
                  : null;
                const leadCount = leadStats[version.id] || 0;
                const translationCount = getWebTranslationCount(version);
                
                return (
                  <div key={version.id}>
                    <div
                      className={`grid ${quizId ? 'grid-cols-[70px_80px_1fr_70px_70px_90px_100px]' : 'grid-cols-[70px_1fr_80px_1fr_70px_70px_90px_100px]'} gap-3 px-4 py-3 items-center text-sm border-b list-row-interactive cursor-pointer ${index % 2 === 0 ? "list-row-even" : "list-row-odd"}`}
                      onClick={() => setExpandedId(isExpanded ? null : version.id)}
                    >
                      {/* Version */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{version.version_number}</span>
                        {index === 0 && filterQuiz !== "all" && (
                          <Badge variant="outline" className="text-xs h-5 px-1.5">
                            Latest
                          </Badge>
                        )}
                      </div>

                      {/* Quiz (only when showing all) */}
                      {!quizId && (
                        <div className="truncate text-foreground font-medium" title={getQuizTitle(version.quiz_id)}>
                          {getQuizTitle(version.quiz_id)}
                        </div>
                      )}

                      {/* Levels */}
                      <div>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                          {version.result_levels.length} levels
                        </Badge>
                      </div>

                      {/* Created - with user name */}
                      <div className="text-sm text-muted-foreground" title={version.created_by_email || "Unknown"}>
                        <div className="truncate">{formatDate(version.created_at)}</div>
                        {creatorName && (
                          <div className="text-xs text-muted-foreground/70 truncate">by {creatorName}</div>
                        )}
                      </div>

                      {/* Translation Count */}
                      <div className="flex items-center justify-center" title={`${translationCount}/${TOTAL_LANGUAGES} languages translated`}>
                        <div className="flex items-center gap-1">
                          <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-xs ${translationCount >= TOTAL_LANGUAGES ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                            {translationCount}/{TOTAL_LANGUAGES}
                          </span>
                        </div>
                      </div>

                      {/* Lead Count */}
                      <div className="flex items-center justify-center gap-1" title={`${leadCount} leads used this version`}>
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={leadCount > 0 ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                          {leadCount}
                        </span>
                      </div>

                      {/* Cost */}
                      <div className="text-sm text-muted-foreground text-right">
                        {version.estimated_cost_eur ? `€${version.estimated_cost_eur.toFixed(4)}` : "-"}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2">
                        {onRestoreVersion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestoreVersion(version.result_levels);
                              toast({
                                title: "Version restored",
                                description: `Applied version ${version.version_number} result levels`,
                              });
                            }}
                            className="h-8 px-2 text-xs"
                            title="Restore this version"
                          >
                            Restore
                          </Button>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-muted/20 border-b space-y-3">
                        {version.result_levels.map((level, levelIndex) => {
                          const levelLanguages = Object.keys(level.title || {});
                          return (
                            <div key={levelIndex} className="bg-background rounded-lg p-4 text-sm border">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium">Score: {level.min_score}-{level.max_score}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {levelLanguages.map(lang => {
                                  const title = level.title?.[lang];
                                  if (!title) return null;
                                  return (
                                    <div key={lang} className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs h-5 px-1.5 uppercase font-mono">
                                        {lang}
                                      </Badge>
                                      <span className="text-muted-foreground truncate max-w-[200px]" title={title}>
                                        {title}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Token usage */}
                        {(version.input_tokens || version.output_tokens) && (
                          <div className="flex gap-4 text-sm text-muted-foreground pt-2">
                            {version.input_tokens && <span>Input: {version.input_tokens.toLocaleString()} tokens</span>}
                            {version.output_tokens && <span>Output: {version.output_tokens.toLocaleString()} tokens</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
