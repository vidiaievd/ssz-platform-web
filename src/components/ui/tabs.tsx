import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Tabs ─────────────────────────────────────── */
interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (v: string) => void;
}>({
  value: "",
  onValueChange: () => {},
});

const Tabs = ({
  value,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={cn("flex flex-col", className)} {...props}>
      {children}
    </div>
  </TabsContext.Provider>
);

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn("flex border-b-2 border-border gap-0", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    const active = ctx.value === value;
    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={active}
        onClick={() => ctx.onValueChange(value)}
        className={cn(
          "px-5 py-2.25 text-sm capitalize cursor-pointer",
          "border-b-2 -mb-0.5 transition-all duration-base ease-out-ssz",
          "focus-visible:outline-none focus-visible:shadow-focus-primary rounded-t-sm",
          // Two separate signals, not one: the label goes dark and bold
          // (emphasis, same as any selected state), and the underline stays
          // the brand accent — a small deliberate flourish, not the thing
          // doing the "this one is active" work by itself. Coloring the
          // label too, as the previous version did, made both jobs the
          // underline's, and the label read as merely tinted rather than
          // selected.
          active
            ? "border-primary text-(--ssz-text-primary) font-semibold"
            : "border-transparent text-(--ssz-text-secondary) font-medium hover:text-(--ssz-text-primary)",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn("mt-6 animate-fade-in", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

/* ── Breadcrumb ───────────────────────────────── */
interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps extends React.HTMLAttributes<HTMLCanvasElement> {
  items: BreadcrumbItem[];
}

const Breadcrumb = ({ items, className, ...props }: BreadcrumbProps) => (
  <nav
    aria-label="Breadcrumb"
    className={cn("flex items-center gap-1.5 text-sm", className)}
    {...props}
  >
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (
        <React.Fragment key={i}>
          {isLast ? (
            <span className="text-(--ssz-text-primary) font-medium">
              {item.label}
            </span>
          ) : (
            <>
              <button
                onClick={item.onClick}
                className="text-(--ssz-text-link) hover:underline transition-colors"
              >
                {item.label}
              </button>
              <ChevronRight className="size-3.5 text-(--ssz-text-muted)" />
            </>
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

/* inline minimal icon to avoid extra dep */
const ChevronRight = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export { Tabs, TabsList, TabsTrigger, TabsContent, Breadcrumb };
