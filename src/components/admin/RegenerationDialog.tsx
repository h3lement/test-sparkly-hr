import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { AI_MODELS, type AiModelId } from "./AiModelSelector";

export type RegenerationType = "missing" | "all" | "none";

interface RegenerationTask {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  errorMessage?: string;
}

interface RegenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newModel: AiModelId;
  oldModel: AiModelId;
  onRegenerate: (type: RegenerationType) => Promise<void>;
  tasks: RegenerationTask[];
  isRunning: boolean;
  progress: number;
}

export function RegenerationDialog({
  open,
  onOpenChange,
  newModel,
  oldModel,
  onRegenerate,
  tasks,
  isRunning,
  progress,
}: RegenerationDialogProps) {
  const newModelInfo = AI_MODELS.find(m => m.id === newModel);
  const oldModelInfo = AI_MODELS.find(m => m.id === oldModel);

  const handleChoice = async (type: RegenerationType) => {
    if (type === "none") {
      onOpenChange(false);
      return;
    }
    await onRegenerate(type);
  };

  const completedTasks = tasks.filter(t => t.status === "done").length;
  const errorTasks = tasks.filter(t => t.status === "error").length;
  const allDone = tasks.length > 0 && tasks.every(t => t.status === "done" || t.status === "error");

  return (
    <Dialog open={open} onOpenChange={isRunning ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            AI Model Changed
          </DialogTitle>
          <DialogDescription>
            You switched from <strong>{oldModelInfo?.label}</strong> to{" "}
            <strong>{newModelInfo?.label}</strong>. Would you like to regenerate
            AI-generated content?
          </DialogDescription>
        </DialogHeader>

        {!isRunning && tasks.length === 0 && (
          <div className="space-y-4 py-4">
            <div className="grid gap-3">
              <Button
                variant="default"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleChoice("missing")}
              >
                <div className="text-left">
                  <div className="font-medium">Regenerate Missing Only</div>
                  <div className="text-xs text-primary-foreground/70">
                    Only generate content that hasn't been created yet
                  </div>
                </div>
              </Button>
              
              <Button
                variant="secondary"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleChoice("all")}
              >
                <div className="text-left">
                  <div className="font-medium">Regenerate Everything</div>
                  <div className="text-xs text-muted-foreground">
                    Replace all AI-generated content with new model
                  </div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleChoice("none")}
              >
                <div className="text-left">
                  <div className="font-medium">Skip for Now</div>
                  <div className="text-xs text-muted-foreground">
                    Keep existing content, use new model for future generations
                  </div>
                </div>
              </Button>
            </div>
          </div>
        )}

        {(isRunning || tasks.length > 0) && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span className="text-muted-foreground">
                  {completedTasks + errorTasks} / {tasks.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  {task.status === "pending" && (
                    <div className="w-4 h-4 rounded-full border-2 border-muted" />
                  )}
                  {task.status === "running" && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  {task.status === "done" && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {task.status === "error" && (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  <span className={task.status === "error" ? "text-destructive" : ""}>
                    {task.label}
                  </span>
                  {task.errorMessage && (
                    <span className="text-xs text-destructive ml-auto">
                      {task.errorMessage}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {allDone && (
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              {errorTasks > 0 ? "Close" : "Done"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
