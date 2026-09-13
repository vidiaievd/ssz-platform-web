'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';

/** The one filter a tutor with a handful of learners needs: a name. */
export function TutorStudentsSearch() {
  const t = useTranslations('Tutor.students');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get('q') ?? '';
  const [value, setValue] = useState(current);

  // Keep in step when the query changes from elsewhere — the back button, or a search
  // cleared on another screen. Adjusting during render rather than in an effect avoids
  // painting the stale value first.
  const [lastQuery, setLastQuery] = useState(current);
  if (lastQuery !== current) {
    setLastQuery(current);
    setValue(current);
  }

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('q', next);
    else params.delete('q');
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  return (
    <div className="relative max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(value.trim());
          if (e.key === 'Escape') {
            setValue('');
            commit('');
          }
        }}
        onBlur={() => commit(value.trim())}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            commit('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('clearSearch')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
