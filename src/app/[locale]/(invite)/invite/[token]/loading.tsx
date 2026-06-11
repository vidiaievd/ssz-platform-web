export default function InviteLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-hidden>
      {/* Title block */}
      <div className="flex flex-col items-center gap-2">
        <div className="h-7 w-56 rounded bg-(--ssz-bg-subtle)" />
        <div className="h-4 w-28 rounded bg-(--ssz-bg-subtle)" />
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-surface px-5 py-4 flex flex-col gap-3">
        <div className="h-4 w-48 rounded bg-(--ssz-bg-subtle)" />
        <div className="h-4 w-40 rounded bg-(--ssz-bg-subtle)" />
        <div className="h-4 w-32 rounded bg-(--ssz-bg-subtle)" />
      </div>

      {/* CTA button */}
      <div className="h-10 w-full rounded-lg bg-(--ssz-bg-subtle)" />
    </div>
  );
}
