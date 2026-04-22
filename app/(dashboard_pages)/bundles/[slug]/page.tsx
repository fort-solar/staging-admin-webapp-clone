import { notFound } from "next/navigation";
import { BundleDetailScreen } from "@/components/dashboard/bundles-management";
import { getBundleBySlug } from "@/lib/management-data";

export default async function BundleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = getBundleBySlug(slug);

  if (!bundle) {
    notFound();
  }

  return <BundleDetailScreen bundle={bundle} />;
}
