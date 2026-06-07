"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CapacityMeter } from "@/components/shared/operations";
import { cn } from "@/lib/utils";
import { addToGroup } from "@/features/students/api/mutations";
import { projectedCapacity } from "@/lib/groups/operations";
import type { StudentGroupRef } from "@/features/students/types";

type GroupCandidate = {
  id: string;
  name: string;
  lang: string;
  level: string;
  studentCount: number;
  capacity: { min: number; max: number };
  scheduleSummary?: string;
  /** Pre-computed: student's current groups' schedule overlaps with this group */
  hasClash?: boolean;
};

type Props = {
  open: boolean;
  onOpenChangeAction: (v: boolean) => void;
  schoolId: string;
  userId: string;
  studentName: string;
  currentGroups: StudentGroupRef[];
  candidates: GroupCandidate[];
};

export function AddToGroupDialog({
  open,
  onOpenChangeAction,
  schoolId,
  userId,
  studentName,
  currentGroups,
  candidates,
}: Props) {
  const t = useTranslations("Students");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clashAcknowledged, setClashAcknowledged] = useState(false);

  const currentGroupIds = new Set(currentGroups.map((g) => g.id));

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.lang.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const projection = selected
    ? projectedCapacity(
        {
          id: selected.id,
          status: "active",
          primaryTeacherId: null,
          coPrimaryTeacherId: null,
          slots: [],
          studentCount: selected.studentCount,
          capacity: selected.capacity,
        },
        1,
      )
    : null;

  const hasClash = selected?.hasClash ?? false;
  const overCap = projection?.over ?? false;
  const needsConfirm = hasClash && !clashAcknowledged;

  function handleClose() {
    setQuery("");
    setSelectedId(null);
    setClashAcknowledged(false);
    onOpenChangeAction(false);
  }

  function handleSubmit() {
    if (!selectedId) return;

    startTransition(async () => {
      const override = hasClash || overCap;
      const result = await addToGroup(schoolId, selectedId, userId, override);
      if (result.ok) {
        const warnings =
          (result as { warnings?: Array<{ type: string }> }).warnings ?? [];
        const name = selected?.name ?? selectedId;
        if (warnings.length > 0) {
          toast(
            t("addToGroup.addedWithWarning", {
              name: studentName,
              group: name,
            }),
            { description: t("addToGroup.clashAcknowledged") },
          );
        } else {
          toast.success(
            t("addToGroup.added", { name: studentName, group: name }),
          );
        }
        router.refresh();
        handleClose();
      } else {
        if ((result as { conflicts?: unknown }).conflicts) {
          toast.error(t("addToGroup.clashBlocked"));
        } else {
          toast.error(t("addToGroup.failed"));
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("addToGroup.title", { name: studentName })}
          </DialogTitle>
          <DialogDescription>{t("addToGroup.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder={t("addToGroup.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label={t("addToGroup.searchAriaLabel")}
            />
          </div>

          {/* Group list */}
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border p-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("addToGroup.noGroups")}
              </p>
            ) : (
              filtered.map((g) => {
                const proj = projectedCapacity(
                  {
                    id: g.id,
                    status: "active",
                    primaryTeacherId: null,
                    coPrimaryTeacherId: null,
                    slots: [],
                    studentCount: g.studentCount,
                    capacity: g.capacity,
                  },
                  1,
                );
                const alreadyIn = currentGroupIds.has(g.id);
                const isSelected = selectedId === g.id;

                return (
                  <button
                    key={g.id}
                    disabled={alreadyIn}
                    onClick={() => {
                      setSelectedId(isSelected ? null : g.id);
                      setClashAcknowledged(false);
                    }}
                    className={cn(
                      "w-full rounded px-3 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent",
                      alreadyIn && "opacity-40 cursor-not-allowed",
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{g.name}</p>
                        {g.scheduleSummary && (
                          <p className="text-xs text-muted-foreground">
                            {g.scheduleSummary}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="muted" className="text-xs">
                          {g.lang.toUpperCase()} {g.level}
                        </Badge>
                        {alreadyIn && (
                          <Badge variant="muted" className="text-xs bg-muted">
                            Enrolled
                          </Badge>
                        )}
                        {g.hasClash && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-amber-500"
                            aria-label="Schedule clash"
                          />
                        )}
                        <CapacityMeter
                          count={g.studentCount}
                          min={g.capacity.min}
                          max={g.capacity.max}
                          projected={isSelected ? proj.projected : undefined}
                          size="sm"
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Clash warning */}
          {selected && hasClash && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-900/20"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                aria-hidden
              />
              <div className="space-y-2 text-sm">
                <p className="text-amber-800 dark:text-amber-300">
                  {t("addToGroup.clashWarning", { name: selected.name })}
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clashAcknowledged}
                    onChange={(e) => setClashAcknowledged(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs">
                    {t("addToGroup.clashConfirm")}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Over-capacity warning */}
          {selected && overCap && (
            <p
              role="alert"
              className="text-xs text-amber-700 dark:text-amber-400"
            >
              {t("addToGroup.overCapacity", {
                max: selected.capacity.max,
                projected: projection!.projected,
              })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedId || needsConfirm || isPending}
          >
            {isPending && (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            )}
            {t("addToGroup.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
