import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Download, RefreshCw, UserPlus, Trash2, Shield, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/quiz/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [creatingWithPassword, setCreatingWithPassword] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
      // Fetch active admins
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id")
        .eq("role", "admin");

      if (error) throw error;

      // Get emails from profiles table
      const adminUsers: AdminUser[] = [];
      for (const role of data || []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", role.user_id)
          .maybeSingle();
        
        adminUsers.push({
          id: role.id,
          user_id: role.user_id,
          email: profile?.email || "Unknown",
        });
      }
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

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailToAdd = newAdminEmail.trim().toLowerCase();

    setAddingAdmin(true);
    try {
      // Check if already a pending admin
      const { data: existingPending } = await supabase
        .from("pending_admin_emails")
        .select("id")
        .eq("email", emailToAdd)
        .maybeSingle();

      if (existingPending) {
        toast({
          title: "Already pending",
          description: "This email is already in the pending admin list",
          variant: "destructive",
        });
        return;
      }

      // Find user by email in profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", emailToAdd)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile) {
        // User exists - check if already an admin
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("role", "admin")
          .maybeSingle();

        if (existingRole) {
          toast({
            title: "Already an admin",
            description: "This user already has admin privileges",
            variant: "destructive",
          });
          return;
        }

        // Add admin role directly
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: profile.user_id, role: "admin" });

        if (insertError) throw insertError;

        toast({
          title: "Admin added",
          description: `${emailToAdd} is now an admin`,
        });
      } else {
        // User doesn't exist - add to pending list
        const { error: insertError } = await supabase
          .from("pending_admin_emails")
          .insert({ email: emailToAdd });

        if (insertError) throw insertError;

        toast({
          title: "Admin invite added",
          description: `${emailToAdd} will become an admin when they sign up`,
        });
      }

      setNewAdminEmail("");
      fetchAdmins();
    } catch (error: any) {
      console.error("Error adding admin:", error);
      toast({
        title: "Error",
        description: "Failed to add admin",
        variant: "destructive",
      });
    } finally {
      setAddingAdmin(false);
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

  const createAdminWithPassword = async () => {
    if (!newAdminEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (!newAdminPassword || newAdminPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setCreatingWithPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: { 
          email: newAdminEmail.trim().toLowerCase(), 
          password: newAdminPassword 
        },
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

      toast({
        title: "Admin created",
        description: `Account created for ${newAdminEmail} with admin access`,
      });

      setNewAdminEmail("");
      setNewAdminPassword("");
      fetchAdmins();
    } catch (error: any) {
      console.error("Error creating admin:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create admin account",
        variant: "destructive",
      });
    } finally {
      setCreatingWithPassword(false);
    }
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
              <h2 className="text-lg font-semibold text-foreground mb-4">Add New Admin</h2>
              <div className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <Input
                    type="email"
                    placeholder="Enter user email address"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={addAdmin} disabled={addingAdmin || creatingWithPassword}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {addingAdmin ? "Adding..." : "Add/Invite"}
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Input
                    type="password"
                    placeholder="Set password (optional - creates account directly)"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={createAdminWithPassword} 
                    disabled={addingAdmin || creatingWithPassword || !newAdminPassword}
                    variant="secondary"
                  >
                    {creatingWithPassword ? "Creating..." : "Create with Password"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                <strong>Add/Invite:</strong> If user exists, grants admin. If not, they become admin on signup.<br />
                <strong>Create with Password:</strong> Creates a new account with admin access immediately.
              </p>
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
                    <h3 className="font-semibold text-foreground">Active Admins</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary/50">
                        <tr>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Email</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Status</th>
                          <th className="text-right px-6 py-4 text-sm font-semibold text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {admins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-6 py-4 text-sm text-foreground">
                              {admin.email}
                              {admin.user_id === currentUserId && (
                                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                Active
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAdmin(admin.id, admin.user_id, admin.email)}
                                disabled={admin.user_id === currentUserId}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {admins.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                              No active admins found
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
    </div>
  );
};

export default Admin;
