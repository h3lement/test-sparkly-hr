import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Download, RefreshCw, UserPlus, Trash2, Shield } from "lucide-react";
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

const Admin = () => {
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
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

    setAddingAdmin(true);
    try {
      // Find user by email in profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", newAdminEmail.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast({
          title: "User not found",
          description: "No user exists with that email. They must sign up first.",
          variant: "destructive",
        });
        return;
      }

      // Check if already an admin
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

      // Add admin role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.user_id, role: "admin" });

      if (insertError) throw insertError;

      toast({
        title: "Admin added",
        description: `${newAdminEmail} is now an admin`,
      });

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
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="Enter user email address"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && addAdmin()}
                />
                <Button onClick={addAdmin} disabled={addingAdmin}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {addingAdmin ? "Adding..." : "Add Admin"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                The user must have signed up before you can add them as an admin.
              </p>
            </div>

            {adminsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading admins...</p>
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Email</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Role</th>
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
                              Admin
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
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
