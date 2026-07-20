import {
  Bell,
  BookOpen,
  Calendar,
  Check,
  CircleCheck,
  ChevronRight,
  Clock,
  Coffee,
  Headphones,
  Home,
  Layers,
  Lock,
  MapPin,
  Mic,
  PenLine,
  Pencil,
  Play,
  Repeat,
  Search,
  Target,
  Type,
  User,
  Users,
  XCircle,
  Zap,
  BarChart3,
  Bolt,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps the icon names used in the design handoff (`docs/design/design_handoff_student_home/`)
 * to the Lucide icons already used across the codebase. The handoff ships its own inline
 * SVG icon set; this table is the single translation point so no new icon set is introduced.
 */
export const HANDOFF_ICON_MAP: Record<string, LucideIcon> = {
  // Nav (student/Student Home & Navigation.html `NAV`)
  home: Home,
  book: BookOpen,
  search: Search,
  zap: Zap,
  bell: Bell,
  chart: BarChart3,

  // Training / skill tiles (student/home-data.jsx, discover-data.jsx)
  pen: PenLine,
  text: Type,
  headphones: Headphones,
  pencil: Pencil,
  bookOpen: BookOpen,
  mic: Mic,
  repeat: Repeat,
  target: Target,
  layers: Layers,
  user: User,
  users: Users,
  bolt: Bolt,

  // Misc (student/shared.jsx, teacher/shared.jsx)
  coffee: Coffee,
  checkCircle: CircleCheck,
  xCircle: XCircle,
  check: Check,
  chevronR: ChevronRight,
  clock: Clock,
  lock: Lock,
  mapPin: MapPin,
  play: Play,
  calendar: Calendar,
};

export type HandoffIconName = keyof typeof HANDOFF_ICON_MAP;

export function getHandoffIcon(name: HandoffIconName): LucideIcon {
  // `noUncheckedIndexedAccess` widens this to `| undefined`, but `HandoffIconName`
  // is `keyof typeof HANDOFF_ICON_MAP`, so the lookup always hits.
  return HANDOFF_ICON_MAP[name]!;
}
