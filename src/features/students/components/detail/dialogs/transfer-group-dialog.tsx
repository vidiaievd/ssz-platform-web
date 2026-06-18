"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";

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
import { transferGroup } from "@/features/students/api/mutations";
import { studentKeys } from "@/features/students/api/keys";
import type { MembershipDetail } from "@/features/students/types";

type GroupOption = {
  id: string;
  name: string;
  lang: string;
  level: string;
  scheduleSummary?: string;
};

type Props = {
  open: boolean;
  fromMembership: MembershipDetail;
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolSlug: string;
  availableGroups?: GroupOption[];
  onClose: () => void;
};

export function TransferGroupDialog({
  open,
  fromMembership,
  studentId,
  studentName,
  schoolId,
  availableGroups = [],
  onClose,
}: Props) {
  const t = useTranslations("Students");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return availableGroups.filter(
      (g) =>
        g.id !== fromMembership.groupId &&
        (!q ||
          g.name.toLowerCase().includes(q) ||
          g.lang.toLowerCase().includes(q) ||
          g.level.toLowerCase().includes(q)),
    );
  }, [availableGroups, query, fromMembership.groupId]);

  function handleTransfer() {
    if (!selectedId) return;
    const targetGroup = availableGroups.find((g) => g.id === selectedId);
    startTransition(async () => {
      const result = await transferGroup(
        schoolId,
        studentId,
        fromMembership.groupId,
        selectedId,
      );
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: studentKeys.list(schoolId) });
        onClose();
        router.refresh();
        toast.success(
          t("detail.transfer.success", {
            name: studentName,
            from: fromMembership.groupName,
            to: targetGroup?.name ?? selectedId,
          }),
        );
      } else {
        toast.error(
          t("detail.transfer.error", {
            name: studentName,
            from: fromMembership.groupName,
          }),
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("detail.transfer.title")}</DialogTitle>
          <DialogDescription>
            {t("detail.transfer.from")}: <strong>{fromMembership.groupName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t("detail.transfer.to")}</p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("detail.assign.search")}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border p-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("addToGroup.noGroups")}
              </p>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedId === g.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-subtle"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary leading-none">
                    <span>{g.lang.toUpperCase()}</span>
                    <span>{g.level}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    {g.scheduleSummary && (
                      <p className="text-xs text-(--ssz-text-secondary)">{g.scheduleSummary}</p>
                    )}
                  </div>
                  {selectedId === g.id && (
                    <span className="text-primary text-sm" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!selectedId || isPending}
            onClick={handleTransfer}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t("detail.transfer.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
