'use client';

import { useState } from 'react';
import {
  History, Globe, Pencil, Plus, Lock, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container, ContainerVersion } from '@/features/content/types';

import { useContainerVersions } from '../api/use-container-versions';
import type { PreflightResult, SchoolRole } from '../types';
import { DiscardDraftDialog } from './discard-draft-dialog';
import { PublishDialog } from './publish-dialog';

// ── Version card: published ───────────────────────────────────────────────────

function PublishedCard({ version }: { version: ContainerVersion }) {
  const t = useTranslations('Authoring.versions');
  const dateStr = version.publishedAt
    ? new Date(version.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '';

  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--ssz-text-primary)' }}>v—</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
          <Globe className="h-3 w-3" aria-hidden />
          {t('published')}
        </span>
      </div>
      {dateStr && (
        <p className="text-xs text-muted-foreground">
          {t('publishedOn')} {dateStr}
        </p>
      )}
    </div>
  );
}

// ── Version card: draft ───────────────────────────────────────────────────────

interface DraftCardProps {
  container: Container;
  hasPublished: boolean;
  preflightResult?: PreflightResult;
  canEdit: boolean;
}

function DraftCard({
  container,
  hasPublished,
  preflightResult,
  canEdit,
}: DraftCardProps) {
  const t = useTranslations('Authoring.versions');
  const [discardOpen, setDiscardOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--ssz-text-primary)' }}>
          {hasPublished ? 'v—' : 'v1'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Pencil className="h-3 w-3" aria-hidden />
          {t('draft')}
        </span>
      </div>

      <div className="space-y-2 pt-1">
        <PublishDialog container={container} result={preflightResult} />

        {hasPublished && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs">
              {t('viewPublished')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('discardDraft')}
              onClick={() => setDiscardOpen(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      <DiscardDraftDialog
        containerId={container.id}
        open={discardOpen}
        onOpenChange={setDiscardOpen}
      />
    </div>
  );
}

// ── Version card: create-draft ────────────────────────────────────────────────

function CreateDraftCard({ onCreateDraft }: { onCreateDraft?: () => void }) {
  const t = useTranslations('Authoring.versions');
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center gap-3 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Plus className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">{t('createDraftTitle')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('createDraftBody')}</p>
      </div>
      <Button variant="primary" size="sm" onClick={onCreateDraft}>
        {t('createDraft')}
      </Button>
    </div>
  );
}

// ── Version card: read-only ───────────────────────────────────────────────────

function ReadOnlyCard() {
  const t = useTranslations('Authoring.versions');
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center gap-3 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">{t('readOnlyTitle')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('readOnlyBody')}</p>
      </div>
      <Button variant="outline" size="sm">{t('requestAccess')}</Button>
    </div>
  );
}

// ── Loading / error ───────────────────────────────────────────────────────────

function VersionsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

function VersionsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Authoring.versions');
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{t('loadError')}</p>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {t('retry')}
      </Button>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export interface VersionsRailProps {
  container: Container;
  schoolRole?: SchoolRole;
  preflightResult?: PreflightResult;
}

export function VersionsRail({ container, schoolRole = 'owner', preflightResult }: VersionsRailProps) {
  const t = useTranslations('Authoring.versions');
  const canEdit = schoolRole === 'owner' || schoolRole === 'admin';

  const {
    data: versions,
    isLoading,
    isError,
    refetch,
  } = useContainerVersions(container.id);

  const draftVersion = versions?.find((v) => v.status === 'draft') ?? null;
  const publishedVersion = versions?.find((v) => v.status === 'published') ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground">
          {t('title')}
        </h2>
      </div>

      {isLoading && <VersionsSkeleton />}
      {isError && <VersionsError onRetry={() => void refetch()} />}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {draftVersion ? (
            <DraftCard
              container={container}
              hasPublished={!!publishedVersion}
              preflightResult={preflightResult}
              canEdit={canEdit}
            />
          ) : (
            canEdit ? <CreateDraftCard /> : <ReadOnlyCard />
          )}
          {publishedVersion && <PublishedCard version={publishedVersion} />}
        </div>
      )}
    </div>
  );
}
