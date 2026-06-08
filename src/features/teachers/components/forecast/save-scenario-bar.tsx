"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveScenario } from "../../api/mutations";
import { useForecastScenarioStore } from "../../stores/forecast-scenario-store";
import type { ForecastParams, ForecastResult } from "../../types";

type SaveScenarioBarProps = {
  params: ForecastParams;
  result: ForecastResult;
  schoolId: string;
};

export function SaveScenarioBar({ params, result, schoolId }: SaveScenarioBarProps) {
  const t = useTranslations("Teachers.forecast");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const { savedScenarios, addScenario, loadScenario } = useForecastScenarioStore();

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await saveScenario(schoolId, name.trim(), params);
      if (res.ok) {
        addScenario({
          scenarioId: `local-${Date.now()}`,
          name: name.trim(),
          params,
          result,
        });
        toast.success(t("saveScenario"));
        setName("");
      } else {
        toast.error(t("saveScenario"));
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Save form */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("saveScenario")}
          className="flex-1"
          aria-label={t("saveScenario")}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || !name.trim()}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            t("saveScenario")
          )}
        </Button>
      </div>

      {/* Saved scenarios list */}
      {savedScenarios.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-(--ssz-text-muted) uppercase tracking-wide">
            {t("scenarios")}
          </p>
          <ul className="space-y-1">
            {savedScenarios.map((s) => (
              <li key={s.scenarioId}>
                <button
                  type="button"
                  className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-accent/50 text-(--ssz-text-primary) transition-colors"
                  onClick={() => loadScenario(s)}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
