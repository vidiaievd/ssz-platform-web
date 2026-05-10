import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── Badge ─────────────────────────────────── */
const badgeVariants = cva(
  "inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.01em] rounded-full px-[9px] py-[2px] select-none",
  {
    variants: {
      variant: {
        primary:   "bg-primary-100 text-primary-700",
        success:   "bg-success-100 text-success-700",
        warning:   "bg-warning-100 text-warning-700",
        error:     "bg-error-100 text-error-700",
        info:      "bg-info-100 text-info-700",
        muted:     "bg-neutral-100 text-neutral-600 border border-neutral-200",
        solid:     "bg-primary text-white",
        level:     "bg-primary text-white font-extrabold",
      },
    },
    defaultVariants: { variant: "primary" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = "Badge";

/* ── StatusBadge (lesson/course status) ─────── */
type LessonStatus = "done" | "active" | "new" | "locked";

const statusConfig: Record<LessonStatus, { label: string; variant: BadgeProps["variant"] }> = {
  done:   { label: "Done",        variant: "success" },
  active: { label: "In Progress", variant: "primary" },
  new:    { label: "New",         variant: "warning"  },
  locked: { label: "Locked",      variant: "muted"   },
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: LessonStatus;
}

const StatusBadge = ({ status, className, ...props }: StatusBadgeProps) => {
  const { label, variant } = statusConfig[status];
  return (
    <Badge variant={variant} className={className} {...props}>
      {label}
    </Badge>
  );
};

export { Badge, badgeVariants, StatusBadge };
export type { LessonStatus };
