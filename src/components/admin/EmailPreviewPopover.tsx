import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatTimestamp } from "@/lib/utils";
import { Loader2, Eye } from "lucide-react";

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
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);

  const fetchPreview = async () => {
    if (previewHtml || previewLoading) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      // Determine lead type based on whether it has answers (quiz) or not (hypothesis)
      const leadType = hasAnswers ? 'quiz' : 'hypothesis';
      const { data, error } = await supabase.functions.invoke('render-email-preview', {
        body: { leadId, leadType }
      });
      if (error) throw error;
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch (err: any) {
      console.error('Failed to fetch email preview:', err);
      setPreviewError(err.message || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
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
        {!emailLog ? (
          // No email log - show preview button
          <div className="flex flex-col">
            <div className="p-3 border-b border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">{emailStatusLabel}</Badge>
                <span className="text-xs text-muted-foreground">
                  Submitted: {formatTimestamp(leadCreatedAt)}
                </span>
              </div>
              {previewSubject && (
                <p className="text-sm font-medium truncate" title={previewSubject}>
                  {previewSubject}
                </p>
              )}
              {!previewHtml && !previewLoading && !previewError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPreview}
                  className="w-full mt-2"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Generate Email Preview
                </Button>
              )}
            </div>
            {previewLoading && (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Generating preview...</span>
              </div>
            )}
            {previewError && (
              <div className="p-4 text-center">
                <p className="text-sm text-destructive">{previewError}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchPreview}
                  className="mt-2"
                >
                  Try again
                </Button>
              </div>
            )}
            {previewHtml && (
              <ScrollArea className="h-[320px]">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0 bg-white"
                  style={{ height: "400px" }}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </ScrollArea>
            )}
          </div>
        ) : (
          // Has email log - show sent email
          <div className="flex flex-col">
            <div className="p-3 border-b border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge className={cn(
                  "text-xs",
                  emailLog.bounced_at ? "bg-destructive/10 text-destructive" :
                  emailLog.clicked_at ? "bg-green-500/10 text-green-600" :
                  emailLog.opened_at ? "bg-blue-500/10 text-blue-500" :
                  emailLog.delivery_status === "delivered" ? "bg-green-500/10 text-green-500" :
                  "bg-primary/10 text-primary"
                )}>
                  {emailStatusLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(emailLog.created_at)}
                </span>
              </div>
              <p className="text-sm font-medium truncate" title={emailLog.subject}>
                {emailLog.subject}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {emailLog.delivered_at && (
                  <span>Delivered: {formatTimestamp(emailLog.delivered_at)}</span>
                )}
                {emailLog.opened_at && (
                  <span>Opened: {formatTimestamp(emailLog.opened_at)}</span>
                )}
                {emailLog.clicked_at && (
                  <span>Clicked: {formatTimestamp(emailLog.clicked_at)}</span>
                )}
              </div>
            </div>
            {emailLog.html_body ? (
              <ScrollArea className="h-[320px]">
                <iframe
                  srcDoc={emailLog.html_body}
                  className="w-full border-0 bg-white"
                  style={{ height: "320px" }}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </ScrollArea>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No email preview available
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
