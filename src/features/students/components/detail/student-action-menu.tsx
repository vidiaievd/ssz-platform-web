"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, GraduationCap, Archive, Trash2, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RemoveFromSchoolDialog } from "./dialogs/remove-from-school-dialog";
import { archiveStudent } from "@/features/students/api/mutations";

type Props = {
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolSlug: string;
  activeGroupCount: number;
  isArchived?: boolean;
  isOwner: boolean;
};

export function StudentActionMenu({
  studentId,
  studentName,
  schoolId,
  schoolSlug,
  activeGroupCount,
  isArchived = false,
  isOwner,
}: Props) {
  const t = useTranslations("Students");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  function handleArchive() {
    startTransition(async () => {
      await archiveStudent(schoolId, studentId, !isArchived);
      router.refresh();
      toast.success(isArchived ? t("detail.actions.unarchive") : t("detail.actions.archive"));
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <a href={`/school/${schoolSlug}/students/${studentId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("detail.actions.editInfo")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/school/${schoolSlug}/students/${studentId}/level`}>
              <GraduationCap className="mr-2 h-4 w-4" />
              {t("detail.actions.changeLevel")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleArchive} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            {isArchived ? t("detail.actions.unarchive") : t("detail.actions.archive")}
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setRemoveDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("detail.actions.removeFromSchool")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveFromSchoolDialog
        open={removeDialogOpen}
        studentId={studentId}
        studentName={studentName}
        schoolId={schoolId}
        schoolSlug={schoolSlug}
        activeGroupCount={activeGroupCount}
        onClose={() => setRemoveDialogOpen(false)}
      />
    </>
  );
}
