import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function AdminEmptyState({ icon: Icon, title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="admin-empty-state">
      <Icon className="admin-empty-icon" />
      <h3 className="admin-empty-title">{title}</h3>
      {description && <p className="admin-empty-description">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AdminLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="admin-loading">
      <div className="admin-loading-spinner" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
