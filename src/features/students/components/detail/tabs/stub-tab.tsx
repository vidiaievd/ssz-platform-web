import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export function StubTab({ icon: Icon, title, body }: Props) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center rounded-xl border bg-card p-8">
        <Icon className="h-10 w-10 text-muted-foreground/40" aria-hidden />
        <p className="font-semibold text-[var(--ssz-text-primary)]">{title}</p>
        <p className="text-sm text-[var(--ssz-text-secondary)]">{body}</p>
      </div>
    </div>
  );
}
