import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-ui font-semibold transition-all duration-base ease-out-ssz",
    "focus-visible:outline-none focus-visible:shadow-focus-primary",
    "disabled:pointer-events-none disabled:opacity-40",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-primary text-white",
          "hover:bg-primary-700 active:bg-primary-800 active:scale-[0.98]",
        ].join(" "),
        secondary: [
          "bg-[oklch(0.52_0.11_82)] text-white",
          "hover:bg-[oklch(0.44_0.10_82)] active:bg-[oklch(0.36_0.09_82)] active:scale-[0.98]",
        ].join(" "),
        outline: [
          "border-[1.5px] border-primary text-primary bg-transparent",
          "hover:bg-primary-50 active:bg-primary-100",
        ].join(" "),
        ghost: [
          "border-[1.5px] border-border text-[var(--ssz-text-secondary)] bg-transparent",
          "hover:bg-[var(--ssz-bg-subtle)] hover:text-[var(--ssz-text-primary)]",
        ].join(" "),
        danger: [
          "bg-error text-white",
          "hover:bg-error-700 active:scale-[0.98]",
        ].join(" "),
        link: [
          "text-[var(--ssz-text-link)] underline-offset-4 hover:underline",
          "p-0 h-auto bg-transparent",
        ].join(" "),
      },
      // Each size gets its own radius rather than reusing --radius-sm/lg: those
      // tokens also back cards (16px) and modals (24px), and a button sized to
      // match a card's roundness reads as over-rounded at button scale — the
      // design's own button-radius progression (7/8/10/12px by size) is a
      // distinct, smaller scale on purpose.
      size: {
        sm: "text-sm px-[14px] py-[6px] rounded-[8px]",
        md: "text-sm px-5 py-[9px] rounded-[10px]",
        lg: "text-base px-7 py-3 rounded-[12px]",
        icon: "size-9 rounded-[10px] p-0",
        "icon-sm": "size-7 rounded-[8px] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin-slow size-4"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="8" cy="8" r="6"
                stroke="currentColor" strokeWidth="2"
                strokeDasharray="20 18" strokeLinecap="round"
              />
            </svg>
            {children}
          </>
        ) : children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
