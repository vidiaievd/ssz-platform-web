'use client';

import { Copy, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type InviteLinkFallbackProps = {
  email: string;
  inviteUrl: string;
};

export function InviteLinkFallback({ email, inviteUrl }: InviteLinkFallbackProps) {
  const t = useTranslations('School');

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl);
    toast.success(t('common.copied'));
  }

  const mailtoHref = `mailto:${email}?subject=${encodeURIComponent('School invitation')}&body=${encodeURIComponent(inviteUrl)}`;

  return (
    <div className="rounded-[var(--ssz-radius-md)] border border-[var(--ssz-color-warning-200)] bg-[var(--ssz-color-warning-50)] p-3 mt-2 text-[var(--ssz-color-warning-800)] text-sm">
      <p className="mb-2 font-medium">
        {t('create.invite.linkFallback.title', { email })}
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={inviteUrl}
          className="text-xs h-8"
          onFocus={(e) => e.target.select()}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {t('create.invite.linkFallback.copy')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          asChild
          className="shrink-0 gap-1.5"
        >
          <a href={mailtoHref} target="_blank" rel="noopener noreferrer">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {t('create.invite.linkFallback.openMail')}
          </a>
        </Button>
      </div>
    </div>
  );
}
