import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, Shield, PanelLeftClose, PanelLeft, LogOut, Mail, History, BarChart3, ClipboardList, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import sparklyLogo from "@/assets/sparkly-logo.png";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

interface TableCounts {
  leads: number;
  quizzes: number;
  admins: number;
  emailLogs: number;
  pageViews: number;
}

export function AdminSidebar({ 
  collapsed, 
  onToggle, 
  activeTab, 
  onTabChange,
  onLogout 
}: AdminSidebarProps) {
  const [counts, setCounts] = useState<TableCounts>({
    leads: 0,
    quizzes: 0,
    admins: 0,
    emailLogs: 0,
    pageViews: 0,
  });

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    try {
      const [leadsRes, quizzesRes, adminsRes, emailLogsRes, pageViewsRes] = await Promise.all([
        supabase.from("quiz_leads").select("*", { count: "exact", head: true }),
        supabase.from("quizzes").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
        supabase.from("email_logs").select("*", { count: "exact", head: true }),
        supabase.from("page_views").select("*", { count: "exact", head: true }),
      ]);

      setCounts({
        leads: leadsRes.count || 0,
        quizzes: quizzesRes.count || 0,
        admins: adminsRes.count || 0,
        emailLogs: emailLogsRes.count || 0,
        pageViews: pageViewsRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  const menuItems = [
    { id: "leads", label: "Respondents", icon: Users, count: counts.leads },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList, count: counts.quizzes },
    { id: "analytics", label: "Quiz Analytics", icon: PieChart, count: null },
    { id: "admins", label: "Admin Users", icon: Shield, count: counts.admins },
    { id: "web-stats", label: "Web Stats", icon: BarChart3, count: counts.pageViews },
    { id: "email", label: "Email Settings", icon: Mail, count: null },
    { id: "email-logs", label: "Email History", icon: History, count: counts.emailLogs },
  ];

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <aside 
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-card border-r border-border flex flex-col transition-all duration-300 shrink-0`}
    >
      {/* Header with logo and toggle */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        {!collapsed && (
          <a 
            href="https://sparkly.hr" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <img 
              src={sparklyLogo} 
              alt="Sparkly.hr" 
              className="h-8 object-contain hover:opacity-80 transition-opacity"
            />
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={`h-8 w-8 ${collapsed ? "mx-auto" : ""}`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        {!collapsed && (
          <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Management
          </span>
        )}
        <ul className="mt-2 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? `${item.label}${item.count !== null ? ` (${item.count})` : ""}` : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.count !== null && (
                        <Badge 
                          variant={isActive ? "secondary" : "outline"}
                          className={`text-xs px-1.5 py-0.5 min-w-[1.5rem] justify-center ${
                            isActive ? "bg-primary-foreground/20 text-primary-foreground" : ""
                          }`}
                        >
                          {formatCount(item.count)}
                        </Badge>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer with logout */}
      <div className="p-3 border-t border-border">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
