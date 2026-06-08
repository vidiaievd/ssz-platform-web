"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  params?: Promise<{ locale: string; schoolSlug: string }>;
};

type Tab = {
  id: string;
  labelKey: string;
  href: (slug: string) => string;
  segment: string;
};

const TABS: Tab[] = [
  { id: "command-center", labelKey: "commandCenter", href: (s) => `/school/${s}/teachers`, segment: "/teachers" },
  { id: "substitutions", labelKey: "substitutions", href: (s) => `/school/${s}/teachers/substitutions`, segment: "/substitutions" },
  { id: "curriculum", labelKey: "curriculum", href: (s) => `/school/${s}/teachers/curriculum`, segment: "/curriculum" },
  { id: "forecast", labelKey: "forecast", href: (s) => `/school/${s}/teachers/forecast`, segment: "/forecast" },
];

export default function TeachersLayout({ children }: Props) {
  const t = useTranslations("Teachers");
  const pathname = usePathname();

  // Extract schoolSlug from pathname: /[locale]/school/[slug]/teachers/...
  const slugMatch = pathname?.match(/\/school\/([^/]+)\/teachers/);
  const schoolSlug = slugMatch?.[1] ?? "";

  function isActive(tab: Tab): boolean {
    if (!pathname) return false;
    if (tab.id === "command-center") {
      return pathname.includes("/teachers") && !TABS.slice(1).some((t2) => pathname.includes(t2.segment));
    }
    return pathname.includes(tab.segment);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section sub-tabs */}
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
                  {tab.id === "command-center" && t("tabs.command-center")}
                  {tab.id === "substitutions" && t("tabs.substitutions")}
                  {tab.id === "curriculum" && t("tabs.curriculum")}
                  {tab.id === "forecast" && t("tabs.forecast")}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
