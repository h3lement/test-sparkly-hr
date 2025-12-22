import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminTableProps {
  children: ReactNode;
  className?: string;
}

interface AdminTableHeaderProps {
  children: ReactNode;
}

interface AdminTableRowProps {
  children: ReactNode;
  inactive?: boolean;
  onClick?: () => void;
  className?: string;
  id?: string;
  index?: number; // For zebra striping
}

interface AdminTableCellProps {
  children: ReactNode;
  header?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export function AdminTable({ children, className }: AdminTableProps) {
  return <table className={cn("admin-table", className)}>{children}</table>;
}

export function AdminTableHeader({ children }: AdminTableHeaderProps) {
  return (
    <thead>
      <tr className="admin-table-header">{children}</tr>
    </thead>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function AdminTableRow({ children, inactive, onClick, className, id, index }: AdminTableRowProps) {
  const isEvenRow = index !== undefined ? index % 2 === 0 : false;
  
  return (
    <tr
      id={id}
      className={cn(
        "transition-all duration-200 ease-out hover:bg-primary/5 hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.1)]",
        isEvenRow ? "bg-card" : "bg-secondary/20",
        inactive && "opacity-60",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({ children, header, align = "left", className }: AdminTableCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  if (header) {
    return <th className={cn("admin-table-th", alignClass, className)}>{children}</th>;
  }

  return <td className={cn("admin-table-td", alignClass, className)}>{children}</td>;
}
