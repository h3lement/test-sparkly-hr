import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminStatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  iconClassName?: string;
}

interface AdminStatsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function AdminStatsGrid({ children, columns = 4 }: AdminStatsGridProps) {
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  }[columns];

  return <div className={cn("grid gap-4", colClass)}>{children}</div>;
}

export function AdminStatCard({ icon, value, label, iconClassName }: AdminStatCardProps) {
  return (
    <div className="admin-stat-card">
      <div className="flex items-center gap-3">
        <div className={cn("admin-stat-icon bg-primary/10", iconClassName)}>
          {icon}
        </div>
        <div>
          <p className="admin-stat-value">{value}</p>
          <p className="admin-stat-label">{label}</p>
        </div>
      </div>
    </div>
  );
}
