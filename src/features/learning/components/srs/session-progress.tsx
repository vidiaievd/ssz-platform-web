import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';

interface SessionProgressProps {
  done: number;
  total: number;
  onExit: () => void;
}

export function SessionProgress({ done, total, onExit }: SessionProgressProps) {
  const t = useTranslations('Srs.session');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 py-3">
      <ProgressBar
        value={pct}
        height={6}
        aria-label={t('progress', { done, total })}
        className="flex-1"
      />
      <span className="shrink-0 text-sm text-[var(--ssz-text-muted)]">
        {done} / {total}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onExit}
        aria-label={t('exit')}
        className="shrink-0 h-7 w-7 text-[var(--ssz-text-muted)] hover:text-[var(--ssz-text-primary)]"
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
