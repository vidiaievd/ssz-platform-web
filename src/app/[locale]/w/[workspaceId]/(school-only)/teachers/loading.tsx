export default function TeachersLoading() {
  return (
    <div className="p-6 space-y-4">
      {/* KPI row skeleton */}
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-[1.55fr_1fr] gap-4">
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-3">
          <div className="h-44 rounded-xl bg-muted animate-pulse" />
          <div className="h-44 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
