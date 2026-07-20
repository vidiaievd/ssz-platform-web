import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface TextLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/** Inline "View all →" style action button, used as HSection's trailing action. */
export function TextLink({ children, className, ...props }: TextLinkProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm',
        'text-[13.5px] font-semibold text-(--ssz-text-link) transition-colors duration-fast',
        'hover:text-(--ssz-text-link-hover)',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}
