'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Loader2, UserPlus, AlertCircle, UserCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { resolveEmail } from '../api/resolve-email';
import { enrollStudents } from '../api/mutations';
import type { EmailResolveResult } from '@/features/students/types';

type GroupOption = { id: string; name: string; lang: string; level: string };

type ResolvedEmail = {
  email: string;
  result: EmailResolveResult | null;
  loading: boolean;
  invalid: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseLine(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function BranchBadge({ branch }: { branch: EmailResolveResult['branch'] | undefined }) {
  if (!branch) return null;
  if (branch === 'register') {
    return (
      <Badge variant="muted" className="text-xs bg-sky-100 text-sky-800 border-transparent dark:bg-sky-900/40 dark:text-sky-300">
        <UserPlus className="mr-1 h-3 w-3" aria-hidden /> New user
      </Badge>
    );
  }
  if (branch === 'attach-direct') {
    return (
      <Badge variant="muted" className="text-xs bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/40 dark:text-emerald-300">
        <UserCheck className="mr-1 h-3 w-3" aria-hidden /> Existing student
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="text-xs bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/40 dark:text-amber-300">
      <AlertCircle className="mr-1 h-3 w-3" aria-hidden /> Needs student role
    </Badge>
  );
}

type Props = {
  open: boolean;
  onOpenChangeAction: (v: boolean) => void;
  schoolId: string;
  groups: GroupOption[];
};

export function EnrollDialog({ open, onOpenChangeAction, schoolId, groups }: Props) {
  const t = useTranslations('Students');
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [targetGroupId, setTargetGroupId] = useState<string>('none');
  const [resolved, setResolved] = useState<ResolvedEmail[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = useCallback(async () => {
    const emails = parseLine(raw);
    if (!emails.length) return;

    setIsResolving(true);
    const initial: ResolvedEmail[] = emails.map((e) => ({
      email: e,
      result: null,
      loading: true,
      invalid: !EMAIL_RE.test(e),
    }));
    setResolved(initial);

    const settled = await Promise.allSettled(
      emails.map((e, i) =>
        EMAIL_RE.test(e)
          ? resolveEmail(schoolId, e).then((r) => ({ i, r }))
          : Promise.resolve({ i, r: null }),
      ),
    );

    setResolved((prev) =>
      prev.map((item, i) => {
        const outcome = settled[i];
        if (!outcome) return item;
        if (outcome.status === 'fulfilled') {
          return { ...item, loading: false, result: outcome.value.r };
        }
        return { ...item, loading: false };
      }),
    );
    setIsResolving(false);
  }, [raw, schoolId]);

  function handleClose() {
    setRaw('');
    setResolved([]);
    setTargetGroupId('none');
    onOpenChangeAction(false);
  }

  function handleSubmit() {
    const validEmails = resolved.filter((r) => !r.invalid && r.result);
    if (!validEmails.length) return;

    startTransition(async () => {
      const inputs = validEmails.map((r) => ({
        email: r.email,
        branch: r.result!.branch,
        userId: r.result!.userId,
        targetGroupId: targetGroupId !== 'none' ? targetGroupId : undefined,
      }));

      const result = await enrollStudents(schoolId, inputs);
      if (result.ok || result.invited > 0 || result.attached > 0) {
        const parts: string[] = [];
        if (result.invited > 0) parts.push(`${result.invited} invited`);
        if (result.attached > 0) parts.push(`${result.attached} added directly`);
        toast.success(parts.join(', '));
        router.refresh();
        handleClose();
      } else {
        toast.error(t('enroll.failed'));
      }
    });
  }

  const emailLines = parseLine(raw);
  const hasEmails = emailLines.length > 0;
  const hasResolved = resolved.length > 0 && !isResolving;
  const validCount = resolved.filter((r) => !r.invalid && r.result).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('enroll.title')}</DialogTitle>
          <DialogDescription>{t('enroll.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Email textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="enroll-emails">{t('enroll.emailsLabel')}</Label>
            <Textarea
              id="enroll-emails"
              placeholder={t('enroll.emailsPlaceholder')}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setResolved([]);
              }}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{t('enroll.emailsHint')}</p>
          </div>

          {/* Resolve button */}
          {hasEmails && resolved.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResolve}
              disabled={isResolving}
            >
              {isResolving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              {t('enroll.checkEmails')}
            </Button>
          )}

          {/* Resolved email list */}
          {resolved.length > 0 && (
            <div className="space-y-1.5 rounded-lg border p-3">
              {resolved.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={cn(
                      'truncate font-mono',
                      item.invalid && 'text-destructive line-through',
                    )}
                  >
                    {item.email}
                  </span>
                  {item.loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                  ) : item.invalid ? (
                    <Badge variant="muted" className="text-xs text-destructive border-destructive/30 shrink-0">
                      Invalid
                    </Badge>
                  ) : (
                    <BranchBadge branch={item.result?.branch} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Target group */}
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="enroll-group">{t('enroll.targetGroup')}</Label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger id="enroll-group">
                  <SelectValue placeholder={t('enroll.noGroup')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('enroll.noGroup')}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} — {g.lang.toUpperCase()} {g.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasResolved || validCount === 0 || isPending}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {hasResolved
              ? t('enroll.submit', { count: validCount })
              : t('enroll.submitDefault')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
