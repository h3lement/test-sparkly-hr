import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, Wand2, RefreshCw, Languages, Code, FileText, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ru", name: "Russian" },
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
}

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
  primary_language: string;
}

interface EmailTemplateEditorProps {
  quizId: string;
  quiz: Quiz | null;
  onSave?: () => void;
  onPreview?: (template: Partial<EmailTemplate>) => void;
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="https://sparkly.hr" target="_blank">
        <img src="{{logoUrl}}" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
      </a>
      <h1 style="color: #6d28d9; font-size: 28px; margin: 0;">{{yourResultsTitle}}</h1>
    </div>
    
    <div style="text-align: center; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
      <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">{{score}}</div>
      <div style="opacity: 0.9;">{{outOf}} {{maxScore}} {{points}}</div>
    </div>
    
    <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">{{resultTitle}}</h2>
    <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">{{resultDescription}}</p>
    
    {{opennessSection}}
    
    <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">{{keyInsightsTitle}}:</h3>
    <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 30px;">
      {{insightsList}}
    </ul>
    
    <div style="background: linear-gradient(135deg, #6d28d9, #7c3aed); border-radius: 16px; padding: 32px; margin-top: 30px; text-align: center;">
      <h3 style="color: white; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">{{ctaTitle}}</h3>
      <p style="color: rgba(255,255,255,0.9); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">{{ctaDescription}}</p>
      <a href="{{ctaUrl}}" style="display: inline-block; background: white; color: #6d28d9; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">{{ctaButtonText}}</a>
    </div>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <a href="https://sparkly.hr" target="_blank">
        <img src="{{logoUrl}}" alt="Sparkly.hr" style="height: 32px; margin-bottom: 10px;" />
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
    </div>
  </div>
</body>
</html>`;

const AVAILABLE_PLACEHOLDERS = [
  { name: "{{score}}", description: "User's quiz score" },
  { name: "{{maxScore}}", description: "Maximum possible score" },
  { name: "{{resultTitle}}", description: "Result level title" },
  { name: "{{resultDescription}}", description: "Result level description" },
  { name: "{{insightsList}}", description: "Formatted list of insights" },
  { name: "{{opennessSection}}", description: "Open-mindedness section (if applicable)" },
  { name: "{{opennessScore}}", description: "Open-mindedness score" },
  { name: "{{opennessTitle}}", description: "Open-mindedness result title" },
  { name: "{{opennessDescription}}", description: "Open-mindedness description" },
  { name: "{{yourResultsTitle}}", description: "Translated 'Your Results' heading" },
  { name: "{{outOf}}", description: "Translated 'out of' text" },
  { name: "{{points}}", description: "Translated 'points' text" },
  { name: "{{keyInsightsTitle}}", description: "Translated 'Key Insights' heading" },
  { name: "{{ctaTitle}}", description: "Call-to-action heading" },
  { name: "{{ctaDescription}}", description: "Call-to-action description" },
  { name: "{{ctaButtonText}}", description: "CTA button label" },
  { name: "{{ctaUrl}}", description: "CTA link URL" },
  { name: "{{logoUrl}}", description: "Sparkly logo URL" },
  { name: "{{userEmail}}", description: "User's email address" },
];

export function EmailTemplateEditor({ quizId, quiz, onSave, onPreview }: EmailTemplateEditorProps) {
  const [senderName, setSenderName] = useState("Sparkly");
  const [senderEmail, setSenderEmail] = useState("support@sparkly.hr");
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [bodyContent, setBodyContent] = useState<Record<string, string>>({});
  const [selectedLang, setSelectedLang] = useState(quiz?.primary_language || "en");
  const [saving, setSaving] = useState(false);
  const [translatingSubjects, setTranslatingSubjects] = useState(false);
  const [translatingBody, setTranslatingBody] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [currentTranslatingLang, setCurrentTranslatingLang] = useState<string | null>(null);
  const [liveTemplate, setLiveTemplate] = useState<EmailTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const { toast } = useToast();

  const primaryLanguage = quiz?.primary_language || "en";

  // Calculate translation stats
  const translationStats = useMemo(() => {
    const subjectTranslated = SUPPORTED_LANGUAGES.filter(l => subjects[l.code]?.trim()).length;
    const bodyTranslated = SUPPORTED_LANGUAGES.filter(l => bodyContent[l.code]?.trim()).length;
    const total = SUPPORTED_LANGUAGES.length;
    return {
      subjectTranslated,
      bodyTranslated,
      total,
      subjectMissing: total - subjectTranslated,
      bodyMissing: total - bodyTranslated,
    };
  }, [subjects, bodyContent]);

  // Sample data for preview
  const sampleData = useMemo(() => ({
    score: "75",
    maxScore: "100",
    resultTitle: "Strong Performer",
    resultDescription: "You demonstrate excellent team collaboration skills with room for growth in strategic thinking.",
    insightsList: "<li>Excellent communication skills</li><li>Strong team player</li><li>Room for growth in leadership</li>",
    opennessSection: `<div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #1f2937; margin: 0 0 8px 0;">Open-Mindedness Score</h3>
      <div style="font-size: 24px; font-weight: bold; color: #6d28d9;">85%</div>
      <p style="color: #6b7280; margin: 8px 0 0 0;">High openness to new ideas</p>
    </div>`,
    opennessScore: "85%",
    opennessTitle: "High Openness",
    opennessDescription: "You show great receptivity to new ideas and perspectives.",
    yourResultsTitle: "Your Results",
    outOf: "out of",
    points: "points",
    keyInsightsTitle: "Key Insights",
    ctaTitle: "Ready to level up?",
    ctaDescription: "Book a consultation to discuss your results and growth opportunities.",
    ctaButtonText: "Book Now",
    ctaUrl: "https://sparkly.hr/book",
    logoUrl: "https://sparkly.hr/logo.png",
    userEmail: "user@example.com",
  }), []);

  // Render preview HTML with sample data
  const renderedPreview = useMemo(() => {
    let html = bodyContent[selectedLang] || "";
    if (!html) return "";
    
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
    });
    
    return html;
  }, [bodyContent, selectedLang, sampleData]);

  useEffect(() => {
    fetchLiveTemplate();
  }, [quizId]);

  const fetchLiveTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("template_type", "quiz_results")
        .eq("is_live", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const template = {
          ...data,
          subjects: data.subjects as Record<string, string>,
          body_content: (data.body_content || {}) as Record<string, string>,
        };
        setLiveTemplate(template);
        setSenderName(template.sender_name);
        setSenderEmail(template.sender_email);
        setSubjects(template.subjects);
        setBodyContent(template.body_content);
      } else {
        // Set defaults
        setBodyContent({ [primaryLanguage]: DEFAULT_TEMPLATE });
      }
    } catch (error) {
      console.error("Error fetching live template:", error);
    }
  };

  const updateSubject = (langCode: string, value: string) => {
    setSubjects(prev => ({ ...prev, [langCode]: value }));
  };

  const updateBodyContent = (langCode: string, value: string) => {
    setBodyContent(prev => ({ ...prev, [langCode]: value }));
  };

  const applyDefaultTemplate = () => {
    setBodyContent(prev => ({ ...prev, [selectedLang]: DEFAULT_TEMPLATE }));
    toast({
      title: "Template applied",
      description: "Default HTML template has been loaded. Customize it as needed.",
    });
  };

  const translateSubjects = async () => {
    if (!subjects[primaryLanguage]?.trim()) {
      toast({
        title: "No subject to translate",
        description: `Please add subject in the primary language (${primaryLanguage}) first.`,
        variant: "destructive",
      });
      return;
    }

    setTranslatingSubjects(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-email-template", {
        body: {
          templateId: liveTemplate?.id || "preview",
          sourceLanguage: primaryLanguage,
          sourceSubject: subjects[primaryLanguage] || "",
        },
      });

      if (error) throw error;

      if (data?.subjects) {
        setSubjects(prev => ({ ...prev, ...data.subjects }));
        toast({
          title: "Subjects translated",
          description: `Translated to ${Object.keys(data.subjects).length} languages. Cost: €${data.cost?.toFixed(4) || "0.0000"}`,
        });
      }
    } catch (error: any) {
      console.error("Translation error:", error);
      toast({
        title: "Translation failed",
        description: error.message || "Could not translate subjects",
        variant: "destructive",
      });
    } finally {
      setTranslatingSubjects(false);
    }
  };

  const translateBodyContent = async () => {
    if (!bodyContent[primaryLanguage]?.trim()) {
      toast({
        title: "No body content to translate",
        description: `Please add HTML body in the primary language (${primaryLanguage}) first.`,
        variant: "destructive",
      });
      return;
    }

    const targetLangs = SUPPORTED_LANGUAGES
      .filter(l => l.code !== primaryLanguage && !bodyContent[l.code]?.trim())
      .map(l => l.code);

    if (targetLangs.length === 0) {
      toast({
        title: "All translations complete",
        description: "All languages already have body content.",
      });
      return;
    }

    setTranslatingBody(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-email-body", {
        body: {
          sourceLanguage: primaryLanguage,
          sourceBody: bodyContent[primaryLanguage],
          targetLanguages: targetLangs,
        },
      });

      if (error) throw error;

      if (data?.translations) {
        setBodyContent(prev => ({ ...prev, ...data.translations }));
        toast({
          title: "Body content translated",
          description: `Translated to ${Object.keys(data.translations).length} languages. Cost: €${data.cost?.toFixed(4) || "0.0000"}`,
        });
      }
    } catch (error: any) {
      console.error("Body translation error:", error);
      toast({
        title: "Translation failed",
        description: error.message || "Could not translate body content",
        variant: "destructive",
      });
    } finally {
      setTranslatingBody(false);
      setCurrentTranslatingLang(null);
    }
  };

  const translateAllMissing = async () => {
    const hasPrimarySubject = subjects[primaryLanguage]?.trim();
    const hasPrimaryBody = bodyContent[primaryLanguage]?.trim();

    if (!hasPrimarySubject && !hasPrimaryBody) {
      toast({
        title: "No content to translate",
        description: `Please add content in the primary language (${primaryLanguage}) first.`,
        variant: "destructive",
      });
      return;
    }

    setTranslatingAll(true);
    let totalCost = 0;
    let translatedCount = 0;

    try {
      // Translate subjects if needed
      if (hasPrimarySubject && translationStats.subjectMissing > 0) {
        setCurrentTranslatingLang("subjects");
        const { data, error } = await supabase.functions.invoke("translate-email-template", {
          body: {
            templateId: liveTemplate?.id || "preview",
            sourceLanguage: primaryLanguage,
            sourceSubject: subjects[primaryLanguage],
          },
        });

        if (!error && data?.subjects) {
          setSubjects(prev => ({ ...prev, ...data.subjects }));
          totalCost += data.cost || 0;
          translatedCount += Object.keys(data.subjects).length - 1; // Exclude source
        }
      }

      // Translate body content if needed
      if (hasPrimaryBody && translationStats.bodyMissing > 0) {
        const targetLangs = SUPPORTED_LANGUAGES
          .filter(l => l.code !== primaryLanguage && !bodyContent[l.code]?.trim());

        for (const lang of targetLangs) {
          setCurrentTranslatingLang(lang.code);
          
          const { data, error } = await supabase.functions.invoke("translate-email-body", {
            body: {
              sourceLanguage: primaryLanguage,
              sourceBody: bodyContent[primaryLanguage],
              targetLanguages: [lang.code],
            },
          });

          if (!error && data?.translations) {
            setBodyContent(prev => ({ ...prev, ...data.translations }));
            totalCost += data.cost || 0;
            translatedCount++;
          }
        }
      }

      toast({
        title: "All translations complete",
        description: `Translated ${translatedCount} items. Total cost: €${totalCost.toFixed(4)}`,
      });
    } catch (error: any) {
      console.error("Translation error:", error);
      toast({
        title: "Translation failed",
        description: error.message || "Some translations could not be completed",
        variant: "destructive",
      });
    } finally {
      setTranslatingAll(false);
      setCurrentTranslatingLang(null);
    }
  };

  const saveNewVersion = async () => {
    if (!quizId) return;

    if (!senderName.trim() || !senderEmail.trim()) {
      toast({
        title: "Missing sender info",
        description: "Please fill in sender name and email",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();

      // Get max version
      const { data: existingVersions } = await supabase
        .from("email_templates")
        .select("version_number")
        .eq("quiz_id", quizId)
        .eq("template_type", "quiz_results")
        .order("version_number", { ascending: false })
        .limit(1);

      const maxVersion = existingVersions?.[0]?.version_number || 0;

      // Set all templates to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results")
        .eq("quiz_id", quizId);

      // Insert new version
      const { data: insertedTemplate, error } = await supabase
        .from("email_templates")
        .insert({
          quiz_id: quizId,
          template_type: "quiz_results",
          version_number: maxVersion + 1,
          sender_name: senderName.trim(),
          sender_email: senderEmail.trim(),
          subjects,
          body_content: bodyContent,
          is_live: true,
          created_by: user?.id || null,
          created_by_email: user?.email || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Template saved",
        description: `Version ${maxVersion + 1} is now live`,
      });

      setLiveTemplate({
        ...insertedTemplate,
        subjects: insertedTemplate.subjects as Record<string, string>,
        body_content: (insertedTemplate.body_content || {}) as Record<string, string>,
      });
      onSave?.();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    onPreview?.({
      sender_name: senderName,
      sender_email: senderEmail,
      subjects,
      body_content: bodyContent,
      is_live: true,
      quiz_id: quizId,
    } as Partial<EmailTemplate>);
  };

  const currentSubject = subjects[selectedLang] || "";
  const currentBody = bodyContent[selectedLang] || "";
  const isPrimaryLang = selectedLang === primaryLanguage;

  return (
    <div className="space-y-6">
      {/* Live Status */}
      {liveTemplate && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Currently Live: Version {liveTemplate.version_number}
              </CardTitle>
              <Badge variant="default" className="bg-primary">LIVE</Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Template Editor</CardTitle>
              <CardDescription>Edit sender info, subject lines, and HTML body content</CardDescription>
            </div>
            <Button onClick={fetchLiveTemplate} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sender Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender Name</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Sparkly.hr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Sender Email</Label>
              <Input
                id="senderEmail"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="support@sparkly.hr"
              />
            </div>
          </div>

          {/* Translation Status */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            {/* Progress indicator during translation */}
            {(translatingAll || translatingBody) && currentTranslatingLang && (
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {currentTranslatingLang === "subjects" 
                    ? "Translating subjects..."
                    : `Translating body to ${SUPPORTED_LANGUAGES.find(l => l.code === currentTranslatingLang)?.name || currentTranslatingLang.toUpperCase()}...`
                  }
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Subjects
                  </span>
                  <Badge variant={translationStats.subjectMissing === 0 ? "default" : "secondary"}>
                    {translationStats.subjectTranslated}/{translationStats.total}
                  </Badge>
                </div>
                <Progress value={(translationStats.subjectTranslated / translationStats.total) * 100} className="h-2" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={translateSubjects}
                  disabled={translatingSubjects || translatingAll || !subjects[primaryLanguage]?.trim()}
                  className="w-full gap-1.5"
                >
                  <Languages className="w-4 h-4" />
                  {translatingSubjects ? "Translating..." : `Translate Subjects (${translationStats.subjectMissing} missing)`}
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Body HTML
                  </span>
                  <Badge variant={translationStats.bodyMissing === 0 ? "default" : "secondary"}>
                    {translationStats.bodyTranslated}/{translationStats.total}
                  </Badge>
                </div>
                <Progress value={(translationStats.bodyTranslated / translationStats.total) * 100} className="h-2" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={translateBodyContent}
                  disabled={translatingBody || translatingAll || !bodyContent[primaryLanguage]?.trim()}
                  className="w-full gap-1.5"
                >
                  <Languages className="w-4 h-4" />
                  {translatingBody ? "Translating..." : `Translate Body (${translationStats.bodyMissing} missing)`}
                </Button>
              </div>
            </div>

            {/* Translate All Missing Button */}
            {(translationStats.subjectMissing > 0 || translationStats.bodyMissing > 0) && (
              <Button
                variant="default"
                onClick={translateAllMissing}
                disabled={translatingAll || translatingSubjects || translatingBody}
                className="w-full gap-2"
              >
                {translatingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Translating All Missing...
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4" />
                    Translate All Missing ({translationStats.subjectMissing + translationStats.bodyMissing} items)
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Language Tabs */}
          <Tabs value={selectedLang} onValueChange={setSelectedLang}>
            <TabsList className="flex-wrap h-auto gap-1 mb-4">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const hasSubject = !!subjects[lang.code]?.trim();
                const hasBody = !!bodyContent[lang.code]?.trim();
                const isComplete = hasSubject && hasBody;
                
                return (
                  <TabsTrigger 
                    key={lang.code} 
                    value={lang.code}
                    className="text-xs gap-1"
                  >
                    {lang.code.toUpperCase()}
                    {lang.code === primaryLanguage ? (
                      <span className="text-primary">•</span>
                    ) : isComplete ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <X className="w-3 h-3 text-muted-foreground/50" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {SUPPORTED_LANGUAGES.map((lang) => (
              <TabsContent key={lang.code} value={lang.code} className="space-y-4">
                {/* Subject Line */}
                <div className="space-y-2">
                  <Label>
                    Email Subject ({lang.name})
                    {lang.code === primaryLanguage && (
                      <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>
                    )}
                  </Label>
                  <Input
                    value={subjects[lang.code] || ""}
                    onChange={(e) => updateSubject(lang.code, e.target.value)}
                    placeholder={`Enter subject in ${lang.name}...`}
                  />
                </div>

                {/* Body Content with Preview Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>HTML Body ({lang.name})</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={showPreview ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className="gap-1.5 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showPreview ? "Hide Preview" : "Show Preview"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={applyDefaultTemplate}
                        className="gap-1.5 text-xs"
                      >
                        <Code className="w-3.5 h-3.5" />
                        Load Default
                      </Button>
                    </div>
                  </div>
                  
                  <div className={`grid gap-4 ${showPreview ? "grid-cols-2" : "grid-cols-1"}`}>
                    <Textarea
                      value={bodyContent[lang.code] || ""}
                      onChange={(e) => updateBodyContent(lang.code, e.target.value)}
                      placeholder="Paste HTML email template here..."
                      className="font-mono text-sm min-h-[400px]"
                    />
                    
                    {showPreview && (
                      <div className="border rounded-lg overflow-hidden bg-background">
                        <div className="bg-muted px-3 py-2 border-b flex items-center gap-2">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
                        </div>
                        <div className="h-[400px] overflow-auto">
                          {renderedPreview ? (
                            <iframe
                              srcDoc={renderedPreview}
                              className="w-full h-full border-0"
                              title="Email Preview"
                              sandbox="allow-same-origin"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                              Enter HTML to see preview
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Placeholders Reference */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Available Placeholders
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {AVAILABLE_PLACEHOLDERS.slice(0, 9).map((p) => (
                <div key={p.name} className="flex flex-col">
                  <code className="text-primary font-medium">{p.name}</code>
                  <span className="text-muted-foreground">{p.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handlePreview} className="gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button onClick={saveNewVersion} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save as New Version & Set Live"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
