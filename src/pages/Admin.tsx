import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, Clock, Search, LogOut } from "lucide-react";
import { logActivity } from "@/hooks/useActivityLog";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/quiz/Footer";
import { CreateAdminDialog } from "@/components/admin/CreateAdminDialog";
import { EditAdminDialog } from "@/components/admin/EditAdminDialog";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { EmailVersionHistory, WebVersionHistory } from "@/components/admin/VersionHistoryTables";
import { EmailLogsMonitor } from "@/components/admin/EmailLogsMonitor";
import { WebStatsMonitor } from "@/components/admin/WebStatsMonitor";
import { QuizManager } from "@/components/admin/QuizManager";
import { QuizAnalytics } from "@/components/admin/QuizAnalytics";
import { RespondentsList } from "@/components/admin/RespondentsList";
import { ActivityDashboard } from "@/components/admin/ActivityDashboard";
import { AppearanceSettings } from "@/components/admin/AppearanceSettings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";


interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

interface PendingAdmin {
  id: string;
  email: string;
  created_at: string;
}

const Admin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "activity");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);
  const [emailHistoryFilter, setEmailHistoryFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sync tab with URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setSearchQuery("");
  };

  const handleViewQuizLead = (leadId: string) => {
    setHighlightedLeadId(leadId);
    handleTabChange("leads");
  };

  const handleViewEmailHistory = (leadId: string, email: string) => {
    setEmailHistoryFilter(email);
    handleTabChange("email-logs");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setCurrentUserId(session.user.id);
        checkAdminRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminRole = async (userId: string) => {
    setCheckingRole(true);

    try {
      // Roles can be granted moments after sign-up; retry briefly to avoid false "Access Denied".
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setIsAdmin(true);
          fetchAdmins();
          return;
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      setIsAdmin(false);
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges. Contact the administrator.",
        variant: "destructive",
      });
    } catch (error: any) {
      console.error("Error checking admin role:", error);
      toast({
        title: "Error",
        description: "Failed to verify admin status",
        variant: "destructive",
      });
    } finally {
      setCheckingRole(false);
    }
  };


  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id")
        .eq("role", "admin");

      if (error) throw error;

      if (!data || data.length === 0) {
        setAdmins([]);
        setPendingAdmins([]);
        return;
      }

      const userIds = data.map(role => role.user_id);
      const { data: usersData, error: usersError } = await supabase.functions.invoke("manage-admin-user", {
        body: { action: "get-users-status", userIds },
      });

      const adminUsers: AdminUser[] = data.map(role => {
        const userData = usersData?.users?.[role.user_id];
        return {
          id: role.id,
          user_id: role.user_id,
          email: userData?.email || "Unknown",
          name: userData?.name || "",
          is_active: userData?.is_active ?? true,
          created_at: userData?.created_at,
        };
      });
      
      setAdmins(adminUsers);

      const { data: pendingData, error: pendingError } = await supabase
        .from("pending_admin_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;
      setPendingAdmins(pendingData || []);
    } catch (error: any) {
      console.error("Error fetching admins:", error);
    } finally {
      setAdminsLoading(false);
    }
  };

  const removePendingAdmin = async (id: string, email: string) => {
    try {
      await logActivity({
        actionType: "DELETE",
        tableName: "pending_admin_emails",
        recordId: id,
        description: `Pending admin "${email}" removed from invite list`,
      });

      const { error } = await supabase
        .from("pending_admin_emails")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Pending admin removed",
        description: `${email} removed from pending list`,
      });

      setPendingAdmins(pendingAdmins.filter(p => p.id !== id));
    } catch (error: any) {
      console.error("Error removing pending admin:", error);
      toast({
        title: "Error",
        description: "Failed to remove pending admin",
        variant: "destructive",
      });
    }
  };

  const toggleAdminStatus = async (admin: AdminUser) => {
    if (admin.user_id === currentUserId) {
      toast({
        title: "Cannot modify yourself",
        description: "You cannot deactivate your own account",
        variant: "destructive",
      });
      return;
    }

    // Prevent deactivating the primary admin (Mikk)
    if (admin.email.toLowerCase() === "mikk@sparkly.hr" && admin.is_active) {
      toast({
        title: "Protected account",
        description: "This admin account cannot be deactivated",
        variant: "destructive",
      });
      return;
    }

    try {
      const action = admin.is_active ? "deactivate" : "activate";
      const { data, error } = await supabase.functions.invoke("manage-admin-user", {
        body: { action, userId: admin.user_id },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      await logActivity({
        actionType: "STATUS_CHANGE",
        tableName: "user_roles",
        recordId: admin.id,
        fieldName: "is_active",
        oldValue: admin.is_active ? "active" : "inactive",
        newValue: admin.is_active ? "inactive" : "active",
        description: `Admin "${admin.email}" ${admin.is_active ? "deactivated" : "activated"}`,
      });

      setAdmins(admins.map(a => 
        a.id === admin.id ? { ...a, is_active: !a.is_active } : a
      ));

      toast({
        title: admin.is_active ? "Admin deactivated" : "Admin activated",
        description: `${admin.email} has been ${admin.is_active ? "deactivated" : "activated"}`,
      });
    } catch (error: any) {
      console.error("Error toggling admin status:", error);
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditDialogOpen(true);
  };

  const removeAdmin = async (roleId: string, userId: string, email: string) => {
    if (userId === currentUserId) {
      toast({
        title: "Cannot remove yourself",
        description: "You cannot remove your own admin privileges",
        variant: "destructive",
      });
      return;
    }

    try {
      await logActivity({
        actionType: "DELETE",
        tableName: "user_roles",
        recordId: roleId,
        description: `Admin privileges removed from "${email}"`,
      });

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast({
        title: "Admin removed",
        description: `${email} is no longer an admin`,
      });

      fetchAdmins();
    } catch (error: any) {
      console.error("Error removing admin:", error);
      toast({
        title: "Error",
        description: "Failed to remove admin",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredAdmins = admins.filter(admin =>
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <Logo />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have admin privileges to view this page. Please contact the administrator to request access.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
              <Button
                onClick={() => currentUserId && checkAdminRole(currentUserId)}
                variant="secondary"
              >
                Retry access
              </Button>
              <Button onClick={handleLogout} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex overflow-hidden">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-h-0 bg-card">
        <div className="flex-1 density-padding-lg overflow-y-auto min-h-0">
          {/* Activity Dashboard Tab */}
          {activeTab === "activity" && (
            <ActivityDashboard />
          )}

          {/* Respondents Tab */}
          {activeTab === "leads" && (
            <RespondentsList 
              highlightedLeadId={highlightedLeadId} 
              onHighlightCleared={() => setHighlightedLeadId(null)}
              onViewEmailHistory={handleViewEmailHistory}
            />
          )}

          {/* Quizzes Tab */}
          {activeTab === "quizzes" && (
            <QuizManager />
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <QuizAnalytics />
          )}

          {/* Admins Tab */}
          {activeTab === "admins" && (
            <div className="w-full">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Admins</h1>
                  <p className="text-muted-foreground mt-1">Manage admin accounts</p>
                </div>
                <CreateAdminDialog onAdminCreated={fetchAdmins} />
              </div>

              {/* Search bar */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border"
                  />
                </div>
                <span className="px-3 py-1.5 bg-secondary rounded-full text-sm text-foreground font-medium">
                  {filteredAdmins.length} admin{filteredAdmins.length !== 1 ? "s" : ""}
                </span>
              </div>

              {adminsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading admins...</p>
                </div>
              ) : (
                <>
                  {/* Active Admins */}
                  <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Admin</th>
                          <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Joined</th>
                          <th className="text-right density-px density-py-sm text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAdmins.map((admin, index) => {
                          const isEvenRow = index % 2 === 0;
                          return (
                          <tr 
                            key={admin.id} 
                            className={`transition-all duration-200 ease-out hover:bg-primary/5 hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.1)] ${isEvenRow ? "bg-card" : "bg-secondary/20"} ${!admin.is_active ? 'opacity-60' : ''}`}
                          >
                            <td className="density-px density-py">
                              <div 
                                className="flex items-center gap-3 cursor-pointer group"
                                onClick={() => openEditDialog(admin)}
                              >
                                <Avatar className="h-9 w-9 bg-secondary group-hover:ring-2 group-hover:ring-primary/30 transition-all">
                                  <AvatarFallback className="text-xs bg-secondary text-foreground">
                                    {getInitials(admin.name, admin.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline underline-offset-2 transition-colors">
                                    {admin.name || <span className="text-muted-foreground italic">No name</span>}
                                    {admin.user_id === currentUserId && (
                                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                                    )}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{admin.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="density-px density-py">
                              <button
                                onClick={() => admin.user_id !== currentUserId && toggleAdminStatus(admin)}
                                disabled={admin.user_id === currentUserId}
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-opacity ${
                                  admin.user_id === currentUserId ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-70'
                                } ${admin.is_active ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'}`}
                                title={admin.user_id === currentUserId ? "Cannot modify yourself" : admin.is_active ? "Click to deactivate" : "Click to activate"}
                              >
                                {admin.is_active ? "Active" : "Inactive"}
                              </button>
                            </td>
                            <td className="density-px density-py text-sm text-muted-foreground">
                              {admin.created_at ? formatDate(admin.created_at) : "—"}
                            </td>
                            <td className="density-px density-py text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAdmin(admin.id, admin.user_id, admin.email)}
                                disabled={admin.user_id === currentUserId}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Remove admin"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                          );
                        })}
                        {filteredAdmins.length === 0 && (
                          <tr>
                            <td colSpan={4} className="density-px py-8 text-center text-muted-foreground">
                              No admins found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pending Admins */}
                  {pendingAdmins.length > 0 && (
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="density-px density-py border-b border-border bg-secondary/30">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Pending Admin Invites
                        </h3>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Email</th>
                            <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Status</th>
                            <th className="text-left density-px density-py-sm text-sm font-medium text-muted-foreground">Added</th>
                            <th className="text-right density-px density-py-sm text-sm font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pendingAdmins.map((pending, index) => {
                            const isEvenRow = index % 2 === 0;
                            return (
                            <tr key={pending.id} className={`transition-all duration-200 ease-out hover:bg-primary/5 hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.1)] ${isEvenRow ? "bg-card" : "bg-secondary/20"}`}>
                              <td className="density-px density-py">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 bg-secondary">
                                    <AvatarFallback className="text-xs bg-secondary text-foreground">
                                      {pending.email.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-foreground">{pending.email}</span>
                                </div>
                              </td>
                              <td className="density-px density-py">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-600">
                                  Pending signup
                                </span>
                              </td>
                              <td className="density-px density-py text-sm text-muted-foreground">
                                {formatDate(pending.created_at)}
                              </td>
                              <td className="density-px density-py text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePendingAdmin(pending.id, pending.email)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Web Stats Tab */}
          {activeTab === "web-stats" && (
            <WebStatsMonitor />
          )}

          {/* Versions Tab */}
          {activeTab === "versions" && (
            <div className="w-full space-y-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">Versions</h1>
                <p className="text-muted-foreground mt-1">Web and email template versions across all quizzes</p>
              </div>
              <WebVersionHistory />
              <EmailVersionHistory />
            </div>
          )}

          {/* Email Logs Tab */}
          {activeTab === "email-logs" && (
            <div className="w-full">
              <EmailLogsMonitor 
                onViewQuizLead={handleViewQuizLead}
                initialEmailFilter={emailHistoryFilter}
                onEmailFilterCleared={() => setEmailHistoryFilter(null)}
              />
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <AppearanceSettings />
          )}
        </div>
      </main>

      <EditAdminDialog
        admin={editingAdmin}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onAdminUpdated={fetchAdmins}
      />
    </div>
  );
};

export default Admin;
