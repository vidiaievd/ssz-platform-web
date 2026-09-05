import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Table ────────────────────────────────────
   The one place that decides what a data table looks like: surface card
   (matches KPI/dashboard cards — a table row shouldn't blend into the page
   background it sits on), subtle header, hover row, dense uppercase column
   labels. Every feature table should render through this instead of hand-
   rolling <table> markup — that's how six different features ended up with
   six slightly different row heights and header styles.
─────────────────────────────────────────────── */

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }
>(({ className, wrapperClassName, ...props }, ref) => (
  <div
    className={cn(
      "w-full overflow-x-auto rounded-lg border border-border bg-card",
      wrapperClassName,
    )}
  >
    <table
      ref={ref}
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-(--ssz-bg-subtle)", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn(className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border last:border-0 transition-colors duration-100",
      "hover:bg-(--ssz-bg-subtle)",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    // The header/body divider lives here, not on the header's <tr>: under
    // border-collapse (which this Table uses), collapsing resolves borders
    // per cell, and a border set only at the row level doesn't survive that
    // resolution — verified in Storybook (UI/Table), where the row-level
    // border rendered with the right color/width in getComputedStyle and
    // was still invisible on screen: the cell's own (unset) border wins the
    // collapse regardless.
    //
    // text-secondary, not border-strong: this seam sits between the header
    // and a hovered first row, and both are bg-subtle. Screenshotted both
    // side by side (same story) — border-strong (L 0.83) against bg-subtle
    // (L 0.95) is a 0.12 gap that reads as no line at all once oklch hits
    // sRGB; text-secondary (L 0.46) is the first candidate that actually
    // shows.
    className={cn(
      "text-left px-4 py-[11px] whitespace-nowrap border-b border-(--ssz-text-secondary)",
      "text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-4 py-3.5 align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
