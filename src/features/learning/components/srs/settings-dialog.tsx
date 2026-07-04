'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useSrsSettings, usePatchSrsSettings } from '../../api/use-srs-settings';

const settingsSchema = z.object({
  dailyLimit: z.number().int().min(5).max(100),
  audio: z.boolean(),
  preferReverse: z.boolean(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

interface SrsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SrsSettingsDialog({ open, onClose }: SrsSettingsDialogProps) {
  const t = useTranslations('Srs.settings');
  const { data: settings, isLoading } = useSrsSettings();
  const { mutate: patch } = usePatchSrsSettings();

  const { register, watch, setValue, reset } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { dailyLimit: 20, audio: true, preferReverse: false },
  });

  /* Populate the form once settings load */
  useEffect(() => {
    if (settings) {
      reset({
        dailyLimit: settings.dailyLimit,
        audio: settings.audio,
        preferReverse: settings.preferReverse,
      });
    }
  }, [settings, reset]);

  const dailyLimit = watch('dailyLimit');
  const audio = watch('audio');
  const preferReverse = watch('preferReverse');

  /* Optimistic patch on every field change */
  const patchField = (partial: Partial<SettingsForm>) => {
    patch(partial);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Daily limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="srs-daily-limit" className="font-medium">
                  {t('dailyLimit')}
                </Label>
                <Input
                  id="srs-daily-limit"
                  type="number"
                  min={5}
                  max={100}
                  step={5}
                  className="w-20 text-center"
                  {...register('dailyLimit', { valueAsNumber: true })}
                  onBlur={(e) => {
                    const val = Math.min(100, Math.max(5, Number(e.target.value) || 20));
                    setValue('dailyLimit', val);
                    patchField({ dailyLimit: val });
                  }}
                />
              </div>
              <p className="text-xs text-[var(--ssz-text-muted)]">{t('dailyLimitHelp')}</p>
            </div>

            <Separator />

            {/* Audio */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="srs-audio" className="font-medium">
                  {t('audio')}
                </Label>
                <p className="text-xs text-[var(--ssz-text-muted)]">{t('audioHelp')}</p>
              </div>
              <Switch
                id="srs-audio"
                checked={audio}
                onCheckedChange={(checked) => {
                  setValue('audio', checked);
                  patchField({ audio: checked });
                }}
              />
            </div>

            <Separator />

            {/* Prefer reverse */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="srs-reverse" className="font-medium">
                  {t('preferReverse')}
                </Label>
                <p className="text-xs text-[var(--ssz-text-muted)]">{t('preferReverseHelp')}</p>
              </div>
              <Switch
                id="srs-reverse"
                checked={preferReverse}
                onCheckedChange={(checked) => {
                  setValue('preferReverse', checked);
                  patchField({ preferReverse: checked });
                }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
