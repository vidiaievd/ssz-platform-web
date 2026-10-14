'use client';

import { Bold, Italic, Heading, List, MessageSquareQuote, Quote, Table, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type MarkdownFormat =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'list'
  | 'quote'
  /** A dialogue turn, `**Name:** line` — the reader draws it as a turn, the narration gives the name a voice. */
  | 'dialogue'
  /** A pipe table — drawn by the reader, skipped by the narration. */
  | 'table';

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
    { format: 'dialogue', icon: MessageSquareQuote, label: t('editor.formatDialogue') },
    { format: 'table', icon: Table, label: t('editor.formatTable') },
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

  if (format === 'dialogue') {
    // A turn is a paragraph of its own; the name comes selected, ready to be typed over.
    return insertBlock(value, selStart, selEnd, `**${SPEAKER}:** ${selected}`, 2, SPEAKER.length);
  }
  if (format === 'table') {
    const table = `| ${COLUMN} 1 | ${COLUMN} 2 |\n|---|---|\n|  |  |`;
    return insertBlock(value, selStart, selEnd, table, 2, `${COLUMN} 1`.length);
  }

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

/** What a new turn's name and a new table's columns are called until the author renames them. */
const SPEAKER = 'Navn';
const COLUMN = 'Kolonne';

/**
 * Put `block` on a paragraph of its own at the selection — a blank line before and after it,
 * since the reader and the narration both split the body on blank lines — and select the
 * `length` characters `offset` into it.
 */
export function insertBlock(
  value: string,
  selStart: number,
  selEnd: number,
  block: string,
  offset: number,
  length: number,
): { value: string; selStart: number; selEnd: number } {
  const before = value.slice(0, selStart).replace(/[ \t]+$/, '');
  const after = value.slice(selEnd).replace(/^[ \t]+/, '');
  const lead =
    before === '' ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail =
    after === '' ? '' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const start = before.length + lead.length;
  return {
    value: before + lead + block + trail + after,
    selStart: start + offset,
    selEnd: start + offset + length,
  };
}
