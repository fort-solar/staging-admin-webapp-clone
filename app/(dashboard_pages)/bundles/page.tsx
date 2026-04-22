import { Suspense } from "react";
import { BundlesManagementScreen } from "@/components/dashboard/bundles-management";

export default function BundlesPage() {
  return (
    <Suspense fallback={null}>
      <BundlesManagementScreen />
    </Suspense>
  );
}
