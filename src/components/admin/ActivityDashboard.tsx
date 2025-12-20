import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw, 
  Clock, 
  User, 
  FileEdit, 
  Plus, 
  Trash2, 
  ToggleLeft,
  Shield,
  Users,
  Activity,
  Wifi,
  WifiOff
} from "lucide-react";

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

interface AdminUser {
  user_id: string;
  email: string;
}

export function ActivityDashboard() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activitiesRes, adminsRes] = await Promise.all([
        supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin"),
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (adminsRes.error) throw adminsRes.error;

      setActivities(activitiesRes.data || []);
      
      // Get unique admin emails from activity logs
      const uniqueEmails = new Map<string, AdminUser>();
      (activitiesRes.data || []).forEach((activity) => {
        if (activity.user_id && activity.user_email) {
          uniqueEmails.set(activity.user_id, {
            user_id: activity.user_id,
            email: activity.user_email,
          });
        }
      });
      setAdminUsers(Array.from(uniqueEmails.values()));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for activity_logs
  useEffect(() => {
    if (!realtimeEnabled) return;

    const channel = supabase
      .channel("activity-dashboard-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeEnabled, fetchData]);


  const filteredActivities = useMemo(() => {
    let result = activities;
    
    if (activityFilter !== "all") {
      result = result.filter((a) => a.table_name === activityFilter);
    }
    
    if (adminFilter !== "all") {
      result = result.filter((a) => a.user_id === adminFilter);
    }
    
    return result;
  }, [activities, activityFilter, adminFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    
    const todayActivities = activities.filter(
      (a) => new Date(a.created_at) >= today
    ).length;
    
    const thisWeekActivities = activities.filter(
      (a) => new Date(a.created_at) >= thisWeekStart
    ).length;
    
    const uniqueAdminsActive = new Set(
      activities.filter((a) => a.user_id).map((a) => a.user_id)
    ).size;
    
    const actionCounts = activities.reduce((acc, a) => {
      acc[a.action_type] = (acc[a.action_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      todayActivities,
      thisWeekActivities,
      uniqueAdminsActive,
      totalActivities: activities.length,
      actionCounts,
    };
  }, [activities]);

  // Get most active admins
  const adminActivityCounts = useMemo(() => {
    const counts = new Map<string, { email: string; count: number }>();
    activities.forEach((activity) => {
      if (activity.user_email) {
        const existing = counts.get(activity.user_email);
        if (existing) {
          existing.count++;
        } else {
          counts.set(activity.user_email, { email: activity.user_email, count: 1 });
        }
      }
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [activities]);

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

  const getTableLabel = (table: string) => {
    switch (table) {
      case "quizzes":
        return "Quiz";
      case "quiz_leads":
        return "Respondent";
      case "email_logs":
        return "Email";
      case "email_templates":
        return "Template";
      case "user_roles":
        return "Admin";
      default:
        return table;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Activity</h1>
          <p className="text-muted-foreground mt-1">Track what admin users are doing</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="realtime-activity"
              checked={realtimeEnabled}
              onCheckedChange={setRealtimeEnabled}
            />
            <Label htmlFor="realtime-activity" className="flex items-center gap-1.5 text-sm cursor-pointer">
              {realtimeEnabled ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              Realtime
            </Label>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todayActivities}</p>
                <p className="text-sm text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisWeekActivities}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <Shield className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueAdminsActive}</p>
                <p className="text-sm text-muted-foreground">Active Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileEdit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalActivities}</p>
                <p className="text-sm text-muted-foreground">Total Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Most Active Admins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Most Active Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adminActivityCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No admin activity recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {adminActivityCounts.slice(0, 5).map((admin, index) => (
                  <div
                    key={admin.email}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 bg-secondary">
                        <AvatarFallback className="text-xs bg-secondary text-foreground">
                          {getInitials(admin.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate max-w-[140px]">
                        {admin.email.split("@")[0]}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {admin.count} actions
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity by Type */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Activity by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(stats.actionCounts).map(([action, count]) => (
                <div
                  key={action}
                  className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30"
                >
                  <Badge
                    variant="outline"
                    className={`${getActionColor(action)} gap-1`}
                  >
                    {getActionIcon(action)}
                  </Badge>
                  <div>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {action.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                </div>
              ))}
              {Object.keys(stats.actionCounts).length === 0 && (
                <p className="col-span-4 text-sm text-muted-foreground text-center py-4">
                  No activity recorded yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Activity Log
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={adminFilter} onValueChange={setAdminFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by admin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Admins</SelectItem>
                  {adminUsers.map((admin) => (
                    <SelectItem key={admin.user_id} value={admin.user_id}>
                      {admin.email.split("@")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quizzes">Quizzes</SelectItem>
                  <SelectItem value="quiz_leads">Respondents</SelectItem>
                  <SelectItem value="email_logs">Emails</SelectItem>
                  <SelectItem value="email_templates">Templates</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activities recorded yet.</p>
              <p className="text-sm mt-1">Admin activities will appear here as changes happen.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 bg-secondary/30 rounded-lg border border-border"
                  >
                    {activity.user_email ? (
                      <Avatar className="h-9 w-9 bg-secondary shrink-0">
                        <AvatarFallback className="text-xs bg-secondary text-foreground">
                          {getInitials(activity.user_email)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium">
                          {activity.user_email?.split("@")[0] || "System"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`${getActionColor(activity.action_type)} gap-1 text-xs`}
                        >
                          {getActionIcon(activity.action_type)}
                          {activity.action_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getTableLabel(activity.table_name)}
                        </Badge>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-foreground">{activity.description}</p>
                      )}
                      {activity.field_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">{activity.field_name}:</span>
                          {activity.old_value && (
                            <span className="line-through text-red-500/70 mx-1">
                              {activity.old_value.slice(0, 30)}
                              {activity.old_value.length > 30 && "..."}
                            </span>
                          )}
                          {activity.old_value && activity.new_value && "→"}
                          {activity.new_value && (
                            <span className="text-green-600 mx-1">
                              {activity.new_value.slice(0, 30)}
                              {activity.new_value.length > 30 && "..."}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground" title={formatFullDate(activity.created_at)}>
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
