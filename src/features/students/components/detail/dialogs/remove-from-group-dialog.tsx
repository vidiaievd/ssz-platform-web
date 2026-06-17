"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { removeFromGroup } from "@/features/students/api/mutations";
import type { MembershipDetail } from "@/features/students/types";

type Props = {
  open: boolean;
  membership: MembershipDetail;
  studentName: string;
  schoolId: string;
  onClose: () => void;
};

export function RemoveFromGroupDialog({ open, membership, studentName, schoolId, onClose }: Props) {
  const t = useTranslations("Students");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeFromGroup(schoolId, membership.groupId, membership.id);
      if (result.ok) {
        onClose();
        router.refresh();
        toast.success(
          t("detail.remove.group.success", { name: studentName, group: membership.groupName }),
          {
            action: {
              label: t("detail.remove.group.undo"),
              onClick: () => {
                // Undo is fire-and-forget; a full undo would need to re-POST membership
                toast.info("Undo is not yet supported.");
              },
            },
          },
        );
      } else {
        toast.error(t("detail.transfer.error", { name: studentName, from: membership.groupName }));
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("detail.remove.group.heading", {
              name: studentName,
              group: membership.groupName,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("detail.remove.group.body", {
              name: studentName,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleRemove();
            }}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t("detail.remove.group.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
