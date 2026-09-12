import Account from '../../../messages/en/Account.json';
import Analytics from '../../../messages/en/Analytics.json';
import Assignments from '../../../messages/en/Assignments.json';
import Auth from '../../../messages/en/Auth.json';
import Authoring from '../../../messages/en/Authoring.json';
import Catalog from '../../../messages/en/Catalog.json';
import Common from '../../../messages/en/Common.json';
import Content from '../../../messages/en/Content.json';
import Discovery from '../../../messages/en/Discovery.json';
import Enrollment from '../../../messages/en/Enrollment.json';
import EnrollmentRequired from '../../../messages/en/EnrollmentRequired.json';
import Errors from '../../../messages/en/Errors.json';
import Exercise from '../../../messages/en/Exercise.json';
import ExerciseRunner from '../../../messages/en/ExerciseRunner.json';
import Groups from '../../../messages/en/Groups.json';
import Home from '../../../messages/en/Home.json';
import Invitations from '../../../messages/en/Invitations.json';
import Invite from '../../../messages/en/Invite.json';
import LanguageSwitcher from '../../../messages/en/LanguageSwitcher.json';
import Learning from '../../../messages/en/Learning.json';
import Marketing from '../../../messages/en/Marketing.json';
import Mastery from '../../../messages/en/Mastery.json';
import Media from '../../../messages/en/Media.json';
import Nav from '../../../messages/en/Nav.json';
import Notifications from '../../../messages/en/Notifications.json';
import Onboarding from '../../../messages/en/Onboarding.json';
import Placement from '../../../messages/en/Placement.json';
import Profile from '../../../messages/en/Profile.json';
import PublicSchool from '../../../messages/en/PublicSchool.json';
import Review from '../../../messages/en/Review.json';
import RouteTitles from '../../../messages/en/RouteTitles.json';
import Scheduling from '../../../messages/en/Scheduling.json';
import School from '../../../messages/en/School.json';
import Settings from '../../../messages/en/Settings.json';
import Srs from '../../../messages/en/Srs.json';
import Student from '../../../messages/en/Student.json';
import Students from '../../../messages/en/Students.json';
import TeacherPending from '../../../messages/en/TeacherPending.json';
import Teachers from '../../../messages/en/Teachers.json';
import Theme from '../../../messages/en/Theme.json';
import Topbar from '../../../messages/en/Topbar.json';
import Tutor from '../../../messages/en/Tutor.json';
import UserMenu from '../../../messages/en/UserMenu.json';
import WorkspaceSwitcher from '../../../messages/en/WorkspaceSwitcher.json';

export const enMessages = {
  Account,
  Analytics,
  Assignments,
  Auth,
  Authoring,
  Catalog,
  Common,
  Content,
  Discovery,
  Enrollment,
  EnrollmentRequired,
  Errors,
  Exercise,
  ExerciseRunner,
  Groups,
  Home,
  Invitations,
  Invite,
  LanguageSwitcher,
  Learning,
  Marketing,
  Mastery,
  Media,
  Nav,
  Notifications,
  Onboarding,
  Placement,
  Profile,
  PublicSchool,
  Review,
  RouteTitles,
  Scheduling,
  School,
  Settings,
  Srs,
  Student,
  Students,
  TeacherPending,
  Teachers,
  Theme,
  Topbar,
  Tutor,
  UserMenu,
  WorkspaceSwitcher,
} as const;

export type Messages = typeof enMessages;

