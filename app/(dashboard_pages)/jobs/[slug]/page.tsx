import { JobDetailScreen } from "@/components/dashboard/jobs-management";

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <JobDetailScreen slug={slug} />;
}
