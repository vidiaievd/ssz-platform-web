import { Skeleton } from '@/components/ui/skeleton';

export default function StudentAccountSettingsPage() {
  return (
    <div className="p-6 md:p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="space-y-3 max-w-xl">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
