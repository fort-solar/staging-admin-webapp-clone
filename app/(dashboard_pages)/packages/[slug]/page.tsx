import { use } from "react";
import { BundleDetailScreen } from "@/components/dashboard/bundles-management";

export default function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <BundleDetailScreen packageId={slug} />;
}
