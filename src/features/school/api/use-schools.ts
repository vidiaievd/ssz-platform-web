'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateSchoolBody,
  Invitation,
  InviteMemberBody,
  NameAvailabilityResponse,
  SlugAvailabilityResponse,
  School,
} from '../types';
import { schoolKeys } from './keys';

// ── My schools ────────────────────────────────────────────────────────────────

export function useMySchools() {
  return useQuery({
    queryKey: schoolKeys.mine(),
    queryFn: async () => {
      const res = await fetch('/api/schools');
      if (!res.ok) throw new Error('Failed to fetch schools');
      const data = (await res.json()) as School[] | { items: School[] };
      return Array.isArray(data) ? data : (data.items ?? []);
    },
  });
}

// ── School detail ─────────────────────────────────────────────────────────────

export function useSchool(id: string) {
  return useQuery({
    queryKey: schoolKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/schools/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch school');
      return (await res.json()) as School;
    },
    enabled: Boolean(id),
  });
}

// ── Name availability ─────────────────────────────────────────────────────────

export function useNameAvailability(name: string) {
  const trimmed = name.trim();
  return useQuery({
    queryKey: schoolKeys.nameAvailable(trimmed),
    queryFn: async () => {
      const res = await fetch(`/api/schools/name-available?name=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error('Name check failed');
      return (await res.json()) as NameAvailabilityResponse;
    },
    enabled: trimmed.length >= 3,
    staleTime: 30_000,
    retry: false,
  });
}

// ── Slug availability ─────────────────────────────────────────────────────────

export function useSlugAvailability(slug: string) {
  const trimmed = slug.trim();
  return useQuery({
    queryKey: schoolKeys.slugAvailable(trimmed),
    queryFn: async () => {
      const res = await fetch(`/api/schools/slug-available?slug=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error('Slug check failed');
      return (await res.json()) as SlugAvailabilityResponse;
    },
    enabled: trimmed.length >= 3,
    staleTime: 30_000,
    retry: false,
  });
}

// ── Create school ─────────────────────────────────────────────────────────────

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      idempotencyKey,
    }: {
      body: CreateSchoolBody;
      idempotencyKey: string;
    }) => {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(err.error ?? 'Failed to create school'), {
          status: res.status,
        });
      }
      return (await res.json()) as School;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolKeys.mine() });
    },
  });
}

// ── Update school ─────────────────────────────────────────────────────────────

export function useUpdateSchool(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<CreateSchoolBody>) => {
      const res = await fetch(`/api/schools/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(err.error ?? 'Failed to update school'), {
          status: res.status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: schoolKeys.mine() });
    },
  });
}

// ── Pending invitations (for resume hydration) ────────────────────────────────

export function usePendingInvitations(schoolId: string) {
  return useQuery({
    queryKey: schoolKeys.invitations(schoolId),
    queryFn: async () => {
      const res = await fetch(`/api/schools/${schoolId}/invitations`);
      if (!res.ok) throw new Error('Failed to fetch invitations');
      const data = (await res.json()) as Invitation[] | { items: Invitation[] };
      const all = Array.isArray(data) ? data : (data.items ?? []);
      return all.filter((inv) => inv.status === 'pending');
    },
    enabled: Boolean(schoolId),
  });
}

// ── Invite member ─────────────────────────────────────────────────────────────

export function useInviteMember(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: InviteMemberBody) => {
      const res = await fetch(`/api/schools/${schoolId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(err.error ?? 'Failed to send invitation'), {
          status: res.status,
        });
      }
      return (await res.json()) as Invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolKeys.invitations(schoolId) });
    },
  });
}

// ── Accept invitation ─────────────────────────────────────────────────────────

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch(`/api/schools/invitations/${token}/accept`, { method: 'POST' });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(err.error ?? 'Failed to accept invitation'), {
          status: res.status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolKeys.mine() });
    },
  });
}
