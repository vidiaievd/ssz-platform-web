"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export type TabKey =
  | "overview"
  | "groups"
  | "mastery"
  | "history"
  | "notes"
  | "payments"
  | "bonuses";

type Props = {
  activeTab: TabKey;
  activeGroupCount: number;
  /** A scheduler has no business reading one learner's results, so they get no tab. */
  showMastery: boolean;
  /**
   * Which tabs exist at all. A private tutor keeps overview and history: groups,
   * payments and bonuses describe a school's relationship with a learner, not a
   * tutor's (plan 59, phase 2).
   */
  tabs?: TabKey[];
};

const ALL_TABS: TabKey[] = [
  "overview",
  "groups",
  "mastery",
  "history",
  "notes",
  "payments",
  "bonuses",
];

export function StudentTabs({ activeTab, activeGroupCount, showMastery, tabs = ALL_TABS }: Props) {
  const shown = new Set(tabs);
  const t = useTranslations("Students");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <Tabs value={activeTab} onValueChange={setTab}>
      <TabsList className="overflow-x-auto shrink-0">
        {shown.has("overview") && (
          <TabsTrigger value="overview">{t("detail.tabs.overview")}</TabsTrigger>
        )}
        {shown.has("groups") && (
          <TabsTrigger value="groups">
            {t("detail.tabs.groups")}
            {activeGroupCount > 0 && (
              <Badge variant="muted" className="ml-1.5 text-[10px]">
                {activeGroupCount}
              </Badge>
            )}
          </TabsTrigger>
        )}
        {shown.has("mastery") && showMastery && (
          <TabsTrigger value="mastery">{t("detail.tabs.mastery")}</TabsTrigger>
        )}
        {shown.has("history") && (
          <TabsTrigger value="history">{t("detail.tabs.history")}</TabsTrigger>
        )}
        {shown.has("notes") && <TabsTrigger value="notes">{t("detail.tabs.notes")}</TabsTrigger>}
        {shown.has("payments") && (
          <TabsTrigger value="payments">{t("detail.tabs.payments")}</TabsTrigger>
        )}
        {shown.has("bonuses") && (
          <TabsTrigger value="bonuses">{t("detail.tabs.bonuses")}</TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
}
