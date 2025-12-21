import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
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

interface EmailVersionHistoryProps {
  quizId: string;
  onLoadTemplate?: (template: EmailTemplate) => void;
  onSetLive?: (templateId: string, versionNumber: number) => void;
}

interface WebVersionHistoryProps {
  quizId: string;
  onRestoreVersion?: (levels: WebResultVersion['result_levels']) => void;
}

export function EmailVersionHistory({ quizId, onLoadTemplate, onSetLive }: EmailVersionHistoryProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "quiz_results")
        .eq("quiz_id", quizId)
        .order("version_number", { ascending: false });

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
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSetLive = async (templateId: string, versionNumber: number) => {
    try {
      // Set all templates for this quiz to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results")
        .eq("quiz_id", quizId);

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

      fetchTemplates();
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

  const getLanguages = (subjects: Record<string, string>) => {
    return Object.keys(subjects).filter(key => subjects[key]).sort();
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Email Templates</span>
          <Badge variant="secondary" className="text-xs">
            {templates.length}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTemplates}
          disabled={loading}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {templates.length === 0 ? (
        <div className="text-center py-6 border rounded-lg border-dashed">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No email templates yet</p>
          <p className="text-xs text-muted-foreground mt-1">Save a template to get started</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_140px_120px_100px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <span>Ver</span>
            <span>Sender</span>
            <span>Languages</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table Rows */}
          <div className="max-h-[250px] overflow-y-auto">
            {templates.map((template, index) => {
              const languages = getLanguages(template.subjects);
              return (
                <div
                  key={template.id}
                  className={`grid grid-cols-[60px_1fr_140px_120px_100px] gap-2 px-3 py-2 items-center text-sm border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                    template.is_live ? "bg-primary/5" : index % 2 === 0 ? "bg-background" : "bg-muted/20"
                  }`}
                >
                  {/* Version */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">v{template.version_number}</span>
                    {template.is_live && (
                      <Badge variant="default" className="text-xs h-5 px-1.5 bg-primary">
                        LIVE
                      </Badge>
                    )}
                  </div>

                  {/* Sender */}
                  <div className="truncate text-muted-foreground" title={`${template.sender_name} <${template.sender_email}>`}>
                    {template.sender_name} &lt;{template.sender_email}&gt;
                  </div>

                  {/* Languages */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {languages.slice(0, 4).map(lang => (
                      <Badge key={lang} variant="outline" className="text-xs h-5 px-1.5 uppercase font-mono">
                        {lang}
                      </Badge>
                    ))}
                    {languages.length > 4 && (
                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                        +{languages.length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Created */}
                  <div className="text-sm text-muted-foreground truncate" title={template.created_by_email || "Unknown"}>
                    {formatDate(template.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    {onLoadTemplate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onLoadTemplate(template)}
                        className="h-7 w-7 p-0"
                        title="Load to editor"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    {!template.is_live && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetLive(template.id, template.version_number)}
                        className="h-7 w-7 p-0 text-primary"
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
    </div>
  );
}

export function WebVersionHistory({ quizId, onRestoreVersion }: WebVersionHistoryProps) {
  const [versions, setVersions] = useState<WebResultVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchVersions = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_result_versions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("version_number", { ascending: false });

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
    fetchVersions();
  }, [fetchVersions]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy HH:mm");
  };

  const getLanguages = (version: WebResultVersion): string[] => {
    const languages = new Set<string>();
    version.result_levels.forEach(level => {
      Object.keys(level.title || {}).forEach(lang => languages.add(lang));
      Object.keys(level.description || {}).forEach(lang => languages.add(lang));
    });
    return Array.from(languages).sort();
  };

  if (loading && versions.length === 0) {
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Web Result Templates</span>
          <Badge variant="secondary" className="text-xs">
            {versions.length}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchVersions}
          disabled={loading}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {versions.length === 0 ? (
        <div className="text-center py-6 border rounded-lg border-dashed">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No result versions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Generate results to create versions</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[60px_70px_140px_120px_80px_80px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <span>Ver</span>
            <span>Levels</span>
            <span>Languages</span>
            <span>Created</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table Rows */}
          <div className="max-h-[250px] overflow-y-auto">
            {versions.map((version, index) => {
              const languages = getLanguages(version);
              const isExpanded = expandedId === version.id;
              
              return (
                <div key={version.id}>
                  <div
                    className={`grid grid-cols-[60px_70px_140px_120px_80px_80px] gap-2 px-3 py-2 items-center text-sm border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                      index % 2 === 0 ? "bg-background" : "bg-muted/20"
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : version.id)}
                  >
                    {/* Version */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">v{version.version_number}</span>
                      {index === 0 && (
                        <Badge variant="outline" className="text-xs h-5 px-1.5">
                          Latest
                        </Badge>
                      )}
                    </div>

                    {/* Levels */}
                    <div>
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {version.result_levels.length} levels
                      </Badge>
                    </div>

                    {/* Languages */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {languages.slice(0, 4).map(lang => (
                        <Badge key={lang} variant="outline" className="text-xs h-5 px-1.5 uppercase font-mono">
                          {lang}
                        </Badge>
                      ))}
                      {languages.length > 4 && (
                        <Badge variant="outline" className="text-xs h-5 px-1.5">
                          +{languages.length - 4}
                        </Badge>
                      )}
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
                    <div className="flex items-center justify-end gap-1.5">
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
                          className="h-7 px-2 text-xs"
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
                    <div className="px-4 py-3 bg-muted/30 border-b space-y-3">
                      {version.result_levels.map((level, levelIndex) => (
                        <div key={levelIndex} className="bg-background rounded p-3 text-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">Score: {level.min_score}-{level.max_score}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {languages.map(lang => {
                              const title = level.title?.[lang];
                              if (!title) return null;
                              return (
                                <div key={lang} className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-xs h-5 px-1.5 uppercase font-mono">
                                    {lang}
                                  </Badge>
                                  <span className="text-muted-foreground truncate max-w-[150px]" title={title}>
                                    {title}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      
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
    </div>
  );
}
