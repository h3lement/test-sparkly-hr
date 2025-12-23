import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  hasAnswers: boolean;
  emailLog: EmailLogStatus | undefined;
  emailStatusLabel: string;
  emailStatusColor: string;
  EmailIcon: React.ElementType;
}

export function EmailPreviewPopover({
  leadId,
  leadCreatedAt,
  hasAnswers,
  emailLog,
  emailStatusLabel,
  emailStatusColor,
  EmailIcon,
}: EmailPreviewPopoverProps) {
  const [open, setOpen] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);

  const leadType = useMemo(() => (hasAnswers ? "quiz" : "hypothesis"), [hasAnswers]);
  const canShowSentHtml = Boolean(emailLog?.html_body);

  const fetchPreview = async (force = false) => {
    if ((!force && previewHtml) || previewLoading) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { data, error } = await supabase.functions.invoke("render-email-preview", {
        body: { leadId, leadType },
      });
      if (error) throw error;
      setPreviewHtml(data?.html ?? null);
      setPreviewSubject(data?.subject ?? null);
      if (!data?.html) {
        setPreviewError("No preview HTML was returned");
      }
    } catch (err: any) {
      console.error("Failed to fetch email preview:", err);
      setPreviewError(err.message || "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Auto-generate preview as soon as popover opens (for ALL rows)
  useEffect(() => {
    if (!open) return;
    // If we already have sent HTML, show it immediately; otherwise generate prepared preview.
    if (!canShowSentHtml) {
      void fetchPreview(false);
    }
  }, [open, canShowSentHtml]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClickCapture={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center p-1.5 rounded-md hover:bg-secondary/80 transition-colors",
            emailStatusColor
          )}
          title={emailStatusLabel}
          aria-label={`Email preview: ${emailStatusLabel}`}
        >
          <EmailIcon className="w-4 h-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[420px] max-w-[80vw] p-0"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <div className="p-3 border-b border-border space-y-1.5">
            <div className="flex items-center justify-between gap-2">
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
            </div>

            {canShowSentHtml ? (
              <p className="text-sm font-medium truncate" title={emailLog?.subject || undefined}>
                {emailLog?.subject}
              </p>
            ) : previewSubject ? (
              <p className="text-sm font-medium truncate" title={previewSubject}>
                {previewSubject}
              </p>
            ) : null}

            {!canShowSentHtml && (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPreview(true)}
                  className="w-full"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : previewHtml ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Regenerate preview
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Generate preview
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {canShowSentHtml ? (
            <EmailHtmlViewer html={emailLog!.html_body!} title="Sent Email" />
          ) : previewLoading && !previewHtml ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Generating preview...</span>
            </div>
          ) : previewError ? (
            <div className="p-4 text-center">
              <p className="text-sm text-destructive">{previewError}</p>
              <Button variant="ghost" size="sm" onClick={() => fetchPreview(true)} className="mt-2">
                Try again
              </Button>
            </div>
          ) : previewHtml ? (
            <EmailHtmlViewer html={previewHtml} title="Prepared Email Preview" />
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Open to generate the prepared preview.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
