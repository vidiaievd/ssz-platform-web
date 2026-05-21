import { Skeleton } from '@/components/ui/skeleton';

export default function SchoolSettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="space-y-3 max-w-xl">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    </div>
  );
}
