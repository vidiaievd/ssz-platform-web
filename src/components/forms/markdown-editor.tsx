'use client';

import { useEffect, useState } from 'react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  tab: 'write' | 'preview';
  onTabChange: (tab: 'write' | 'preview') => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  writeLabel?: string;
  previewLabel?: string;
  previewEmpty?: string;
  counterLabel?: string;
  hasError?: boolean;
  id?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  tab,
  onTabChange,
  maxLength = 500,
  rows = 5,
  placeholder = '',
  writeLabel = 'Write',
  previewLabel = 'Preview',
  previewEmpty = 'Nothing to preview.',
  counterLabel,
  hasError,
  id,
}: MarkdownEditorProps) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (tab !== 'preview' || !value.trim()) {
        if (!cancelled) setHtml('');
        return;
      }

      const [
        { unified },
        { default: remarkParse },
        { default: remarkRehype },
        { default: rehypeSanitize },
        { default: rehypeStringify },
        { defaultSchema },
      ] = await Promise.all([
        import('unified'),
        import('remark-parse'),
        import('remark-rehype'),
        import('rehype-sanitize'),
        import('rehype-stringify'),
        import('rehype-sanitize'),
      ]);

      const schema = {
        ...defaultSchema,
        tagNames: ['p', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'code', 'h2', 'h3'],
        attributes: {
          ...defaultSchema.attributes,
          a: ['href', 'rel', 'target'],
        },
      };

      const file = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSanitize, schema)
        .use(rehypeStringify)
        .process(value);

      if (!cancelled) setHtml(String(file));
    })();

    return () => {
      cancelled = true;
    };
  }, [value, tab]);

  const count = value.length;
  const overLimit = count > maxLength;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as 'write' | 'preview')}>
      <div className="flex items-center justify-between mb-1.5">
        <TabsList className="h-7 gap-0 rounded-md border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-0.5">
          <TabsTrigger
            value="write"
            className="h-6 px-2.5 text-xs data-[state=active]:bg-(--ssz-bg-surface) data-[state=active]:shadow-sm"
          >
            {writeLabel}
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="h-6 px-2.5 text-xs data-[state=active]:bg-(--ssz-bg-surface) data-[state=active]:shadow-sm"
          >
            {previewLabel}
          </TabsTrigger>
        </TabsList>

        <span
          className={cn(
            'text-xs tabular-nums',
            overLimit
              ? 'text-[var(--ssz-color-error-600)]'
              : 'text-[var(--ssz-text-muted)]',
          )}
          aria-live="polite"
        >
          {counterLabel
            ? counterLabel.replace('{count}', String(count)).replace('{max}', String(maxLength))
            : `${count}/${maxLength}`}
        </span>
      </div>

      <TabsContent value="write" className="mt-0">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          maxLength={maxLength + 100}
          hasError={hasError || overLimit}
          className="resize-none"
        />
      </TabsContent>

      <TabsContent value="preview" className="mt-0">
        <div
          className={cn(
            'min-h-[120px] rounded-md border border-(--ssz-border-default)',
            'bg-(--ssz-bg-subtle) px-3 py-2 text-sm text-(--ssz-text-primary)',
            'prose prose-sm max-w-none',
          )}
        >
          {value.trim() ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="text-(--ssz-text-muted) italic">{previewEmpty}</span>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
