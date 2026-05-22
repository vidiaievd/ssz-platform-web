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

const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    label: 'UTC',
    timezones: [{ value: 'UTC', label: 'UTC' }],
  },
  {
    label: 'Europe',
    timezones: [
      { value: 'Europe/London', label: 'London' },
      { value: 'Europe/Dublin', label: 'Dublin' },
      { value: 'Europe/Lisbon', label: 'Lisbon' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam' },
      { value: 'Europe/Berlin', label: 'Berlin' },
      { value: 'Europe/Brussels', label: 'Brussels' },
      { value: 'Europe/Copenhagen', label: 'Copenhagen' },
      { value: 'Europe/Madrid', label: 'Madrid' },
      { value: 'Europe/Oslo', label: 'Oslo' },
      { value: 'Europe/Paris', label: 'Paris' },
      { value: 'Europe/Rome', label: 'Rome' },
      { value: 'Europe/Stockholm', label: 'Stockholm' },
      { value: 'Europe/Vienna', label: 'Vienna' },
      { value: 'Europe/Warsaw', label: 'Warsaw' },
      { value: 'Europe/Athens', label: 'Athens' },
      { value: 'Europe/Bucharest', label: 'Bucharest' },
      { value: 'Europe/Helsinki', label: 'Helsinki' },
      { value: 'Europe/Kyiv', label: 'Kyiv' },
      { value: 'Europe/Riga', label: 'Riga' },
      { value: 'Europe/Tallinn', label: 'Tallinn' },
      { value: 'Europe/Vilnius', label: 'Vilnius' },
      { value: 'Europe/Moscow', label: 'Moscow' },
    ],
  },
  {
    label: 'Americas',
    timezones: [
      { value: 'America/New_York', label: 'New York' },
      { value: 'America/Toronto', label: 'Toronto' },
      { value: 'America/Chicago', label: 'Chicago' },
      { value: 'America/Denver', label: 'Denver' },
      { value: 'America/Los_Angeles', label: 'Los Angeles' },
      { value: 'America/Vancouver', label: 'Vancouver' },
      { value: 'America/Phoenix', label: 'Phoenix' },
      { value: 'America/Anchorage', label: 'Anchorage' },
      { value: 'Pacific/Honolulu', label: 'Honolulu' },
      { value: 'America/Mexico_City', label: 'Mexico City' },
      { value: 'America/Bogota', label: 'Bogotá' },
      { value: 'America/Lima', label: 'Lima' },
      { value: 'America/Sao_Paulo', label: 'São Paulo' },
      { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
      { value: 'America/Santiago', label: 'Santiago' },
    ],
  },
  {
    label: 'Asia & Pacific',
    timezones: [
      { value: 'Asia/Dubai', label: 'Dubai' },
      { value: 'Asia/Karachi', label: 'Karachi' },
      { value: 'Asia/Kolkata', label: 'Kolkata' },
      { value: 'Asia/Dhaka', label: 'Dhaka' },
      { value: 'Asia/Bangkok', label: 'Bangkok' },
      { value: 'Asia/Singapore', label: 'Singapore' },
      { value: 'Asia/Shanghai', label: 'Shanghai' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
      { value: 'Asia/Tokyo', label: 'Tokyo' },
      { value: 'Asia/Seoul', label: 'Seoul' },
      { value: 'Australia/Perth', label: 'Perth' },
      { value: 'Australia/Sydney', label: 'Sydney' },
      { value: 'Australia/Melbourne', label: 'Melbourne' },
      { value: 'Pacific/Auckland', label: 'Auckland' },
    ],
  },
  {
    label: 'Africa',
    timezones: [
      { value: 'Africa/Lagos', label: 'Lagos' },
      { value: 'Africa/Cairo', label: 'Cairo' },
      { value: 'Africa/Johannesburg', label: 'Johannesburg' },
      { value: 'Africa/Nairobi', label: 'Nairobi' },
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
