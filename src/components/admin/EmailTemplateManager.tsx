import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Save, Check, History, ChevronDown, ChevronUp, Send, Eye } from "lucide-react";

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
}

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
  { code: "sv", name: "Swedish" },
  { code: "no", name: "Norwegian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "uk", name: "Ukrainian" },
];

// Email translations for preview
const emailTranslations: Record<string, {
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  visitSparkly: string;
  leadershipOpenMindedness: string;
  openMindednessOutOf: string;
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
  },
  de: {
    yourResults: "Ihre Team-Leistungsergebnisse",
    outOf: "von",
    points: "Punkten",
    keyInsights: "Wichtige Erkenntnisse",
    wantToImprove: "Möchten Sie die Leistung Ihres Teams verbessern?",
    visitSparkly: "Besuchen Sie Sparkly.hr",
    leadershipOpenMindedness: "Aufgeschlossene Führung",
    openMindednessOutOf: "von 4",
  },
  fr: {
    yourResults: "Vos résultats de performance d'équipe",
    outOf: "sur",
    points: "points",
    keyInsights: "Points clés",
    wantToImprove: "Voulez-vous améliorer la performance de votre équipe?",
    visitSparkly: "Visitez Sparkly.hr",
    leadershipOpenMindedness: "Leadership ouvert d'esprit",
    openMindednessOutOf: "sur 4",
  },
  es: {
    yourResults: "Tus resultados de rendimiento del equipo",
    outOf: "de",
    points: "puntos",
    keyInsights: "Puntos clave",
    wantToImprove: "¿Quieres mejorar el rendimiento de tu equipo?",
    visitSparkly: "Visita Sparkly.hr",
    leadershipOpenMindedness: "Liderazgo de mente abierta",
    openMindednessOutOf: "de 4",
  },
  it: {
    yourResults: "I tuoi risultati di performance del team",
    outOf: "su",
    points: "punti",
    keyInsights: "Punti chiave",
    wantToImprove: "Vuoi migliorare le prestazioni del tuo team?",
    visitSparkly: "Visita Sparkly.hr",
    leadershipOpenMindedness: "Leadership di mentalità aperta",
    openMindednessOutOf: "su 4",
  },
  pt: {
    yourResults: "Os seus resultados de desempenho da equipa",
    outOf: "de",
    points: "pontos",
    keyInsights: "Pontos-chave",
    wantToImprove: "Quer melhorar o desempenho da sua equipa?",
    visitSparkly: "Visite Sparkly.hr",
    leadershipOpenMindedness: "Liderança de mente aberta",
    openMindednessOutOf: "de 4",
  },
  nl: {
    yourResults: "Uw teamprestatie resultaten",
    outOf: "van",
    points: "punten",
    keyInsights: "Belangrijke inzichten",
    wantToImprove: "Wilt u de prestaties van uw team verbeteren?",
    visitSparkly: "Bezoek Sparkly.hr",
    leadershipOpenMindedness: "Open-minded leiderschap",
    openMindednessOutOf: "van 4",
  },
  pl: {
    yourResults: "Twoje wyniki wydajności zespołu",
    outOf: "z",
    points: "punktów",
    keyInsights: "Kluczowe spostrzeżenia",
    wantToImprove: "Chcesz poprawić wydajność swojego zespołu?",
    visitSparkly: "Odwiedź Sparkly.hr",
    leadershipOpenMindedness: "Przywództwo otwarte na innowacje",
    openMindednessOutOf: "z 4",
  },
  ru: {
    yourResults: "Результаты производительности вашей команды",
    outOf: "из",
    points: "баллов",
    keyInsights: "Ключевые выводы",
    wantToImprove: "Хотите улучшить производительность вашей команды?",
    visitSparkly: "Посетите Sparkly.hr",
    leadershipOpenMindedness: "Открытое лидерство",
    openMindednessOutOf: "из 4",
  },
  sv: {
    yourResults: "Dina teamprestationsresultat",
    outOf: "av",
    points: "poäng",
    keyInsights: "Viktiga insikter",
    wantToImprove: "Vill du förbättra ditt teams prestation?",
    visitSparkly: "Besök Sparkly.hr",
    leadershipOpenMindedness: "Öppensinnat ledarskap",
    openMindednessOutOf: "av 4",
  },
  no: {
    yourResults: "Dine teamytelsesresultater",
    outOf: "av",
    points: "poeng",
    keyInsights: "Viktige innsikter",
    wantToImprove: "Vil du forbedre teamets ytelse?",
    visitSparkly: "Besøk Sparkly.hr",
    leadershipOpenMindedness: "Åpent lederskap",
    openMindednessOutOf: "av 4",
  },
  da: {
    yourResults: "Dine teampræstationsresultater",
    outOf: "af",
    points: "point",
    keyInsights: "Vigtige indsigter",
    wantToImprove: "Vil du forbedre dit teams præstation?",
    visitSparkly: "Besøg Sparkly.hr",
    leadershipOpenMindedness: "Åbensindet lederskab",
    openMindednessOutOf: "af 4",
  },
  fi: {
    yourResults: "Tiimisuorituksesi tulokset",
    outOf: "/",
    points: "pistettä",
    keyInsights: "Keskeiset oivallukset",
    wantToImprove: "Haluatko parantaa tiimisi suorituskykyä?",
    visitSparkly: "Vieraile Sparkly.hr",
    leadershipOpenMindedness: "Avoimen mielen johtajuus",
    openMindednessOutOf: "/ 4",
  },
  uk: {
    yourResults: "Результати продуктивності вашої команди",
    outOf: "з",
    points: "балів",
    keyInsights: "Ключові висновки",
    wantToImprove: "Хочете покращити продуктивність вашої команди?",
    visitSparkly: "Відвідайте Sparkly.hr",
    leadershipOpenMindedness: "Відкрите лідерство",
    openMindednessOutOf: "з 4",
  },
};

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const { toast } = useToast();

  // Form state for new version
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [subjects, setSubjects] = useState<Record<string, string>>({});

  // Test email state
  const [testEmail, setTestEmail] = useState("");
  const [testLanguage, setTestLanguage] = useState("en");
  const [sendingTest, setSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setCurrentUserEmail(user.email);
      setTestEmail(user.email);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "quiz_results")
        .order("version_number", { ascending: false });

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        subjects: item.subjects as Record<string, string>
      }));

      setTemplates(typedData);

      // Load live template into form
      const liveTemplate = typedData.find(t => t.is_live);
      if (liveTemplate) {
        setSenderName(liveTemplate.sender_name);
        setSenderEmail(liveTemplate.sender_email);
        setSubjects(liveTemplate.subjects);
      }
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to fetch email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveNewVersion = async () => {
    if (!senderName.trim() || !senderEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Sender name and email are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Get next version number
      const maxVersion = templates.length > 0 
        ? Math.max(...templates.map(t => t.version_number)) 
        : 0;

      // First, set all existing templates to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results");

      // Insert new version as live
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("email_templates")
        .insert({
          version_number: maxVersion + 1,
          template_type: "quiz_results",
          sender_name: senderName.trim(),
          sender_email: senderEmail.trim(),
          subjects: subjects,
          is_live: true,
          created_by: user?.id,
          created_by_email: user?.email || currentUserEmail,
        });

      if (error) throw error;

      toast({
        title: "Template saved",
        description: `Version ${maxVersion + 1} is now live`,
      });

      fetchTemplates();
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

  const setLiveVersion = async (templateId: string, versionNumber: number) => {
    try {
      // Set all to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results");

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
    } catch (error: any) {
      console.error("Error setting live version:", error);
      toast({
        title: "Error",
        description: "Failed to update live version",
        variant: "destructive",
      });
    }
  };

  const loadVersionToEdit = (template: EmailTemplate) => {
    setSenderName(template.sender_name);
    setSenderEmail(template.sender_email);
    setSubjects(template.subjects);
    toast({
      title: "Version loaded",
      description: `Version ${template.version_number} loaded into editor`,
    });
  };

  const updateSubject = (langCode: string, value: string) => {
    setSubjects(prev => ({
      ...prev,
      [langCode]: value,
    }));
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a test email address",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      // Use mock/sample data for test emails that matches what the edge function expects
      const testData = {
        email: testEmail.trim(),
        totalScore: 18,
        maxScore: 24,
        resultTitle: "Strong Team Foundation",
        resultDescription: "Your team shows solid performance indicators with room for growth.",
        insights: [
          "Your team demonstrates good collaboration patterns",
          "Consider implementing regular feedback sessions",
          "Focus on developing leadership skills within the team"
        ],
        language: testLanguage,
        opennessScore: 3,
      };

      const { error } = await supabase.functions.invoke("send-quiz-results", {
        body: testData,
      });

      if (error) throw error;

      toast({
        title: "Test email sent",
        description: `Email sent to ${testEmail} in ${SUPPORTED_LANGUAGES.find(l => l.code === testLanguage)?.name || testLanguage}`,
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Sample test data for preview
  const sampleData = {
    totalScore: 18,
    maxScore: 24,
    resultTitle: "Strong Team Foundation",
    resultDescription: "Your team shows solid performance indicators with room for growth.",
    insights: [
      "Your team demonstrates good collaboration patterns",
      "Consider implementing regular feedback sessions",
      "Focus on developing leadership skills within the team"
    ],
    opennessScore: 3,
  };

  const getEmailPreviewHtml = () => {
    const trans = emailTranslations[testLanguage] || emailTranslations.en;
    const currentSubject = subjects[testLanguage] || trans.yourResults;
    const logoUrl = "/sparkly-logo.png";
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="background: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 13px; color: #6b7280;"><strong>From:</strong> ${senderName || "Sparkly.hr"} &lt;${senderEmail || "support@sparkly.hr"}&gt;</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;"><strong>Subject:</strong> ${currentSubject}: ${sampleData.resultTitle}</p>
          </div>
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="https://sparkly.hr" target="_blank">
                <img src="${logoUrl}" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
              </a>
              <h1 style="color: #6d28d9; font-size: 28px; margin: 0;">${trans.yourResults}</h1>
            </div>
            
            <div style="text-align: center; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
              <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${sampleData.totalScore}</div>
              <div style="opacity: 0.9;">${trans.outOf} ${sampleData.maxScore} ${trans.points}</div>
            </div>
            
            <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">${sampleData.resultTitle}</h2>
            
            <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">${sampleData.resultDescription}</p>
            
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 12px 0;">${trans.leadershipOpenMindedness}</h3>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px; font-weight: bold; color: #6d28d9;">${sampleData.opennessScore}</span>
                <span style="color: #6b7280;">${trans.openMindednessOutOf}</span>
              </div>
            </div>
            
            <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">${trans.keyInsights}:</h3>
            <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 30px;">
              ${sampleData.insights.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("")}
            </ul>
            
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 14px; margin-bottom: 12px;">${trans.wantToImprove}</p>
              <a href="https://sparkly.hr" style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">${trans.visitSparkly}</a>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <a href="https://sparkly.hr" target="_blank">
                <img src="${logoUrl}" alt="Sparkly.hr" style="height: 32px; margin-bottom: 10px;" />
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const liveTemplate = templates.find(t => t.is_live);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading email templates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Current Live Status */}
      {liveTemplate && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                Currently Live: Version {liveTemplate.version_number}
              </CardTitle>
              <Badge variant="default" className="bg-primary">LIVE</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Sender: <span className="text-foreground font-medium">{liveTemplate.sender_name} &lt;{liveTemplate.sender_email}&gt;</span></p>
            <p className="mt-1">Updated: {formatDate(liveTemplate.created_at)} by {liveTemplate.created_by_email || "Unknown"}</p>
          </CardContent>
        </Card>
      )}

      {/* Editor Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email Template Editor</CardTitle>
            <Button onClick={fetchTemplates} variant="outline" size="sm">
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

          {/* Subject Lines by Language */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Subject Lines by Language</Label>
            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <div key={lang.code} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-muted-foreground flex-shrink-0">
                    {lang.name}
                  </span>
                  <Badge variant="outline" className="uppercase w-8 justify-center flex-shrink-0">
                    {lang.code}
                  </Badge>
                  <Input
                    value={subjects[lang.code] || ""}
                    onChange={(e) => updateSubject(lang.code, e.target.value)}
                    placeholder={`Subject in ${lang.name}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={saveNewVersion} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save as New Version & Set Live"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Send Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Test Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Send a test email using sample quiz data and the current live template settings.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="testEmail">Recipient Email</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter test email address"
              />
            </div>
            <div className="w-[180px] space-y-2">
              <Label htmlFor="testLanguage">Language</Label>
              <Select value={testLanguage} onValueChange={setTestLanguage}>
                <SelectTrigger id="testLanguage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={sendTestEmail} 
              disabled={sendingTest}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {sendingTest ? "Sending..." : "Send Test"}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? "Hide Preview" : "Preview"}
            </Button>
          </div>
          
          {/* Email Preview */}
          {showPreview && (
            <div className="mt-6 border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Email Preview</span>
                <Badge variant="outline">{SUPPORTED_LANGUAGES.find(l => l.code === testLanguage)?.name}</Badge>
              </div>
              <div 
                className="bg-[#faf7f5] max-h-[600px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: getEmailPreviewHtml() }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setShowHistory(!showHistory)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Version History ({templates.length} versions)
            </CardTitle>
            {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent>
            <div className="space-y-3">
              {templates.map((template) => (
                <div 
                  key={template.id} 
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    template.is_live ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Version {template.version_number}</span>
                      {template.is_live && (
                        <Badge variant="default" className="bg-primary text-xs">LIVE</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {template.sender_name} &lt;{template.sender_email}&gt;
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(template.created_at)} by {template.created_by_email || "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadVersionToEdit(template)}
                    >
                      Load
                    </Button>
                    {!template.is_live && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setLiveVersion(template.id, template.version_number)}
                      >
                        Set Live
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
