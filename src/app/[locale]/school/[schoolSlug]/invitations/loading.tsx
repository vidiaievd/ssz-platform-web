import { Skeleton } from '@/components/ui/skeleton';

export default function InvitationsLoading() {
  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded-md" />
        <Skeleton className="h-4 w-36 rounded-md" />
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-1 border-b pb-px">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-t-md" />
        ))}
      </div>
      {/* Rows skeleton */}
      <div className="space-y-2" aria-label="Loading invitations">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    </main>
  );
}
