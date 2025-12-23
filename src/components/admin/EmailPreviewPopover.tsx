import { useEffect, useRef, useState } from "react";
import type React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatTimestamp } from "@/lib/utils";
import { Loader2, Eye, RotateCcw } from "lucide-react";
import { EmailHtmlViewer } from "./EmailHtmlViewer";

interface EmailLogStatus {
  lead_id: string;
  status: string;
  delivery_status: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  delivered_at: string | null;
  created_at: string;
  subject: string;
  html_body: string | null;
}

interface EmailPreviewPopoverProps {
  leadId: string;
  leadCreatedAt: string;
  leadType: "quiz" | "hypothesis";
  emailLog: EmailLogStatus | undefined;
  emailStatusLabel: string;
  emailStatusColor: string;
  EmailIcon: React.ElementType;
  // Pre-stored email content from lead record (instant access)
  storedEmailHtml?: string | null;
  storedEmailSubject?: string | null;
  // When true, show only the icon without the "Prepared" badge
  iconOnly?: boolean;
}

export function EmailPreviewPopover({
  leadId,
  leadCreatedAt,
  leadType,
  emailLog,
  emailStatusLabel,
  emailStatusColor,
  EmailIcon,
  storedEmailHtml,
  storedEmailSubject,
  iconOnly = false,
}: EmailPreviewPopoverProps) {
  const [open, setOpen] = useState(false);
  const [regeneratedHtml, setRegeneratedHtml] = useState<string | null>(null);
  const [regeneratedSubject, setRegeneratedSubject] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // Priority: 1) Sent email from logs, 2) Stored on lead, 3) Regenerated
  const canShowSentHtml = Boolean(emailLog?.html_body);
  const hasStoredEmail = Boolean(storedEmailHtml);
  
  const displayHtml = canShowSentHtml 
    ? emailLog!.html_body! 
    : (storedEmailHtml || regeneratedHtml);
  
  const displaySubject = canShowSentHtml 
    ? emailLog?.subject 
    : (storedEmailSubject || regeneratedSubject || "Email Preview");

  const hasContent = Boolean(displayHtml);

  // When the user clicks the email icon, auto-generate a preview if none exists yet.
  // This makes "pre-see" work with a single click (no extra "Generate Preview" click).
  const autoRegeneratedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      autoRegeneratedRef.current = false;
      return;
    }

    if (autoRegeneratedRef.current) return;

    const hasAnyHtml = Boolean(emailLog?.html_body || storedEmailHtml || regeneratedHtml);
    if (!canShowSentHtml && !hasAnyHtml) {
      autoRegeneratedRef.current = true;
      void regeneratePreview();
    }
  }, [open, leadId, canShowSentHtml, emailLog?.html_body, storedEmailHtml, regeneratedHtml]);

  const regeneratePreview = async () => {
    setRegenerating(true);
    setRegenerateError(null);

    try {
      const { data, error } = await supabase.functions.invoke("render-email-preview", {
        body: { leadId, leadType },
      });

      if (error) throw error;

      setRegeneratedHtml(data?.html ?? null);
      setRegeneratedSubject(data?.subject ?? null);
      if (!data?.html) {
        setRegenerateError("No preview HTML was returned");
      }
    } catch (err: any) {
      console.error("Failed to regenerate email preview:", err);
      setRegenerateError(err?.message || "Failed to regenerate preview");
    } finally {
      setRegenerating(false);
    }
  };

  // Whether we have instant content (no need to generate)
  const hasInstantContent = canShowSentHtml || hasStoredEmail;

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClickCapture={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className={cn(
            "inline-flex items-center justify-center p-1.5 rounded-md hover:bg-secondary/80 transition-colors",
            emailStatusColor
          )}
          title={emailStatusLabel}
          aria-label={`Email preview: ${emailStatusLabel}`}
        >
          <EmailIcon className="w-4 h-4" />
        </button>
        {hasStoredEmail && !canShowSentHtml && !iconOnly && (
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            Prepared
          </Badge>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col p-0 gap-0"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge
                  className={cn(
                    "text-xs",
                    emailLog?.bounced_at
                      ? "bg-destructive/10 text-destructive"
                      : emailLog?.clicked_at
                        ? "bg-green-500/10 text-green-600"
                        : emailLog?.opened_at
                          ? "bg-blue-500/10 text-blue-500"
                          : emailLog?.delivery_status === "delivered"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-primary/10 text-primary"
                  )}
                >
                  {emailStatusLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Submitted: {formatTimestamp(leadCreatedAt)}
                </span>
                {hasStoredEmail && !canShowSentHtml && (
                  <Badge variant="outline" className="text-xs">
                    Prepared
                  </Badge>
                )}
              </div>
              {!canShowSentHtml && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regeneratePreview}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Regenerate
                    </>
                  )}
                </Button>
              )}
            </div>
            <DialogTitle className="text-sm font-medium truncate mt-2">
              {displaySubject}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {hasContent ? (
              <EmailHtmlViewer 
                html={displayHtml!} 
                heightClassName="h-[calc(90vh-120px)]" 
                iframeHeight={800} 
                title={canShowSentHtml ? "Sent Email" : "Prepared Email Preview"} 
              />
            ) : regenerating ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Generating preview...</span>
              </div>
            ) : regenerateError ? (
              <div className="p-8 text-center">
                <p className="text-sm text-destructive">{regenerateError}</p>
                <Button variant="ghost" size="sm" onClick={regeneratePreview} className="mt-2">
                  Try again
                </Button>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <p className="mb-4">No prepared email found for this respondent.</p>
                <Button variant="outline" size="sm" onClick={regeneratePreview}>
                  <Eye className="w-4 h-4 mr-2" />
                  Generate Preview
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
