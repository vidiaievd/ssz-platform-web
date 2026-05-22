'use client';

import { useController, type Control } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LOCALE_LABELS, LOCALES } from '@/lib/i18n/config';
import type { UpdateProfileInput } from '../schemas';

type LocaleSelectProps = {
  name: keyof Pick<UpdateProfileInput, 'uiLocale'>;
  control: Control<UpdateProfileInput>;
  disabled?: boolean;
};

export function LocaleSelect({ name, control, disabled }: LocaleSelectProps) {
  const { field } = useController({ name, control });

  return (
    <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label="Select language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
