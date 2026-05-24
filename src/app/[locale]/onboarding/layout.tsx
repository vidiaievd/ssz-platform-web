import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-(--ssz-bg-base)">
      <header className="flex items-center justify-between px-4 py-3 border-b border-(--ssz-border-base)">
        <span className="text-sm font-semibold text-(--ssz-text-primary) md:hidden">SSZ</span>
        <span className="hidden md:block text-sm font-semibold text-(--ssz-text-primary) mx-auto">SSZ</span>
        <div className="flex items-center gap-1 md:absolute md:right-4 md:top-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <div className="md:px-4">{children}</div>
    </div>
  );
}
