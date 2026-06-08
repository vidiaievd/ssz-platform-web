"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { RoomLoad } from "../../types";

type RoomUtilizationListProps = {
  rooms: RoomLoad[];
};

export function RoomUtilizationList({ rooms }: RoomUtilizationListProps) {
  const t = useTranslations("Teachers.commandCenter.roomUtilization");

  if (!rooms.length) return null;

  return (
    <div role="region" aria-label={t("title")} className="space-y-2">
      <h3 className="text-xs font-semibold text-(--ssz-text-muted) uppercase tracking-wide">
        {t("title")}
      </h3>
      <ul className="space-y-1.5">
        {rooms.map((room) => (
          <li key={room.room} className="flex items-center gap-3">
            <span className="w-20 truncate text-sm font-medium text-(--ssz-text-primary) shrink-0">
              {room.room}
            </span>
            <div
              role="progressbar"
              aria-valuenow={room.utilizationPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${room.room}: ${room.utilizationPct}%`}
              className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  room.utilizationPct >= 90
                    ? "bg-error-500"
                    : room.utilizationPct >= 75
                      ? "bg-warning-500"
                      : "bg-success-500",
                )}
                style={{ width: `${Math.min(100, room.utilizationPct)}%` }}
              />
            </div>
            <span
              className={cn(
                "w-10 text-right text-xs font-semibold tabular-nums shrink-0",
                room.utilizationPct >= 90
                  ? "text-error-600 dark:text-error-400"
                  : room.utilizationPct >= 75
                    ? "text-warning-600 dark:text-warning-400"
                    : "text-(--ssz-text-muted)",
              )}
            >
              {room.utilizationPct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
