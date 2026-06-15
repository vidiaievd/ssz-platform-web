'use client';

import { useController, type Control } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UpdateProfileInput } from '../schemas';

type TimezoneGroup = {
  label: string;
  timezones: { value: string; label: string }[];
};

function getUtcOffset(tz: string): string {
  if (tz === 'UTC') return 'UTC+0';
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    return offset.replace('GMT', 'UTC') || 'UTC';
  } catch {
    return '';
  }
}

function buildLabel(city: string, tz: string): string {
  const offset = getUtcOffset(tz);
  return `${city} (${offset})`;
}

const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    label: 'UTC',
    timezones: [{ value: 'UTC', label: 'UTC (UTC+0)' }],
  },
  {
    label: 'Europe',
    timezones: [
      { value: 'Europe/London', label: buildLabel('London', 'Europe/London') },
      { value: 'Europe/Dublin', label: buildLabel('Dublin', 'Europe/Dublin') },
      { value: 'Europe/Lisbon', label: buildLabel('Lisbon', 'Europe/Lisbon') },
      { value: 'Europe/Amsterdam', label: buildLabel('Amsterdam', 'Europe/Amsterdam') },
      { value: 'Europe/Berlin', label: buildLabel('Berlin', 'Europe/Berlin') },
      { value: 'Europe/Brussels', label: buildLabel('Brussels', 'Europe/Brussels') },
      { value: 'Europe/Copenhagen', label: buildLabel('Copenhagen', 'Europe/Copenhagen') },
      { value: 'Europe/Madrid', label: buildLabel('Madrid', 'Europe/Madrid') },
      { value: 'Europe/Oslo', label: buildLabel('Oslo', 'Europe/Oslo') },
      { value: 'Europe/Paris', label: buildLabel('Paris', 'Europe/Paris') },
      { value: 'Europe/Rome', label: buildLabel('Rome', 'Europe/Rome') },
      { value: 'Europe/Stockholm', label: buildLabel('Stockholm', 'Europe/Stockholm') },
      { value: 'Europe/Vienna', label: buildLabel('Vienna', 'Europe/Vienna') },
      { value: 'Europe/Warsaw', label: buildLabel('Warsaw', 'Europe/Warsaw') },
      { value: 'Europe/Athens', label: buildLabel('Athens', 'Europe/Athens') },
      { value: 'Europe/Bucharest', label: buildLabel('Bucharest', 'Europe/Bucharest') },
      { value: 'Europe/Helsinki', label: buildLabel('Helsinki', 'Europe/Helsinki') },
      { value: 'Europe/Kyiv', label: buildLabel('Kyiv', 'Europe/Kyiv') },
      { value: 'Europe/Riga', label: buildLabel('Riga', 'Europe/Riga') },
      { value: 'Europe/Tallinn', label: buildLabel('Tallinn', 'Europe/Tallinn') },
      { value: 'Europe/Vilnius', label: buildLabel('Vilnius', 'Europe/Vilnius') },
      { value: 'Europe/Moscow', label: buildLabel('Moscow', 'Europe/Moscow') },
    ],
  },
  {
    label: 'Americas',
    timezones: [
      { value: 'America/New_York', label: buildLabel('New York', 'America/New_York') },
      { value: 'America/Toronto', label: buildLabel('Toronto', 'America/Toronto') },
      { value: 'America/Chicago', label: buildLabel('Chicago', 'America/Chicago') },
      { value: 'America/Denver', label: buildLabel('Denver', 'America/Denver') },
      { value: 'America/Los_Angeles', label: buildLabel('Los Angeles', 'America/Los_Angeles') },
      { value: 'America/Vancouver', label: buildLabel('Vancouver', 'America/Vancouver') },
      { value: 'America/Phoenix', label: buildLabel('Phoenix', 'America/Phoenix') },
      { value: 'America/Anchorage', label: buildLabel('Anchorage', 'America/Anchorage') },
      { value: 'Pacific/Honolulu', label: buildLabel('Honolulu', 'Pacific/Honolulu') },
      { value: 'America/Mexico_City', label: buildLabel('Mexico City', 'America/Mexico_City') },
      { value: 'America/Bogota', label: buildLabel('Bogotá', 'America/Bogota') },
      { value: 'America/Lima', label: buildLabel('Lima', 'America/Lima') },
      { value: 'America/Sao_Paulo', label: buildLabel('São Paulo', 'America/Sao_Paulo') },
      { value: 'America/Buenos_Aires', label: buildLabel('Buenos Aires', 'America/Argentina/Buenos_Aires') },
      { value: 'America/Santiago', label: buildLabel('Santiago', 'America/Santiago') },
    ],
  },
  {
    label: 'Asia & Pacific',
    timezones: [
      { value: 'Asia/Dubai', label: buildLabel('Dubai', 'Asia/Dubai') },
      { value: 'Asia/Karachi', label: buildLabel('Karachi', 'Asia/Karachi') },
      { value: 'Asia/Kolkata', label: buildLabel('Kolkata', 'Asia/Kolkata') },
      { value: 'Asia/Dhaka', label: buildLabel('Dhaka', 'Asia/Dhaka') },
      { value: 'Asia/Bangkok', label: buildLabel('Bangkok', 'Asia/Bangkok') },
      { value: 'Asia/Singapore', label: buildLabel('Singapore', 'Asia/Singapore') },
      { value: 'Asia/Shanghai', label: buildLabel('Shanghai', 'Asia/Shanghai') },
      { value: 'Asia/Hong_Kong', label: buildLabel('Hong Kong', 'Asia/Hong_Kong') },
      { value: 'Asia/Tokyo', label: buildLabel('Tokyo', 'Asia/Tokyo') },
      { value: 'Asia/Seoul', label: buildLabel('Seoul', 'Asia/Seoul') },
      { value: 'Australia/Perth', label: buildLabel('Perth', 'Australia/Perth') },
      { value: 'Australia/Sydney', label: buildLabel('Sydney', 'Australia/Sydney') },
      { value: 'Australia/Melbourne', label: buildLabel('Melbourne', 'Australia/Melbourne') },
      { value: 'Pacific/Auckland', label: buildLabel('Auckland', 'Pacific/Auckland') },
    ],
  },
  {
    label: 'Africa',
    timezones: [
      { value: 'Africa/Lagos', label: buildLabel('Lagos', 'Africa/Lagos') },
      { value: 'Africa/Cairo', label: buildLabel('Cairo', 'Africa/Cairo') },
      { value: 'Africa/Johannesburg', label: buildLabel('Johannesburg', 'Africa/Johannesburg') },
      { value: 'Africa/Nairobi', label: buildLabel('Nairobi', 'Africa/Nairobi') },
    ],
  },
];

type TimezoneSelectProps = {
  control: Control<UpdateProfileInput>;
  disabled?: boolean;
};

export function TimezoneSelect({ control, disabled }: TimezoneSelectProps) {
  const { field } = useController({ name: 'timezone', control });

  return (
    <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label="Select timezone">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.timezones.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
