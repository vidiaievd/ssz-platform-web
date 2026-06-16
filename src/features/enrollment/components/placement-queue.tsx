'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { suggestGroups, type GroupSuggestion } from '@/features/enrollment/lib/suggest-groups';
import type { Membership } from '@/features/enrollment/types';
import type { Group } from '@/features/groups/types';

type Props = {
  memberships: Membership[];
  groups: Group[];
};

export function PlacementQueue({ memberships, groups }: Props) {
  const t = useTranslations('Enrollment.PlacementQueue');
  const router = useRouter();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Record<string, string>>({});

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <UserCheck className="h-10 w-10 text-(--ssz-text-muted)" />
        <p className="text-sm text-(--ssz-text-muted)">{t('empty')}</p>
      </div>
    );
  }

  async function handleAssign(m: Membership) {
    const membershipId = m.id;
    const groupId = selectedGroup[membershipId];
    if (!groupId) return;
    setAssigning(membershipId);
    try {
      const res = await fetch(`/api/enrollment/memberships/${membershipId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: m.schoolId, groupId }),
      });
      if (!res.ok) throw new Error('Assign failed');
      toast.success(t('assigned'));
      router.refresh();
    } catch {
      toast.error(t('assignFailed'));
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {memberships.map((m) => {
        const suggestions: GroupSuggestion[] = suggestGroups(m, groups);
        const groupId = selectedGroup[m.id] ?? '';

        return (
          <div key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Student info */}
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-medium text-(--ssz-text-primary)">{m.id}</span>
              <span className="text-xs text-(--ssz-text-muted)">
                {m.language.toUpperCase()}
                {m.placement && (
                  <>
                    {' · '}
                    <span className="font-semibold text-(--ssz-primary)">
                      {m.placement.cefrLevel}
                    </span>
                    {' '}
                    <span className="text-(--ssz-text-muted)">({m.placement.sourceLabel})</span>
                  </>
                )}
              </span>
              {m.availability && m.availability.length > 0 && (
                <span className="text-xs text-(--ssz-text-muted)">
                  {t('availableDays', { count: m.availability.length })}
                </span>
              )}
            </div>

            {/* Group picker */}
            <div className="flex flex-col gap-2 sm:w-72">
              <Select
                value={groupId}
                onValueChange={(v) => setSelectedGroup((prev) => ({ ...prev, [m.id]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectGroup')} />
                </SelectTrigger>
                <SelectContent>
                  {suggestions.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {t('noGroups')}
                    </SelectItem>
                  ) : (
                    suggestions.map(({ group, levelDelta, slotOverlap, hasCapacity }) => (
                      <SelectItem
                        key={group.id}
                        value={group.id}
                        disabled={!hasCapacity}
                      >
                        <span className="flex items-center gap-2">
                          {group.name}
                          <Badge variant="level" className="text-xs">
                            {group.level}
                          </Badge>
                          {levelDelta === 0 && (
                            <Badge variant="primary" className="text-xs">
                              {t('exactMatch')}
                            </Badge>
                          )}
                          {slotOverlap > 0 && (
                            <Badge variant="info" className="text-xs">
                              {t('slots', { count: slotOverlap })}
                            </Badge>
                          )}
                          {!hasCapacity && (
                            <Badge variant="error" className="text-xs">
                              {t('full')}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                disabled={!groupId || groupId === '__none__' || assigning === m.id}
                onClick={() => handleAssign(m)}
                className="self-end"
              >
                {assigning === m.id ? t('assigning') : t('assign')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
