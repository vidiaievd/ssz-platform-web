import { AssignmentDetail } from '@/features/student/assignments/assignment-detail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssignmentDetailPage({ params }: Props) {
  const { id } = await params;
  return <AssignmentDetail assignmentId={id} />;
}
