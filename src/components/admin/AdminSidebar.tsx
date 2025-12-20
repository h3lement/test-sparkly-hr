import { useLocation, useNavigate } from "react-router-dom";
import { Users, Shield, PanelLeftClose, PanelLeft, LogOut, Mail, History, BarChart3, ClipboardList, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import sparklyLogo from "@/assets/sparkly-logo.png";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export function AdminSidebar({ 
  collapsed, 
  onToggle, 
  activeTab, 
  onTabChange,
  onLogout 
}: AdminSidebarProps) {
  const menuItems = [
    { id: "leads", label: "Respondents", icon: Users },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
    { id: "analytics", label: "Quiz Analytics", icon: PieChart },
    { id: "admins", label: "Admin Users", icon: Shield },
    { id: "web-stats", label: "Web Stats", icon: BarChart3 },
    { id: "email", label: "Email Settings", icon: Mail },
    { id: "email-logs", label: "Email History", icon: History },
  ];

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
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
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
