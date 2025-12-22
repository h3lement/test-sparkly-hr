import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Mail } from "lucide-react";
import { EmailVersionHistory, WebVersionHistory } from "./VersionHistoryTables";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { supabase } from "@/integrations/supabase/client";

interface EmailTemplate {
  id: string;
  version_number: number;
  template_type: string;
  sender_name: string;
  sender_email: string;
  subjects: Record<string, string>;
  body_content?: Record<string, string>;
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

// Email translations for preview - includes sample result data
const emailTranslations: Record<string, {
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  visitSparkly: string;
  leadershipOpenMindedness: string;
  openMindednessOutOf: string;
  sampleResultTitle: string;
  sampleResultDescription: string;
  sampleInsight1: string;
  sampleInsight2: string;
  sampleInsight3: string;
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
    sampleResultTitle: "Room for Improvement",
    sampleResultDescription: "Your team has solid potential, but friction points are costing you valuable time and slowing growth.",
    sampleInsight1: "Hidden Time Drain: Tasks that should take 2 hours often stretch to 4-6 hours.",
    sampleInsight2: "Communication Debt: Delays and rework often trace back to assumptions.",
    sampleInsight3: "Untapped Potential: Your team likely has capabilities you're not fully leveraging.",
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
    sampleResultTitle: "Arenguruumi on",
    sampleResultDescription: "Sinu meeskonnal on tugev potentsiaal, kuid hõõrdumiskohad kulutavad sinu väärtuslikku aega ja aeglustavad kasvu.",
    sampleInsight1: "Peidetud ajakadu: Ülesanded, mis peaksid võtma 2 tundi, venivad sageli 4-6 tunnini.",
    sampleInsight2: "Kommunikatsioonivõlg: Viivitused ja ümbertöötlemine tulenevad sageli oletustest.",
    sampleInsight3: "Kasutamata potentsiaal: Sinu meeskonnal on tõenäoliselt võimeid, mida sa täielikult ei kasuta.",
  },
};

export function TemplateVersionsPage() {
  const [activeTab, setActiveTab] = useState("web");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, slug, primary_language")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setQuizzes(data.map(q => ({
        ...q,
        title: q.title as Record<string, string>,
      })));
    }
  };

  const handlePreview = async (template: EmailTemplate) => {
    setPreviewTemplate(template);
    
    // Find the quiz for this template
    if (template.quiz_id) {
      const quiz = quizzes.find(q => q.id === template.quiz_id);
      setPreviewQuiz(quiz || null);
    } else {
      setPreviewQuiz(null);
    }
    
    setPreviewDialogOpen(true);
  };

  const handleLoadTemplate = (template: EmailTemplate) => {
    // This would normally load into an editor - for now just log
    console.log("Load template:", template);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Template Versions</h2>
        <p className="text-muted-foreground">
          View and manage all web result and email template versions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="web" className="gap-2">
            <Globe className="w-4 h-4" />
            Web Results
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="mt-6">
          <WebVersionHistory />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailVersionHistory 
            onLoadTemplate={handleLoadTemplate}
            onPreview={handlePreview}
          />
        </TabsContent>
      </Tabs>

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        template={previewTemplate}
        quiz={previewQuiz}
        emailTranslations={emailTranslations}
      />
    </div>
  );
}