export const NAMESPACES = [
  'Account',
  'Analytics',
  'Assignments',
  'Auth',
  'Authoring',
  'Catalog',
  'Common',
  'Content',
  'Discovery',
  'Enrollment',
  'EnrollmentRequired',
  'Errors',
  'Exercise',
  'ExerciseRunner',
  'Groups',
  'Home',
  'Invitations',
  'Invite',
  'LanguageSwitcher',
  'Learning',
  'Marketing',
  'Mastery',
  'Media',
  'Nav',
  'Notifications',
  'Onboarding',
  'Placement',
  'Profile',
  'PublicSchool',
  'Review',
  'RouteTitles',
  'Scheduling',
  'School',
  'Settings',
  'Srs',
  'Student',
  'Students',
  'TeacherPending',
  'Teachers',
  'Theme',
  'Topbar',
  'Tutor',
  'UserMenu',
  'WorkspaceSwitcher',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export async function loadMessages(locale: string): Promise<Messages> {
  const results = await Promise.all(
    NAMESPACES.map((ns) => import(`../../../messages/${locale}/${ns}.json`)),
  );
  return Object.fromEntries(NAMESPACES.map((ns, i) => [ns, results[i].default])) as Messages;
}

// ---------------------------------------------------------------------------
// Per-surface namespace sets
// Used by layout files to scope NextIntlClientProvider to only the namespaces
// a given route segment actually needs on the client side.
//
// Every provider receives GLOBAL_NAMESPACES + its own surface set.
// Nested providers replace (not merge) the parent context — so each layout
// must include global names even if the parent already has them.
// ---------------------------------------------------------------------------

/** Namespaces required on every surface (shared components, data-state, nav). */
export const GLOBAL_NAMESPACES = [
  'Common',
  'Errors',
  'Theme',
  'Nav',
  'Topbar',
  'LanguageSwitcher',
  'UserMenu',
] as const satisfies readonly Namespace[];

export const MARKETING_NAMESPACES = [
  'Home',
  'Marketing',
  'Discovery',
  'Enrollment',
  'PublicSchool',
] as const satisfies readonly Namespace[];

export const AUTH_NAMESPACES = ['Auth'] as const satisfies readonly Namespace[];

export const INVITE_NAMESPACES = [
  'Invite',
  'Invitations',
  'Auth',
] as const satisfies readonly Namespace[];

export const STUDENT_NAMESPACES = [
  'Student',
  // The learner's half of the review system (plan 47): "Мои работы" reads the same
  // namespace the teacher's inbox does, because it is one subsystem saying one thing.
  'Review',
  'Learning',
  'Srs',
  'Exercise',
  'ExerciseRunner',
  'Placement',
  'Catalog',
  'Assignments',
  'Content',
  'Enrollment',
  'EnrollmentRequired',
  'Discovery',
  'Notifications',
  'Profile',
  'PublicSchool',
  'Settings',
  'WorkspaceSwitcher',
] as const satisfies readonly Namespace[];

export const SCHOOL_NAMESPACES = [
  'School',
  'Groups',
  // The progress surfaces of plan 58 — the group's chart, the learner's grid and the
  // course's result all speak one vocabulary of cell states, so it lives in one
  // namespace rather than being restated in three.
  'Analytics',
  'Students',
  'Teachers',
  'Scheduling',
  'Invitations',
  'Invite',
  'Authoring',
  'Content',
  'Review',
  // The lesson editor previews reuse the student reader's components
  // (GlossaryParagraph, AudioPlayer, VideoPlayer), which translate against
  // `Learning.glossary`, `Learning.audio` and `Learning.reader.video.player`.
  'Learning',
  // The gap-fill builder previews the real runner body, which translates against
  // `ExerciseRunner` — the preview is the student's component, not a copy of it.
  'ExerciseRunner',
  'Media',
  'Notifications',
  'Profile',
  'Settings',
  'Tutor',
  'TeacherPending',
  'WorkspaceSwitcher',
  'Enrollment',
] as const satisfies readonly Namespace[];

export const ACCOUNT_NAMESPACES = [
  'Account',
  'Profile',
  'Settings',
] as const satisfies readonly Namespace[];

export const ONBOARDING_NAMESPACES = [
  'Onboarding',
  'Profile',
  'Enrollment',
  'Placement',
] as const satisfies readonly Namespace[];

export const PUBLIC_SCHOOL_NAMESPACES = [
  'PublicSchool',
  'Enrollment',
  'Discovery',
  'Catalog',
  'Auth',
] as const satisfies readonly Namespace[];
