import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  Loader2, 
  Languages, 
  Globe, 
  Eye, 
  Sparkles, 
  RefreshCw,
  Check,
  Link as LinkIcon,
  History
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CTAPreviewDialog } from "./CTAPreviewDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
  cta_title: Record<string, string>;
  cta_description: Record<string, string>;
  cta_text: Record<string, string>;
  cta_url: string | null;
  primary_language: string;
}

interface CTATemplate {
  id: string;
  quiz_id: string;
  version_number: number;
  is_live: boolean;
  cta_title: Record<string, string>;
  cta_description: Record<string, string>;
  cta_text: Record<string, string>;
  cta_url: string;
  created_at: string;
  created_by_email: string | null;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pl", name: "Polish" },
  { code: "nl", name: "Dutch" },
  { code: "pt", name: "Portuguese" },
  { code: "sv", name: "Swedish" },
  { code: "fi", name: "Finnish" },
  { code: "da", name: "Danish" },
  { code: "ro", name: "Romanian" },
  { code: "el", name: "Greek" },
  { code: "cs", name: "Czech" },
  { code: "hu", name: "Hungarian" },
  { code: "bg", name: "Bulgarian" },
  { code: "sk", name: "Slovak" },
  { code: "hr", name: "Croatian" },
  { code: "lt", name: "Lithuanian" },
  { code: "sl", name: "Slovenian" },
  { code: "lv", name: "Latvian" },
  { code: "ga", name: "Irish" },
  { code: "mt", name: "Maltese" },
];

