import { langHue } from '@/features/student/lib/lang-hue';
import { cn } from '@/lib/utils';

export interface LangChipProps {
  langCode: string;
  level: string;
  size?: number;
  className?: string;
}

/** Compact language cover chip: hue-tinted square with a decorative stripe and the CEFR level. */
export function LangChip({ langCode, level, size = 48, className }: LangChipProps) {
  const hue = langHue(langCode);

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-md', className)}
      style={{
        width: size,
        height: size,
        background: hue.soft,
        border: `1px solid ${hue.c.replace(/\)$/, ' / 0.2)')}`,
      }}
    >
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0 block"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={size}
          x2={size}
          y2="0"
          stroke={hue.mid}
          strokeOpacity="0.25"
          strokeWidth="7"
        />
        <line
          x1={-size * 0.5}
          y1={size}
          x2={size * 0.5}
          y2="0"
          stroke={hue.mid}
          strokeOpacity="0.18"
          strokeWidth="7"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold"
        style={{ color: hue.deep }}
      >
        {level}
      </span>
    </div>
  );
}
