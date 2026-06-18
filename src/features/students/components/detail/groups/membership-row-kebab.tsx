"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, ExternalLink, ArrowRightLeft, UserMinus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { MembershipRole } from "@/features/students/types";

type Props = {
  membershipId: string;
  groupId: string;
  groupName: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolSlug: string;
  currentRole: MembershipRole;
  onTransfer: () => void;
  onRemove: () => void;
};

export function MembershipRowKebab({
  groupId,
  groupName,
  schoolSlug,
  onTransfer,
  onRemove,
}: Props) {
  const t = useTranslations("Students");
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Actions for ${groupName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <a href={`/school/${schoolSlug}/groups/${groupId}`} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("detail.groups.actions.view")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setOpen(false);
            onTransfer();
          }}
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          {t("detail.groups.actions.transfer")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            setOpen(false);
            onRemove();
          }}
        >
          <UserMinus className="mr-2 h-4 w-4" />
          {t("detail.groups.actions.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
