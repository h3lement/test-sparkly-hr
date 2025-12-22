import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Loader2, Languages, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const getQuizTitle = (quiz: Quiz) => quiz.title?.en || quiz.title?.et || quiz.slug;

  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);

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

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save CTA Content
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
