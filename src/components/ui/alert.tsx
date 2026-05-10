import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── Alert ───────────────────────────────────── */
const alertVariants = cva(
  "flex gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        success: "bg-success-50 border-success-300 text-success-700",
        warning: "bg-warning-50 border-warning-300 text-warning-700",
        error:   "bg-error-50   border-error-300   text-error-700",
        info:    "bg-info-50    border-info-300     text-info-700",
        default: "bg-[var(--ssz-bg-subtle)] border-border text-[var(--ssz-text-primary)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  title?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, title, children, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  )
);
Alert.displayName = "Alert";

/* ── Toast (minimal) ─────────────────────────── */
interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "error";
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", onClose, children, ...props }, ref) => {
    const bg: Record<string, string> = {
      default: "bg-neutral-900",
      success: "bg-success-500",
      error:   "bg-error-500",
    };
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-white",
          "shadow-lg animate-fade-in w-fit max-w-sm",
          bg[variant],
          className
        )}
        {...props}
      >
        <span className="flex-1">{children}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="opacity-60 hover:opacity-100 transition-opacity text-base leading-none ml-2"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    );
  }
);
Toast.displayName = "Toast";

export { Alert, alertVariants, Toast };
