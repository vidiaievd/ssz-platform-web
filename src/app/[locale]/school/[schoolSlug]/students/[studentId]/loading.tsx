import { Skeleton } from "@/components/ui/skeleton";

export default function StudentDetailLoading() {
  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-5">
      {/* Back link */}
      <Skeleton className="h-5 w-32" />

      {/* Header card */}
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
        <Skeleton className="h-9 w-9 rounded-md shrink-0" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1">
        {[80, 70, 90, 60, 80, 70].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-md" style={{ width: w }} />
        ))}
      </div>

      {/* Content area */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-7 w-7 rounded shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
