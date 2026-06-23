import type { ContainerFormValues } from '../schemas/container';
import type { MetadataDraft, VisibilityMode } from '../stores/create-wizard';

const VISIBILITY_MAP: Record<
  VisibilityMode,
  { visibility: ContainerFormValues['visibility']; accessTier: ContainerFormValues['accessTier'] }
> = {
  public_catalog: { visibility: 'public', accessTier: 'public_free' },
  internal_draft: { visibility: 'school_private', accessTier: 'free_within_school' },
  invite_only: { visibility: 'private', accessTier: 'assigned_only' },
};

/** Maps the create-wizard's draft state to the container create/update payload. */
export function wizardPayload(
  metadata: MetadataDraft,
  visibilityMode: VisibilityMode,
): ContainerFormValues {
  const { visibility, accessTier } = VISIBILITY_MAP[visibilityMode];
  return {
    title: metadata.title,
    description: metadata.description || undefined,
    containerType: 'course',
    targetLanguage: metadata.targetLanguage,
    difficultyLevel: metadata.level as ContainerFormValues['difficultyLevel'],
    visibility,
    accessTier,
  };
}
