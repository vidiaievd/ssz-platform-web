"use client";

import { RefreshCw, Target, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { useSrsSessionStore } from "../../stores/srs-session-store";
import { LimitReachedBanner } from "./limit-banner";

function formatTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

interface StatTileProps {
  value: string;
  label: string;
  className?: string;
}

function StatTile({ value, label, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-[var(--ssz-radius-lg)] border border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)] px-4 py-4 shadow-[var(--ssz-shadow-sm)]",
        className,
      )}
    >
      <span className="text-2xl font-bold text-[var(--ssz-text-primary)]">
        {value}
      </span>
      <span className="text-xs text-[var(--ssz-text-muted)]">{label}</span>
    </div>
  );
}

export function SessionSummary() {
  const t = useTranslations("Srs");
  const {
    reviewedCount,
    correctCount,
    againIds,
    startedAt,
    endedAt,
    limitHit,
    queueMisses,
  } = useSrsSessionStore();

  const elapsed = startedAt && endedAt ? endedAt - startedAt : 0;
  const accuracy =
    reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;
  const missCount = againIds.length;

  return (
    <div className="flex flex-col gap-6">
      {limitHit && <LimitReachedBanner />}

      <div className="flex flex-col items-center gap-4 text-center">
        {limitHit ? (
          <Target
            className="h-14 w-14 text-[var(--ssz-color-info-700)]"
            aria-hidden
          />
        ) : (
          <Trophy
            className="h-14 w-14 text-[var(--ssz-color-secondary-500)]"
            aria-hidden
          />
        )}

        <div className="space-y-1">
          <h1 className="text-[28px] font-bold text-[var(--ssz-text-primary)]">
            {limitHit ? t("limit.title") : t("summary.title")}
          </h1>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          value={String(reviewedCount)}
          label={t("summary.cardsReviewed")}
        />
        <StatTile value={`${accuracy}%`} label={t("summary.accuracy")} />
        <StatTile value={formatTime(elapsed)} label={t("summary.timeSpent")} />
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        {missCount > 0 && !limitHit && (
          <Button onClick={queueMisses} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            {t("summary.reviewMisses", { count: missCount })}
          </Button>
        )}
        <Button
          asChild
          variant={missCount > 0 && !limitHit ? "outline" : "primary"}
        >
          <Link href="/student/enrolled">{t("summary.done")}</Link>
        </Button>
      </div>
    </div>
  );
}
