import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  Clock, 
  FileEdit, 
  Plus, 
  Trash2, 
  ToggleLeft,
  RefreshCw
} from "lucide-react";
import { formatTimestamp } from "@/lib/utils";

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action_type: string;
  table_name: string;
  record_id: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface ActivityLogDialogProps {
  open: boolean;
  onClose: () => void;
  tableName: string;
  recordId: string;
  recordTitle?: string;
}

export function ActivityLogDialog({
  open,
  onClose,
  tableName,
  recordId,
  recordTitle,
}: ActivityLogDialogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && recordId) {
      fetchLogs();
    }
  }, [open, recordId, tableName]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "CREATE":
        return <Plus className="h-4 w-4" />;
      case "UPDATE":
        return <FileEdit className="h-4 w-4" />;
      case "DELETE":
        return <Trash2 className="h-4 w-4" />;
      case "STATUS_CHANGE":
        return <ToggleLeft className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "CREATE":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "DELETE":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "STATUS_CHANGE":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };


  const getTableDisplayName = (table: string) => {
    switch (table) {
      case "quizzes":
        return "Quiz";
      case "quiz_leads":
        return "Respondent";
      case "email_logs":
        return "Email";
      case "quiz_questions":
        return "Question";
      case "quiz_answers":
        return "Answer";
      case "email_templates":
        return "Email Template";
      default:
        return table;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Activity Log
            {recordTitle && (
              <span className="text-muted-foreground font-normal">
                — {recordTitle}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          {getTableDisplayName(tableName)} • ID: {recordId.slice(0, 8)}...
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activity recorded yet.</p>
            <p className="text-sm mt-1">Changes will appear here as they happen.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-secondary/30 rounded-lg p-4 border border-border"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Badge
                        variant="outline"
                        className={`${getActionColor(log.action_type)} gap-1 shrink-0`}
                      >
                        {getActionIcon(log.action_type)}
                        {log.action_type}
                      </Badge>
                      <div className="space-y-1">
                        {log.description && (
                          <p className="text-sm text-foreground">
                            {log.description}
                          </p>
                        )}
                        {log.field_name && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{log.field_name}:</span>
                            {log.old_value && (
                              <span className="line-through text-red-500/70 mx-1">
                                {log.old_value.length > 50
                                  ? `${log.old_value.slice(0, 50)}...`
                                  : log.old_value}
                              </span>
                            )}
                            {log.old_value && log.new_value && "→"}
                            {log.new_value && (
                              <span className="text-green-600 mx-1">
                                {log.new_value.length > 50
                                  ? `${log.new_value.slice(0, 50)}...`
                                  : log.new_value}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(log.created_at)}
                      </p>
                      {log.user_email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 justify-end">
                          <User className="h-3 w-3" />
                          <span>{log.user_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
