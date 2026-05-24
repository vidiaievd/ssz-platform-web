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
import { buildLanguageOptions } from '../../lib/iso-languages';

type LanguageComboboxProps = {
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  exclude?: string[];
  disabled?: boolean;
  id?: string;
};

export function LanguageCombobox({
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Search languages…',
  emptyText = 'No language found.',
  exclude = [],
  disabled,
  id,
}: LanguageComboboxProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => buildLanguageOptions(exclude), [exclude]);
  const selected = options.find((l) => l.code === value);

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
          {selected ? (
            <span className="flex items-baseline gap-2 truncate">
              <span>{selected.endonym}</span>
              {selected.endonym !== selected.english && (
                <span className="text-xs text-(--ssz-text-muted) truncate">{selected.english}</span>
              )}
            </span>
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
            <CommandGroup>
              {options.map((lang) => (
                <CommandItem
                  key={lang.code}
                  value={`${lang.endonym} ${lang.english} ${lang.code}`}
                  onSelect={() => {
                    onChange(lang.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4 shrink-0', value === lang.code ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="font-medium">{lang.endonym}</span>
                  {lang.endonym !== lang.english && (
                    <span className="ml-2 text-xs text-(--ssz-text-muted) truncate">{lang.english}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
