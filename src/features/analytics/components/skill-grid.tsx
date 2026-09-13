import { Fragment, type ReactNode } from 'react';

export interface SkillGridProps<TCell> {
  skills: readonly string[];
  foci: readonly string[];
  cell: (skill: string, focus: string) => TCell;
  renderCell: (cell: TCell, skill: string, focus: string) => ReactNode;
  colLabel?: (focus: string) => string;
  rowLabel?: (skill: string) => string;
  /** Named out loud. Without it the grid is announced as a table of nothing in particular. */
  label?: string;
}

/**
 * The `skill × focus` grid, shared by the learner's profile and the course's result.
 *
 * The cell itself is rendered by the caller, because the two screens mean different
 * things by one: on the learner's it is "how are you doing at this", on the course's it
 * is "what came of teaching this". The frame — which rows, which columns, in which order,
 * and never a missing one — is the same, and that is what lives here.
 */
export function SkillGrid<TCell>({
  skills,
  foci,
  cell,
  renderCell,
  colLabel,
  rowLabel,
  label,
}: SkillGridProps<TCell>) {
  return (
    <div className="overflow-x-auto">
      <div
        role="grid"
        aria-label={label}
        className="grid min-w-[520px] gap-1.5"
        style={{ gridTemplateColumns: `104px repeat(${foci.length}, minmax(78px, 1fr))` }}
      >
        {/* `display: contents` on the rows: the cells stay direct children of the CSS
            grid, which is what lays them out, while a screen reader is given the rows
            and headers a table needs to be read at all. */}
        <div role="row" className="contents">
          <div role="columnheader" />
          {foci.map((focus) => (
            <div
              key={focus}
              role="columnheader"
              className="pb-0.5 text-center text-[11px] font-bold text-(--ssz-text-secondary) capitalize"
            >
              {colLabel ? colLabel(focus) : focus}
            </div>
          ))}
        </div>

        {skills.map((skill) => (
          <div role="row" className="contents" key={skill}>
            <div
              role="rowheader"
              className="flex items-center text-[12.5px] font-bold text-(--ssz-text-primary) capitalize"
            >
              {rowLabel ? rowLabel(skill) : skill}
            </div>
            {foci.map((focus) => (
              <Fragment key={focus}>{renderCell(cell(skill, focus), skill, focus)}</Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
