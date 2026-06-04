'use client';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useGroupCreateWizardStore } from '../../stores/create-wizard-store';
import type { CEFR } from '../../stores/create-wizard-store';

const CEFR_LEVELS: CEFR[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function StepDetails() {
  const { name, lang, level, mode, capacity, startDate, endDate, setField } =
    useGroupCreateWizardStore();

  const capError =
    capacity.min < 0
      ? 'Min must be ≥ 0'
      : capacity.max < 1
        ? 'Max must be ≥ 1'
        : capacity.max < capacity.min
          ? 'Max must be ≥ min'
          : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">Group details</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-0.5">
          Name, capacity, language and dates.
        </p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wiz-name">
          Group name <span className="text-error-500">*</span>
        </Label>
        <Input
          id="wiz-name"
          value={name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Norwegian A2 — Spring 2026"
          maxLength={100}
          className={cn(!name.trim() && 'border-error-300')}
        />
        {!name.trim() && (
          <p className="text-xs text-error-600">Name is required.</p>
        )}
      </div>

      {/* Language + Level */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiz-lang">Language code</Label>
          <Input
            id="wiz-lang"
            value={lang}
            onChange={(e) => setField('lang', e.target.value.toLowerCase())}
            placeholder="en, nb, uk…"
            maxLength={5}
            className="uppercase"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Level</Label>
          <Select value={level} onValueChange={(v) => setField('level', v as CEFR)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CEFR_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mode */}
      <div className="flex flex-col gap-1.5">
        <Label>Mode</Label>
        <div
          role="radiogroup"
          aria-label="Group mode"
          className="flex rounded-md border border-input overflow-hidden"
        >
          {(['online', 'in-person'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setField('mode', m)}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                mode === m
                  ? 'bg-primary text-white'
                  : 'bg-background text-(--ssz-text-secondary) hover:bg-muted',
                m === 'in-person' && 'border-l border-input',
              )}
            >
              {m === 'online' ? 'Online' : 'In-person'}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity */}
      <div className="flex flex-col gap-1.5">
        <Label>Capacity</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-(--ssz-text-muted)">Min students</span>
            <Input
              type="number"
              min={0}
              value={capacity.min}
              onChange={(e) =>
                setField('capacity', { ...capacity, min: Math.max(0, Number(e.target.value)) })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-(--ssz-text-muted)">Max students</span>
            <Input
              type="number"
              min={1}
              value={capacity.max}
              onChange={(e) =>
                setField('capacity', { ...capacity, max: Math.max(1, Number(e.target.value)) })
              }
            />
          </div>
        </div>
        {capError && <p className="text-xs text-error-600">{capError}</p>}
      </div>

      {/* Dates (optional) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiz-start">Start date (optional)</Label>
          <Input
            id="wiz-start"
            type="date"
            value={startDate}
            onChange={(e) => setField('startDate', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiz-end">End date (optional)</Label>
          <Input
            id="wiz-end"
            type="date"
            value={endDate}
            onChange={(e) => setField('endDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
