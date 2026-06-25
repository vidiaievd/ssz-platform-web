import { Skeleton } from '@/components/ui/skeleton';

export default function SchoolDetailLoading() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </main>
  );
}
