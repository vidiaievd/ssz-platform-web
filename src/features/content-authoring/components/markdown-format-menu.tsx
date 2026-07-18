'use client';

import { Bold, Italic, Heading, List, Quote, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type MarkdownFormat = 'bold' | 'italic' | 'heading' | 'list' | 'quote';

interface MarkdownFormatMenuProps {
  onInsert: (format: MarkdownFormat) => void;
}

/**
 * "Format" action for the anchor-text card header: inserts Markdown syntax at
 * the current selection (the anchor text is stored as Markdown).
 */
export function MarkdownFormatMenu({ onInsert }: MarkdownFormatMenuProps) {
  const t = useTranslations('Authoring');
  const items: { format: MarkdownFormat; icon: typeof Bold; label: string }[] = [
    { format: 'bold', icon: Bold, label: t('editor.formatBold') },
    { format: 'italic', icon: Italic, label: t('editor.formatItalic') },
    { format: 'heading', icon: Heading, label: t('editor.formatHeading') },
    { format: 'list', icon: List, label: t('editor.formatList') },
    { format: 'quote', icon: Quote, label: t('editor.formatQuote') },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <Type aria-hidden /> {t('editor.format')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ format, icon: Icon, label }) => (
          <DropdownMenuItem key={format} onSelect={() => onInsert(format)}>
            <Icon aria-hidden /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Pure Markdown-insertion helper: given the current textarea value and
 * selection, returns the new value and the caret range to restore. Inline
 * formats wrap the selection; block formats prefix the selected lines.
 */
export function applyMarkdownFormat(
  format: MarkdownFormat,
  value: string,
  selStart: number,
  selEnd: number,
): { value: string; selStart: number; selEnd: number } {
  const selected = value.slice(selStart, selEnd);

  if (format === 'bold' || format === 'italic') {
    const marker = format === 'bold' ? '**' : '_';
    const inner = selected || (format === 'bold' ? 'bold text' : 'italic text');
    const next = value.slice(0, selStart) + marker + inner + marker + value.slice(selEnd);
    return {
      value: next,
      selStart: selStart + marker.length,
      selEnd: selStart + marker.length + inner.length,
    };
  }

  // Block formats: prefix every selected line (or the caret line) from its start.
  const prefix = format === 'heading' ? '## ' : format === 'list' ? '- ' : '> ';
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const region = value.slice(lineStart, selEnd);
  const prefixed = region
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
  const next = value.slice(0, lineStart) + prefixed + value.slice(selEnd);
  return {
    value: next,
    selStart: lineStart,
    selEnd: selEnd + (prefixed.length - region.length),
  };
}
