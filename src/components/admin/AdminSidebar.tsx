import { useState, useEffect } from "react";
import { Users, Shield, PanelLeftClose, PanelLeft, LogOut, Mail, History, BarChart3, ClipboardList, PieChart, Activity, Pencil, GripVertical, Check, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import sparklyLogo from "@/assets/sparkly-logo.png";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useUserPreferences } from "@/hooks/useUserPreferences";

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
  activity: number;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { id: "activity", label: "Activity", icon: Activity, count: null },
  { id: "leads", label: "Respondents", icon: Users, count: null },
  { id: "quizzes", label: "Quizzes", icon: ClipboardList, count: null },
  { id: "analytics", label: "Quiz Analytics", icon: PieChart, count: null },
  { id: "admins", label: "Admin Users", icon: Shield, count: null },
  { id: "web-stats", label: "Web Stats", icon: BarChart3, count: null },
  { id: "email", label: "Email Settings", icon: Mail, count: null },
  { id: "email-logs", label: "Email History", icon: History, count: null },
  { id: "appearance", label: "Appearance", icon: Palette, count: null },
];

interface SortableMenuItemProps {
  item: MenuItem;
  isActive: boolean;
  collapsed: boolean;
  isEditing: boolean;
  onTabChange: (id: string) => void;
  formatCount: (count: number) => string;
}

function SortableMenuItem({ item, isActive, collapsed, isEditing, onTabChange, formatCount }: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = item.icon;

  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={`w-full flex items-center density-gap px-3 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-secondary"
        } ${collapsed ? "justify-center" : ""} ${isEditing ? "cursor-grab" : "cursor-pointer"}`}
        style={{ padding: "var(--density-padding-sm) var(--density-padding)" }}
        onClick={() => !isEditing && onTabChange(item.id)}
        title={collapsed ? `${item.label}${item.count !== null ? ` (${item.count})` : ""}` : undefined}
        {...(isEditing ? { ...attributes, ...listeners } : {})}
      >
        {isEditing && !collapsed && (
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
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
      </div>
    </li>
  );
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
    activity: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [menuOrder, setMenuOrder] = useState<string[]>(DEFAULT_MENU_ITEMS.map(item => item.id));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const { preferences: savedOrder, savePreferences, loading: preferencesLoading } = useUserPreferences<string[]>({
    key: "sidebar_menu_order",
    defaultValue: [] as unknown as string[],
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUserId(session.user.id);
      }
    });
    fetchCounts();
  }, []);

  useEffect(() => {
    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
      // Merge saved order with any new menu items that might have been added
      const validSavedOrder = (savedOrder as string[]).filter(id => 
        DEFAULT_MENU_ITEMS.some(item => item.id === id)
      );
      const newItems = DEFAULT_MENU_ITEMS
        .filter(item => !(savedOrder as string[]).includes(item.id))
        .map(item => item.id);
      setMenuOrder([...validSavedOrder, ...newItems]);
    }
  }, [savedOrder]);

  async function fetchCounts() {
    try {
      const [leadsRes, quizzesRes, adminsRes, emailLogsRes, pageViewsRes, activityRes] = await Promise.all([
        supabase.from("quiz_leads").select("*", { count: "exact", head: true }),
        supabase.from("quizzes").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
        supabase.from("email_logs").select("*", { count: "exact", head: true }),
        supabase.from("page_views").select("*", { count: "exact", head: true }),
        supabase.from("activity_logs").select("*", { count: "exact", head: true }),
      ]);

      setCounts({
        leads: leadsRes.count || 0,
        quizzes: quizzesRes.count || 0,
        admins: adminsRes.count || 0,
        emailLogs: emailLogsRes.count || 0,
        pageViews: pageViewsRes.count || 0,
        activity: activityRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  }

  // Keep sidebar counters in sync in real time
  useEffect(() => {
    const channel = supabase
      .channel("admin-sidebar-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_leads" },
        () => fetchCounts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_logs" },
        () => fetchCounts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_views" },
        () => fetchCounts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs" },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const menuItems: MenuItem[] = menuOrder.map(id => {
    const defaultItem = DEFAULT_MENU_ITEMS.find(item => item.id === id)!;
    let count: number | null = null;
    
    switch (id) {
      case "activity":
        count = counts.activity;
        break;
      case "leads":
        count = counts.leads;
        break;
      case "quizzes":
        count = counts.quizzes;
        break;
      case "admins":
        count = counts.admins;
        break;
      case "email-logs":
        count = counts.emailLogs;
        break;
      case "web-stats":
        count = counts.pageViews;
        break;
    }
    
    return { ...defaultItem, count };
  });

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setMenuOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    await savePreferences(menuOrder as unknown as string[]);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
      setMenuOrder(savedOrder as string[]);
    } else {
      setMenuOrder(DEFAULT_MENU_ITEMS.map(item => item.id));
    }
    setIsEditing(false);
  };

  return (
    <aside 
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-card border-r border-border flex flex-col transition-all duration-300 shrink-0`}
    >
      {/* Header with logo and toggle */}
      <div className="density-padding flex items-center justify-between border-b border-border">
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
        <div className="flex items-center gap-1">
          {!collapsed && !isEditing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8"
              aria-label="Edit menu order"
              title="Reorder menu items"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {!collapsed && isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveOrder}
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                aria-label="Save order"
                title="Save order"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelEdit}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                aria-label="Cancel"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 density-padding">
        {!collapsed && (
          <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isEditing ? "Drag to reorder" : "Management"}
          </span>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={menuOrder}
            strategy={verticalListSortingStrategy}
          >
            <ul className="mt-2 space-y-1">
              {menuItems.map((item) => (
                <SortableMenuItem
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  collapsed={collapsed}
                  isEditing={isEditing}
                  onTabChange={onTabChange}
                  formatCount={formatCount}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>

      {/* Footer with logout */}
      <div className="density-padding border-t border-border">
        <button
          onClick={onLogout}
          className={`w-full flex items-center density-gap rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
          style={{ padding: "var(--density-padding-sm) var(--density-padding)" }}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
