import { MarketingNav } from '@/components/shared/marketing-nav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-(--ssz-bg-base)">
      <MarketingNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
