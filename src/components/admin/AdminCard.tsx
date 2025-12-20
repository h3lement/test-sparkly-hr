import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: ReactNode;
  className?: string;
}

interface AdminCardHeaderProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

interface AdminCardContentProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function AdminCard({ children, className }: AdminCardProps) {
  return <div className={cn("admin-card", className)}>{children}</div>;
}

export function AdminCardHeader({ title, children, className }: AdminCardHeaderProps) {
  return (
    <div className={cn("admin-card-header", className)}>
      {title && <h3 className="admin-card-title">{title}</h3>}
      {children}
    </div>
  );
}

export function AdminCardContent({ children, className, noPadding }: AdminCardContentProps) {
  return (
    <div className={cn(!noPadding && "admin-card-content", className)}>
      {children}
    </div>
  );
}
