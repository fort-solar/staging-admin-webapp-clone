import { Suspense } from "react";
import { BundlesManagementScreen } from "@/components/dashboard/bundles-management";

export default function PackagesPage() {
  return (
    <Suspense fallback={null}>
      <BundlesManagementScreen />
    </Suspense>
  );
}
