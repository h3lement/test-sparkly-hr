import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatTimestamp, formatTimestampShort } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
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
  Pencil,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink
} from "lucide-react";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

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

interface ActivityFormData {
  action_type: string;
  table_name: string;
  record_id: string;
  description: string;
  field_name: string;
  old_value: string;
  new_value: string;
}

interface ObjectInfo {
  name: string;
  link: string | null;
}

export function ActivityDashboard() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [objectNames, setObjectNames] = useState<Record<string, ObjectInfo>>({});
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const { toast } = useToast();

  const emptyForm: ActivityFormData = {
    action_type: "CREATE",
    table_name: "quizzes",
    record_id: "",
    description: "",
    field_name: "",
    old_value: "",
    new_value: "",
  };
  const [formData, setFormData] = useState<ActivityFormData>(emptyForm);

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

  // Fetch object names for activities
  const fetchObjectNames = useCallback(async (activitiesData: ActivityLog[]) => {
    const objectMap: Record<string, ObjectInfo> = {};
    
    // Group record IDs by table
    const quizIds = new Set<string>();
    const leadIds = new Set<string>();
    const hypothesisLeadIds = new Set<string>();
    const templateIds = new Set<string>();
    const ctaIds = new Set<string>();
    
    activitiesData.forEach((activity) => {
      const key = `${activity.table_name}:${activity.record_id}`;
      if (objectMap[key]) return;
      
      switch (activity.table_name) {
        case "quizzes":
          quizIds.add(activity.record_id);
          break;
        case "quiz_leads":
          leadIds.add(activity.record_id);
          break;
        case "hypothesis_leads":
          hypothesisLeadIds.add(activity.record_id);
          break;
        case "email_templates":
          templateIds.add(activity.record_id);
          break;
        case "cta_templates":
          ctaIds.add(activity.record_id);
          break;
      }
    });

    try {
      // Fetch all object names in parallel
      const [quizzesRes, leadsRes, hypothesisRes, templatesRes, ctasRes] = await Promise.all([
        quizIds.size > 0 
          ? supabase.from("quizzes").select("id, title, slug").in("id", Array.from(quizIds))
          : Promise.resolve({ data: [] }),
        leadIds.size > 0 
          ? supabase.from("quiz_leads").select("id, email, quiz_id").in("id", Array.from(leadIds))
          : Promise.resolve({ data: [] }),
        hypothesisLeadIds.size > 0 
          ? supabase.from("hypothesis_leads").select("id, email, quiz_id").in("id", Array.from(hypothesisLeadIds))
          : Promise.resolve({ data: [] }),
        templateIds.size > 0 
          ? supabase.from("email_templates").select("id, template_type, quiz_id").in("id", Array.from(templateIds))
          : Promise.resolve({ data: [] }),
        ctaIds.size > 0 
          ? supabase.from("cta_templates").select("id, name, quiz_id").in("id", Array.from(ctaIds))
          : Promise.resolve({ data: [] }),
      ]);

      // Map quizzes
      (quizzesRes.data || []).forEach((quiz: any) => {
        const title = typeof quiz.title === 'object' ? (quiz.title.en || quiz.title.hr || Object.values(quiz.title)[0] || quiz.slug) : quiz.title;
        objectMap[`quizzes:${quiz.id}`] = {
          name: title || quiz.slug,
          link: `/admin/quiz/${quiz.id}`,
        };
      });

      // Map quiz leads
      (leadsRes.data || []).forEach((lead: any) => {
        objectMap[`quiz_leads:${lead.id}`] = {
          name: lead.email,
          link: `/admin/leads`,
        };
      });

      // Map hypothesis leads
      (hypothesisRes.data || []).forEach((lead: any) => {
        objectMap[`hypothesis_leads:${lead.id}`] = {
          name: lead.email,
          link: `/admin/leads`,
        };
      });

      // Map email templates
      (templatesRes.data || []).forEach((template: any) => {
        objectMap[`email_templates:${template.id}`] = {
          name: `${template.template_type} template`,
          link: template.quiz_id ? `/admin/quiz/${template.quiz_id}/email` : null,
        };
      });

      // Map CTA templates
      (ctasRes.data || []).forEach((cta: any) => {
        objectMap[`cta_templates:${cta.id}`] = {
          name: cta.name || "CTA Template",
          link: `/admin/versions`,
        };
      });

      setObjectNames(objectMap);
    } catch (error) {
      console.error("Error fetching object names:", error);
    }
  }, []);

  // Fetch object names when activities change
  useEffect(() => {
    if (activities.length > 0) {
      fetchObjectNames(activities);
    }
  }, [activities, fetchObjectNames]);

  // Always-on realtime subscription for activity_logs
  useEffect(() => {
    const channel = supabase
      .channel("activity-dashboard-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const openCreateDialog = () => {
    setFormData(emptyForm);
    setIsCreateOpen(true);
  };

  const openEditDialog = (activity: ActivityLog) => {
    setEditingActivity(activity);
    setFormData({
      action_type: activity.action_type,
      table_name: activity.table_name,
      record_id: activity.record_id,
      description: activity.description || "",
      field_name: activity.field_name || "",
      old_value: activity.old_value || "",
      new_value: activity.new_value || "",
    });
  };

  const closeDialogs = () => {
    setIsCreateOpen(false);
    setEditingActivity(null);
    setFormData(emptyForm);
  };

  const handleCreateActivity = async () => {
    if (!formData.record_id.trim()) {
      toast({ title: "Record ID is required", variant: "destructive" });
      return;
    }

    setFormLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from("activity_logs").insert({
        action_type: formData.action_type,
        table_name: formData.table_name,
        record_id: formData.record_id,
        description: formData.description || null,
        field_name: formData.field_name || null,
        old_value: formData.old_value || null,
        new_value: formData.new_value || null,
        user_id: session?.session?.user.id || null,
        user_email: session?.session?.user.email || null,
      });

      if (error) throw error;

      toast({ title: "Activity log created" });
      closeDialogs();
      fetchData();
    } catch (error: any) {
      console.error("Error creating activity:", error);
      toast({ title: "Failed to create activity", description: error.message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity) return;

    setFormLoading(true);
    try {
      const { error } = await supabase
        .from("activity_logs")
        .update({
          action_type: formData.action_type,
          table_name: formData.table_name,
          record_id: formData.record_id,
          description: formData.description || null,
          field_name: formData.field_name || null,
          old_value: formData.old_value || null,
          new_value: formData.new_value || null,
        })
        .eq("id", editingActivity.id);

      if (error) throw error;

      toast({ title: "Activity log updated" });
      closeDialogs();
      fetchData();
    } catch (error: any) {
      console.error("Error updating activity:", error);
      toast({ title: "Failed to update activity", description: error.message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from("activity_logs")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) throw error;

      toast({ title: "Activity log deleted" });
      setDeleteConfirmId(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting activity:", error);
      toast({ title: "Failed to delete activity", description: error.message, variant: "destructive" });
    }
  };


  const filteredActivities = useMemo(() => {
    let result = activities;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a) => 
        (a.description && a.description.toLowerCase().includes(query)) ||
        (a.user_email && a.user_email.toLowerCase().includes(query)) ||
        (a.action_type && a.action_type.toLowerCase().includes(query)) ||
        (a.table_name && a.table_name.toLowerCase().includes(query))
      );
    }
    
    if (activityFilter !== "all") {
      result = result.filter((a) => a.table_name === activityFilter);
    }
    
    if (adminFilter !== "all") {
      result = result.filter((a) => a.user_id === adminFilter);
    }
    
    return result;
  }, [activities, activityFilter, adminFilter, searchQuery]);

  // Pagination calculations
  const totalItems = filteredActivities.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activityFilter, adminFilter, searchQuery]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) pages.push("ellipsis");
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      
      pages.push(totalPages);
    }
    
    return pages;
  };

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
      case "EMAIL_SENT":
        return <Shield className="h-4 w-4" />;
      case "EMAIL_FAILED":
        return <Shield className="h-4 w-4" />;
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
      case "EMAIL_SENT":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "EMAIL_FAILED":
        return "bg-red-500/10 text-red-600 border-red-500/20";
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
      case "domain_reputation":
        return "Domain Rep.";
      default:
        return table;
    }
  };

  const formatDate = (dateString: string) => {
    return formatTimestampShort(dateString);
  };

  const formatFullDate = (dateString: string) => {
    return formatTimestamp(dateString);
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Activity</h1>
          <p className="text-muted-foreground mt-1">Track what admin users are doing</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <Wifi className="h-4 w-4" />
            <span>Live</span>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Log
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[180px] bg-secondary/50 border-border"
                />
              </div>
              <Select value={adminFilter} onValueChange={setAdminFilter}>
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quizzes">Quizzes</SelectItem>
                  <SelectItem value="quiz_leads">Respondents</SelectItem>
                  <SelectItem value="email_logs">Emails</SelectItem>
                  <SelectItem value="email_templates">Templates</SelectItem>
                  <SelectItem value="domain_reputation">Domain Rep.</SelectItem>
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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-3 px-3 font-medium text-muted-foreground whitespace-nowrap w-[120px]">User</th>
                      <th className="py-3 px-3 font-medium text-muted-foreground whitespace-nowrap w-[100px]">Action</th>
                      <th className="py-3 px-3 font-medium text-muted-foreground whitespace-nowrap w-[90px]">Type</th>
                      <th className="py-3 px-3 font-medium text-muted-foreground whitespace-nowrap w-[160px]">Object</th>
                      <th className="py-3 px-3 font-medium text-muted-foreground">Description</th>
                      <th className="py-3 px-3 font-medium text-muted-foreground whitespace-nowrap w-[140px]">Timestamp</th>
                      <th className="py-3 px-3 font-medium text-muted-foreground w-[80px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedActivities.map((activity, index) => (
                      <tr
                        key={activity.id}
                        className={`list-row-interactive ${index % 2 === 0 ? 'list-row-even' : 'list-row-odd'}`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {activity.user_email ? (
                              <Avatar className="h-6 w-6 bg-secondary shrink-0">
                                <AvatarFallback className="text-[10px] bg-secondary text-foreground">
                                  {getInitials(activity.user_email)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <User className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium truncate max-w-[80px]">
                              {activity.user_email?.split("@")[0] || "System"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={`${getActionColor(activity.action_type)} gap-1 text-xs`}
                          >
                            {getActionIcon(activity.action_type)}
                            {activity.action_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className="text-xs">
                            {getTableLabel(activity.table_name)}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {(() => {
                            const objectKey = `${activity.table_name}:${activity.record_id}`;
                            const objectInfo = objectNames[objectKey];
                            if (objectInfo?.name) {
                              return objectInfo.link ? (
                                <button
                                  onClick={() => navigate(objectInfo.link!)}
                                  className="flex items-center gap-1 text-primary hover:underline font-medium truncate max-w-[150px]"
                                  title={objectInfo.name}
                                >
                                  <span className="truncate">{objectInfo.name}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                </button>
                              ) : (
                                <span className="text-foreground truncate max-w-[150px]" title={objectInfo.name}>
                                  {objectInfo.name}
                                </span>
                              );
                            }
                            return (
                              <span className="text-muted-foreground text-xs font-mono truncate max-w-[100px]" title={activity.record_id}>
                                {activity.record_id.slice(0, 8)}...
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            {activity.description && (
                              <p className="text-foreground">{activity.description}</p>
                            )}
                            {activity.field_name && (
                              <p className="text-xs text-muted-foreground">
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
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground" title={formatFullDate(activity.created_at)}>
                          {formatDate(activity.created_at)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(activity)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmId(activity.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Showing</span>
                    <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>of {totalItems} results</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers().map((page, idx) =>
                      page === "ellipsis" ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      )
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingActivity} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "Edit Activity Log" : "Create Activity Log"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select value={formData.action_type} onValueChange={(v) => setFormData({ ...formData, action_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREATE">CREATE</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="STATUS_CHANGE">STATUS_CHANGE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Select value={formData.table_name} onValueChange={(v) => setFormData({ ...formData, table_name: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quizzes">Quizzes</SelectItem>
                    <SelectItem value="quiz_leads">Respondents</SelectItem>
                    <SelectItem value="email_logs">Email Logs</SelectItem>
                    <SelectItem value="email_templates">Email Templates</SelectItem>
                    <SelectItem value="user_roles">User Roles</SelectItem>
                    <SelectItem value="pending_admin_emails">Pending Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Record ID</Label>
              <Input
                value={formData.record_id}
                onChange={(e) => setFormData({ ...formData, record_id: e.target.value })}
                placeholder="UUID of the record"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the action"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Field Name (optional)</Label>
              <Input
                value={formData.field_name}
                onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                placeholder="e.g. is_active"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Old Value (optional)</Label>
                <Input
                  value={formData.old_value}
                  onChange={(e) => setFormData({ ...formData, old_value: e.target.value })}
                  placeholder="Previous value"
                />
              </div>
              <div className="space-y-2">
                <Label>New Value (optional)</Label>
                <Input
                  value={formData.new_value}
                  onChange={(e) => setFormData({ ...formData, new_value: e.target.value })}
                  placeholder="Updated value"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              onClick={editingActivity ? handleUpdateActivity : handleCreateActivity}
              disabled={formLoading}
            >
              {formLoading ? "Saving..." : editingActivity ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the activity log entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteActivity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
