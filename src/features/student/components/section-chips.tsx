/** Four fixed section chips shown on every syllabus module row. */
import { BookOpen, AlignLeft, PenLine, Target } from 'lucide-react';

const SECTIONS = [
  { key: 'read',     Icon: BookOpen,    label: 'Read / Listen' },
  { key: 'vocab',    Icon: AlignLeft,   label: 'Vocabulary' },
  { key: 'grammar',  Icon: PenLine,     label: 'Grammar' },
  { key: 'practice', Icon: Target,      label: 'Practice' },
] as const;

export function SectionChips({ dim = false }: { dim?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginTop: 8,
        opacity: dim ? 0.5 : 1,
      }}
    >
      {SECTIONS.map(({ key, Icon, label }) => (
        <span
          key={key}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--ssz-text-secondary)',
            background: 'var(--ssz-bg-subtle)',
            padding: '4px 9px',
            borderRadius: 7,
          }}
        >
          <Icon size={12} color="var(--ssz-text-muted)" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}
