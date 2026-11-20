import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── Alert ───────────────────────────────────── */
const alertVariants = cva(
  "flex gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        // Theme-aware aliases (globals.css): the scale tokens are tuned for light surfaces only.
        success: "bg-[var(--ssz-alert-success-bg)] border-[var(--ssz-alert-success-border)] text-[var(--ssz-alert-success-fg)]",
        warning: "bg-[var(--ssz-alert-warning-bg)] border-[var(--ssz-alert-warning-border)] text-[var(--ssz-alert-warning-fg)]",
        error:   "bg-[var(--ssz-alert-error-bg)] border-[var(--ssz-alert-error-border)] text-[var(--ssz-alert-error-fg)]",
        info:    "bg-[var(--ssz-alert-info-bg)] border-[var(--ssz-alert-info-border)] text-[var(--ssz-alert-info-fg)]",
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
