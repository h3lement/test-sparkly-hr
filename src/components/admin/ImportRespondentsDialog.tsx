import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ImportRespondentsDialogProps {
  quizId: string;
  onImportComplete: () => void;
}

export function ImportRespondentsDialog({ quizId, onImportComplete }: ImportRespondentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!csvContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter CSV data",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-quiz-leads", {
        body: { csvContent },
      });

      if (error) throw error;

      toast({
        title: "Import Complete",
        description: `Imported ${data.inserted} respondents (${data.parseErrors} errors)`,
      });

      setCsvContent("");
      setOpen(false);
      onImportComplete();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import respondents",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const sampleCsv = `id;email;score;total_questions;result_category;answers;created_at;openness_score;language
${crypto.randomUUID()};user@example.com;8;10;High Performer;null;${new Date().toISOString()};null;en`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Upload className="w-3 h-3" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Respondents from CSV
          </DialogTitle>
          <DialogDescription>
            Paste CSV data with semicolon (;) delimiter. Required columns: id, email, score, total_questions, result_category, answers, created_at, openness_score, language
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">CSV Data</label>
            <Textarea
              placeholder={sampleCsv}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs">
            <p className="font-medium mb-1">Expected format:</p>
            <code className="block text-muted-foreground whitespace-pre-wrap break-all">
              {sampleCsv}
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || !csvContent.trim()}>
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
