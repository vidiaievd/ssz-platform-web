"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAvailability } from "../../api/mutations";
import type { AvailabilityBlock, Weekday, AvailabilityType } from "../../types";

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type AvailabilityEditorProps = {
  schoolId: string;
  teacherId: string;
  initialBlocks: AvailabilityBlock[];
  onSaved?: () => void;
};

type DraftBlock = Omit<AvailabilityBlock, "blockId" | "teacherId" | "validFrom" | "validTo"> & {
  draftId: string;
};

function toDraft(b: AvailabilityBlock): DraftBlock {
  return {
    draftId: b.blockId,
    dayOfWeek: b.dayOfWeek,
    startTime: b.startTime,
    endTime: b.endTime,
    type: b.type,
    recurring: b.recurring,
  };
}

let draftCounter = 0;
function newDraftId() {
  return `draft-${++draftCounter}`;
}

export function AvailabilityEditor({
  schoolId,
  teacherId,
  initialBlocks,
  onSaved,
}: AvailabilityEditorProps) {
  const t = useTranslations("Teachers.availability");
  const [blocks, setBlocks] = useState<DraftBlock[]>(initialBlocks.map(toDraft));
  const [isSaving, startSave] = useTransition();

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      {
        draftId: newDraftId(),
        dayOfWeek: "Mon",
        startTime: "09:00",
        endTime: "17:00",
        type: "available",
        recurring: true,
      },
    ]);
  }

  function removeBlock(draftId: string) {
    setBlocks((prev) => prev.filter((b) => b.draftId !== draftId));
  }

  function updateBlock(draftId: string, patch: Partial<DraftBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.draftId === draftId ? { ...b, ...patch } : b)),
    );
  }

  function handleSave() {
    startSave(async () => {
      const payload: AvailabilityBlock[] = blocks.map((b, i) => ({
        blockId: b.draftId.startsWith("draft-") ? `new-${i}` : b.draftId,
        teacherId,
        dayOfWeek: b.dayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
        type: b.type,
        recurring: b.recurring,
        validFrom: null,
        validTo: null,
      }));

      const result = await updateAvailability(schoolId, teacherId, payload);
      if (result.ok) {
        toast.success(t("saveButton"));
        onSaved?.();
      } else {
        toast.error(t("saveButton"));
      }
    });
  }

  return (
    <div className="space-y-3" aria-label={t("saveButton")}>
      <div className="space-y-2">
        {blocks.map((block) => (
          <div
            key={block.draftId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            {/* Day */}
            <Select
              value={block.dayOfWeek}
              onValueChange={(v) => updateBlock(block.draftId, { dayOfWeek: v as Weekday })}
            >
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start time */}
            <div className="flex items-center gap-1">
              <Label className="sr-only">Start</Label>
              <Input
                type="time"
                value={block.startTime}
                onChange={(e) => updateBlock(block.draftId, { startTime: e.target.value as AvailabilityBlock["startTime"] })}
                className="w-28 h-8 text-sm"
              />
            </div>

            <span className="text-(--ssz-text-muted) text-sm">—</span>

            {/* End time */}
            <div className="flex items-center gap-1">
              <Label className="sr-only">End</Label>
              <Input
                type="time"
                value={block.endTime}
                onChange={(e) => updateBlock(block.draftId, { endTime: e.target.value as AvailabilityBlock["endTime"] })}
                className="w-28 h-8 text-sm"
              />
            </div>

            {/* Type */}
            <Select
              value={block.type}
              onValueChange={(v) => updateBlock(block.draftId, { type: v as AvailabilityType })}
            >
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t("available")}</SelectItem>
                <SelectItem value="preferred">{t("preferred")}</SelectItem>
                <SelectItem value="unavailable">{t("unavailable")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Remove */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 ml-auto text-(--ssz-text-muted) hover:text-error-600"
              aria-label="Remove"
              onClick={() => removeBlock(block.draftId)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBlock}
          disabled={isSaving}
        >
          <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
          {t("available")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
          {t("saveButton")}
        </Button>
      </div>
    </div>
  );
}
