"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { cn } from "@/lib/utils";

type Tab = {
  id: string;
  segment: string;
  href: (slug: string) => string;
};

const TABS: Tab[] = [
  { id: "overview",    segment: "",            href: (s) => `/school/${s}/scheduling` },
  { id: "cover",       segment: "/cover",      href: (s) => `/school/${s}/scheduling/cover` },
  { id: "curriculum",  segment: "/curriculum", href: (s) => `/school/${s}/scheduling/curriculum` },
  { id: "forecast",    segment: "/forecast",   href: (s) => `/school/${s}/scheduling/forecast` },
];

type Props = { children: ReactNode };

export default function SchedulingLayout({ children }: Props) {
  const t = useTranslations("Scheduling");
  const pathname = usePathname();

  const slugMatch = pathname?.match(/\/school\/([^/]+)\/scheduling/);
  const schoolSlug = slugMatch?.[1] ?? "";

  function isActive(tab: Tab): boolean {
    if (!pathname) return false;
    const base = `/school/${schoolSlug}/scheduling`;
    if (tab.id === "overview") {
      return pathname === base || pathname.endsWith("/scheduling");
    }
    return pathname.includes(`${base}${tab.segment}`);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card shrink-0">
        <div className="px-6">
          <nav
            className="flex gap-1 -mb-px"
            role="tablist"
            aria-label={t("sectionTitle")}
          >
            {TABS.map((tab) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.id}
                  href={tab.href(schoolSlug)}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    "whitespace-nowrap",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) hover:border-border",
                  )}
                >
                  {tab.id === "overview" && t("tabs.overview")}
                  {tab.id === "cover" && t("tabs.cover")}
                  {tab.id === "curriculum" && t("tabs.curriculum")}
                  {tab.id === "forecast" && t("tabs.forecast")}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
