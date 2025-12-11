import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Search, Mail, AlertCircle, CheckCircle2, TestTube, User, Shield } from "lucide-react";

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
  created_at: string;
}

export function EmailLogsMonitor() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching email logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch email logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case "test":
        return { label: "Test", icon: TestTube, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      case "quiz_result_user":
        return { label: "Quiz Taker", icon: User, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
      case "quiz_result_admin":
        return { label: "Admin Notification", icon: Shield, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
      default:
        return { label: type, icon: Mail, color: "bg-secondary text-secondary-foreground" };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.resend_id && log.resend_id.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === "all" || log.email_type === filterType;

    return matchesSearch && matchesType;
  });

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === "sent").length,
    failed: logs.filter((l) => l.status === "failed").length,
    tests: logs.filter((l) => l.email_type === "test").length,
    quizUsers: logs.filter((l) => l.email_type === "quiz_result_user").length,
    adminNotifs: logs.filter((l) => l.email_type === "quiz_result_admin").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email Sending History</h2>
          <p className="text-muted-foreground mt-1">Monitor all emails sent via Resend</p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Emails</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          <div className="text-sm text-muted-foreground">Sent</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.tests}</div>
          <div className="text-sm text-muted-foreground">Test Emails</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.quizUsers}</div>
          <div className="text-sm text-muted-foreground">Quiz Takers</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.adminNotifs}</div>
          <div className="text-sm text-muted-foreground">Admin Notifs</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by email, subject, or Resend ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "test", "quiz_result_user", "quiz_result_admin"].map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
            >
              {type === "all" && "All"}
              {type === "test" && "Tests"}
              {type === "quiz_result_user" && "Quiz Takers"}
              {type === "quiz_result_admin" && "Admin Notifs"}
            </Button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading email logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No email logs found.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Emails will appear here after they are sent.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Recipient</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Lang</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Resend ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const typeInfo = getEmailTypeLabel(log.email_type);
                  const TypeIcon = typeInfo.icon;
                  return (
                    <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${typeInfo.color} gap-1`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {log.status === "sent" ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Sent
                          </Badge>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Failed
                            </Badge>
                            {log.error_message && (
                              <span className="text-xs text-red-500 max-w-32 truncate" title={log.error_message}>
                                {log.error_message}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{log.recipient_email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground max-w-48 truncate block" title={log.subject}>
                          {log.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground uppercase">
                          {log.language || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-muted-foreground">
                          {log.resend_id ? log.resend_id.slice(0, 12) + "..." : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Showing up to 200 most recent email logs
      </p>
    </div>
  );
}
