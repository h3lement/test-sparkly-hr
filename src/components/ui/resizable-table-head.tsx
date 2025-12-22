import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnKey: string;
  width: number;
  onResizeStart: (columnKey: string, e: React.MouseEvent) => void;
  resizable?: boolean;
}

const ResizableTableHead = React.forwardRef<
  HTMLTableCellElement,
  ResizableTableHeadProps
>(({ className, columnKey, width, onResizeStart, resizable = true, children, style, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] relative group",
      className
    )}
    style={{ ...style, width: `${width}px`, minWidth: `${width}px` }}
    {...props}
  >
    {children}
    {resizable && (
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30 group-hover:bg-border/50 transition-colors"
        onMouseDown={(e) => onResizeStart(columnKey, e)}
        onClick={(e) => e.stopPropagation()}
      />
    )}
  </th>
));
ResizableTableHead.displayName = "ResizableTableHead";

export { ResizableTableHead };
