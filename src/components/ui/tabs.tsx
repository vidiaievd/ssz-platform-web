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
          "px-5 py-2.25 text-sm font-medium capitalize cursor-pointer",
          "border-b-2 -mb-0.5 transition-all duration-base ease-out-ssz",
          "focus-visible:outline-none focus-visible:shadow-focus-primary rounded-t-sm",
          active
            ? "border-primary text-primary-600"
            : "border-transparent text-(--ssz-text-secondary) hover:text-(--ssz-text-primary)",
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
