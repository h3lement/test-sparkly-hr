import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, 
  Mail, 
  Globe, 
  Check, 
  Eye,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { format } from "date-fns";

interface EmailTemplate {
  id: string;
  version_number: number;
  template_type: string;
  sender_name: string;
  sender_email: string;
  subjects: Record<string, string>;
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
  onPreview?: (template: EmailTemplate) => void;
}

interface WebVersionHistoryProps {
  quizId?: string;
  onRestoreVersion?: (levels: WebResultVersion['result_levels']) => void;
}

export function EmailVersionHistory({ quizId, onLoadTemplate, onSetLive, onPreview }: EmailVersionHistoryProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Fetch templates - all or filtered
      let query = supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "quiz_results")
        .order("created_at", { ascending: false });

      if (quizId) {
        query = query.eq("quiz_id", quizId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        subjects: item.subjects as Record<string, string>,
        quiz_id: item.quiz_id as string | null
      }));

      setTemplates(typedData);
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

  const filteredTemplates = templates.filter(t => {
    if (filterQuiz === "all") return true;
    return t.quiz_id === filterQuiz;
  });

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
            <div className={`grid ${quizId ? 'grid-cols-[70px_1fr_140px_80px_100px]' : 'grid-cols-[70px_1fr_1fr_140px_80px_100px]'} gap-3 px-4 py-3 bg-muted/40 text-sm font-medium text-foreground border-b`}>
              <span>Version</span>
              {!quizId && <span>Quiz</span>}
              <span>Sender</span>
              <span>Created</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Table Rows */}
            <div className="max-h-[300px] overflow-y-auto">
              {filteredTemplates.map((template, index) => {
                return (
                  <div
                    key={template.id}
                    className={`grid ${quizId ? 'grid-cols-[70px_1fr_140px_80px_100px]' : 'grid-cols-[70px_1fr_1fr_140px_80px_100px]'} gap-3 px-4 py-3 items-center text-sm border-b last:border-b-0 list-row-interactive ${
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

                    {/* Created */}
                    <div className="text-sm text-muted-foreground truncate" title={template.created_by_email || "Unknown"}>
                      {formatDate(template.created_at)}
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
                          onClick={() => onPreview(template)}
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
  );
}

export function WebVersionHistory({ quizId, onRestoreVersion }: WebVersionHistoryProps) {
  const [versions, setVersions] = useState<WebResultVersion[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
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

  const filteredVersions = versions.filter(v => {
    if (filterQuiz === "all") return true;
    return v.quiz_id === filterQuiz;
  });

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
            <div className={`grid ${quizId ? 'grid-cols-[70px_80px_140px_90px_100px]' : 'grid-cols-[70px_1fr_80px_140px_90px_100px]'} gap-3 px-4 py-3 bg-muted/40 text-sm font-medium text-foreground border-b`}>
              <span>Version</span>
              {!quizId && <span>Quiz</span>}
              <span>Levels</span>
              <span>Created</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Table Rows */}
            <div className="max-h-[300px] overflow-y-auto">
              {filteredVersions.map((version, index) => {
                const isExpanded = expandedId === version.id;
                
                return (
                  <div key={version.id}>
                    <div
                      className={`grid ${quizId ? 'grid-cols-[70px_80px_140px_90px_100px]' : 'grid-cols-[70px_1fr_80px_140px_90px_100px]'} gap-3 px-4 py-3 items-center text-sm border-b list-row-interactive cursor-pointer ${index % 2 === 0 ? "list-row-even" : "list-row-odd"}`}
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

                      {/* Created */}
                      <div className="text-sm text-muted-foreground truncate" title={version.created_by_email || "Unknown"}>
                        {formatDate(version.created_at)}
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
