import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, RotateCcw, Calendar, Euro, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatTimestampShort } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

interface ResultLevel {
  id: string;
  min_score: number;
  max_score: number;
  title: Json;
  description: Json;
  insights: Json;
  emoji: string;
  color_class: string;
}

interface ResultVersion {
  id: string;
  version_number: number;
  result_levels: Json;
  generation_params: Json;
  estimated_cost_eur: number;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  created_by_email: string | null;
}

interface ResultVersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  onRestoreVersion: (levels: ResultLevel[]) => void;
}

export function ResultVersionsDialog({
  open,
  onOpenChange,
  quizId,
  onRestoreVersion,
}: ResultVersionsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ResultVersion[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, quizId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_result_versions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error: any) {
      console.error("Error loading versions:", error);
      toast({
        title: "Error",
        description: "Failed to load result versions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: ResultVersion) => {
    setRestoring(version.id);
    try {
      const levels = (version.result_levels as unknown as ResultLevel[]).map((level, idx) => ({
        ...level,
        id: level.id.startsWith("new-") ? level.id : `new-${Date.now()}-${idx}`,
      }));
      
      onRestoreVersion(levels);
      onOpenChange(false);
      
      toast({
        title: "Version restored",
        description: `Restored to version ${version.version_number}. Save to apply changes.`,
      });
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message || "Failed to restore version",
        variant: "destructive",
      });
    } finally {
      setRestoring(null);
    }
  };


  const getParamsDescription = (params: Json) => {
    if (!params || typeof params !== "object" || Array.isArray(params)) return "";
    const p = params as Record<string, any>;
    const parts = [];
    if (p.toneOfVoice) parts.push(p.toneOfVoice);
    if (p.numberOfLevels) parts.push(`${p.numberOfLevels} levels`);
    if (p.higherScoreMeaning === "positive") parts.push("higher = better");
    if (p.higherScoreMeaning === "negative") parts.push("higher = worse");
    return parts.join(" • ");
  };

  // Calculate total cost across all versions
  const totalCost = versions.reduce((sum, v) => sum + (v.estimated_cost_eur || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Result Versions
          </DialogTitle>
          <DialogDescription>
            {versions.length > 0 ? (
              <span className="flex items-center gap-2">
                {versions.length} version{versions.length !== 1 && "s"} • 
                Total cost: <Euro className="w-3 h-3" />{totalCost.toFixed(4)}
              </span>
            ) : (
              "No AI-generated versions yet"
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No versions generated yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use "Generate with AI" to create result levels.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {versions.map((version) => {
                const levels = version.result_levels as unknown as ResultLevel[];
                return (
                  <div
                    key={version.id}
                    className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            Version {version.version_number}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {Array.isArray(levels) ? levels.length : 0} levels
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Calendar className="w-3 h-3" />
                          {formatTimestampShort(version.created_at)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {getParamsDescription(version.generation_params)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Euro className="w-3 h-3" />
                            {(version.estimated_cost_eur || 0).toFixed(4)}
                          </span>
                          {version.created_by_email && (
                            <span className="truncate max-w-[150px]">
                              by {version.created_by_email}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version)}
                        disabled={restoring === version.id}
                        className="gap-1.5 h-8"
                      >
                        {restoring === version.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Restore
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
