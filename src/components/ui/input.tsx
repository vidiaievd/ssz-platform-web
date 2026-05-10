import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Input ───────────────────────────────────── */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex w-full rounded-md border-[1.5px] px-3 py-[9px] text-sm",
        "bg-[var(--ssz-bg-surface)] text-[var(--ssz-text-primary)]",
        "placeholder:text-[var(--ssz-text-muted)]",
        "transition-[border-color,box-shadow] duration-base ease-out-ssz",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus-primary",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-[var(--ssz-bg-subtle)]",
        hasError
          ? "border-error focus-visible:shadow-focus-error"
          : "border-border hover:border-[var(--ssz-border-strong)]",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

/* ── Textarea ─────────────────────────────────── */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full rounded-md border-[1.5px] px-3 py-[9px] text-sm",
        "bg-[var(--ssz-bg-surface)] text-[var(--ssz-text-primary)]",
        "placeholder:text-[var(--ssz-text-muted)]",
        "transition-[border-color,box-shadow] duration-base ease-out-ssz",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus-primary",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "resize-y min-h-[80px] leading-relaxed",
        hasError
          ? "border-error focus-visible:shadow-focus-error"
          : "border-border hover:border-[var(--ssz-border-strong)]",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

/* ── Field wrapper ────────────────────────────── */
interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
}

const Field = ({ label, hint, error, required, htmlFor, children, className, ...props }: FieldProps) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--ssz-text-primary)]"
      >
        {label}
        {required && <span className="text-error ml-1" aria-hidden>*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-xs text-error">{error}</p>
    ) : hint ? (
      <p className="text-xs text-[var(--ssz-text-muted)]">{hint}</p>
    ) : null}
  </div>
);

export { Input, Textarea, Field };
