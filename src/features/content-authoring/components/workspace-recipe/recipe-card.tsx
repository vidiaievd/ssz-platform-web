'use client';

/** The card every section of the recipe page sits in — README «Карточка (общая)». */
export function RecipeCard({
  title,
  meta,
  sub,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-(--ssz-border-default) bg-(--ssz-bg-surface) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {meta && <span className="text-xs text-(--ssz-text-muted)">{meta}</span>}
      </div>
      {sub && <p className="-mt-2 text-xs text-(--ssz-text-secondary)">{sub}</p>}
      {children}
    </section>
  );
}
