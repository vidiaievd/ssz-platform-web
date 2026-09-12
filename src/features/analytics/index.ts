// The analytics visual layer — plan 58, phase 6.
//
// Deliberately free of any import from `features/groups` or `features/school`: the same
// components are reused by the tutor contour (plan 59), which has no school at all. A
// test in this folder enforces it.

export { PaDefs } from './components/pa-defs';
export { HeatCell } from './components/heat-cell';
export type { HeatCellData, HeatCellProps } from './components/heat-cell';
export { ZeroLegend, Swatch } from './components/zero-legend';
export type { LegendItem, LegendKey } from './components/zero-legend';
export { SkillGrid } from './components/skill-grid';
export { DeliveredAbsorbed } from './components/delivered-absorbed';
export type {
  ChartUnit,
  ChartDelivered,
  ChartAbsorbed,
  DeliveredAbsorbedProps,
} from './components/delivered-absorbed';
export { DualBar } from './components/dual-bar';
export { Stat } from './components/stat';
export type { StatTone } from './components/stat';
export { Note } from './components/note';
export { ramp, rampInk, HATCH, HATCH_WARN, PA } from './lib/ramp';
