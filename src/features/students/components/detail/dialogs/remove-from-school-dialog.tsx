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
import { removeFromSchool } from "@/features/students/api/mutations";

type Props = {
  open: boolean;
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolSlug: string;
  activeGroupCount: number;
  onClose: () => void;
};

export function RemoveFromSchoolDialog({
  open,
  studentId,
  studentName,
  schoolId,
  schoolSlug,
  activeGroupCount,
  onClose,
}: Props) {
  const t = useTranslations("Students");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeFromSchool(schoolId, studentId);
      if (result.ok) {
        onClose();
        router.push(`/school/${schoolSlug}/students`);
      } else {
        toast.error("Failed to remove from school. Please try again.");
      }
    });
  }

  const body =
    activeGroupCount > 0
      ? t("detail.remove.school.bodyWithGroups", { name: studentName, n: activeGroupCount })
      : t("detail.remove.school.bodyNoGroups", { name: studentName });

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("detail.remove.school.heading", { name: studentName })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{body}</p>
              <p className="font-medium text-foreground">{t("detail.remove.school.irreversible")}</p>
            </div>
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
            {t("detail.remove.school.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
