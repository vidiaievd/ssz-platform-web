import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getCoverQueue } from "@/features/teachers/api/queries";
import { SubstituteConsoleClient } from "@/features/teachers/components/substitutions/substitute-console-client";

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function SubstitutionsPage({ params }: Props) {
  const { schoolSlug } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">School not found.</p>
      </main>
    );
  }

  const queueResult = await getCoverQueue(school.id);
  const requests = "status" in queueResult ? [] : queueResult;

  return (
    <SubstituteConsoleClient
      schoolId={school.id}
      initialRequests={requests}
    />
  );
}
