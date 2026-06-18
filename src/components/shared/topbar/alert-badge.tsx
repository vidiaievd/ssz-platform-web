"use client";

import { useState, useEffect, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ackAlert } from "@/features/teachers/api/mutations";
import { useCommandCenter } from "@/features/teachers/api/use-command-center";
import { teacherKeys } from "@/features/teachers/api/keys";

type AlertBadgeProps = {
  schoolId?: string;
};

const POLL_INTERVAL_MS = 60_000;

export function AlertBadge({ schoolId }: AlertBadgeProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Teachers.alerts");
  const queryClient = useQueryClient();

  const { data } = useCommandCenter(schoolId ?? "", {
    refetchInterval: schoolId ? POLL_INTERVAL_MS : undefined,
  });
  const alerts = data?.violations ?? [];

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleMouse(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-alert-badge]")) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleMouse);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouse);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const openAlerts = alerts.filter((a) => a.state === "raised");
  const count = openAlerts.length;
  const hasDanger = openAlerts.some((a) => a.severity === "danger");

  function handleAck(alertId: string) {
    if (!schoolId) return;
    startTransition(async () => {
      const res = await ackAlert(schoolId, alertId);
      if (res.ok) {
        queryClient.setQueryData(teacherKeys.commandCenter(schoolId), (old: typeof data) =>
          old
            ? {
                ...old,
                violations: old.violations.map((a) =>
                  a.alertId === alertId ? { ...a, state: "acknowledged" as const } : a,
                ),
              }
            : old,
        );
      } else {
        toast.error(t("ackError"));
      }
    });
  }

  return (
    <div className="relative" data-alert-badge>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `${t("title")}: ${count}` : t("title")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative"
      >
        <TriangleAlert className="size-5" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 rounded-full",
              "flex items-center justify-center text-[10px] font-bold text-white px-1",
              hasDanger ? "bg-error-500" : "bg-warning-500",
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          aria-live="polite"
          className={cn(
            "absolute right-0 top-full mt-2 w-80 z-50",
            "rounded-xl border border-border bg-card shadow-lg",
            "overflow-hidden",
          )}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-(--ssz-text-primary)">{t("title")}</h2>
            {count > 0 && (
              <span className="text-xs text-(--ssz-text-muted)">
                {count} {t("open")}
              </span>
            )}
          </div>

          {openAlerts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-(--ssz-text-muted) text-center">
              {t("empty")}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {openAlerts.map((alert) => (
                <li
                  key={alert.alertId}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <span
                    className={cn(
                      "mt-1 inline-block size-2 rounded-full shrink-0",
                      alert.severity === "danger" ? "bg-error-500" : "bg-warning-500",
                    )}
                    aria-hidden="true"
                  />
                  <p className="text-sm text-(--ssz-text-primary) leading-snug flex-1">
                    {alert.message}
                  </p>
                  {schoolId && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAck(alert.alertId)}
                      aria-label={t("ackLabel")}
                      className={cn(
                        "shrink-0 rounded p-1 text-(--ssz-text-muted)",
                        "hover:text-(--ssz-text-primary) hover:bg-accent/50 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
