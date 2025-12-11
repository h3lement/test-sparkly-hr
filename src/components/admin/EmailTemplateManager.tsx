import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Save, Check, History, ChevronDown, ChevronUp } from "lucide-react";

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

  useEffect(() => {
    fetchTemplates();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setCurrentUserEmail(user.email);
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
