'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Curated fallback used when Intl.supportedValuesOf is unavailable (old runtimes).
const FALLBACK_ZONES = [
  'UTC',
  'Europe/London', 'Europe/Oslo', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Kyiv', 'Europe/Moscow', 'Europe/Helsinki', 'Europe/Warsaw',
  'Europe/Athens', 'Europe/Bucharest', 'Europe/Stockholm',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Mexico_City',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland',
  'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg',
];

function getAllZones(): string[] {
  try {
    // Available in all modern browsers and Node 16+.
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return FALLBACK_ZONES;
  }
}

function getContinent(zone: string): string {
  const prefix = zone.split('/')[0] ?? zone;
  // Map prefixes that don't read naturally as group labels.
  const map: Record<string, string> = { Pacific: 'Pacific' };
  return map[prefix] ?? prefix;
}

type TimezoneGroup = { label: string; zones: string[] };

function buildGroups(detectedZone: string, zones: string[]): TimezoneGroup[] {
  const map = new Map<string, string[]>();
  for (const z of zones) {
    const continent = getContinent(z);
    const group = map.get(continent) ?? [];
    group.push(z);
    map.set(continent, group);
  }

  // Sort continents; UTC first.
  const sorted = [...map.entries()].sort(([a], [b]) => {
    if (a === 'UTC') return -1;
    if (b === 'UTC') return 1;
    return a.localeCompare(b);
  });

  const groups: TimezoneGroup[] = [];

  // Pin detected timezone at the top.
  if (detectedZone && zones.includes(detectedZone)) {
    groups.push({ label: 'Detected', zones: [detectedZone] });
  }

  for (const [label, zns] of sorted) {
    groups.push({ label, zones: zns });
  }

  return groups;
}

function formatZoneLabel(zone: string): string {
  // "America/New_York" → "America/New York"
  return zone.replace(/_/g, ' ');
}

type TimezoneSelectProps = {
  value: string;
  onChange: (zone: string) => void;
  detectedZone?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
};

export function TimezoneSelect({
  value,
  onChange,
  detectedZone = '',
  placeholder = 'Select timezone…',
  searchPlaceholder = 'Search timezones…',
  emptyText = 'No timezone found.',
  disabled,
  id,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(
    () => buildGroups(detectedZone, getAllZones()),
    [detectedZone],
  );

  const displayLabel = value ? formatZoneLabel(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {displayLabel ? (
            <span className="truncate">{displayLabel}</span>
          ) : (
            <span className="text-(--ssz-text-muted)">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.zones.map((zone) => (
                  <CommandItem
                    key={zone}
                    value={zone}
                    onSelect={() => {
                      onChange(zone);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === zone ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {formatZoneLabel(zone)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
