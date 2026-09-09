import { Skeleton } from '@/components/ui/skeleton';

export default function GroupsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-page mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Table header */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 flex items-center gap-4 border-b border-border">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-24 ml-auto" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
        </div>

        {/* Table rows */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0"
          >
            {/* Group name + lang badge */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Skeleton className="size-8 rounded-md shrink-0" />
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>

            {/* Teacher */}
            <div className="hidden sm:flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
            </div>

            {/* Schedule summary */}
            <Skeleton className="hidden md:block h-3.5 w-28" />

            {/* Capacity bar */}
            <div className="hidden lg:block space-y-1 w-24">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>

            {/* Alert chips */}
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Action button */}
            <Skeleton className="size-8 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
