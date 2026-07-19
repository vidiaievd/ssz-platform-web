'use client';

import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: 'sm' | 'md';
  'aria-label': string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  size = 'md',
  className,
  ...aria
}: SegmentedProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      aria-label={aria['aria-label']}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;
        return (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
            {option.label}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
