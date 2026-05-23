import { use } from "react";
import { BundleFormScreen } from "@/components/dashboard/bundles-management";

export default function EditPackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <BundleFormScreen packageId={slug} />;
}
