import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { ProfileSettingsScreen } from '@/features/profile/components/profile-settings-screen';

export default async function AccountProfilePage() {
  const user = await getCurrentUser();
  const isPrivateTutor = user?.roles.includes('tutor') ?? false;

  return <ProfileSettingsScreen isPrivateTutor={isPrivateTutor} />;
}
