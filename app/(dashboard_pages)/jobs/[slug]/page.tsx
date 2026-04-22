import { notFound } from "next/navigation";
import { JobDetailScreen } from "@/components/dashboard/jobs-management";
import { getJobBySlug } from "@/lib/operations-data";

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = getJobBySlug(slug);

  if (!job) {
    notFound();
  }

  return <JobDetailScreen job={job} />;
}
