import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Download, RefreshCw, Trash2, Shield, Clock, Pencil, Ban, CheckCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/quiz/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAdminDialog } from "@/components/admin/CreateAdminDialog";
import { EditAdminDialog } from "@/components/admin/EditAdminDialog";

interface QuizLead {
  id: string;
  email: string;
  score: number;
  total_questions: number;
  result_category: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  is_active: boolean;
}

interface PendingAdmin {
  id: string;
  email: string;
  created_at: string;
}

const Admin = () => {
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsAdmin(true);
        fetchLeads();
        fetchAdmins();
      } else {
        setIsAdmin(false);
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges. Contact the administrator.",
          variant: "destructive",
        });
      }
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

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Error",
        description: "Failed to fetch quiz leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      // Fetch admin role entries
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

      // Get user emails and status from edge function
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
        };
      });
      
      setAdmins(adminUsers);

      // Fetch pending admins
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

      // Update local state
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

  const deleteLead = async (leadId: string, email: string) => {
    try {
      const { error } = await supabase
        .from("quiz_leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead deleted",
        description: `Removed submission from ${email}`,
      });

      setLeads(leads.filter(lead => lead.id !== leadId));
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const downloadCSV = () => {
    if (leads.length === 0) {
      toast({
        title: "No data",
        description: "There are no leads to download",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Email", "Score", "Total Questions", "Result Category", "Date"];
    const csvContent = [
      headers.join(","),
      ...leads.map((lead) =>
        [
          `"${lead.email}"`,
          lead.score,
          lead.total_questions,
          `"${lead.result_category}"`,
          `"${new Date(lead.created_at).toLocaleString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz-leads-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button onClick={fetchLeads} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={downloadCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <Tabs defaultValue="leads" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="leads">Quiz Leads</TabsTrigger>
            <TabsTrigger value="admins">
              <Shield className="w-4 h-4 mr-2" />
              Manage Admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Quiz Leads</h1>
              <p className="text-muted-foreground mt-1">
                {leads.length} submission{leads.length !== 1 ? "s" : ""} total
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12 glass rounded-xl">
                <p className="text-muted-foreground">No quiz submissions yet.</p>
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Email</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Score</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Result</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Date</th>
                        <th className="text-right px-6 py-4 text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-foreground">{lead.email}</td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {lead.score}/{lead.total_questions}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {lead.result_category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {new Date(lead.created_at).toLocaleDateString()} at{" "}
                            {new Date(lead.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteLead(lead.id, lead.email)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="admins">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Manage Admins</h1>
              <p className="text-muted-foreground mt-1">
                Add or remove admin privileges for users
              </p>
            </div>

            <div className="glass rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Add New Admin</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new admin account with login credentials
                  </p>
                </div>
                <CreateAdminDialog onAdminCreated={fetchAdmins} />
              </div>
            </div>

            {adminsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading admins...</p>
              </div>
            ) : (
              <>
                {/* Active Admins */}
                <div className="glass rounded-xl overflow-hidden mb-6">
                  <div className="px-6 py-4 bg-secondary/30 border-b border-border">
                    <h3 className="font-semibold text-foreground">Admins</h3>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full">
                      <thead className="bg-secondary/50">
                        <tr>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Name</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Email</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Status</th>
                          <th className="text-right px-6 py-4 text-sm font-semibold text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {admins.map((admin) => (
                          <tr key={admin.id} className={`hover:bg-secondary/30 transition-colors ${!admin.is_active ? 'opacity-60' : ''}`}>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {admin.name || <span className="text-muted-foreground italic">No name</span>}
                              {admin.user_id === currentUserId && (
                                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {admin.email}
                            </td>
                            <td className="px-6 py-4">
                              {admin.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                                  Deactivated
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(admin)}
                                title="Edit admin"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleAdminStatus(admin)}
                                disabled={admin.user_id === currentUserId}
                                title={admin.is_active ? "Deactivate" : "Activate"}
                                className={admin.is_active 
                                  ? "text-orange-600 hover:text-orange-600 hover:bg-orange-500/10" 
                                  : "text-green-600 hover:text-green-600 hover:bg-green-500/10"}
                              >
                                {admin.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAdmin(admin.id, admin.user_id, admin.email)}
                                disabled={admin.user_id === currentUserId}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Remove admin"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {admins.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                              No admins found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pending Admins */}
                {pendingAdmins.length > 0 && (
                  <div className="glass rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-secondary/30 border-b border-border">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pending Admin Invites
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Email</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Status</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Added</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pendingAdmins.map((pending) => (
                            <tr key={pending.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-6 py-4 text-sm text-foreground">{pending.email}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600">
                                  Pending signup
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {new Date(pending.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePendingAdmin(pending.id, pending.email)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      
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
