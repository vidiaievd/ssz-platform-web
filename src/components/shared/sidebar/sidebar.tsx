"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarSection } from "./sidebar-section";
import type { NavSection } from "./types";

type SidebarProps = {
  sections: NavSection[];
  /** When provided, renders a school-type pill in the sidebar footer. */
  schoolType?: 'online' | 'hybrid';
};

export function Sidebar({ sections, schoolType }: SidebarProps) {
  const t = useTranslations("Common");
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable;
      if (e.key === "[" && !editable && !e.metaKey && !e.ctrlKey) {
        toggleSidebar();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [toggleSidebar]);

  return (
    <TooltipProvider>
      <aside
        aria-label={t("appName")}
        className={cn(
          "hidden md:flex flex-col h-full border-r border-border bg-card",
          "transition-[width] duration-200 ease-in-out overflow-hidden shrink-0",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-2.5 border-b border-border shrink-0",
            collapsed ? "justify-center px-3.5 py-4.5" : "px-4 py-4.5",
          )}
        >
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-primary">
            <span className="text-[11px] font-extrabold text-white tracking-tighter">
              SSZ
            </span>
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-(--ssz-text-primary) tracking-tight leading-tight">
                SSZ Learn
              </div>
              <div className="text-[11px] text-(--ssz-text-muted) leading-tight">
                Language Platform
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 gap-4 py-4 overflow-y-auto overflow-x-hidden">
          <nav className="flex flex-col gap-6 px-2">
            {sections.map((section, i) => (
              <SidebarSection key={i} {...section} collapsed={collapsed} />
            ))}
          </nav>
        </div>
        <div className="border-t border-border p-2 flex flex-col gap-1">
          {schoolType && !collapsed && (
            <div className="px-2 py-1">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">
                {schoolType === 'hybrid' ? 'Hybrid' : 'Online only'}
              </span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center rounded-md px-2 py-2 text-sm text-(--ssz-text-secondary)",
              "hover:bg-accent hover:text-accent-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
