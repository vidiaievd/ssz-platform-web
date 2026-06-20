'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, BookOpen, Layers, Users, Lock, Globe, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/i18n/navigation';
import { PreflightPanel } from '@/features/content-authoring/components/preflight-panel';
import { authoringKeys } from '@/features/content-authoring/api/keys';

import { createContainerAction, updateContainerAction } from '../../actions/container';
import { publishContainerAction } from '../../actions/publish-container';
import { wizardPayload } from '../../lib/wizard-payload';
import { useCreateWizardStore } from '../../stores/create-wizard';

// ── Review section row ────────────────────────────────────────────────────────

function ReviewSection({
  icon: Icon,
  title,
  items,
  onEdit,
  editLabel,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  items: { label: string; value: string }[];
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="rounded-[var(--ssz-radius-md)] border border-(--ssz-border-default) bg-(--ssz-bg-surface)">
      <div className="flex items-center justify-between gap-2 border-b border-(--ssz-border-default) px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-(--ssz-color-primary-600)" aria-hidden />
          <h2 className="text-sm font-semibold text-(--ssz-text-primary)">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-(--ssz-color-primary-600) hover:underline"
        >
          <Pencil className="h-3 w-3" />
          {editLabel}
        </button>
      </div>
      <dl className="divide-y divide-(--ssz-border-default)">
        {items.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-4 px-4 py-2.5">
            <dt className="min-w-[120px] text-xs text-(--ssz-text-muted)">{label}</dt>
            <dd className="flex-1 text-sm text-(--ssz-text-primary) break-words">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Visibility label helpers ──────────────────────────────────────────────────

function useVisibilityLabel() {
  const t = useTranslations('Authoring');
  return (mode: string) => {
    if (mode === 'public_catalog') return t('wizard.visibility.publicCatalog');
    if (mode === 'internal_draft') return t('wizard.visibility.internalDraft');
    return t('wizard.visibility.inviteOnly');
  };
}

function VisibilityIcon({ mode }: { mode: string }) {
  if (mode === 'public_catalog') return <Globe className="h-4 w-4" />;
  if (mode === 'internal_draft') return <EyeOff className="h-4 w-4" />;
  return <Lock className="h-4 w-4" />;
}

// ── Structure label ───────────────────────────────────────────────────────────

function useStructureLabel() {
  const t = useTranslations('Authoring');
  return (mode: string) => {
    if (mode === 'blank') return t('wizard.structure.blank');
    if (mode === 'template') return t('wizard.structure.template');
    return t('wizard.structure.cefr');
  };
}

// ── Step 5: Review ────────────────────────────────────────────────────────────

export function WizardStepReview({ onSaveAsDraft }: { onSaveAsDraft: () => void }) {
  const t = useTranslations('Authoring');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const contentBase = `/school/${schoolSlug}/content`;
  const store = useCreateWizardStore();
  const [isPending, startTransition] = useTransition();
  const visibilityLabel = useVisibilityLabel();
  const structureLabel = useStructureLabel();

  const { metadata, structure, visibility } = store;

  function goToStep(step: number) {
    store.setStep(step);
    const params = new URLSearchParams();
    params.set('step', String(step + 1));
    if (store.draftId) params.set('draft', store.draftId);
    router.push(`${contentBase}/new?${params.toString()}`);
  }

  async function ensureDraft() {
    const payload = wizardPayload(metadata, visibility.mode);

    if (store.draftId) {
      const res = await updateContainerAction(store.draftId, payload);
      if (!res.ok) throw new Error('patch failed');
      return store.draftId;
    }

    const res = await createContainerAction(payload);
    if (!res.ok) throw new Error('create failed');
    store.setDraftId(res.value.id);
    return res.value.id;
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        const id = await ensureDraft();
        const res = await publishContainerAction(id);
        if (!res.ok) {
          toast.error(t('wizard.review.publishError'));
          return;
        }
        await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
        toast.success(t('wizard.review.publishSuccess'));
        store.reset();
        router.push(`${contentBase}/${id}`);
      } catch {
        toast.error(t('wizard.review.publishError'));
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      {/* Summary column */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-(--ssz-text-primary) font-[Lora]">
            {t('wizard.steps.review')}
          </h1>
          <p className="mt-1 text-sm text-(--ssz-text-secondary)">
            {t('wizard.review.subtitle')}
          </p>
        </div>

        {/* Metadata section */}
        <ReviewSection
          icon={BookOpen}
          title={t('wizard.review.sectionMetadata')}
          onEdit={() => goToStep(0)}
          editLabel={t('wizard.review.edit')}
          items={[
            { label: t('wizard.metadata.titleLabel'), value: metadata.title },
            { label: t('wizard.metadata.language'), value: metadata.targetLanguage },
            { label: t('wizard.metadata.level'), value: metadata.level },
            { label: t('wizard.metadata.descriptionLabel'), value: metadata.description },
          ]}
        />

        {/* Structure section */}
        <ReviewSection
          icon={Layers}
          title={t('wizard.review.sectionStructure')}
          onEdit={() => goToStep(1)}
          editLabel={t('wizard.review.edit')}
          items={[
            { label: t('wizard.structure.previewTitle'), value: structureLabel(structure.mode) },
          ]}
        />

        {/* Teachers section */}
        <ReviewSection
          icon={Users}
          title={t('wizard.review.sectionTeachers')}
          onEdit={() => goToStep(2)}
          editLabel={t('wizard.review.edit')}
          items={[
            { label: t('wizard.teachers.ownerSection'), value: t('wizard.review.ownerOnly') },
          ]}
        />

        {/* Visibility section */}
        <ReviewSection
          icon={() => <VisibilityIcon mode={visibility.mode} />}
          title={t('wizard.review.sectionVisibility')}
          onEdit={() => goToStep(3)}
          editLabel={t('wizard.review.edit')}
          items={[
            { label: t('wizard.steps.visibility'), value: visibilityLabel(visibility.mode) },
          ]}
        />

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="outline" onClick={onSaveAsDraft} disabled={isPending}>
            {t('wizard.review.saveAsDraft')}
          </Button>
          <Button onClick={handlePublish} disabled={isPending} loading={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('wizard.review.publish')}
          </Button>
        </div>
      </div>

      {/* Preflight panel */}
      <div className="hidden lg:block">
        {store.draftId ? (
          <PreflightPanel containerId={store.draftId} />
        ) : (
          <div className="rounded-[var(--ssz-radius-md)] border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-4 text-center">
            <p className="text-xs text-(--ssz-text-muted)">
              {t('wizard.review.preflightHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
