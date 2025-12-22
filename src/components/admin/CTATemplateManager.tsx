import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, Languages, Globe, Eye, Sparkles, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CTAPreviewDialog } from "./CTAPreviewDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [ctaTitle, setCtaTitle] = useState("");
  const [ctaDescription, setCtaDescription] = useState("");
  const [ctaButtonText, setCtaButtonText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Translation state
  const [translating, setTranslating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Cost estimation
  const COST_PER_1K_INPUT_TOKENS = 0.000075;
  const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (selectedQuizId) {
      loadQuizCTA(selectedQuizId, selectedLanguage);
    }
  }, [selectedQuizId, selectedLanguage]);

  const fetchQuizzes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, slug, cta_title, cta_description, cta_text, cta_url, primary_language")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const typedQuizzes = data.map(q => ({
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
    }
    setLoading(false);
  };

  const loadQuizCTA = (quizId: string, lang: string) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    setCtaTitle(quiz.cta_title?.[lang] || "");
    setCtaDescription(quiz.cta_description?.[lang] || "");
    setCtaButtonText(quiz.cta_text?.[lang] || "");
    setCtaUrl(quiz.cta_url || "https://sparkly.hr");
  };

  const handleSave = async () => {
    if (!selectedQuizId) return;
    
    setSaving(true);
    const quiz = quizzes.find(q => q.id === selectedQuizId);
    if (!quiz) {
      setSaving(false);
      return;
    }

    const updatedCtaTitle = { ...quiz.cta_title, [selectedLanguage]: ctaTitle };
    const updatedCtaDescription = { ...quiz.cta_description, [selectedLanguage]: ctaDescription };
    const updatedCtaText = { ...quiz.cta_text, [selectedLanguage]: ctaButtonText };

    const { error } = await supabase
      .from("quizzes")
      .update({
        cta_title: updatedCtaTitle,
        cta_description: updatedCtaDescription,
        cta_text: updatedCtaText,
        cta_url: ctaUrl,
      })
      .eq("id", selectedQuizId);

    if (error) {
      toast.error("Failed to save CTA content");
      console.error(error);
    } else {
      toast.success(`CTA content saved for ${selectedLanguage.toUpperCase()}`);
      // Update local state
      setQuizzes(prev => prev.map(q => 
        q.id === selectedQuizId 
          ? { 
              ...q, 
              cta_title: updatedCtaTitle, 
              cta_description: updatedCtaDescription, 
              cta_text: updatedCtaText,
              cta_url: ctaUrl,
            } 
          : q
      ));
    }
    setSaving(false);
  };

  const handleTranslate = async (regenerate = false) => {
    if (!selectedQuiz) return;
    
    if (regenerate) {
      setRegenerating(true);
    } else {
      setTranslating(true);
    }
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/translate-cta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          quizId: selectedQuiz.id,
          sourceLanguage: selectedQuiz.primary_language || "en",
          regenerate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Translation failed");
      }

      const action = regenerate ? "Regenerated" : "Translated";
      toast.success(`${action} CTA to ${data.translatedCount} languages (€${data.costEur?.toFixed(4) || "0.0000"})`);
      
      // Update local state with new translations
      setQuizzes(prev => prev.map(q => 
        q.id === selectedQuiz.id 
          ? { 
              ...q, 
              cta_title: data.updatedCtaTitle || q.cta_title, 
              cta_description: data.updatedCtaDescription || q.cta_description, 
              cta_text: data.updatedCtaText || q.cta_text,
            } 
          : q
      ));
    } catch (error: any) {
      console.error("Translation error:", error);
      toast.error(error.message || "Failed to translate CTA content");
    } finally {
      setTranslating(false);
      setRegenerating(false);
    }
  };

  const getQuizTitle = (quiz: Quiz) => quiz.title?.en || quiz.title?.et || quiz.slug;

  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);

  // Estimate translation cost
  const estimateTranslationCost = (regenerate = false) => {
    if (!selectedQuiz) return 0;
    
    let missingCount: number;
    
    if (regenerate) {
      // For regenerate, we translate all languages except source
      missingCount = LANGUAGES.length - 1;
    } else {
      // Count available languages
      const availableLanguages = new Set<string>();
      Object.keys(selectedQuiz.cta_title || {}).forEach(lang => {
        if (selectedQuiz.cta_title[lang]?.trim()) availableLanguages.add(lang);
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
  const hasAnyTranslations = Object.keys(selectedQuiz?.cta_title || {}).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quiz and Language Selection */}
      <div className="flex flex-wrap gap-4">
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
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              CTA Block Content
            </CardTitle>
            <CardDescription>
              Customize the call-to-action section shown at the end of quiz results.
              This appears as "Ready for Precise Employee Assessment?" block.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {ctaTitle || "Ready for Precise Employee Assessment?"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {ctaDescription || "This quiz provides a general overview. For accurate, in-depth analysis of your team's performance and actionable improvement strategies, continue with professional testing."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" className="gap-2">
                  {ctaButtonText || "Continue to Sparkly.hr"}
                </Button>
                <Button size="sm" variant="outline">
                  Take Quiz Again
                </Button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="cta-title">CTA Title</Label>
                <Input
                  id="cta-title"
                  value={ctaTitle}
                  onChange={(e) => setCtaTitle(e.target.value)}
                  placeholder="Ready for Precise Employee Assessment?"
                />
              </div>

              <div>
                <Label htmlFor="cta-description">CTA Description</Label>
                <Textarea
                  id="cta-description"
                  value={ctaDescription}
                  onChange={(e) => setCtaDescription(e.target.value)}
                  placeholder="This quiz provides a general overview..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cta-button">Button Text</Label>
                  <Input
                    id="cta-button"
                    value={ctaButtonText}
                    onChange={(e) => setCtaButtonText(e.target.value)}
                    placeholder="Continue to Sparkly.hr"
                  />
                </div>

                <div>
                  <Label htmlFor="cta-url">Button URL</Label>
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

            <div className="flex justify-between items-center pt-4 border-t gap-4">
              <div className="flex gap-2">
                {/* Preview Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={() => setPreviewOpen(true)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Preview CTA in all languages</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

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

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save CTA Content
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <CTAPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        quiz={selectedQuiz || null}
        onTranslateComplete={() => {
          fetchQuizzes();
        }}
      />
    </div>
  );
}
