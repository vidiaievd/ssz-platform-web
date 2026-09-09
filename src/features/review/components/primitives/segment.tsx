'use client';

import { Segmented } from '@/components/ui/segmented';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

/**
 * A choice between two ways of looking at the same list.
 *
 * Not a filter and not a tab: nothing is added or removed by it, the same submissions are
 * merely walked through in a different order. That is why it sits apart from the filter
 * row and why it is a radio group underneath — a screen reader should hear "one of two",
 * not "button".
 *
 * It exists as a review primitive rather than a direct call to `Segmented` because
 * oversight (46) needs the same control at the same size, and the pair should not drift
 * apart through two independent sets of props.
 */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: SegmentProps<T>) {
  return (
    <Segmented
      aria-label={aria['aria-label']}
      value={value}
      onValueChange={onChange}
      size="sm"
      options={options}
      className={className}
    />
  );
}
