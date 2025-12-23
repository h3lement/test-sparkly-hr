import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  RotateCcw,
  Eye,
  MousePointer,
  AlertTriangle,
  Inbox,
  ArrowRight,
  Loader2,
  MailCheck,
  MailX,
  Shield,
  TestTube,
  Lightbulb,
  Copy,
  Check,
} from "lucide-react";

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  language: string | null;
  quiz_lead_id: string | null;
  quiz_id: string | null;
  created_at: string;
  resend_attempts: number;
  last_attempt_at: string | null;
  original_log_id: string | null;
  html_body: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  complaint_type: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number | null;
  click_count: number | null;
  isQueueItem?: boolean;
  scheduled_for?: string;
}

interface RelatedLog {
  id: string;
  status: string;
  created_at: string;
  error_message: string | null;
  resend_attempts: number;
  delivery_status: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  original_log_id: string | null;
}

interface EmailDetailDialogProps {
  open: boolean;
  onClose: () => void;
  log: EmailLog | null;
  quizTitle?: string | null;
}

export function EmailDetailDialog({ open, onClose, log, quizTitle }: EmailDetailDialogProps) {
  const [relatedLogs, setRelatedLogs] = useState<RelatedLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && log && !log.isQueueItem) {
      fetchRelatedLogs();
    } else {
      setRelatedLogs([]);
    }
  }, [open, log]);

  const fetchRelatedLogs = async () => {
    if (!log) return;
    setLoading(true);
    try {
      // Fetch resends of this email and the original if this is a resend
      const { data } = await supabase
        .from("email_logs")
        .select("id, status, created_at, error_message, resend_attempts, delivery_status, delivered_at, bounced_at, opened_at, clicked_at, original_log_id")
        .or(`original_log_id.eq.${log.id},id.eq.${log.original_log_id || '00000000-0000-0000-0000-000000000000'}`)
        .order("created_at", { ascending: true });
      
      setRelatedLogs(data || []);
    } catch (error) {
      console.error("Error fetching related logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getEmailTypeInfo = (type: string) => {
    switch (type) {
      case "test":
        return { label: "Test Email", icon: TestTube, color: "text-amber-600 bg-amber-500/10" };
      case "quiz_result_user":
        return { label: "Quiz Taker Results", icon: User, color: "text-blue-600 bg-blue-500/10" };
      case "quiz_result_admin":
        return { label: "Admin Notification", icon: Shield, color: "text-purple-600 bg-purple-500/10" };
      case "domain_reputation_alert":
        return { label: "Domain Alert", icon: AlertCircle, color: "text-orange-600 bg-orange-500/10" };
      default:
        return { label: type, icon: Mail, color: "text-muted-foreground bg-muted" };
    }
  };

  const getStatusInfo = (log: EmailLog) => {
    if (log.isQueueItem) {
      if (log.status === "pending") return { label: "Pending in Queue", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10" };
      if (log.status === "processing") return { label: "Processing", icon: Loader2, color: "text-blue-600", bgColor: "bg-blue-500/10", animate: true };
      if (log.status === "failed") return { label: "Queue Failed", icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-500/10" };
    }
    if (log.delivery_status === "delivered") return { label: "Delivered", icon: MailCheck, color: "text-emerald-600", bgColor: "bg-emerald-500/10" };
    if (log.delivery_status === "bounced") return { label: "Bounced", icon: MailX, color: "text-red-600", bgColor: "bg-red-500/10" };
    if (log.delivery_status === "complained") return { label: "Marked as Spam", icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-500/10" };
    if (log.delivery_status === "opened" || log.delivery_status === "clicked") return { label: "Opened", icon: Eye, color: "text-blue-600", bgColor: "bg-blue-500/10" };
    if (log.status === "sent") return { label: "Sent", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-500/10" };
    return { label: "Failed", icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-500/10" };
  };

  const getTroubleshootingTips = (log: EmailLog): string[] => {
    const tips: string[] = [];
    
    if (log.status === "failed" || log.isQueueItem && log.status === "failed") {
      if (log.error_message?.toLowerCase().includes("smtp") || log.error_message?.toLowerCase().includes("connection")) {
        tips.push("Check SMTP server settings and credentials in Email Settings");
        tips.push("Verify the SMTP server is accessible and not blocked by firewall");
      }
      if (log.error_message?.toLowerCase().includes("auth")) {
        tips.push("Verify SMTP username and password are correct");
        tips.push("Some providers require app-specific passwords");
      }
      if (log.error_message?.toLowerCase().includes("timeout")) {
        tips.push("The email server took too long to respond - try again later");
        tips.push("Consider checking if the SMTP port is correct (usually 587 or 465)");
      }
      if (log.error_message?.toLowerCase().includes("rate") || log.error_message?.toLowerCase().includes("limit")) {
        tips.push("You may have hit the sending rate limit - wait before retrying");
      }
      if (!tips.length) {
        tips.push("Review the error message for specific details");
        tips.push("Try resending the email after checking settings");
      }
    }
    
    if (log.delivery_status === "bounced") {
      if (log.bounce_type === "hard") {
        tips.push("This is a permanent failure - the email address doesn't exist or is invalid");
        tips.push("Remove this email from your list to maintain sender reputation");
      } else {
        tips.push("This is a temporary failure - the recipient's mailbox may be full");
        tips.push("Try resending after some time or contact the recipient");
      }
    }
    
    if (log.delivery_status === "complained") {
      tips.push("The recipient marked this email as spam");
      tips.push("Review your email content and ensure you have consent to email");
      tips.push("Consider removing this recipient from future communications");
    }

    if (log.isQueueItem && log.status === "pending") {
      tips.push("This email is waiting to be sent");
      tips.push("Check if you're online - emails are queued when offline");
      tips.push("Click 'Process Queue' to send pending emails now");
    }

    return tips;
  };

  const buildTimeline = (log: EmailLog) => {
    const events: Array<{ time: string; label: string; icon: any; color: string; detail?: string }> = [];

    // Created/Queued
    events.push({
      time: log.created_at,
      label: log.isQueueItem ? "Queued for sending" : "Email created",
      icon: log.isQueueItem ? Inbox : Mail,
      color: "text-muted-foreground",
    });

    // Scheduled (for queue items)
    if (log.scheduled_for && log.scheduled_for !== log.created_at) {
      events.push({
        time: log.scheduled_for,
        label: "Scheduled to send",
        icon: Clock,
        color: "text-amber-600",
      });
    }

    // Sent
    if (log.status === "sent" && !log.isQueueItem) {
      events.push({
        time: log.created_at,
        label: "Sent successfully",
        icon: Send,
        color: "text-green-600",
      });
    }

    // Failed
    if (log.status === "failed") {
      events.push({
        time: log.last_attempt_at || log.created_at,
        label: "Send failed",
        icon: AlertCircle,
        color: "text-red-600",
        detail: log.error_message || undefined,
      });
    }

    // Resend attempts
    if (log.resend_attempts > 0) {
      events.push({
        time: log.last_attempt_at || log.created_at,
        label: `Resent ${log.resend_attempts} time(s)`,
        icon: RotateCcw,
        color: "text-amber-600",
      });
    }

    // Delivered
    if (log.delivered_at) {
      events.push({
        time: log.delivered_at,
        label: "Delivered to inbox",
        icon: MailCheck,
        color: "text-emerald-600",
      });
    }

    // Opened
    if (log.opened_at) {
      events.push({
        time: log.opened_at,
        label: `Opened${log.open_count && log.open_count > 1 ? ` (${log.open_count} times)` : ""}`,
        icon: Eye,
        color: "text-blue-600",
      });
    }

    // Clicked
    if (log.clicked_at) {
      events.push({
        time: log.clicked_at,
        label: `Link clicked${log.click_count && log.click_count > 1 ? ` (${log.click_count} times)` : ""}`,
        icon: MousePointer,
        color: "text-purple-600",
      });
    }

    // Bounced
    if (log.bounced_at) {
      events.push({
        time: log.bounced_at,
        label: `Bounced (${log.bounce_type || "unknown"})`,
        icon: MailX,
        color: "text-red-600",
        detail: log.bounce_reason || undefined,
      });
    }

    // Complained
    if (log.complained_at) {
      events.push({
        time: log.complained_at,
        label: "Marked as spam",
        icon: AlertTriangle,
        color: "text-orange-600",
        detail: log.complaint_type || undefined,
      });
    }

    // Sort by time
    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!log) return null;

  const typeInfo = getEmailTypeInfo(log.email_type);
  const TypeIcon = typeInfo.icon;
  const statusInfo = getStatusInfo(log);
  const StatusIcon = statusInfo.icon;
  const timeline = buildTimeline(log);
  const tips = getTroubleshootingTips(log);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Details
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 px-6 py-4">
            {/* Status Banner */}
            <div className={`p-4 rounded-lg ${statusInfo.bgColor} border`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${statusInfo.bgColor}`}>
                  <StatusIcon className={`h-5 w-5 ${statusInfo.color} ${statusInfo.animate ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
                  <p className="text-sm text-muted-foreground">{formatRelativeTime(log.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Email Information</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Type:</span>
                  <Badge variant="outline" className={`${typeInfo.color} gap-1`}>
                    <TypeIcon className="h-3 w-3" />
                    {typeInfo.label}
                  </Badge>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">From:</span>
                  <span>{log.sender_name} &lt;{log.sender_email}&gt;</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">To:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{log.recipient_email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(log.recipient_email)}
                    >
                      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Subject:</span>
                  <span className="font-medium">{log.subject}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Language:</span>
                  <Badge variant="secondary" className="uppercase text-xs">{log.language || "en"}</Badge>
                </div>
                {quizTitle && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Quiz:</span>
                    <span>{quizTitle}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Created:</span>
                  <span>{formatTimestamp(log.created_at)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Timeline</h3>
              <div className="space-y-3">
                {timeline.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div className="relative">
                        <div className={`p-1.5 rounded-full bg-muted ${event.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {index < timeline.length - 1 && (
                          <div className="absolute left-1/2 top-full w-0.5 h-6 bg-border -translate-x-1/2" />
                        )}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className={`text-sm font-medium ${event.color}`}>{event.label}</p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(event.time)}</p>
                        {event.detail && (
                          <p className="text-xs text-red-600 mt-1 bg-red-50 dark:bg-red-950/30 p-2 rounded">{event.detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Related Emails (Resends) */}
            {!log.isQueueItem && (relatedLogs.length > 0 || log.original_log_id || loading) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Related Emails</h3>
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading related emails...
                    </div>
                  ) : relatedLogs.length > 0 ? (
                    <div className="space-y-2">
                      {log.original_log_id && (
                        <p className="text-xs text-muted-foreground mb-2">
                          This is a resend of an earlier email
                        </p>
                      )}
                      {relatedLogs.map((related) => (
                        <div key={related.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                          {related.id === log.original_log_id ? (
                            <Badge variant="outline" className="text-xs">Original</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600">Resend</Badge>
                          )}
                          <span className={related.status === "sent" ? "text-green-600" : "text-red-600"}>
                            {related.status === "sent" ? "Sent" : "Failed"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatRelativeTime(related.created_at)}</span>
                          {related.error_message && (
                            <span className="text-red-600 text-xs truncate max-w-[150px]" title={related.error_message}>
                              {related.error_message}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No resends found</p>
                  )}
                </div>
              </>
            )}

            {/* Error Details */}
            {log.error_message && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-red-600 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Error Details
                  </h3>
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
                    <p className="text-sm text-red-700 dark:text-red-400 font-mono break-all">{log.error_message}</p>
                  </div>
                </div>
              </>
            )}

            {/* Troubleshooting Tips */}
            {tips.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    How to Fix
                  </h3>
                  <ul className="space-y-2">
                    {tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Technical Details */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Technical Details</h3>
              <div className="grid gap-1 text-xs font-mono bg-muted/50 p-3 rounded-lg">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="truncate">{log.id}</span>
                </div>
                {log.resend_id && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Provider ID:</span>
                    <span className="truncate">{log.resend_id}</span>
                  </div>
                )}
                {log.quiz_id && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Quiz ID:</span>
                    <span className="truncate">{log.quiz_id}</span>
                  </div>
                )}
                {log.quiz_lead_id && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Lead ID:</span>
                    <span className="truncate">{log.quiz_lead_id}</span>
                  </div>
                )}
                {log.original_log_id && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Original Log:</span>
                    <span className="truncate">{log.original_log_id}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Attempts:</span>
                  <span>{1 + (log.resend_attempts || 0)}</span>
                </div>
              </div>
            </div>
            {/* Bottom padding for scroll area */}
            <div className="h-4" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
