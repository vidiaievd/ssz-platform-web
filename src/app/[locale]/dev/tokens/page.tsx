'use client';

import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/shared/theme-toggle';
import { env } from '@/lib/env';

/* Reads a CSS custom property from :root at runtime */
function useToken(name: string) {
  const [value, setValue] = useState('');
  useEffect(() => {
    void (async () => {
      setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    })();
  }, [name]);
  return value;
}

function TokenRow({ name, label }: { name: string; label?: string }) {
  const value = useToken(name);
  const isColor = name.includes('color') || name.includes('bg') || name.includes('border') || name.includes('text') || name.includes('shadow') || name.includes('ring') || name.includes('interactive') || name.includes('focus');

  return (
    <tr className="border-b border-(--ssz-border-default) text-sm">
      <td className="py-2 pr-4 font-mono text-xs text-(--ssz-text-secondary)">{name}</td>
      <td className="py-2 pr-4 text-xs text-(--ssz-text-muted)">{label}</td>
      <td className="py-2 pr-4 font-mono text-xs text-(--ssz-text-primary)">{value || '—'}</td>
      {isColor && (
        <td className="py-2">
          <div
            className="h-6 w-12 rounded"
            style={{ background: `var(${name})`, border: '1px solid var(--ssz-border-default)' }}
          />
        </td>
      )}
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-base font-semibold text-(--ssz-text-primary)">{title}</h2>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-(--ssz-border-strong) text-xs text-(--ssz-text-muted)">
            <th className="pb-1 pr-4 font-medium">Token</th>
            <th className="pb-1 pr-4 font-medium">Description</th>
            <th className="pb-1 pr-4 font-medium">Value</th>
            <th className="pb-1 font-medium">Swatch</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

export default function TokensPage() {
  if (!env.NEXT_PUBLIC_ENABLE_DEV_ROUTES) notFound();

  return (
    <main
      className="min-h-screen px-8 py-10"
      style={{ background: 'var(--ssz-bg-base)', color: 'var(--ssz-text-primary)' }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SSZ Design Tokens</h1>
            <p className="mt-1 text-sm text-(--ssz-text-muted)">
              Verify token values resolve correctly in both themes. Toggle theme to check dark mode.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Section title="Backgrounds">
          <TokenRow name="--ssz-bg-base" label="Page background" />
          <TokenRow name="--ssz-bg-surface" label="Card / panel surface" />
          <TokenRow name="--ssz-bg-subtle" label="Subtle fill" />
          <TokenRow name="--ssz-bg-muted" label="Muted fill" />
          <TokenRow name="--ssz-bg-overlay" label="Modal overlay" />
        </Section>

        <Section title="Text">
          <TokenRow name="--ssz-text-primary" label="Primary text" />
          <TokenRow name="--ssz-text-secondary" label="Secondary text" />
          <TokenRow name="--ssz-text-muted" label="Muted / placeholder" />
          <TokenRow name="--ssz-text-inverse" label="On dark surfaces" />
          <TokenRow name="--ssz-text-link" label="Link" />
          <TokenRow name="--ssz-text-link-hover" label="Link hover" />
        </Section>

        <Section title="Borders">
          <TokenRow name="--ssz-border-default" label="Default border" />
          <TokenRow name="--ssz-border-strong" label="Strong border" />
          <TokenRow name="--ssz-border-focus" label="Focus border" />
        </Section>

        <Section title="Interactive">
          <TokenRow name="--ssz-interactive-primary" label="Primary action" />
          <TokenRow name="--ssz-interactive-primary-hover" label="Primary hover" />
          <TokenRow name="--ssz-interactive-primary-active" label="Primary active" />
          <TokenRow name="--ssz-focus-ring" label="Focus ring shadow" />
        </Section>

        <Section title="Primary palette">
          {['50','100','200','300','400','500','600','700','800','900'].map(n => (
            <TokenRow key={n} name={`--ssz-color-primary-${n}`} label={`Primary ${n}`} />
          ))}
        </Section>

        <Section title="Secondary palette">
          {['50','100','200','300','400','500','600','700','800','900'].map(n => (
            <TokenRow key={n} name={`--ssz-color-secondary-${n}`} label={`Secondary ${n}`} />
          ))}
        </Section>

        <Section title="Neutral palette">
          {['0','50','100','200','300','400','500','600','700','800','900'].map(n => (
            <TokenRow key={n} name={`--ssz-color-neutral-${n}`} label={`Neutral ${n}`} />
          ))}
        </Section>

        <Section title="Semantic colors">
          {(['success','warning','error','info'] as const).map(s =>
            ['50','100','300','500','700'].map(n => (
              <TokenRow key={`${s}-${n}`} name={`--ssz-color-${s}-${n}`} label={`${s} ${n}`} />
            ))
          )}
        </Section>

        <Section title="Shadows">
          <TokenRow name="--ssz-shadow-xs" label="Micro elevation" />
          <TokenRow name="--ssz-shadow-sm" label="Card elevation" />
          <TokenRow name="--ssz-shadow-md" label="Dropdown elevation" />
          <TokenRow name="--ssz-shadow-lg" label="Modal elevation" />
          <TokenRow name="--ssz-shadow-xl" label="Overlay elevation" />
        </Section>

        <Section title="Radius">
          <TokenRow name="--ssz-radius-xs" label="4px" />
          <TokenRow name="--ssz-radius-sm" label="6px" />
          <TokenRow name="--ssz-radius-md" label="10px" />
          <TokenRow name="--ssz-radius-lg" label="16px" />
          <TokenRow name="--ssz-radius-xl" label="24px" />
          <TokenRow name="--ssz-radius-2xl" label="32px" />
          <TokenRow name="--ssz-radius-full" label="9999px" />
        </Section>

        <Section title="Spacing (8pt system)">
          {[1,2,3,4,5,6,8,10,12,16,20,24,32].map(n => (
            <TokenRow key={n} name={`--ssz-space-${n}`} label={`${n * 4}px`} />
          ))}
        </Section>

        <Section title="Motion">
          <TokenRow name="--ssz-duration-fast" label="100ms" />
          <TokenRow name="--ssz-duration-base" label="180ms" />
          <TokenRow name="--ssz-duration-slow" label="280ms" />
          <TokenRow name="--ssz-duration-slower" label="400ms" />
          <TokenRow name="--ssz-ease-out" label="Snap out" />
          <TokenRow name="--ssz-ease-in" label="Ease in" />
          <TokenRow name="--ssz-ease-inout" label="Standard ease" />
          <TokenRow name="--ssz-ease-spring" label="Spring overshoot" />
        </Section>

        <Section title="Typography">
          <TokenRow name="--ssz-font-ui" label="UI typeface" />
          <TokenRow name="--ssz-font-reading" label="Content/reading typeface" />
          <TokenRow name="--ssz-font-mono" label="Mono / IPA typeface" />
          {['xs','sm','base','lg','xl','2xl','3xl','4xl','5xl'].map(s => (
            <TokenRow key={s} name={`--ssz-text-${s}`} label={`Font size ${s}`} />
          ))}
        </Section>

        <div className="mt-16 border-t border-(--ssz-border-default) pt-6 text-xs text-(--ssz-text-muted)">
          <p>
            <strong>prefers-reduced-motion:</strong> when active, all transitions collapse to 0.01ms.
            This page is dev-only ({`NEXT_PUBLIC_ENABLE_DEV_ROUTES=true`}).
          </p>
        </div>
      </div>
    </main>
  );
}
