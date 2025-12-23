import { useEffect, useState } from "react";
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
  // Prefetched preview data from parent
  prefetchedHtml?: string | null;
  prefetchedSubject?: string | null;
  prefetchLoading?: boolean;
}

type RenderEmailPreviewBody = { leadId: string; leadType: "quiz" | "hypothesis" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function invokeRenderEmailPreview(
  body: RenderEmailPreviewBody,
  opts?: { retries?: number }
): Promise<any> {
  const retries = opts?.retries ?? 1;
  let lastErr: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke("render-email-preview", {
      body,
    });

    if (!error) return data;

    lastErr = error;
    const status = (error as any)?.status;
    const msg = String((error as any)?.message ?? "");
    const isBootError =
      status === 503 || msg.includes("BOOT_ERROR") || msg.toLowerCase().includes("failed to start");

    if (isBootError && attempt < retries) {
      await sleep(1200 * (attempt + 1));
      continue;
    }

    throw error;
  }

  throw lastErr ?? new Error("Failed to render email preview");
}

export function EmailPreviewPopover({
  leadId,
  leadCreatedAt,
  leadType,
  emailLog,
  emailStatusLabel,
  emailStatusColor,
  EmailIcon,
  prefetchedHtml,
  prefetchedSubject,
  prefetchLoading: parentLoading = false,
}: EmailPreviewPopoverProps) {
  const [open, setOpen] = useState(false);

  const [localHtml, setLocalHtml] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [localSubject, setLocalSubject] = useState<string | null>(null);

  // Use prefetched data if available, otherwise use local state
  const previewHtml = prefetchedHtml ?? localHtml;
  const previewSubject = prefetchedSubject ?? localSubject;
  const previewLoading = parentLoading || localLoading;

  const canShowSentHtml = Boolean(emailLog?.html_body);

  const fetchPreview = async (force = false) => {
    if ((!force && previewHtml) || localLoading) return;
    setLocalLoading(true);
    setPreviewError(null);

    try {
      const data = await invokeRenderEmailPreview({ leadId, leadType }, { retries: 1 });

      setLocalHtml(data?.html ?? null);
      setLocalSubject(data?.subject ?? null);
      if (!data?.html) {
        setPreviewError("No preview HTML was returned");
      }
    } catch (err: any) {
      console.error("Failed to fetch email preview:", err);
      setPreviewError(err?.message || `Failed to load preview (${leadType}: ${leadId})`);
    } finally {
      setLocalLoading(false);
    }
  };

  // Auto-fetch if dialog opens and no prefetched/sent data available
  useEffect(() => {
    if (!open) return;
    if (!canShowSentHtml && !previewHtml && !previewLoading) {
      void fetchPreview(false);
    }
  }, [open, canShowSentHtml, previewHtml, previewLoading]);

  return (
    <>
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
              </div>
              {!canShowSentHtml && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPreview(true)}
                  disabled={previewLoading}
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : previewHtml ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              )}
            </div>
            <DialogTitle className="text-sm font-medium truncate mt-2">
              {canShowSentHtml ? emailLog?.subject : previewSubject || "Email Preview"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {canShowSentHtml ? (
              <EmailHtmlViewer html={emailLog!.html_body!} heightClassName="h-[calc(90vh-120px)]" iframeHeight={800} title="Sent Email" />
            ) : previewLoading && !previewHtml ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Generating preview...</span>
              </div>
            ) : previewError ? (
              <div className="p-8 text-center">
                <p className="text-sm text-destructive">{previewError}</p>
                <Button variant="ghost" size="sm" onClick={() => fetchPreview(true)} className="mt-2">
                  Try again
                </Button>
              </div>
            ) : previewHtml ? (
              <EmailHtmlViewer html={previewHtml} heightClassName="h-[calc(90vh-120px)]" iframeHeight={800} title="Prepared Email Preview" />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Click &quot;Generate&quot; to preview the prepared email.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Utility function to prefetch email previews for a list of leads
export async function prefetchEmailPreviews(
  leads: { id: string; leadType: "quiz" | "hypothesis" }[]
): Promise<Map<string, { html: string; subject: string }>> {
  const results = new Map<string, { html: string; subject: string }>();

  // Process in batches to avoid overwhelming the backend function
  const batchSize = 5;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const promises = batch.map(async (lead) => {
      try {
        const data = await invokeRenderEmailPreview(
          { leadId: lead.id, leadType: lead.leadType },
          { retries: 1 }
        );
        if (data?.html) {
          results.set(lead.id, { html: data.html, subject: data.subject || "" });
        }
      } catch (err) {
        console.warn(`Failed to prefetch preview for lead ${lead.id}:`, err);
      }
    });
    await Promise.all(promises);
  }

  return results;
}
