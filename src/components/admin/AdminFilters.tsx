import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdminFiltersProps {
  children: ReactNode;
}

interface AdminSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface AdminCountBadgeProps {
  count: number;
  singular: string;
  plural?: string;
}

export function AdminFilters({ children }: AdminFiltersProps) {
  return <div className="admin-filters">{children}</div>;
}

export function AdminSearch({ value, onChange, placeholder = "Search..." }: AdminSearchProps) {
  return (
    <div className="admin-search-wrapper">
      <Search className="admin-search-icon" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-search-input"
      />
    </div>
  );
}

export function AdminCountBadge({ count, singular, plural }: AdminCountBadgeProps) {
  const label = count === 1 ? singular : (plural || `${singular}s`);
  return (
    <span className="admin-count-badge">
      {count} {label}
    </span>
  );
}
