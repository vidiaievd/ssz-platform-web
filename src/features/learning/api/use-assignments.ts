'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  Assignment,
  AssignmentListResponse,
  GradedSubmitRequest,
  GradedSubmitResponse,
  WrittenSubmitRequest,
} from '../types';
import { learningKeys } from './keys';

export function useAssignments(courseId?: string) {
  return useQuery<AssignmentListResponse>({
    queryKey: learningKeys.assignments(courseId),
    queryFn: async () => {
      const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
      const res = await fetch(`/api/learning/assignments${query}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch assignments');
      return res.json() as Promise<AssignmentListResponse>;
    },
    staleTime: 60_000,
  });
}

export function useAssignment(id: string) {
  return useQuery<Assignment>({
    queryKey: learningKeys.assignment(id),
    queryFn: async () => {
      const res = await fetch(`/api/learning/assignments/${id}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (res.status === 404) throw new Error('Assignment not found');
      if (!res.ok) throw new Error('Failed to fetch assignment');
      return res.json() as Promise<Assignment>;
    },
    staleTime: 60_000,
  });
}

export function useSubmitGradedAssignment(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation<GradedSubmitResponse, Error, GradedSubmitRequest>({
    mutationFn: async (body) => {
      const res = await fetch(`/api/learning/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) throw new Error('Already submitted');
      if (!res.ok) throw new Error('Failed to submit assignment');
      return res.json() as Promise<GradedSubmitResponse>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: learningKeys.assignment(assignmentId) });
      void qc.invalidateQueries({ queryKey: learningKeys.assignments() });
    },
  });
}

export function useSubmitWrittenAssignment(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, WrittenSubmitRequest>({
    mutationFn: async (body) => {
      const res = await fetch(`/api/learning/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) throw new Error('Already submitted');
      if (!res.ok) throw new Error('Failed to submit assignment');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: learningKeys.assignment(assignmentId) });
      void qc.invalidateQueries({ queryKey: learningKeys.assignments() });
    },
  });
}

export function useSaveWrittenDraft(assignmentId: string) {
  return useMutation<void, Error, { text: string }>({
    mutationFn: async ({ text }) => {
      const res = await fetch(`/api/learning/assignments/${assignmentId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Failed to save draft');
    },
  });
}
