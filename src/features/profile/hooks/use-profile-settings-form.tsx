'use client';

import { createContext, useContext, useEffect, useTransition } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { LOCALES } from '@/lib/i18n/config';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useMyProfile } from '../api/use-my-profile';
import { useMyTutorProfile, useUpdateTutorProfile } from '../api/use-my-tutor-profile';
import { updateProfileAction } from '../api/update-profile';
import { profileKeys } from '../api/keys';
import { createProfileSettingsSchema, type ProfileSettingsInput } from '../schemas';

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

type ProfileSettingsFormContextValue = {
  form: UseFormReturn<ProfileSettingsInput>;
  isPending: boolean;
  isLoading: boolean;
};

const ProfileSettingsFormContext = createContext<ProfileSettingsFormContextValue | null>(null);

type Props = {
  children: React.ReactNode;
  isPrivateTutor: boolean;
};

export function ProfileSettingsFormProvider({ children, isPrivateTutor }: Props) {
  const t = useTranslations('Profile');
  const tErrors = useTranslations('Errors');
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: tutor, isLoading: tutorLoading } = useMyTutorProfile();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const updateTutor = useUpdateTutorProfile();
  const unsavedChanges = useUnsavedChanges();

  const isLoading = profileLoading || (isPrivateTutor && tutorLoading);

  const form = useForm<ProfileSettingsInput>({
    resolver: zodResolver(
      createProfileSettingsSchema({
        invalidEmail: t('validation.invalidEmail'),
        invalidPhone: t('validation.invalidPhone'),
      }),
    ),
    defaultValues: {
      firstName: null,
      lastName: null,
      handle: null,
      displayName: '',
      bio: null,
      uiLocale: 'en',
      instructionLocales: [],
      timezone: 'UTC',
      contactEmail: null,
      contactPhone: null,
      hourlyRate: null,
      currency: null,
    },
  });

  const isDirty = form.formState.isDirty;
  useEffect(() => {
    unsavedChanges?.setDirty(isDirty);
    return () => unsavedChanges?.setDirty(false);
  }, [isDirty, unsavedChanges]);

  useEffect(() => {
    if (!profile) return;
    if (isPrivateTutor && tutorLoading) return;

    const storedTimezone = profile.timezone;
    const timezone =
      !storedTimezone || storedTimezone === 'UTC' ? getBrowserTimezone() : storedTimezone;

    form.reset({
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      handle: profile.handle ?? null,
      displayName: profile.displayName,
      bio: profile.bio ?? null,
      uiLocale: (LOCALES.includes(profile.uiLocale as (typeof LOCALES)[number])
        ? profile.uiLocale
        : 'en') as ProfileSettingsInput['uiLocale'],
      instructionLocales: (profile.instructionLocales ?? []).filter(
        (l): l is (typeof LOCALES)[number] => LOCALES.includes(l as (typeof LOCALES)[number]),
      ),
      timezone,
      contactEmail: profile.contactEmail ?? null,
      contactPhone: profile.contactPhone ?? null,
      hourlyRate: tutor?.hourlyRate ?? null,
      currency: tutor?.currency ?? null,
    });
  }, [profile, tutor, isPrivateTutor, tutorLoading, form]);

  function handleSave(data: ProfileSettingsInput) {
    const savedProfile = profile;
    startTransition(async () => {
      const { hourlyRate, currency, ...profileData } = data;

      const profileResult = await updateProfileAction(profileData);
      if (!profileResult.ok) {
        if (savedProfile) {
          form.reset({
            firstName: savedProfile.firstName ?? null,
            lastName: savedProfile.lastName ?? null,
            handle: savedProfile.handle ?? null,
            displayName: savedProfile.displayName,
            bio: savedProfile.bio ?? null,
            uiLocale: savedProfile.uiLocale as ProfileSettingsInput['uiLocale'],
            instructionLocales:
              (savedProfile.instructionLocales ?? []) as ProfileSettingsInput['instructionLocales'],
            timezone: savedProfile.timezone ?? 'UTC',
            contactEmail: savedProfile.contactEmail ?? null,
            contactPhone: savedProfile.contactPhone ?? null,
            hourlyRate: tutor?.hourlyRate ?? null,
            currency: tutor?.currency ?? null,
          });
        }
        toast.error(tErrors(profileResult.error.code));
        return;
      }

      if (isPrivateTutor) {
        try {
          await updateTutor.mutateAsync({
            hourlyRate: hourlyRate ?? undefined,
            currency: currency ?? undefined,
          });
        } catch {
          toast.error(tErrors('unknown'));
          return;
        }
      }

      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      if (isPrivateTutor) {
        await queryClient.invalidateQueries({ queryKey: profileKeys.tutorMe() });
      }
      toast.success(t('saveSuccess'));
    });
  }

  return (
    <ProfileSettingsFormContext.Provider value={{ form, isPending, isLoading }}>
      <form
        onSubmit={form.handleSubmit(handleSave)}
        noValidate
        data-profile-form
        className="min-h-full flex flex-col"
      >
        {children}
      </form>
    </ProfileSettingsFormContext.Provider>
  );
}

export function useProfileSettingsForm() {
  const ctx = useContext(ProfileSettingsFormContext);
  if (!ctx) throw new Error('useProfileSettingsForm must be used inside ProfileSettingsFormProvider');
  return ctx;
}