export function CTATemplateManager() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [templates, setTemplates] = useState<CTATemplate[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [ctaTitle, setCtaTitle] = useState<Record<string, string>>({});
  const [ctaDescription, setCtaDescription] = useState<Record<string, string>>({});
  const [ctaButtonText, setCtaButtonText] = useState<Record<string, string>>({});
  const [ctaUrl, setCtaUrl] = useState("");
  
  // Version history dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filterQuiz, setFilterQuiz] = useState<string>("all");
  const [showOnlyLive, setShowOnlyLive] = useState(true);
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<CTATemplate | null>(null);
  const [previewLang, setPreviewLang] = useState("en");
  
  // Translation state
  const [translating, setTranslating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { toast } = useToast();

  // Cost estimation
  const COST_PER_1K_INPUT_TOKENS = 0.000075;
  const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch quizzes
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("id, title, slug, cta_title, cta_description, cta_text, cta_url, primary_language")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      const typedQuizzes = (quizzesData || []).map(q => ({
        ...q,
        title: (q.title || {}) as Record<string, string>,
        cta_title: (q.cta_title || {}) as Record<string, string>,
        cta_description: (q.cta_description || {}) as Record<string, string>,
        cta_text: (q.cta_text || {}) as Record<string, string>,
      }));
      setQuizzes(typedQuizzes);

      // Select first quiz by default
      if (typedQuizzes.length > 0 && !selectedQuizId) {
        setSelectedQuizId(typedQuizzes[0].id);
      }

      // Fetch CTA templates
      const activeQuizIds = typedQuizzes.map(q => q.id);
      if (activeQuizIds.length > 0) {
        const { data: templatesData, error: templatesError } = await supabase
          .from("cta_templates")
          .select("*")
          .in("quiz_id", activeQuizIds)
          .order("created_at", { ascending: false });

        if (templatesError) throw templatesError;

        const typedTemplates = (templatesData || []).map(t => ({
          ...t,
          cta_title: (t.cta_title || {}) as Record<string, string>,
          cta_description: (t.cta_description || {}) as Record<string, string>,
          cta_text: (t.cta_text || {}) as Record<string, string>,
        }));
        setTemplates(typedTemplates);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedQuizId, toast]);

  useEffect(() => {
    fetchData();
  }, []);

  // Load live template when quiz changes
  useEffect(() => {
    if (!selectedQuizId) return;

    const liveTemplate = templates.find(t => t.quiz_id === selectedQuizId && t.is_live);
    if (liveTemplate) {
      setCtaTitle(liveTemplate.cta_title);
      setCtaDescription(liveTemplate.cta_description);
      setCtaButtonText(liveTemplate.cta_text);
      setCtaUrl(liveTemplate.cta_url || "https://sparkly.hr");
    } else {
      // Fall back to quiz table data if no template exists
      const quiz = quizzes.find(q => q.id === selectedQuizId);
      if (quiz) {
        setCtaTitle(quiz.cta_title || {});
        setCtaDescription(quiz.cta_description || {});
        setCtaButtonText(quiz.cta_text || {});
        setCtaUrl(quiz.cta_url || "https://sparkly.hr");
      } else {
        setCtaTitle({});
        setCtaDescription({});
        setCtaButtonText({});
        setCtaUrl("https://sparkly.hr");
      }
    }
  }, [selectedQuizId, templates, quizzes]);

  const handleSaveNewVersion = async () => {
    if (!selectedQuizId) return;
    
    const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
    const primaryLanguage = selectedQuiz?.primary_language || "en";

    if (!ctaButtonText[primaryLanguage]?.trim()) {
      toast({
        title: "Validation Error",
        description: `Button text is required for ${primaryLanguage.toUpperCase()}`,
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
      // Get next version number
      const quizTemplates = templates.filter(t => t.quiz_id === selectedQuizId);
      const maxVersion = quizTemplates.length > 0 
        ? Math.max(...quizTemplates.map(t => t.version_number)) 
        : 0;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert new version (trigger will set others to not live)
      const { error } = await supabase
        .from("cta_templates")
        .insert({
          quiz_id: selectedQuizId,
          version_number: maxVersion + 1,
          is_live: true,
          cta_title: ctaTitle,
          cta_description: ctaDescription,
          cta_text: ctaButtonText,
          cta_url: ctaUrl.trim() || "https://sparkly.hr",
          created_by: user?.id,
          created_by_email: user?.email,
        });

      if (error) throw error;

      toast({
        title: "CTA Template Saved",
        description: `Version ${maxVersion + 1} is now live`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save CTA template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTranslate = async (regenerate = false) => {
    const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
    if (!selectedQuiz) return;
    
    if (!ctaTitle[selectedLanguage]?.trim() && !ctaDescription[selectedLanguage]?.trim() && !ctaButtonText[selectedLanguage]?.trim()) {
      toast({
        title: "Error",
        description: "Please enter CTA content before translating",
        variant: "destructive",
      });
      return;
    }
    
    if (regenerate) {
      setRegenerating(true);
    } else {
      setTranslating(true);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke("translate-cta", {
        body: {
          quizId: selectedQuizId,
          sourceLanguage: selectedLanguage,
          regenerate,
          sourceContent: {
            cta_title: ctaTitle[selectedLanguage] || "",
            cta_description: ctaDescription[selectedLanguage] || "",
            cta_text: ctaButtonText[selectedLanguage] || "",
          },
        },
      });

      if (error) throw error;

      const action = regenerate ? "Regenerated" : "Translated";
      toast({
        title: "Success",
        description: `${action} CTA to ${data.translatedCount} languages (€${data.costEur?.toFixed(4) || "0.0000"})`,
      });
      
      // Update local state with translations
      if (data.updatedCtaTitle) setCtaTitle(data.updatedCtaTitle);
      if (data.updatedCtaDescription) setCtaDescription(data.updatedCtaDescription);
      if (data.updatedCtaText) setCtaButtonText(data.updatedCtaText);
    } catch (error: any) {
      console.error("Translation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to translate CTA content",
        variant: "destructive",
      });
    } finally {
      setTranslating(false);
      setRegenerating(false);
    }
  };

  const setLiveVersion = async (templateId: string, versionNumber: number) => {
    try {
      const { error } = await supabase
        .from("cta_templates")
        .update({ is_live: true })
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Live version updated",
        description: `Version ${versionNumber} is now live`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Error setting live version:", error);
      toast({
        title: "Error",
        description: "Failed to update live version",
        variant: "destructive",
      });
    }
  };

  const loadVersionToEdit = (template: CTATemplate) => {
    setCtaTitle(template.cta_title);
    setCtaDescription(template.cta_description);
    setCtaButtonText(template.cta_text);
    setCtaUrl(template.cta_url || "https://sparkly.hr");
    setSelectedQuizId(template.quiz_id);
    setHistoryOpen(false);
    toast({
      title: "Version loaded",
      description: "You can now edit and save as a new version",
    });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy HH:mm");
  };

  const getQuizTitle = (quiz: Quiz) => quiz.title?.en || quiz.title?.et || quiz.slug;
  const getQuizTitleById = (quizId: string) => {
    const quiz = quizzes.find(q => q.id === quizId);
    return quiz ? getQuizTitle(quiz) : "Unknown";
  };

  const getTranslationCount = (template: CTATemplate): number => {
    const titleLangs = Object.keys(template.cta_title || {}).filter(k => template.cta_title[k]?.trim());
    const textLangs = Object.keys(template.cta_text || {}).filter(k => template.cta_text[k]?.trim());
    return Math.max(titleLangs.length, textLangs.length);
  };

  // Filtered templates for history view
  const filteredTemplates = useMemo(() => {
    const filtered = templates.filter(t => {
      const quizMatch = filterQuiz === "all" || t.quiz_id === filterQuiz;
      const liveMatch = !showOnlyLive || t.is_live;
      return quizMatch && liveMatch;
    });

    return filtered.sort((a, b) => {
      if (a.is_live && !b.is_live) return -1;
      if (!a.is_live && b.is_live) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [templates, filterQuiz, showOnlyLive]);

  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
  const currentLiveTemplate = templates.find(t => t.quiz_id === selectedQuizId && t.is_live);

  // Estimate translation cost
  const estimateTranslationCost = (regenerate = false) => {
    let missingCount: number;
    
    if (regenerate) {
      missingCount = LANGUAGES.length - 1;
    } else {
      const availableLanguages = new Set<string>();
      Object.keys(ctaTitle || {}).forEach(lang => {
        if (ctaTitle[lang]?.trim()) availableLanguages.add(lang);
      });
      
      missingCount = LANGUAGES.length - availableLanguages.size;
      if (missingCount <= 0) return 0;
    }
    
    const avgTitleLength = 50;
    const avgDescLength = 200;
    const avgButtonLength = 30;
    const totalContent = avgTitleLength + avgDescLength + avgButtonLength;
    
    const promptBase = 500;
    const languageList = missingCount * 15;
    const inputChars = promptBase + languageList + totalContent;
    const outputChars = missingCount * totalContent * 1.2;
    
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    
    const costUsd = (inputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                    (outputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    return costUsd * 0.92;
  };

  const translationCostEur = estimateTranslationCost(false);
  const regenerateCostEur = estimateTranslationCost(true);
  const hasMissingTranslations = translationCostEur > 0;
  const hasAnyTranslations = Object.keys(ctaTitle || {}).length > 1;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CTA Templates Table - Shown First */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              CTA Templates
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyLive}
                  onChange={(e) => setShowOnlyLive(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-muted-foreground">Only Live</span>
              </label>
              <Select value={filterQuiz} onValueChange={setFilterQuiz}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Quizzes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  {quizzes.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      {getQuizTitle(q)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 border rounded-lg border-dashed bg-muted/30">
              <LinkIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No CTA templates yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Select a quiz below to create one</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex bg-muted/40 text-sm font-medium border-b">
                <div className="w-[80px] px-3 py-2">Version</div>
                <div className="w-[150px] px-3 py-2">Quiz</div>
                <div className="flex-1 px-3 py-2">Button Text</div>
                <div className="w-[130px] px-3 py-2">Created</div>
                <div className="w-[60px] px-3 py-2 text-center">Lang</div>
                <div className="w-[120px] px-3 py-2 text-center">Actions</div>
              </div>
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className={`flex items-center border-b last:border-b-0 hover:bg-muted/20 text-sm ${
                    template.is_live ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="w-[80px] px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono">v{template.version_number}</span>
                      {template.is_live && (
                        <Badge variant="default" className="text-[10px] px-1 py-0 bg-green-600">
                          Live
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="w-[150px] px-3 py-2 truncate">
                    {getQuizTitleById(template.quiz_id)}
                  </div>
                  <div className="flex-1 px-3 py-2 text-muted-foreground truncate">
                    {template.cta_text?.en || template.cta_text?.et || "—"}
                  </div>
                  <div className="w-[130px] px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      {formatDate(template.created_at)}
                    </div>
                    {template.created_by_email && (
                      <div className="text-[10px] text-muted-foreground/70 truncate">
                        {template.created_by_email.split("@")[0]}
                      </div>
                    )}
                  </div>
                  <div className="w-[60px] px-3 py-2 text-center">
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <Languages className="w-2.5 h-2.5" />
                      {getTranslationCount(template)}
                    </Badge>
                  </div>
                  <div className="w-[120px] px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPreviewTemplate(template);
                          setPreviewOpen(true);
                        }}
                        className="h-7 w-7 p-0"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadVersionToEdit(template)}
                        className="h-7 px-2 text-xs"
                      >
                        Edit
                      </Button>
                      {!template.is_live && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLiveVersion(template.id, template.version_number)}
                          className="h-7 w-7 p-0 text-green-600"
                          title="Set as live"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz and Language Selection */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="mb-2 block">Select Quiz</Label>
          <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a quiz" />
            </SelectTrigger>
            <SelectContent>
              {quizzes.map(quiz => (
                <SelectItem key={quiz.id} value={quiz.id}>
                  {getQuizTitle(quiz)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-[180px]">
          <Label className="mb-2 block">Language</Label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <Globe className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedQuiz && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                CTA Block Editor
                {currentLiveTemplate && (
                  <Badge variant="default" className="ml-2 bg-green-600">
                    <Check className="w-3 h-3 mr-1" />
                    v{currentLiveTemplate.version_number} Live
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {ctaTitle[selectedLanguage] || "Ready for Precise Employee Assessment?"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {ctaDescription[selectedLanguage] || "This quiz provides a general overview. For accurate, in-depth analysis of your team's performance and actionable improvement strategies, continue with professional testing."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" className="gap-2">
                  {ctaButtonText[selectedLanguage] || "Continue to Sparkly.hr"}
                </Button>
                <Button size="sm" variant="outline">
                  Take Quiz Again
                </Button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="cta-title">CTA Title ({selectedLanguage.toUpperCase()})</Label>
                <Input
                  id="cta-title"
                  value={ctaTitle[selectedLanguage] || ""}
                  onChange={(e) => setCtaTitle({ ...ctaTitle, [selectedLanguage]: e.target.value })}
                  placeholder="Ready for Precise Employee Assessment?"
                />
              </div>

              <div>
                <Label htmlFor="cta-description">CTA Description ({selectedLanguage.toUpperCase()})</Label>
                <Textarea
                  id="cta-description"
                  value={ctaDescription[selectedLanguage] || ""}
                  onChange={(e) => setCtaDescription({ ...ctaDescription, [selectedLanguage]: e.target.value })}
                  placeholder="This quiz provides a general overview..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cta-button">Button Text ({selectedLanguage.toUpperCase()}) *</Label>
                  <Input
                    id="cta-button"
                    value={ctaButtonText[selectedLanguage] || ""}
                    onChange={(e) => setCtaButtonText({ ...ctaButtonText, [selectedLanguage]: e.target.value })}
                    placeholder="Continue to Sparkly.hr"
                  />
                </div>

                <div>
                  <Label htmlFor="cta-url">Button URL (shared)</Label>
                  <Input
                    id="cta-url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://sparkly.hr"
                    type="url"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t gap-4 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {/* AI Translate Button */}
                {hasMissingTranslations && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          onClick={() => handleTranslate(false)}
                          disabled={translating || regenerating}
                          className="gap-2"
                        >
                          {translating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          AI Translate
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-mono">
                            ~€{translationCostEur.toFixed(4)}
                          </Badge>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Translate CTA to missing languages</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Regenerate AI Translations Button */}
                {hasAnyTranslations && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          onClick={() => handleTranslate(true)}
                          disabled={translating || regenerating}
                          className="gap-2"
                        >
                          {regenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Regenerate
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-mono">
                            ~€{regenerateCostEur.toFixed(4)}
                          </Badge>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Regenerate all CTA translations from source</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <Button onClick={handleSaveNewVersion} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save as New Version
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen && !!previewTemplate} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              CTA Preview
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Language:</Label>
                <Select value={previewLang} onValueChange={setPreviewLang}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border">
                <h3 className="text-lg font-semibold mb-2">
                  {previewTemplate.cta_title?.[previewLang] || previewTemplate.cta_title?.en || "CTA Title"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {previewTemplate.cta_description?.[previewLang] || previewTemplate.cta_description?.en || "CTA description..."}
                </p>
                <Button className="w-full">
                  {previewTemplate.cta_text?.[previewLang] || previewTemplate.cta_text?.en || "Button"}
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Links to: {previewTemplate.cta_url}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
