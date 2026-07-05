import Account from '../../../messages/en/Account.json';
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
import Media from '../../../messages/en/Media.json';
import Nav from '../../../messages/en/Nav.json';
import Notifications from '../../../messages/en/Notifications.json';
import Onboarding from '../../../messages/en/Onboarding.json';
import Placement from '../../../messages/en/Placement.json';
import Profile from '../../../messages/en/Profile.json';
import Progress from '../../../messages/en/Progress.json';
import PublicSchool from '../../../messages/en/PublicSchool.json';
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
  Media,
  Nav,
  Notifications,
  Onboarding,
  Placement,
  Profile,
  Progress,
  PublicSchool,
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
  'Media',
  'Nav',
  'Notifications',
  'Onboarding',
  'Placement',
  'Profile',
  'Progress',
  'PublicSchool',
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
  return Object.fromEntries(
    NAMESPACES.map((ns, i) => [ns, results[i].default]),
  ) as Messages;
}
